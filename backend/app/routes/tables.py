from typing import List, Optional
from fastapi import APIRouter, UploadFile, File, Query, Depends

from app.schemas import (
    TableCreate,
    TableUpdate,
    Table as TableSchema,
    ColumnCreate,
    Column as ColumnSchema,
    RowCreate,
    RowWithCells,
    CSVUploadResponse,
    CellWithColumn,
    CellUpdate,
    RowsListResponse,
)
from app.dependencies import get_cell_service, get_table_service, get_row_service
from app.services import CellService, TableService, RowService
from app.auth.dependencies import verify_jwt_token

router = APIRouter()


@router.get("/", response_model=List[TableSchema])
async def list_tables(
    table_service: TableService = Depends(get_table_service),
    token: dict = Depends(verify_jwt_token),
):
    """List all tables"""
    return await table_service.list_tables()


@router.post("/", response_model=TableSchema, status_code=201)
async def create_table(
    table: TableCreate,
    table_service: TableService = Depends(get_table_service),
    token: dict = Depends(verify_jwt_token),
):
    """Create a new table and auto-create primary column"""
    return await table_service.create_table(table)


@router.patch("/{table_id}", response_model=TableSchema)
async def rename_table(
    table_id: int,
    table_update: TableUpdate,
    table_service: TableService = Depends(get_table_service),
    token: dict = Depends(verify_jwt_token),
):
    """Rename a table"""
    return await table_service.update_table(table_id, table_update)


@router.get("/{table_id}/columns", response_model=List[ColumnSchema])
async def list_columns(
    table_id: int,
    table_service: TableService = Depends(get_table_service),
    token: dict = Depends(verify_jwt_token),
):
    """List all columns for a table"""
    return await table_service.list_columns(table_id)


@router.post("/{table_id}/columns", response_model=ColumnSchema, status_code=201)
async def add_column(
    table_id: int,
    column: ColumnCreate,
    table_service: TableService = Depends(get_table_service),
    token: dict = Depends(verify_jwt_token),
):
    """Add a column to a table and trigger agents for all existing rows"""
    return await table_service.create_column(table_id, column)


@router.delete("/{table_id}/columns/{column_id}", status_code=204)
async def delete_column(
    table_id: int,
    column_id: int,
    table_service: TableService = Depends(get_table_service),
    token: dict = Depends(verify_jwt_token),
):
    """Soft delete a column and all related rows and cells"""
    await table_service.delete_column(table_id, column_id)
    return None


@router.post("/{table_id}/columns/{column_id}/regenerate", status_code=204)
async def regenerate_column(
    table_id: int,
    column_id: int,
    table_service: TableService = Depends(get_table_service),
    token: dict = Depends(verify_jwt_token),
):
    """Regenerate all values in a column by re-triggering agents"""
    await table_service.regenerate_column(table_id, column_id)
    return None


@router.post("/{table_id}/rows", response_model=RowWithCells, status_code=201)
async def add_row(
    table_id: int,
    row: RowCreate,
    row_service: RowService = Depends(get_row_service),
    token: dict = Depends(verify_jwt_token),
):
    """Add a row to a table and trigger agents for all columns"""
    return await row_service.create_row(table_id, row)


@router.patch(
    "/{table_id}/rows/{row_id}/cells/{cell_id}", response_model=CellWithColumn
)
async def update_cell(
    table_id: int,
    row_id: int,
    cell_id: int,
    cell_update: CellUpdate,
    cell_service: CellService = Depends(get_cell_service),
    token: dict = Depends(verify_jwt_token),
):
    """Update a cell's value (only for primary columns)"""
    return await cell_service.update_cell(table_id, row_id, cell_id, cell_update)


@router.post("/{table_id}/rows/{row_id}/regenerate", status_code=204)
async def regenerate_row(
    table_id: int,
    row_id: int,
    row_service: RowService = Depends(get_row_service),
    token: dict = Depends(verify_jwt_token),
):
    """Regenerate all values in a row by re-triggering agents"""
    await row_service.regenerate_row(table_id, row_id)
    return None


@router.delete("/{table_id}/rows/{row_id}", status_code=204)
async def delete_row(
    table_id: int,
    row_id: int,
    row_service: RowService = Depends(get_row_service),
    token: dict = Depends(verify_jwt_token),
):
    """Soft delete a row and all its cells"""
    await row_service.delete_row(table_id, row_id)
    return None


@router.post("/{table_id}/upload-csv", response_model=CSVUploadResponse)
async def upload_csv(
    table_id: int,
    file: UploadFile = File(...),
    row_service: RowService = Depends(get_row_service),
    token: dict = Depends(verify_jwt_token),
):
    """Upload CSV file and create rows (first column only)"""
    contents = await file.read()
    return await row_service.upload_csv_rows(table_id, contents)


@router.get("/{table_id}/rows", response_model=RowsListResponse)
async def list_rows(
    table_id: int,
    cursor: Optional[str] = Query(None),  # Changed to str to support encoded cursors
    page_size: int = Query(50, ge=1, le=100),
    sort_by_column_id: Optional[int] = Query(None),
    sort_asc: bool = Query(True),
    filters: Optional[str] = Query(None),  # JSON string of filters
    row_service: RowService = Depends(get_row_service),
    token: dict = Depends(verify_jwt_token),
):
    """List rows with pagination, sorting, and filtering"""
    rows, next_cursor, previous_cursor = await row_service.list_rows(
        table_id=table_id,
        cursor=cursor,
        page_size=page_size,
        sort_by_column_id=sort_by_column_id,
        sort_asc=sort_asc,
        filters=filters,
    )
    return RowsListResponse(
        rows=rows,
        next_cursor=next_cursor,
        previous_cursor=previous_cursor,
    )


@router.get("/{table_id}/rows/{row_id}", response_model=RowWithCells)
async def get_row(
    table_id: int,
    row_id: int,
    row_service: RowService = Depends(get_row_service),
    token: dict = Depends(verify_jwt_token),
):
    """Get a specific row by ID"""
    return await row_service.get_row(table_id, row_id)


@router.delete("/{table_id}", status_code=204)
async def delete_table(
    table_id: int,
    table_service: TableService = Depends(get_table_service),
    token: dict = Depends(verify_jwt_token),
):
    """Delete a table and all related columns, rows, and cells"""
    await table_service.delete_table(table_id)
    return None
