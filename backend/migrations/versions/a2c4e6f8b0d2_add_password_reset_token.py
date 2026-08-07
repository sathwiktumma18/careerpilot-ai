"""add password reset token to users

Revision ID: a2c4e6f8b0d2
Revises: a48178cea3e2
Create Date: 2026-08-07 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a2c4e6f8b0d2'
down_revision: Union[str, None] = 'a48178cea3e2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('reset_token_hash', sa.String(), nullable=True))
    op.add_column('users', sa.Column('reset_token_expires_at', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'reset_token_expires_at')
    op.drop_column('users', 'reset_token_hash')
