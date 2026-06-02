from collections import defaultdict
import csv
from functools import cached_property
import io
import json
import base64
from typing import List, Optional, Tuple, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import (
    ColumnElement,
    select,
    update,
    func,
    Numeric,
    and_,
    or_,
    bindparam,
)
from sqlalchemy.orm import aliased

from app.models import Table, TableColumn, Row, Cell
from app.exceptions import NotFoundError, BadRequestError
from app.schemas import (
    AgentStateEnum,
    RowCreate,
    RowWithCells,
    CSVUploadResponse,
    ColumnTypeEnum,
    ColumnFilter,
)
from app.services.cell_service import CellService


class RowService:
    def __init__(self, db: AsyncSession, cell_service: CellService):
        self.db = db
        self.cell_service = cell_service

    async def create_row(self, table_id: int, row_data: RowCreate) -> RowWithCells:
        # Verify table exists
        table_result = await self.db.execute(select(Table).where(Table.id == table_id))
        db_table = table_result.scalar_one_or_none()
        if db_table is None:
            raise NotFoundError("Table not found")

        # Create row
        db_row = Row(table_id=table_id)
        self.db.add(db_row)
        await self.db.flush()

        # Get all columns for this table
        columns_result = await self.db.execute(
            select(TableColumn).where(
                TableColumn.table_id == table_id, TableColumn.deleted_at.is_(None)
            )
        )
        columns = columns_result.scalars().all()

        # Create cells for all columns using CellService
        primary_value = row_data.primary_value or ""
        cells_to_create = await self.cell_service._create_cells_for_row(
            row_id=db_row.id,
            table_id=table_id,
            columns=columns,
            primary_value=primary_value,
        )

        await self.db.flush()
        await self.db.refresh(db_row)

        # Queue background tasks for agent processing (only for non-primary columns)
        self.cell_service._queue_agent_tasks(cells_to_create, columns)

        # Load cells with columns for response
        cells_by_row = await self.cell_service._load_cells_with_columns([db_row.id])
        cell_list = cells_by_row.get(db_row.id, [])

        return self.cell_service._build_row_with_cells(db_row, cell_list)

    async def get_row(self, table_id: int, row_id: int) -> RowWithCells:
        # Verify row exists and belongs to table
        result = await self.db.execute(
            select(Row).where(
                Row.id == row_id, Row.table_id == table_id, Row.deleted_at.is_(None)
            )
        )
        db_row = result.scalar_one_or_none()
        if db_row is None:
            raise NotFoundError("Row not found")

        # Load cells with columns using CellService
        cells_by_row = await self.cell_service._load_cells_with_columns([row_id])
        cell_list = cells_by_row.get(row_id, [])

        return self.cell_service._build_row_with_cells(db_row, cell_list)

    async def list_rows(
        self,
        table_id: int,
        cursor: Optional[str] = None,  # Changed to str to support encoded cursors
        page_size: int = 50,
        sort_by_column_id: Optional[int] = None,
        sort_asc: bool = True,
        filters: Optional[str] = None,  # JSON string of filters
    ) -> Tuple[
        List[RowWithCells], Optional[str], Optional[str]
    ]:  # Returns rows, next_cursor, and previous_cursor
        # Verify table exists
        table_result = await self.db.execute(select(Table).where(Table.id == table_id))
        db_table = table_result.scalar_one_or_none()
        if db_table is None:
            raise NotFoundError("Table not found")

        # Get all columns for this table to map column_id to type
        columns_result = await self.db.execute(
            select(TableColumn).where(
                TableColumn.table_id == table_id,
                TableColumn.deleted_at.is_(None),
            )
        )
        columns_by_id = {col.id: col for col in columns_result.scalars().all()}

        # Parse filters
        filter_list = []
        if filters:
            try:
                filters_data = json.loads(filters)
                filter_list = [ColumnFilter(**f) for f in filters_data]
            except (json.JSONDecodeError, ValueError, TypeError):
                # If filter parsing fails, log error but don't fail the request
                pass

        # Build unified query that fetches row_id and cursor key
        # We'll use a subquery approach to handle multiple joins for filters and sorting

        # Start with base row selection
        base_query = select(Row.id.label("row_id")).where(
            Row.table_id == table_id, Row.deleted_at.is_(None)
        )

        # Parse cursor
        cursor_row_id = None
        cursor_sort_value = None
        if cursor:
            cursor_row_id, cursor_sort_value = self._decode_cursor(cursor)

        # Handle sorting and cursor pagination
        sort_cell_alias = None
        sort_expr = None
        sort_column = None
        if sort_by_column_id:
            sort_column = columns_by_id.get(sort_by_column_id)
            if sort_column:
                # Create alias for sort cell join
                sort_cell_alias = aliased(Cell)
                base_query = base_query.join(
                    sort_cell_alias,
                    and_(
                        sort_cell_alias.row_id == Row.id,
                        sort_cell_alias.column_id == sort_by_column_id,
                        sort_cell_alias.deleted_at.is_(None),
                    ),
                )

                # Build sort expression
                if sort_column.type == ColumnTypeEnum.NUMBER.value:
                    sort_expr = func.cast(sort_cell_alias.value, Numeric)
                else:
                    sort_expr = sort_cell_alias.value

                # Add sort expression to select for cursor key
                base_query = base_query.add_columns(sort_expr.label("sort_value"))

                # Apply cursor condition
                if cursor_row_id is not None and cursor_sort_value is not None:
                    cursor_condition = None

                    cursor_condition = self._search_classes[
                        sort_column.type
                    ].build_cursor_condition(
                        sort_expr, cursor_sort_value, cursor_row_id, sort_asc
                    )
                    if cursor_condition is not None:
                        base_query = base_query.where(cursor_condition)
                elif cursor_row_id is not None:
                    # Fallback: if cursor is just row_id (legacy)
                    base_query = base_query.where(Row.id > cursor_row_id)

                # Apply ordering
                if sort_asc:
                    base_query = base_query.order_by(sort_expr.asc(), Row.id.asc())
                else:
                    base_query = base_query.order_by(sort_expr.desc(), Row.id.asc())
            else:
                # Invalid sort column, fall back to row_id sorting
                if cursor_row_id:
                    base_query = base_query.where(Row.id > cursor_row_id)
                base_query = base_query.order_by(Row.id.asc())
                base_query = base_query.add_columns(Row.id.label("sort_value"))
        else:
            # No sort column, use row_id
            if cursor_row_id:
                base_query = base_query.where(Row.id > cursor_row_id)
            base_query = base_query.order_by(Row.id.asc())
            # Add row_id as sort_value for consistency
            base_query = base_query.add_columns(Row.id.label("sort_value"))

        # Apply filters by joining with filter cells
        filter_conditions = []
        filter_cell_aliases = {}
        if filter_list:
            for idx, column_filter in enumerate(filter_list):
                column = columns_by_id.get(column_filter.column_id)
                if not column:
                    continue  # Skip invalid column_id

                filter_cell_alias = aliased(Cell, name=f"filter_cell_{idx}")
                condition = self._search_classes[column.type].build_condition(
                    filter_cell_alias, column_filter, column
                )
                if condition is not None:
                    filter_cell_aliases[column_filter.column_id] = filter_cell_alias
                    base_query = base_query.join(
                        filter_cell_alias,
                        and_(
                            filter_cell_alias.row_id == Row.id,
                            filter_cell_alias.column_id == column_filter.column_id,
                            filter_cell_alias.deleted_at.is_(None),
                            filter_cell_alias.table_id == table_id,
                        ),
                    )
                    filter_conditions.append(condition)

        if filter_conditions:
            base_query = base_query.where(and_(*filter_conditions))

        # Execute query with limit
        base_query = base_query.limit(page_size + 1)
        result = await self.db.execute(base_query)
        rows_data = result.all()

        # Check if there are more rows
        has_more = len(rows_data) > page_size
        if has_more:
            rows_data = rows_data[:page_size]

        # Extract row_ids and build cursors
        row_ids = [row.row_id for row in rows_data]
        next_cursor = None
        # previous_cursor is the cursor that was provided (represents last row of previous page)
        previous_cursor = cursor if cursor else None

        if rows_data:
            # Build next_cursor from last row
            last_row = rows_data[-1]
            if sort_by_column_id and sort_expr is not None:
                # Encode cursor with sort_value and row_id
                next_cursor = self._encode_cursor(last_row.row_id, last_row.sort_value)
            else:
                # Just use row_id
                next_cursor = self._encode_cursor(last_row.row_id, None)

            # If there are no more rows, don't return next_cursor
            if not has_more:
                next_cursor = None

        # Load actual row data and cells
        if not row_ids:
            return [], None, None

        rows_result = await self.db.execute(select(Row).where(Row.id.in_(row_ids)))
        rows = rows_result.scalars().all()
        rows_by_id = {row.id: row for row in rows}

        # Load cells for each row with columns using CellService
        cells_by_row = await self.cell_service._load_cells_with_columns(row_ids)

        # Build response in the correct order
        response_rows = []
        for row_id in row_ids:
            row = rows_by_id.get(row_id)
            if row:
                row_cells = cells_by_row.get(row_id, [])
                response_rows.append(
                    self.cell_service._build_row_with_cells(row, row_cells)
                )

        return response_rows, next_cursor, previous_cursor

    def _encode_cursor(self, row_id: int, sort_value: Any) -> str:
        """Encode cursor as base64 JSON string."""
        if sort_value is not None:
            cursor_data = {"row_id": row_id, "sort_value": str(sort_value)}
        else:
            cursor_data = {"row_id": row_id}
        cursor_json = json.dumps(cursor_data)
        return base64.urlsafe_b64encode(cursor_json.encode()).decode()

    def _decode_cursor(self, cursor: str) -> Tuple[Optional[int], Optional[Any]]:
        """Decode cursor from base64 JSON string."""
        try:
            cursor_json = base64.urlsafe_b64decode(cursor.encode()).decode()
            cursor_data = json.loads(cursor_json)
            row_id = cursor_data.get("row_id")
            sort_value = cursor_data.get("sort_value")
            return row_id, sort_value
        except (ValueError, json.JSONDecodeError, KeyError):
            # Try to parse as simple integer (legacy support)
            try:
                return int(cursor), None
            except ValueError:
                return None, None

    async def delete_row(self, table_id: int, row_id: int) -> None:
        result = await self.db.execute(
            select(Row).where(
                Row.id == row_id, Row.table_id == table_id, Row.deleted_at.is_(None)
            )
        )
        db_row = result.scalar_one_or_none()
        if db_row is None:
            raise NotFoundError("Row not found")

        # Soft delete row
        await self.db.execute(
            update(Row)
            .where(Row.id == row_id)
            .values(deleted_at=func.now(), modified_at=func.now())
        )

        # Soft delete all cells for this row
        await self.db.execute(
            update(Cell)
            .where(Cell.row_id == row_id, Cell.deleted_at.is_(None))
            .values(deleted_at=func.now(), modified_at=func.now())
        )

        await self.db.flush()

    async def upload_csv_rows(
        self, table_id: int, csv_content: bytes
    ) -> CSVUploadResponse:
        # Verify table exists
        table_result = await self.db.execute(select(Table).where(Table.id == table_id))
        db_table = table_result.scalar_one_or_none()
        if db_table is None:
            raise NotFoundError("Table not found")

        # Read CSV file
        csv_file = io.StringIO(csv_content.decode("utf-8"))
        csv_reader = csv.reader(csv_file)

        rows_created = 0
        rows_to_process = []

        # Get primary column for setting values
        primary_col_result = await self.db.execute(
            select(TableColumn).where(
                TableColumn.table_id == table_id,
                TableColumn.is_primary.is_(True),
                TableColumn.deleted_at.is_(None),
            )
        )
        primary_column = primary_col_result.scalar_one_or_none()
        if not primary_column:
            raise BadRequestError("Primary column not found")

        # Get all columns
        columns_result = await self.db.execute(
            select(TableColumn).where(
                TableColumn.table_id == table_id, TableColumn.deleted_at.is_(None)
            )
        )
        columns = columns_result.scalars().all()

        # Process CSV rows
        for csv_row in csv_reader:
            if not csv_row or len(csv_row) == 0:
                continue

            # Get first column value
            first_value = csv_row[0].strip()
            if not first_value:
                continue

            # Create row
            db_row = Row(table_id=table_id)
            self.db.add(db_row)
            await self.db.flush()

            # Create cells for all columns using CellService
            cells_to_create = await self.cell_service._create_cells_for_row(
                row_id=db_row.id,
                table_id=table_id,
                columns=columns,
                primary_value=first_value,
            )

            await self.db.flush()
            await self.db.refresh(db_row)

            rows_created += 1
            rows_to_process.append((db_row.id, cells_to_create, columns))

        # Queue background tasks for agent processing
        for row_id, cells, cols in rows_to_process:
            self.cell_service._queue_agent_tasks(cells, cols)

        return CSVUploadResponse(
            rows_created=rows_created,
            message=f"Successfully created {rows_created} rows",
        )

    async def regenerate_row(self, table_id: int, row_id: int) -> None:
        """Regenerate all cell values for a row by re-triggering agents for non-primary columns"""
        # Verify table exists
        table_result = await self.db.execute(select(Table).where(Table.id == table_id))
        db_table = table_result.scalar_one_or_none()
        if db_table is None:
            raise NotFoundError("Table not found")

        # Verify row exists and belongs to table
        row_result = await self.db.execute(
            select(Row).where(
                Row.id == row_id, Row.table_id == table_id, Row.deleted_at.is_(None)
            )
        )
        db_row = row_result.scalar_one_or_none()
        if db_row is None:
            raise NotFoundError("Row not found")

        # Get all non-primary cells for this row with their columns (using join to filter)
        cells_result = await self.db.execute(
            select(Cell, TableColumn)
            .join(TableColumn, Cell.column_id == TableColumn.id)
            .where(
                and_(
                    Cell.row_id == row_id,
                    Cell.table_id == table_id,
                    Cell.deleted_at.is_(None),
                    TableColumn.table_id == table_id,
                    TableColumn.deleted_at.is_(None),
                    TableColumn.is_primary.is_distinct_from(True),
                )
            )
        )
        cells_with_columns = cells_result.all()

        if not cells_with_columns:
            return  # No non-primary cells to regenerate

        # Separate cells and columns, ensuring they're paired correctly
        non_primary_cells = []
        non_primary_columns = []
        non_primary_cell_ids = []

        for cell, column in cells_with_columns:
            non_primary_cell_ids.append(cell.id)
            non_primary_cells.append(cell)
            non_primary_columns.append(column)

        # Reset agent_state to QUEUED for all non-primary cells
        await self.db.execute(
            update(Cell)
            .where(Cell.id.in_(non_primary_cell_ids))
            .values(agent_state=AgentStateEnum.QUEUED.value)
        )
        await self.db.flush()

        # Update in-memory cell objects so _queue_agent_tasks can check the state correctly
        for cell in non_primary_cells:
            cell.agent_state = AgentStateEnum.QUEUED.value

        # Queue agent tasks for regeneration
        self.cell_service._queue_agent_tasks(non_primary_cells, non_primary_columns)

    @cached_property
    def _search_classes(self) -> defaultdict[ColumnTypeEnum, type["_BaseTypeSearch"]]:
        return defaultdict(
            lambda: _BaseTypeSearch,
            {
                ColumnTypeEnum.TEXT: _TextSearch,
                ColumnTypeEnum.NUMBER: _NumberSearch,
                ColumnTypeEnum.BOOLEAN: _BooleanSearch,
            },
        )


class _BaseTypeSearch:
    """Base class for column type search/cursor condition building."""

    @staticmethod
    def build_cursor_condition(
        sort_expr: Any,
        cursor_sort_value: Any,
        cursor_row_id: int,
        sort_asc: bool,
    ) -> Optional[Any]:
        """
        Build SQL cursor condition for text/string comparison.
        Returns None if condition should be skipped.
        Returns SQLAlchemy condition otherwise.
        """
        # Text/string comparison
        if sort_asc:
            cursor_condition = or_(
                sort_expr > cursor_sort_value,
                and_(
                    sort_expr == cursor_sort_value,
                    Row.id > cursor_row_id,
                ),
            )
        else:
            cursor_condition = or_(
                sort_expr < cursor_sort_value,
                and_(
                    sort_expr == cursor_sort_value,
                    Row.id > cursor_row_id,
                ),
            )
        return cursor_condition

    @staticmethod
    def build_condition(
        cell_alias: type[Cell],
        column_filter: ColumnFilter,
        column: TableColumn,
    ) -> ColumnElement[bool] | None:
        return None


class _TextSearch(_BaseTypeSearch):
    """Private filter class for TEXT column type filtering using fulltext search."""

    @staticmethod
    def build_condition(
        cell_alias: type[Cell],  # SQLAlchemy alias for Cell table
        column_filter: ColumnFilter,
        column: TableColumn,
    ) -> ColumnElement[bool] | None:
        """
        Build SQL condition for text filter.
        Returns None if filter should be skipped (empty value).
        Returns SQLAlchemy condition otherwise.
        """
        if not column_filter.value or not column_filter.value.strip():
            return None  # Skip empty text filters

        # Use raw SQL for PostgreSQL fulltext search with parameterized query
        search_term_value = column_filter.value.strip()
        search_term_param = f"search_term_{column_filter.column_id}"

        # Use SQLAlchemy's column reference with custom operator to properly handle the alias
        # The column reference will automatically use the correct alias name
        search_vector_col = cell_alias.search_vector
        tsquery_expr = func.plainto_tsquery(
            "english",
            func.regexp_replace(
                bindparam(search_term_param, search_term_value),
                "[^[:alnum:]]+",
                " ",
                "g",
            ),
        )

        return and_(
            cell_alias.is_searchable.is_(True),
            search_vector_col.op("@@")(tsquery_expr),
        )


class _NumberSearch(_BaseTypeSearch):
    """Private search class for NUMBER column type filtering and cursor pagination."""

    @staticmethod
    def build_condition(
        cell_alias: type[Cell],  # SQLAlchemy alias for Cell table
        column_filter: ColumnFilter,
        column: TableColumn,
    ) -> ColumnElement[bool] | None:
        """
        Build SQL condition for number filter.
        Returns None if filter should be skipped (no range values provided).
        Returns SQLAlchemy condition otherwise.
        """
        conditions = []
        if column_filter.min_value is not None:
            conditions.append(
                func.cast(cell_alias.value, Numeric) >= column_filter.min_value
            )
        if column_filter.max_value is not None:
            conditions.append(
                func.cast(cell_alias.value, Numeric) <= column_filter.max_value
            )

        if not conditions:
            return None  # Skip if no range values provided

        return and_(*conditions)

    @staticmethod
    def build_cursor_condition(
        sort_expr: Any,
        cursor_sort_value: Any,
        cursor_row_id: int,
        sort_asc: bool,
    ) -> Optional[Any]:
        """
        Build SQL cursor condition for NUMBER column type sorting.
        Returns None if condition should be skipped.
        Returns SQLAlchemy condition otherwise.
        """
        # Cast cursor_sort_value to match sort_expr type
        try:
            cursor_sort_value_numeric = float(cursor_sort_value)
        except (ValueError, TypeError):
            cursor_sort_value_numeric = None
        if cursor_sort_value_numeric is not None:
            if sort_asc:
                cursor_condition = or_(
                    sort_expr > cursor_sort_value_numeric,
                    and_(
                        sort_expr == cursor_sort_value_numeric,
                        Row.id > cursor_row_id,
                    ),
                )
            else:
                cursor_condition = or_(
                    sort_expr < cursor_sort_value_numeric,
                    and_(
                        sort_expr == cursor_sort_value_numeric,
                        Row.id > cursor_row_id,
                    ),
                )
            return cursor_condition
        return None


class _BooleanSearch(_BaseTypeSearch):
    """Private filter class for BOOLEAN column type filtering."""

    @staticmethod
    def build_condition(
        cell_alias: type[Cell],  # SQLAlchemy alias for Cell table
        column_filter: ColumnFilter,
        column: TableColumn,
    ) -> ColumnElement[bool] | None:
        """
        Build SQL condition for boolean filter.
        Returns None if filter should be skipped (boolean_value not set).
        Returns SQLAlchemy condition otherwise.
        """
        if column_filter.boolean_value is None:
            return None  # Skip if boolean_value not set

        # Convert boolean to "1" or "0" to match how values are stored in cells
        bool_str = "1" if column_filter.boolean_value else "0"
        return cell_alias.value == bool_str
