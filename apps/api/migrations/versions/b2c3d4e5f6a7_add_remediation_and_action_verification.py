"""add_remediation_and_action_verification

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-10-08 19:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'b2c3d4e5f6a7'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Action Plans table
    op.create_table(
        'action_plans',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('investigation_id', sa.Integer(), nullable=False),
        sa.Column('hypothesis_id', sa.Integer(), nullable=True),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('rationale', sa.Text(), nullable=True),
        sa.Column('status', sa.String(length=50), nullable=False, server_default='PLANNED'),
        sa.Column('priority', sa.String(length=50), nullable=False, server_default='MEDIUM'),
        sa.Column('responsible_person', sa.String(length=255), nullable=True),
        sa.Column('planned_start_date', sa.DateTime(timezone=True), nullable=True),
        sa.Column('target_date', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_by', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['hypothesis_id'], ['hypotheses.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['investigation_id'], ['investigations.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_action_plans_id'), 'action_plans', ['id'], unique=False)
    op.create_index(op.f('ix_action_plans_investigation_id'), 'action_plans', ['investigation_id'], unique=False)
    op.create_index(op.f('ix_action_plans_hypothesis_id'), 'action_plans', ['hypothesis_id'], unique=False)
    op.create_index(op.f('ix_action_plans_status'), 'action_plans', ['status'], unique=False)
    op.create_index(op.f('ix_action_plans_created_by'), 'action_plans', ['created_by'], unique=False)
    op.create_index(op.f('ix_action_plans_created_at'), 'action_plans', ['created_at'], unique=False)
    op.create_index('ix_action_plans_investigation_created', 'action_plans', ['investigation_id', 'created_at'], unique=False)

    # 2. Action Criteria table
    op.create_table(
        'action_criteria',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('action_id', sa.Integer(), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('measurement_type', sa.String(length=50), nullable=False),
        sa.Column('target_value', sa.Float(), nullable=True),
        sa.Column('target_unit', sa.String(length=50), nullable=True),
        sa.Column('comparison_operator', sa.String(length=20), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['action_id'], ['action_plans.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_action_criteria_id'), 'action_criteria', ['id'], unique=False)
    op.create_index(op.f('ix_action_criteria_action_id'), 'action_criteria', ['action_id'], unique=False)

    # 3. Action Evidence relationship table
    op.create_table(
        'action_evidence',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('action_id', sa.Integer(), nullable=False),
        sa.Column('evidence_id', sa.Integer(), nullable=False),
        sa.Column('relationship_type', sa.String(length=50), nullable=False),
        sa.Column('note', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['action_id'], ['action_plans.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['evidence_id'], ['evidence.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('action_id', 'evidence_id', name='uq_action_evidence')
    )
    op.create_index(op.f('ix_action_evidence_id'), 'action_evidence', ['id'], unique=False)
    op.create_index(op.f('ix_action_evidence_action_id'), 'action_evidence', ['action_id'], unique=False)
    op.create_index(op.f('ix_action_evidence_evidence_id'), 'action_evidence', ['evidence_id'], unique=False)

    # 4. Action Observations relationship table
    op.create_table(
        'action_observations',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('action_id', sa.Integer(), nullable=False),
        sa.Column('observation_id', sa.Integer(), nullable=False),
        sa.Column('relationship_type', sa.String(length=50), nullable=False),
        sa.Column('note', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['action_id'], ['action_plans.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['observation_id'], ['observations.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('action_id', 'observation_id', name='uq_action_observation')
    )
    op.create_index(op.f('ix_action_observations_id'), 'action_observations', ['id'], unique=False)
    op.create_index(op.f('ix_action_observations_action_id'), 'action_observations', ['action_id'], unique=False)
    op.create_index(op.f('ix_action_observations_observation_id'), 'action_observations', ['observation_id'], unique=False)

    # 5. Action Verifications table
    op.create_table(
        'action_verifications',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('action_id', sa.Integer(), nullable=False),
        sa.Column('status', sa.String(length=50), nullable=False),
        sa.Column('summary', sa.Text(), nullable=True),
        sa.Column('verified_by', sa.Integer(), nullable=False),
        sa.Column('verified_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('uncertainty_notes', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['action_id'], ['action_plans.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['verified_by'], ['users.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_action_verifications_id'), 'action_verifications', ['id'], unique=False)
    op.create_index(op.f('ix_action_verifications_action_id'), 'action_verifications', ['action_id'], unique=False)
    op.create_index(op.f('ix_action_verifications_verified_by'), 'action_verifications', ['verified_by'], unique=False)

    # 6. Action Verification Results table
    op.create_table(
        'action_verification_results',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('verification_id', sa.Integer(), nullable=False),
        sa.Column('criterion_id', sa.Integer(), nullable=False),
        sa.Column('result', sa.String(length=50), nullable=False),
        sa.Column('observed_value', sa.Float(), nullable=True),
        sa.Column('observed_unit', sa.String(length=50), nullable=True),
        sa.Column('note', sa.Text(), nullable=True),
        sa.Column('evaluation_mode', sa.String(length=50), nullable=False, server_default='investigator_recorded'),
        sa.ForeignKeyConstraint(['criterion_id'], ['action_criteria.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['verification_id'], ['action_verifications.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('verification_id', 'criterion_id', name='uq_verification_criterion')
    )
    op.create_index(op.f('ix_action_verification_results_id'), 'action_verification_results', ['id'], unique=False)
    op.create_index(op.f('ix_action_verification_results_verification_id'), 'action_verification_results', ['verification_id'], unique=False)
    op.create_index(op.f('ix_action_verification_results_criterion_id'), 'action_verification_results', ['criterion_id'], unique=False)


def downgrade() -> None:
    op.drop_table('action_verification_results')
    op.drop_table('action_verifications')
    op.drop_table('action_observations')
    op.drop_table('action_evidence')
    op.drop_table('action_criteria')
    op.drop_table('action_plans')
