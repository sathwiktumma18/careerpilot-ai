"""add user role column

Adds `users.role` ("job_seeker" | "recruiter") so signup can create a separate
account type for recruiters. Defaults every existing account to job_seeker.

Revision ID: c4d6e8f0b2e4
Revises: b3c5e7f9a1d3
Create Date: 2026-08-08 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c4d6e8f0b2e4'
down_revision: Union[str, None] = 'b3c5e7f9a1d3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # server_default makes the column non-nullable for the rows that already
    # exist (all prior accounts are job seekers); new rows get the default too.
    op.add_column(
        'users',
        sa.Column('role', sa.String(), nullable=False, server_default='job_seeker'),
    )


def downgrade() -> None:
    op.drop_column('users', 'role')
