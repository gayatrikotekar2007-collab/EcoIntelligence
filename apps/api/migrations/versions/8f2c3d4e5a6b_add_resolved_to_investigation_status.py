"""add_resolved_to_investigation_status

Revision ID: 8f2c3d4e5a6b
Revises: 19e1891aa879
Create Date: 2026-09-25 14:41:40.000000
"""

from alembic import op

# revision identifiers, used by Alembic.
revision = '8f2c3d4e5a6b'
down_revision = '19e1891aa879'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TYPE investigationstatus ADD VALUE IF NOT EXISTS 'RESOLVED'")


def downgrade() -> None:
    pass
