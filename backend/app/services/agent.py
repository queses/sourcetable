import asyncio
import json
import logging
from collections import OrderedDict
from textwrap import dedent
from typing import Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import update
import httpx
from openai import AsyncOpenAI

from app.models import Cell
from app.schemas import AgentStateEnum, ColumnTypeEnum
from app.config import get_settings

logger = logging.getLogger(__name__)

# Initialize OpenRouter client
openrouter_client = AsyncOpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=get_settings().openrouter_api_key,
)

# Initialize HTTP client for async requests
http_client = httpx.AsyncClient(timeout=10.0, follow_redirects=True)

# Async-safe LRU cache for webpage content
_webpage_cache: OrderedDict[str, str] = OrderedDict()
_cache_maxsize = 124
_cache_lock = asyncio.Lock()


async def fetch_webpage_content(url: str) -> str:
    """
    Fetch webpage HTML content with LRU caching (max 124 entries)

    Args:
        url: URL to fetch

    Returns:
        HTML content as string, or error message if fetch fails
    """
    # Ensure URL has a protocol prefix
    url = url.strip()
    if not url.startswith(("http://", "https://")):
        url = f"https://{url}"

    async with _cache_lock:
        # Check cache first
        if url in _webpage_cache:
            # Move to end (most recently used)
            _webpage_cache.move_to_end(url)
            return _webpage_cache[url]

    try:
        response = await http_client.get(url)
        response.raise_for_status()
        content = response.text

        async with _cache_lock:
            # Add to cache
            _webpage_cache[url] = content
            _webpage_cache.move_to_end(url)

            # Remove oldest entry if cache is full
            if len(_webpage_cache) > _cache_maxsize:
                _webpage_cache.popitem(last=False)

        return content
    except httpx.RequestError as e:
        logger.error(f"Error fetching webpage {url}: {e}")
        error_msg = f"Error fetching webpage: {str(e)}"
        return error_msg
    except httpx.HTTPStatusError as e:
        logger.error(f"HTTP error fetching webpage {url}: {e}")
        error_msg = f"HTTP error fetching webpage: {e.response.status_code}"
        return error_msg
    except Exception as e:
        logger.error(f"Unexpected error fetching webpage {url}: {e}")
        error_msg = f"Error fetching webpage: {str(e)}"
        return error_msg


def get_json_schema_for_type(column_type: ColumnTypeEnum) -> Dict[str, Any]:
    """
    Generate JSON schema for a given column type

    Args:
        column_type: Type of column (text, boolean, number)

    Returns:
        JSON schema dictionary
    """
    if column_type == ColumnTypeEnum.BOOLEAN:
        return {
            "type": "object",
            "properties": {"value": {"type": "boolean"}},
            "required": ["value"],
        }
    elif column_type == ColumnTypeEnum.NUMBER:
        return {
            "type": "object",
            "properties": {"value": {"type": "number"}},
            "required": ["value"],
        }
    # Default to text
    return {
        "type": "object",
        "properties": {"value": {"type": "string"}},
        "required": ["value"],
    }


def format_value_for_storage(value: Any, column_type: ColumnTypeEnum) -> str:
    """
    Convert LLM response value to string format for database storage

    Args:
        value: Value from LLM response
        column_type: Type of column

    Returns:
        String representation of the value
    """
    if column_type == ColumnTypeEnum.BOOLEAN:
        return "1" if value else "0"
    elif column_type == ColumnTypeEnum.NUMBER:
        return str(value)
    else:
        return str(value)


def build_llm_prompt(
    primary_column_name: str,
    primary_column_value: str,
    column_prompt: str,
    html_content: str,
) -> str:
    """
    Build prompt for LLM with guidelines and context

    Args:
        primary_column_name: Name of the primary column
        primary_column_value: Value of the primary column (URL)
        column_prompt: User's question/prompt for this column
        html_content: HTML content from the webpage

    Returns:
        Formatted prompt string
    """
    return dedent(
        f"""Extract ONE piece of information from the webpage content below.

        Question to answer: {column_prompt}

        Source webpage: {primary_column_value}

        Webpage HTML content:
        ```html
        {html_content[:50000]}
        ```

        IMPORTANT RULES:
        - Extract ONLY the specific information asked in the question above
        - If asked for "company name", return ONLY the company name (e.g., "Collectly"), nothing else
        - If asked for a number, return ONLY the number, nothing else
        - If asked for a yes/no question, return ONLY true or false
        - Do NOT include descriptions, explanations, additional details, or context
        - Do NOT include multiple pieces of information
        - Return the most concise answer possible

        Return your answer as JSON with a "value" field containing ONLY the extracted information."""
    )


class Agent:
    """Real AI agent that processes cells using OpenRouter API"""

    @staticmethod
    async def process_cell(
        cell_id: int,
        column_type: ColumnTypeEnum,
        primary_column_name: str,
        primary_column_value: str,
        column_prompt: str,
        db: AsyncSession,
    ) -> str:
        """
        Process a cell by fetching webpage content and using LLM to answer the prompt

        Args:
            cell_id: ID of the cell to process
            column_type: Type of column (text, boolean, number)
            primary_column_name: Name of the primary column
            primary_column_value: Value of the primary column (URL)
            column_prompt: User's question/prompt for this column
            db: Database session

        Returns:
            Generated value as string
        """
        # Update state to triggered
        await db.execute(
            update(Cell)
            .where(Cell.id == cell_id)
            .values(agent_state=AgentStateEnum.TRIGGERED.value)
        )
        await db.commit()

        try:
            # Fetch webpage HTML content
            html_content = await fetch_webpage_content(primary_column_value)

            # Build prompt
            prompt = build_llm_prompt(
                primary_column_name, primary_column_value, column_prompt, html_content
            )

            # Get JSON schema for the column type
            json_schema = get_json_schema_for_type(column_type)

            # Call OpenRouter API with two user messages for emphasis
            response = await openrouter_client.chat.completions.create(
                model=get_settings().openrouter_model,
                messages=[
                    {
                        "role": "system",
                        "content": f"You are a data extraction tool. Extract ONLY the specific information requested. Return valid JSON matching this schema: {json.dumps(json_schema)}. The 'value' field must contain ONLY the exact answer - no descriptions, no explanations, no additional details.",
                    },
                    {"role": "user", "content": prompt},
                    {
                        "role": "user",
                        "content": f"REMEMBER: Answer ONLY this question: '{column_prompt}'\n\nReturn ONLY the specific piece of information requested. Nothing else. No descriptions. No explanations. Just the answer.",
                    },
                ],
                response_format={"type": "json_object"},
                temperature=0.4,
            )

            # Parse response
            response_content = response.choices[0].message.content
            if not response_content:
                raise ValueError("Empty response from LLM")

            response_json = json.loads(response_content)
            if "value" not in response_json:
                raise ValueError("Response missing 'value' field")

            # Format value for storage
            value = format_value_for_storage(response_json["value"], column_type)

            # Update cell with value and completed state
            await db.execute(
                update(Cell)
                .where(Cell.id == cell_id)
                .values(value=value, agent_state=AgentStateEnum.COMPLETED.value)
            )
            await db.commit()

            return value

        except Exception as e:
            logger.error(f"Error processing cell {cell_id}: {e}", exc_info=e)
            # Update state to failed on error
            await db.execute(
                update(Cell)
                .where(Cell.id == cell_id)
                .values(agent_state=AgentStateEnum.FAILED.value)
            )
            await db.commit()
            raise e

    @staticmethod
    async def process_cell_with_error_handling(
        cell_id: int,
        column_type: ColumnTypeEnum,
        primary_column_name: str,
        primary_column_value: str,
        column_prompt: str,
        db: AsyncSession,
    ) -> None:
        """
        Process a cell with error handling - updates state to failed on error

        Args:
            cell_id: ID of the cell to process
            column_type: Type of column (text, boolean, number)
            primary_column_name: Name of the primary column
            primary_column_value: Value of the primary column (URL)
            column_prompt: User's question/prompt for this column
            db: Database session
        """
        try:
            await Agent.process_cell(
                cell_id,
                column_type,
                primary_column_name,
                primary_column_value,
                column_prompt,
                db,
            )
        except Exception as e:
            # State is already updated to FAILED in process_cell
            logger.error(f"Failed to process cell {cell_id}: {e}", exc_info=e)
            raise e
