import logging
from sqlalchemy import select, update

from app.models import Cell, TableColumn

from app.schemas import (
    ColumnTypeEnum,
    AgentStateEnum,
)
from app.database import AsyncSessionLocal
from app.services.agent import Agent

logger = logging.getLogger(__name__)


async def run_agent_for_cell_task(cell_id: int, col_type: str):
    """Background task helper for processing cells"""
    async with AsyncSessionLocal() as session:
        try:
            # Fetch cell and column information
            cell_result = await session.execute(
                select(Cell).where(Cell.id == cell_id, Cell.deleted_at.is_(None))
            )
            db_cell = cell_result.scalar_one_or_none()
            if db_cell is None:
                logger.error(f"Cell {cell_id} not found")
                return

            # Get the column for this cell
            column_result = await session.execute(
                select(TableColumn).where(
                    TableColumn.id == db_cell.column_id,
                    TableColumn.deleted_at.is_(None),
                )
            )
            db_column = column_result.scalar_one_or_none()
            if db_column is None:
                logger.error(f"Column {db_cell.column_id} not found for cell {cell_id}")
                await session.execute(
                    update(Cell)
                    .where(Cell.id == cell_id)
                    .values(agent_state=AgentStateEnum.FAILED.value)
                )
                await session.commit()
                return

            # Get primary column for the table
            primary_col_result = await session.execute(
                select(TableColumn).where(
                    TableColumn.table_id == db_cell.table_id,
                    TableColumn.is_primary.is_(True),
                    TableColumn.deleted_at.is_(None),
                )
            )
            primary_column = primary_col_result.scalar_one_or_none()
            if not primary_column:
                logger.error(
                    f"Primary column not found for table {db_cell.table_id}, cell {cell_id}"
                )
                await session.execute(
                    update(Cell)
                    .where(Cell.id == cell_id)
                    .values(agent_state=AgentStateEnum.FAILED.value)
                )
                await session.commit()
                return

            # Get primary cell value for this row
            primary_cell_result = await session.execute(
                select(Cell).where(
                    Cell.row_id == db_cell.row_id,
                    Cell.column_id == primary_column.id,
                    Cell.deleted_at.is_(None),
                )
            )
            primary_cell = primary_cell_result.scalar_one_or_none()
            if not primary_cell or not primary_cell.value:
                logger.error(
                    f"Primary cell value not found for row {db_cell.row_id}, cell {cell_id}"
                )
                await session.execute(
                    update(Cell)
                    .where(Cell.id == cell_id)
                    .values(agent_state=AgentStateEnum.FAILED.value)
                )
                await session.commit()
                return

            # Convert column type string to enum
            try:
                column_type_enum = ColumnTypeEnum(db_column.type)
            except ValueError:
                logger.error(
                    f"Invalid column type: {db_column.type} for cell {cell_id}"
                )
                await session.execute(
                    update(Cell)
                    .where(Cell.id == cell_id)
                    .values(agent_state=AgentStateEnum.FAILED.value)
                )
                await session.commit()
                return

            # Get column prompt (can be None)
            column_prompt = (
                db_column.prompt or "Extract relevant information from the webpage."
            )

            # Get primary column name
            primary_column_name = primary_column.title or "Primary Column"

            # Process cell with agent
            await Agent.process_cell_with_error_handling(
                cell_id=cell_id,
                column_type=column_type_enum,
                primary_column_name=primary_column_name,
                primary_column_value=primary_cell.value,
                column_prompt=column_prompt,
                db=session,
            )
        except Exception as e:
            logger.error(
                f"Unexpected error in `run_agent_for_cell_task` for cell {cell_id}: {e}",
                exc_info=e,
            )
            # Try to update cell state to failed
            try:
                await session.execute(
                    update(Cell)
                    .where(Cell.id == cell_id)
                    .values(agent_state=AgentStateEnum.FAILED.value)
                )
                await session.commit()
            except Exception:
                pass  # If we can't update, at least we tried
