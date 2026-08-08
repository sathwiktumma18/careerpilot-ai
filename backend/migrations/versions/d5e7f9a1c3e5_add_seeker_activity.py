"""add seeker_activities table

Tracks job-seeker product actions (resume analyzed / job searched) so recruiters
can build a candidate pool from real usage.

Revision ID: d5e7f9a1c3e5
Revises: c4d6e8f0b2e4
Create Date: 2026-08-08 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd5e7f9a1c3e5'
down_revision: Union[str, None] = 'c4d6e8f0b2e4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'seeker_activities',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('user_id', sa.String(), nullable=False),
        sa.Column('activity_type', sa.String(), nullable=False),
        sa.Column('role', sa.String(), nullable=False),
        sa.Column('detail', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(
        op.f('ix_seeker_activities_user_id'), 'seeker_activities', ['user_id'], unique=False
    )


def downgrade() -> None:
    op.drop_index(op.f('ix_seeker_activities_user_id'), table_name='seeker_activities')
    op.drop_table('seeker_activities')
