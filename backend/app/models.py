from sqlalchemy import (
    Column,
    BigInteger,
    Text,
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    Computed,
)
from sqlalchemy.dialects.postgresql import JSONB, TSVECTOR
from sqlalchemy.sql import func, text
from app.database import Base


class BaseModel(Base):
    """Base model with common fields"""

    __abstract__ = True

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )
    modified_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
        index=True,
    )


class Table(BaseModel):
    """Table model"""

    __tablename__ = "tables"

    title = Column(Text, nullable=False)
    columns = Column(JSONB, nullable=False, server_default=text("'{}'::jsonb"))
    deleted_at = Column(DateTime(timezone=True), nullable=True)


class TableColumn(BaseModel):
    """Column model"""

    __tablename__ = "columns"

    table_id = Column(
        BigInteger,
        ForeignKey("tables.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    is_primary = Column(Boolean, nullable=True)
    title = Column(Text, nullable=True)
    prompt = Column(Text, nullable=True)
    type = Column(Text, nullable=False)
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        Index(
            "only_one_primary_cell",
            "table_id",
            unique=True,
            postgresql_where=(text("is_primary = true")),
        ),
    )


class Row(BaseModel):
    """Row model"""

    __tablename__ = "rows"

    table_id = Column(
        BigInteger,
        ForeignKey("tables.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    deleted_at = Column(DateTime(timezone=True), nullable=True)


class Cell(BaseModel):
    """Cell model"""

    __tablename__ = "cells"

    row_id = Column(
        BigInteger,
        ForeignKey("rows.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    table_id = Column(
        BigInteger,
        ForeignKey("tables.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    column_id = Column(
        BigInteger,
        ForeignKey("columns.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    value = Column(Text, nullable=False)
    is_searchable = Column(Boolean, nullable=False)
    search_vector = Column(
        TSVECTOR,
        Computed(
            "to_tsvector('english', regexp_replace(value, '[^[:alnum:]]+', ' ', 'g'))",
            persisted=True,
        ),
        nullable=False,
    )
    agent_state = Column(Text, nullable=False)
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        Index(
            "idx_cells_value_table_column",
            "value",
            "table_id",
            "column_id",
            postgresql_where=(text("deleted_at IS NULL")),
        ),
        Index(
            "idx_cells_search_vector",
            "search_vector",
            "table_id",
            "column_id",
            postgresql_using="gin",
            postgresql_where=(text("is_searchable = true AND deleted_at IS NULL")),
        ),
        Index(
            "only_one_undeleted_cell",
            "row_id",
            "column_id",
            unique=True,
            postgresql_where=(text("deleted_at IS NULL")),
        ),
    )
