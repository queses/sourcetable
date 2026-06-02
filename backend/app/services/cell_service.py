import asyncio
import logging
from typing import List, Dict
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, update

from app.models import Cell, TableColumn, Row

from app.exceptions import NotFoundError, BadRequestError
from app.schemas import (
    CellWithColumn,
    CellUpdate,
    Column as ColumnSchema,
    RowWithCells,
    ColumnTypeEnum,
    AgentStateEnum,
)
from app.database import AsyncSessionLocal
from app.services.agent import Agent

logger = logging.getLogger(__name__)


async def process_cell_background(cell_id: int, col_type: str):
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
                f"Unexpected error in process_cell_background for cell {cell_id}: {e}",
                exc_info=True,
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


class CellService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def update_cell(
        self, table_id: int, row_id: int, cell_id: int, update_data: CellUpdate
    ) -> CellWithColumn:
        # Verify row exists and belongs to table
        row_result = await self.db.execute(
            select(Row).where(
                and_(
                    Row.id == row_id, Row.table_id == table_id, Row.deleted_at.is_(None)
                )
            )
        )
        db_row = row_result.scalar_one_or_none()
        if db_row is None:
            raise NotFoundError("Row not found")

        # Verify cell exists and belongs to row
        cell_result = await self.db.execute(
            select(Cell).where(
                and_(
                    Cell.id == cell_id,
                    Cell.row_id == row_id,
                    Cell.table_id == table_id,
                    Cell.deleted_at.is_(None),
                )
            )
        )
        db_cell = cell_result.scalar_one_or_none()
        if db_cell is None:
            raise NotFoundError("Cell not found")

        # Get column to check if it's primary
        column_result = await self.db.execute(
            select(TableColumn).where(TableColumn.id == db_cell.column_id)
        )
        db_column = column_result.scalar_one_or_none()
        if db_column is None:
            raise NotFoundError("Column not found")

        # Only allow updating primary column values
        if not db_column.is_primary:
            raise BadRequestError("Only primary column values can be updated")

        # Update cell value
        if update_data.value is not None:
            db_cell.value = update_data.value
            # Update searchable flag for text columns
            if update_data.is_searchable is not None:
                db_cell.is_searchable = update_data.is_searchable
            elif db_column.type == ColumnTypeEnum.TEXT.value:
                db_cell.is_searchable = True

        await self.db.flush()
        await self.db.refresh(db_cell)

        return self._build_cell_with_column(db_cell, db_column)

    def _build_cell_with_column(
        self, cell: Cell, column: TableColumn
    ) -> CellWithColumn:
        """Convert cell+column to CellWithColumn schema"""
        cell_dict = {
            "id": cell.id,
            "row_id": cell.row_id,
            "table_id": cell.table_id,
            "column_id": cell.column_id,
            "value": cell.value,
            "is_searchable": cell.is_searchable,
            "agent_state": cell.agent_state,
            "deleted_at": cell.deleted_at,
            "created_at": cell.created_at,
            "modified_at": cell.modified_at,
            "column": ColumnSchema.model_validate(column) if column else None,
        }
        return CellWithColumn(**cell_dict)

    def _build_row_with_cells(
        self, row: Row, cells_with_columns: List[CellWithColumn]
    ) -> RowWithCells:
        """Convert row+cells to RowWithCells schema"""
        return RowWithCells(
            id=row.id,
            table_id=row.table_id,
            deleted_at=row.deleted_at,
            created_at=row.created_at,
            modified_at=row.modified_at,
            cells=cells_with_columns,
        )

    async def _load_cells_with_columns(
        self, row_ids: List[int]
    ) -> Dict[int, List[CellWithColumn]]:
        """Query cells with columns for given row IDs"""
        cells_result = await self.db.execute(
            select(Cell, TableColumn)
            .join(TableColumn)
            .where(
                and_(
                    Cell.row_id.in_(row_ids),
                    Cell.deleted_at.is_(None),
                    TableColumn.deleted_at.is_(None),
                )
            )
        )
        cells_with_cols = cells_result.all()

        # Group cells by row_id
        cells_by_row: Dict[int, List[CellWithColumn]] = {}
        for cell, column in cells_with_cols:
            if cell.row_id not in cells_by_row:
                cells_by_row[cell.row_id] = []
            cells_by_row[cell.row_id].append(self._build_cell_with_column(cell, column))

        return cells_by_row

    async def _create_cells_for_row(
        self,
        row_id: int,
        table_id: int,
        columns: List[TableColumn],
        primary_value: str,
    ) -> List[Cell]:
        """Create cells for a row"""
        cells_to_create = []
        for column in columns:
            # Primary columns get the provided value, non-primary get queued
            if column.is_primary:
                value = primary_value
                agent_state = AgentStateEnum.NOT_REQUIRED.value
            else:
                value = ""
                agent_state = AgentStateEnum.QUEUED.value

            cell = Cell(
                row_id=row_id,
                table_id=table_id,
                column_id=column.id,
                value=value,
                is_searchable=column.type == ColumnTypeEnum.TEXT.value,
                agent_state=agent_state,
            )
            cells_to_create.append(cell)

        self.db.add_all(cells_to_create)
        await self.db.flush()
        return cells_to_create

    async def _create_cells_for_column(
        self,
        table_id: int,
        column_id: int,
        rows: List[Row],
        column_type: ColumnTypeEnum,
        is_primary: bool,
    ) -> List[Cell]:
        cells_to_create = []
        for row in rows:
            cell = Cell(
                row_id=row.id,
                table_id=table_id,
                column_id=column_id,
                value="",
                is_searchable=column_type != ColumnTypeEnum.BOOLEAN,
                agent_state=AgentStateEnum.QUEUED.value
                if not is_primary
                else AgentStateEnum.NOT_REQUIRED.value,
            )
            cells_to_create.append(cell)

        self.db.add_all(cells_to_create)
        await self.db.flush()
        return cells_to_create

    def _queue_agent_tasks(self, cells: List[Cell], columns: List[TableColumn]) -> None:
        for cell, column in zip(cells, columns):
            if (
                not column.is_primary
                and cell.agent_state == AgentStateEnum.QUEUED.value
            ):
                asyncio.create_task(process_cell_background(cell.id, column.type))
