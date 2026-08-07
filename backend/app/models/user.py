from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import DateTime, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database.session import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    email: Mapped[str] = mapped_column(String, unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)
    # bcrypt hash — never store plaintext passwords.
    password_hash: Mapped[str] = mapped_column(String, nullable=False)
    # Password-reset: hash of a one-time reset token and when it expires. We store
    # the hash (not the raw token) so a DB leak can't be replayed to reset accounts.
    reset_token_hash: Mapped[str | None] = mapped_column(String, nullable=True)
    reset_token_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
