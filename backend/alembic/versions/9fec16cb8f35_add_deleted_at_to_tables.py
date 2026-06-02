"""add_deleted_at_to_tables

Revision ID: 9fec16cb8f35
Revises: a8ee4677b772
Create Date: 2025-12-21 22:37:26.292189

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "9fec16cb8f35"
down_revision: Union[str, Sequence[str], None] = "a8ee4677b772"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        "tables",
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("tables", "deleted_at")
