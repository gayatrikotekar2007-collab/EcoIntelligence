"""add_root_cause_hypothesis_workspace

Revision ID: a1b2c3d4e5f6
Revises: 9a3b4c5d6e7f
Create Date: 2026-10-08 12:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'a1b2c3d4e5f6'
down_revision = '9a3b4c5d6e7f'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Hypotheses table
    op.create_table(
        'hypotheses',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('investigation_id', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('status', sa.String(length=50), nullable=False, server_default='OPEN'),
        sa.Column('confidence', sa.String(length=50), nullable=False, server_default='LOW'),
        sa.Column('reasoning', sa.Text(), nullable=True),
        sa.Column('created_by', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['investigation_id'], ['investigations.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_hypotheses_id'), 'hypotheses', ['id'], unique=False)
    op.create_index(op.f('ix_hypotheses_investigation_id'), 'hypotheses', ['investigation_id'], unique=False)
    op.create_index(op.f('ix_hypotheses_status'), 'hypotheses', ['status'], unique=False)
    op.create_index(op.f('ix_hypotheses_created_at'), 'hypotheses', ['created_at'], unique=False)
    op.create_index(op.f('ix_hypotheses_created_by'), 'hypotheses', ['created_by'], unique=False)
    op.create_index('ix_hypotheses_investigation_created', 'hypotheses', ['investigation_id', 'created_at'], unique=False)

    # 2. Hypothesis Evidence relationship table
    op.create_table(
        'hypothesis_evidence',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('hypothesis_id', sa.Integer(), nullable=False),
        sa.Column('evidence_id', sa.Integer(), nullable=False),
        sa.Column('relationship_type', sa.String(length=50), nullable=False),
        sa.Column('note', sa.Text(), nullable=True),
        sa.Column('created_by', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['evidence_id'], ['evidence.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['hypothesis_id'], ['hypotheses.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('hypothesis_id', 'evidence_id', name='uq_hypothesis_evidence')
    )
    op.create_index(op.f('ix_hypothesis_evidence_id'), 'hypothesis_evidence', ['id'], unique=False)
    op.create_index(op.f('ix_hypothesis_evidence_hypothesis_id'), 'hypothesis_evidence', ['hypothesis_id'], unique=False)
    op.create_index(op.f('ix_hypothesis_evidence_evidence_id'), 'hypothesis_evidence', ['evidence_id'], unique=False)

    # 3. Hypothesis Observations relationship table
    op.create_table(
        'hypothesis_observations',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('hypothesis_id', sa.Integer(), nullable=False),
        sa.Column('observation_id', sa.Integer(), nullable=False),
        sa.Column('relationship_type', sa.String(length=50), nullable=False),
        sa.Column('note', sa.Text(), nullable=True),
        sa.Column('created_by', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['hypothesis_id'], ['hypotheses.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['observation_id'], ['observations.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('hypothesis_id', 'observation_id', name='uq_hypothesis_observation')
    )
    op.create_index(op.f('ix_hypothesis_observations_id'), 'hypothesis_observations', ['id'], unique=False)
    op.create_index(op.f('ix_hypothesis_observations_hypothesis_id'), 'hypothesis_observations', ['hypothesis_id'], unique=False)
    op.create_index(op.f('ix_hypothesis_observations_observation_id'), 'hypothesis_observations', ['observation_id'], unique=False)

    # 4. Missing Evidence requirements table
    op.create_table(
        'missing_evidence',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('hypothesis_id', sa.Integer(), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('priority', sa.String(length=50), nullable=False, server_default='MEDIUM'),
        sa.Column('status', sa.String(length=50), nullable=False, server_default='OPEN'),
        sa.Column('created_by', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('resolved_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['hypothesis_id'], ['hypotheses.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_missing_evidence_id'), 'missing_evidence', ['id'], unique=False)
    op.create_index(op.f('ix_missing_evidence_hypothesis_id'), 'missing_evidence', ['hypothesis_id'], unique=False)


def downgrade() -> None:
    # 4. Missing evidence
    op.drop_index(op.f('ix_missing_evidence_hypothesis_id'), table_name='missing_evidence')
    op.drop_index(op.f('ix_missing_evidence_id'), table_name='missing_evidence')
    op.drop_table('missing_evidence')

    # 3. Hypothesis observations
    op.drop_index(op.f('ix_hypothesis_observations_observation_id'), table_name='hypothesis_observations')
    op.drop_index(op.f('ix_hypothesis_observations_hypothesis_id'), table_name='hypothesis_observations')
    op.drop_index(op.f('ix_hypothesis_observations_id'), table_name='hypothesis_observations')
    op.drop_table('hypothesis_observations')

    # 2. Hypothesis evidence
    op.drop_index(op.f('ix_hypothesis_evidence_evidence_id'), table_name='hypothesis_evidence')
    op.drop_index(op.f('ix_hypothesis_evidence_hypothesis_id'), table_name='hypothesis_evidence')
    op.drop_index(op.f('ix_hypothesis_evidence_id'), table_name='hypothesis_evidence')
    op.drop_table('hypothesis_evidence')

    # 1. Hypotheses
    op.drop_index('ix_hypotheses_investigation_created', table_name='hypotheses')
    op.drop_index(op.f('ix_hypotheses_created_by'), table_name='hypotheses')
    op.drop_index(op.f('ix_hypotheses_created_at'), table_name='hypotheses')
    op.drop_index(op.f('ix_hypotheses_status'), table_name='hypotheses')
    op.drop_index(op.f('ix_hypotheses_investigation_id'), table_name='hypotheses')
    op.drop_index(op.f('ix_hypotheses_id'), table_name='hypotheses')
    op.drop_table('hypotheses')
