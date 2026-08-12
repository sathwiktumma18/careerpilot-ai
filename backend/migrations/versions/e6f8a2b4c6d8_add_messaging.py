"""add conversations + messages tables

One-thread-per-pair messaging between job seekers and recruiters, with
per-recipient read tracking for unread counts.

Revision ID: e6f8a2b4c6d8
Revises: d5e7f9a1c3e5
Create Date: 2026-08-11 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e6f8a2b4c6d8'
down_revision: Union[str, None] = 'd5e7f9a1c3e5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'conversations',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('seeker_id', sa.String(), nullable=False),
        sa.Column('recruiter_id', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('last_message_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['recruiter_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['seeker_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('seeker_id', 'recruiter_id', name='uq_conversations_pair'),
    )
    op.create_index(
        op.f('ix_conversations_seeker_id'), 'conversations', ['seeker_id'], unique=False
    )
    op.create_index(
        op.f('ix_conversations_recruiter_id'), 'conversations', ['recruiter_id'], unique=False
    )
    op.create_table(
        'messages',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('conversation_id', sa.String(), nullable=False),
        sa.Column('sender_id', sa.String(), nullable=False),
        sa.Column('body', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('read_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['conversation_id'], ['conversations.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['sender_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(
        op.f('ix_messages_conversation_id'), 'messages', ['conversation_id'], unique=False
    )
    op.create_index(op.f('ix_messages_sender_id'), 'messages', ['sender_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_messages_sender_id'), table_name='messages')
    op.drop_index(op.f('ix_messages_conversation_id'), table_name='messages')
    op.drop_table('messages')
    op.drop_index(op.f('ix_conversations_recruiter_id'), table_name='conversations')
    op.drop_index(op.f('ix_conversations_seeker_id'), table_name='conversations')
    op.drop_table('conversations')
