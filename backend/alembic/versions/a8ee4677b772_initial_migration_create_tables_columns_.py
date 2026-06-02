"""Initial migration: create tables, columns, rows, cells

Revision ID: a8ee4677b772
Revises:
Create Date: 2025-12-21 19:41:53.134761

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "a8ee4677b772"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Enable btree_gin extension for mixed column GIN indexes
    op.execute("CREATE EXTENSION IF NOT EXISTS btree_gin")

    # Drop existing items table if it exists
    op.execute("DROP TABLE IF EXISTS items CASCADE")

    # Create tables table
    op.create_table(
        "tables",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column(
            "columns",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "modified_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_tables_created_at"), "tables", ["created_at"], unique=False
    )
    op.create_index(
        op.f("ix_tables_modified_at"), "tables", ["modified_at"], unique=False
    )

    # Create columns table
    op.create_table(
        "columns",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("table_id", sa.BigInteger(), nullable=False),
        sa.Column("is_primary", sa.Boolean(), nullable=True),
        sa.Column("title", sa.Text(), nullable=True),
        sa.Column("prompt", sa.Text(), nullable=True),
        sa.Column("type", sa.Text(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "modified_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["table_id"], ["tables.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_columns_created_at"), "columns", ["created_at"], unique=False
    )
    op.create_index(
        op.f("ix_columns_modified_at"), "columns", ["modified_at"], unique=False
    )
    op.create_index(op.f("ix_columns_table_id"), "columns", ["table_id"], unique=False)
    op.create_index(
        "only_one_primary_cell",
        "columns",
        ["table_id"],
        unique=True,
        postgresql_where=sa.text("is_primary = true"),
    )

    # Create rows table
    op.create_table(
        "rows",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("table_id", sa.BigInteger(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "modified_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["table_id"], ["tables.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_rows_created_at"), "rows", ["created_at"], unique=False)
    op.create_index(op.f("ix_rows_modified_at"), "rows", ["modified_at"], unique=False)
    op.create_index(op.f("ix_rows_table_id"), "rows", ["table_id"], unique=False)

    # Create cells table (without search_vector first)
    op.create_table(
        "cells",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("row_id", sa.BigInteger(), nullable=False),
        sa.Column("table_id", sa.BigInteger(), nullable=False),
        sa.Column("column_id", sa.BigInteger(), nullable=False),
        sa.Column("value", sa.Text(), nullable=False),
        sa.Column("is_searchable", sa.Boolean(), nullable=False),
        sa.Column("agent_state", sa.Text(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "modified_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["column_id"], ["columns.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["row_id"], ["rows.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["table_id"], ["tables.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    # Add generated column for search_vector
    op.execute(
        """
        ALTER TABLE cells 
        ADD COLUMN search_vector tsvector 
        GENERATED ALWAYS AS (to_tsvector('english', regexp_replace(value, '[^[:alnum:]]+', ' ', 'g'))) STORED
        NOT NULL
    """
    )

    op.create_index(op.f("ix_cells_created_at"), "cells", ["created_at"], unique=False)
    op.create_index(
        op.f("ix_cells_modified_at"), "cells", ["modified_at"], unique=False
    )
    op.create_index(op.f("ix_cells_row_id"), "cells", ["row_id"], unique=False)
    op.create_index(op.f("ix_cells_table_id"), "cells", ["table_id"], unique=False)
    op.create_index(op.f("ix_cells_column_id"), "cells", ["column_id"], unique=False)

    # Create partial indexes for cells
    op.create_index(
        "idx_cells_value_table_column",
        "cells",
        ["value", "table_id", "column_id"],
        postgresql_where=sa.text("deleted_at IS NULL"),
    )
    # Create GIN index with btree_gin for mixed column types
    # Using raw SQL to specify operator classes for non-TSVECTOR columns
    op.execute(
        """
        CREATE INDEX idx_cells_search_vector ON cells 
        USING gin (
            search_vector,
            table_id,
            column_id
        )
        WHERE is_searchable = true AND deleted_at IS NULL
    """
    )
    op.create_index(
        "only_one_undeleted_cell",
        "cells",
        ["row_id", "column_id"],
        unique=True,
        postgresql_where=sa.text("deleted_at IS NULL"),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index("only_one_undeleted_cell", table_name="cells")
    op.execute("DROP INDEX IF EXISTS idx_cells_search_vector")
    op.drop_index("idx_cells_value_table_column", table_name="cells")
    op.drop_index(op.f("ix_cells_column_id"), table_name="cells")
    op.drop_index(op.f("ix_cells_table_id"), table_name="cells")
    op.drop_index(op.f("ix_cells_row_id"), table_name="cells")
    op.drop_index(op.f("ix_cells_modified_at"), table_name="cells")
    op.drop_index(op.f("ix_cells_created_at"), table_name="cells")
    op.drop_table("cells")
    op.drop_index(op.f("ix_rows_table_id"), table_name="rows")
    op.drop_index(op.f("ix_rows_modified_at"), table_name="rows")
    op.drop_index(op.f("ix_rows_created_at"), table_name="rows")
    op.drop_table("rows")
    op.drop_index("only_one_primary_cell", table_name="columns")
    op.drop_index(op.f("ix_columns_table_id"), table_name="columns")
    op.drop_index(op.f("ix_columns_modified_at"), table_name="columns")
    op.drop_index(op.f("ix_columns_created_at"), table_name="columns")
    op.drop_table("columns")
    op.drop_index(op.f("ix_tables_modified_at"), table_name="tables")
    op.drop_index(op.f("ix_tables_created_at"), table_name="tables")
    op.drop_table("tables")
