"""add user profiles table

1:1 editable identity for job seekers AND recruiters — headline, location, bio,
social links, recruiter company/role, and the stored avatar photo. This powers
the real Account settings (Phase F) and the recruiter portfolio.

Revision ID: f7a9b1c3e5d7
Revises: e6f8a2b4c6d8
Create Date: 2026-08-12 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f7a9b1c3e5d7'
down_revision: Union[str, None] = 'e6f8a2b4c6d8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'profiles',
        sa.Column('user_id', sa.String(), nullable=False),
        sa.Column('avatar_path', sa.String(length=300), nullable=True),
        sa.Column('headline', sa.String(length=120), nullable=True),
        sa.Column('location', sa.String(length=80), nullable=True),
        sa.Column('bio', sa.Text(), nullable=True),
        sa.Column('years_experience', sa.Integer(), nullable=True),
        sa.Column('linkedin_url', sa.String(length=300), nullable=True),
        sa.Column('github_url', sa.String(length=300), nullable=True),
        sa.Column('portfolio_url', sa.String(length=300), nullable=True),
        sa.Column('company', sa.String(length=120), nullable=True),
        sa.Column('company_role', sa.String(length=120), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('user_id'),
    )


def downgrade() -> None:
    op.drop_table('profiles')
