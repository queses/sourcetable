"""FastAPI dependencies for dependency injection"""

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.services import CellService, TableService, RowService


def get_cell_service(db: AsyncSession = Depends(get_db)) -> CellService:
    """Dependency for CellService"""
    return CellService(db)


def get_table_service(
    db: AsyncSession = Depends(get_db),
    cell_service: CellService = Depends(get_cell_service),
) -> TableService:
    """Dependency for TableService"""
    return TableService(db, cell_service)


def get_row_service(
    db: AsyncSession = Depends(get_db),
    cell_service: CellService = Depends(get_cell_service),
) -> RowService:
    """Dependency for RowService"""
    return RowService(db, cell_service)
