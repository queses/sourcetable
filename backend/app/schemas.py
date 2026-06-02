from pydantic import BaseModel, Field, field_validator
from datetime import datetime
from typing import Optional, List, Dict, Any
from enum import Enum


# Enums
class ColumnTypeEnum(str, Enum):
    TEXT = "text"
    BOOLEAN = "boolean"
    NUMBER = "number"


class AgentStateEnum(str, Enum):
    NOT_REQUIRED = "not_required"
    AWAITING = "awaiting"
    QUEUED = "queued"
    TRIGGERED = "triggered"
    COMPLETED = "completed"
    FAILED = "failed"


# Base schemas
class TableBase(BaseModel):
    title: str
    columns: Dict[str, Any] = Field(default_factory=dict)


class ColumnBase(BaseModel):
    is_primary: Optional[bool] = None
    title: Optional[str] = None
    prompt: Optional[str] = None
    type: ColumnTypeEnum

    @field_validator("type", mode="before")
    @classmethod
    def validate_type(cls, v):
        if isinstance(v, str):
            return ColumnTypeEnum(v.lower())
        return v


class RowBase(BaseModel):
    pass


class CellBase(BaseModel):
    value: str
    is_searchable: bool
    agent_state: AgentStateEnum

    @field_validator("agent_state", mode="before")
    @classmethod
    def validate_agent_state(cls, v):
        if isinstance(v, str):
            return AgentStateEnum(v.lower())
        return v


# Create schemas
class TableCreate(TableBase):
    pass


class ColumnCreate(ColumnBase):
    table_id: int


class RowCreate(RowBase):
    table_id: int
    primary_value: str


class CellCreate(CellBase):
    row_id: int
    table_id: int
    column_id: int


# Update schemas
class TableUpdate(BaseModel):
    title: Optional[str] = None


class ColumnUpdate(BaseModel):
    is_primary: Optional[bool] = None
    title: Optional[str] = None
    prompt: Optional[str] = None
    type: Optional[ColumnTypeEnum] = None


class RowUpdate(BaseModel):
    pass


class CellUpdate(BaseModel):
    value: Optional[str] = None
    is_searchable: Optional[bool] = None
    agent_state: Optional[AgentStateEnum] = None


# Response schemas
class Table(TableBase):
    id: int
    created_at: datetime
    modified_at: datetime

    class Config:
        from_attributes = True


class Column(ColumnBase):
    id: int
    table_id: int
    deleted_at: Optional[datetime] = None
    created_at: datetime
    modified_at: datetime

    class Config:
        from_attributes = True


class Row(RowBase):
    id: int
    table_id: int
    deleted_at: Optional[datetime] = None
    created_at: datetime
    modified_at: datetime

    class Config:
        from_attributes = True


class Cell(CellBase):
    id: int
    row_id: int
    table_id: int
    column_id: int
    deleted_at: Optional[datetime] = None
    created_at: datetime
    modified_at: datetime

    class Config:
        from_attributes = True


# Response schemas with relationships
class CellWithColumn(Cell):
    column: Optional[Column] = None


class RowWithCells(Row):
    cells: List[CellWithColumn] = Field(default_factory=list)


# Pagination schemas
class CursorPaginationParams(BaseModel):
    cursor: Optional[int] = None
    page_size: int = Field(default=50, ge=1, le=100)


class CursorPaginationResponse(BaseModel):
    items: List[Any]
    next_cursor: Optional[int] = None
    has_more: bool


class RowsListResponse(BaseModel):
    rows: List[RowWithCells]
    next_cursor: Optional[str] = None
    previous_cursor: Optional[str] = None


# Filter schemas
class ColumnFilter(BaseModel):
    column_id: int
    value: Optional[str] = None
    min_value: Optional[float] = None
    max_value: Optional[float] = None
    boolean_value: Optional[bool] = None


class RowListParams(BaseModel):
    cursor: Optional[int] = None
    page_size: int = Field(default=50, ge=1, le=100)
    sort_by_column_id: Optional[int] = None
    sort_asc: bool = True
    filters: List[ColumnFilter] = Field(default_factory=list)


# CSV Upload schema
class CSVUploadResponse(BaseModel):
    rows_created: int
    message: str
