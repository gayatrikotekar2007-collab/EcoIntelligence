"""add_location_to_evidence

Revision ID: 9a3b4c5d6e7f
Revises: 8f2c3d4e5a6b
Create Date: 2026-10-04 21:30:00.000000
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '9a3b4c5d6e7f'
down_revision = '8f2c3d4e5a6b'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('evidence', sa.Column('location_id', sa.Integer(), nullable=True))
    op.create_foreign_key(
        'fk_evidence_location_id_locations',
        'evidence',
        'locations',
        ['location_id'],
        ['id'],
        ondelete='SET NULL'
    )
    op.create_index(op.f('ix_evidence_location_id'), 'evidence', ['location_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_evidence_location_id'), table_name='evidence')
    op.drop_constraint('fk_evidence_location_id_locations', 'evidence', type_='foreignkey')
    op.drop_column('evidence', 'location_id')
