"""resume versions + social sign-in columns

- create resume_versions (one snapshot per resume), backfill each existing
  resumes row into version 1
- slim resumes to the logical group: title, current_version_id, view_count,
  last_viewed_at; drop the file/analysis columns that now live on versions
- users: add nullable oauth_provider + oauth_provider_sub (unique pair)

Revision ID: b3c5e7f9a1d3
Revises: a2c4e6f8b0d2
Create Date: 2026-08-07 00:00:00.000000
"""
from typing import Sequence, Union
from uuid import uuid4

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b3c5e7f9a1d3'
down_revision: Union[str, None] = 'a2c4e6f8b0d2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- resume_versions -----------------------------------------------------
    op.create_table(
        'resume_versions',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('resume_id', sa.String(), nullable=False),
        sa.Column('version_no', sa.Integer(), nullable=False),
        sa.Column('file_name', sa.String(), nullable=False),
        sa.Column('file_path', sa.String(), nullable=False),
        sa.Column('status', sa.String(), nullable=False),
        sa.Column('ats_score', sa.Integer(), nullable=True),
        sa.Column('text', sa.String(), nullable=True),
        sa.Column('analysis', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('analyzed_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['resume_id'], ['resumes.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('resume_id', 'version_no', name='uq_resume_versions_group_no'),
    )
    op.create_index(op.f('ix_resume_versions_resume_id'), 'resume_versions', ['resume_id'], unique=False)

    # Backfill: every existing resume row becomes version 1.
    conn = op.get_bind()
    rows = conn.execute(sa.text(
        "SELECT id, file_name, file_path, status, ats_score, text, analysis, created_at, analyzed_at "
        "FROM resumes"
    )).fetchall()
    for r in rows:
        conn.execute(sa.text(
            """
            INSERT INTO resume_versions
              (id, resume_id, version_no, file_name, file_path, status, ats_score, text, analysis, created_at, analyzed_at)
            VALUES (:id, :resume_id, 1, :file_name, :file_path, :status, :ats_score, :text, :analysis, :created_at, :analyzed_at)
            """
        ), {
            "id": str(uuid4()),
            "resume_id": r.id,
            "file_name": r.file_name,
            "file_path": r.file_path,
            "status": r.status,
            "ats_score": r.ats_score,
            "text": r.text,
            "analysis": r.analysis,
            "created_at": r.created_at,
            "analyzed_at": r.analyzed_at,
        })

    # --- resumes: add group columns, backfill, drop the per-version columns --
    op.add_column('resumes', sa.Column('title', sa.String(), nullable=True))
    op.add_column('resumes', sa.Column('current_version_id', sa.String(), nullable=True))
    op.add_column('resumes', sa.Column('view_count', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('resumes', sa.Column('last_viewed_at', sa.DateTime(timezone=True), nullable=True))

    conn.execute(sa.text("UPDATE resumes SET title = file_name"))
    conn.execute(sa.text(
        """
        UPDATE resumes SET current_version_id = (
            SELECT rv.id FROM resume_versions rv WHERE rv.resume_id = resumes.id AND rv.version_no = 1
        )
        """
    ))
    # Note: no DB-level FK on resumes.current_version_id — SQLite can't
    # ALTER-ADD constraints. The ORM relationship + versions cascade manage it.

    op.drop_column('resumes', 'analysis')
    op.drop_column('resumes', 'text')
    op.drop_column('resumes', 'ats_score')
    op.drop_column('resumes', 'status')
    op.drop_column('resumes', 'file_path')
    op.drop_column('resumes', 'file_name')
    op.drop_column('resumes', 'analyzed_at')

    # --- users: social sign-in columns --------------------------------------
    op.add_column('users', sa.Column('oauth_provider', sa.String(), nullable=True))
    op.add_column('users', sa.Column('oauth_provider_sub', sa.String(), nullable=True))
    # Unique index (not a constraint) so it works on SQLite; NULLs don't collide.
    op.create_index('ix_users_oauth', 'users', ['oauth_provider', 'oauth_provider_sub'], unique=True)


def downgrade() -> None:
    # users
    op.drop_index('ix_users_oauth', table_name='users')
    op.drop_column('users', 'oauth_provider_sub')
    op.drop_column('users', 'oauth_provider')

    # resumes: recreate the per-version columns from version 1, then drop group cols
    op.add_column('resumes', sa.Column('file_name', sa.String(), nullable=True))
    op.add_column('resumes', sa.Column('file_path', sa.String(), nullable=True))
    op.add_column('resumes', sa.Column('status', sa.String(), nullable=True))
    op.add_column('resumes', sa.Column('ats_score', sa.Integer(), nullable=True))
    op.add_column('resumes', sa.Column('text', sa.String(), nullable=True))
    op.add_column('resumes', sa.Column('analysis', sa.JSON(), nullable=True))
    op.add_column('resumes', sa.Column('analyzed_at', sa.DateTime(timezone=True), nullable=True))
    conn = op.get_bind()
    conn.execute(sa.text(
        """
        UPDATE resumes SET
            file_name = rv.file_name,
            file_path = rv.file_path,
            status = rv.status,
            ats_score = rv.ats_score,
            text = rv.text,
            analysis = rv.analysis,
            analyzed_at = rv.analyzed_at
        FROM resume_versions rv
        WHERE rv.resume_id = resumes.id AND rv.version_no = 1
        """
    ))
    op.drop_column('resumes', 'last_viewed_at')
    op.drop_column('resumes', 'view_count')
    op.drop_column('resumes', 'current_version_id')
    op.drop_column('resumes', 'title')

    # resume_versions
    op.drop_index(op.f('ix_resume_versions_resume_id'), table_name='resume_versions')
    op.drop_table('resume_versions')
