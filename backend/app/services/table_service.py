from typing import List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, func, and_

from app.models import Table, TableColumn, Row, Cell
from app.exceptions import NotFoundError, BadRequestError
from app.schemas import (
    TableCreate,
    TableUpdate,
    Table as TableSchema,
    ColumnCreate,
    Column as ColumnSchema,
    ColumnTypeEnum,
    AgentStateEnum,
)
from app.services.cell_service import CellService


class TableService:
    """Service for table and column operations"""

    def __init__(self, db: AsyncSession, cell_service: CellService):
        self.db = db
        self.cell_service = cell_service

    async def get_table_or_raise(self, table_id: int) -> Table:
        result = await self.db.execute(select(Table).where(Table.id == table_id))
        db_table = result.scalar_one_or_none()
        if db_table is None:
            raise NotFoundError("Table not found")
        return db_table

    async def list_tables(self) -> List[TableSchema]:
        result = await self.db.execute(
            select(Table)
            .where(Table.deleted_at.is_(None))
            .order_by(Table.created_at.desc())
        )
        tables = result.scalars().all()
        return tables

    async def create_table(self, table_data: TableCreate) -> TableSchema:
        # Create table
        db_table = Table(title=table_data.title, columns=table_data.columns)
        self.db.add(db_table)
        await self.db.flush()

        # Create primary column
        primary_column = TableColumn(
            table_id=db_table.id,
            is_primary=True,
            title="Website",
            prompt="",
            type=ColumnTypeEnum.TEXT.value,
        )
        self.db.add(primary_column)
        await self.db.flush()
        await self.db.refresh(db_table)

        return db_table

    async def update_table(
        self, table_id: int, update_data: TableUpdate
    ) -> TableSchema:
        db_table = await self.get_table_or_raise(table_id)

        if update_data.title is not None:
            db_table.title = update_data.title

        await self.db.flush()
        await self.db.refresh(db_table)
        return db_table

    async def list_columns(self, table_id: int) -> List[ColumnSchema]:
        # Verify table exists
        await self.get_table_or_raise(table_id)

        result = await self.db.execute(
            select(TableColumn)
            .where(
                and_(
                    TableColumn.table_id == table_id,
                    TableColumn.deleted_at.is_(None),
                )
            )
            .order_by(TableColumn.created_at.asc())
        )
        columns = result.scalars().all()
        return columns

    async def create_column(
        self, table_id: int, column_data: ColumnCreate
    ) -> ColumnSchema:
        # Verify table exists
        await self.get_table_or_raise(table_id)

        # Create column
        db_column = TableColumn(
            table_id=table_id,
            is_primary=column_data.is_primary,
            title=column_data.title,
            prompt=column_data.prompt,
            type=column_data.type.value,
        )
        self.db.add(db_column)
        await self.db.flush()

        # Get all existing rows
        rows_result = await self.db.execute(
            select(Row).where(and_(Row.table_id == table_id, Row.deleted_at.is_(None)))
        )
        rows = rows_result.scalars().all()

        # Create cells for all rows using CellService
        cells_to_create = await self.cell_service._create_cells_for_column(
            table_id=table_id,
            column_id=db_column.id,
            rows=rows,
            column_type=column_data.type,
            is_primary=column_data.is_primary or False,
        )

        await self.db.flush()
        await self.db.refresh(db_column)

        # Queue background tasks for agent processing (only for non-primary columns)
        if not column_data.is_primary:
            columns = [db_column] * len(cells_to_create)
            self.cell_service._queue_agent_tasks(cells_to_create, columns)

        return db_column

    async def delete_column(self, table_id: int, column_id: int) -> None:
        result = await self.db.execute(
            select(TableColumn).where(
                and_(
                    TableColumn.id == column_id,
                    TableColumn.table_id == table_id,
                    TableColumn.deleted_at.is_(None),
                )
            )
        )
        column = result.scalar_one_or_none()
        if column is None:
            raise NotFoundError("Column not found")

        await self.db.execute(
            update(Cell)
            .where(Cell.column_id == column_id, Cell.deleted_at.is_(None))
            .values(deleted_at=func.now(), modified_at=func.now())
        )
        await self.db.execute(
            update(TableColumn)
            .where(TableColumn.id == column_id)
            .values(deleted_at=func.now(), modified_at=func.now())
        )

    async def delete_table(self, table_id: int) -> None:
        # Verify table exists
        await self.get_table_or_raise(table_id)

        await self.db.execute(
            update(Cell)
            .where(and_(Cell.table_id == table_id, Cell.deleted_at.is_(None)))
            .values(deleted_at=func.now(), modified_at=func.now())
        )
        await self.db.execute(
            update(TableColumn)
            .where(
                and_(TableColumn.table_id == table_id, TableColumn.deleted_at.is_(None))
            )
            .values(deleted_at=func.now(), modified_at=func.now())
        )
        await self.db.execute(
            update(Row)
            .where(and_(Row.table_id == table_id, Row.deleted_at.is_(None)))
            .values(deleted_at=func.now(), modified_at=func.now())
        )

        await self.db.execute(
            update(Table)
            .where(Table.id == table_id)
            .values(deleted_at=func.now(), modified_at=func.now())
        )

    async def regenerate_column(self, table_id: int, column_id: int) -> None:
        """Regenerate all cell values for a column by re-triggering agents"""
        # Verify table exists
        await self.get_table_or_raise(table_id)

        # Verify column exists and belongs to table
        column_result = await self.db.execute(
            select(TableColumn).where(
                and_(
                    TableColumn.id == column_id,
                    TableColumn.table_id == table_id,
                    TableColumn.deleted_at.is_(None),
                )
            )
        )
        column = column_result.scalar_one_or_none()
        if column is None:
            raise NotFoundError("Column not found")

        # Primary columns cannot be regenerated (they are manually entered)
        if column.is_primary:
            raise BadRequestError("Cannot regenerate primary column values")

        # Get all cells for this column
        cells_result = await self.db.execute(
            select(Cell).where(
                and_(
                    Cell.column_id == column_id,
                    Cell.table_id == table_id,
                    Cell.deleted_at.is_(None),
                )
            )
        )
        cells = cells_result.scalars().all()

        # Reset agent_state to QUEUED for all cells (both in DB and in memory)
        if cells:
            cell_ids = [cell.id for cell in cells]
            await self.db.execute(
                update(Cell)
                .where(Cell.id.in_(cell_ids))
                .values(agent_state=AgentStateEnum.QUEUED.value)
            )
            await self.db.flush()

            # Update in-memory cell objects so _queue_agent_tasks can check the state correctly
            for cell in cells:
                cell.agent_state = AgentStateEnum.QUEUED.value

            # Queue agent tasks for regeneration
            columns = [column] * len(cells)
            self.cell_service._queue_agent_tasks(cells, columns)
