"""Messaging service — one thread per (seeker, recruiter) pair.

`start_conversation` is get-or-create (idempotent). Reads are participant-only:
a caller who isn't in the thread gets None (routes raise 404, matching the
no-existence-disclosure pattern used across the API). Fetching a thread marks
the other participant's messages as read, driving the inbox unread counts.
"""
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.message import Conversation, Message
from app.models.user import ROLE_JOB_SEEKER, ROLE_RECRUITER, User
from app.schemas.messages import ConversationDetail, ConversationLite, MessageOut


class MessageOwnershipError(Exception):
    """Caller isn't a participant in the thread (or it doesn't exist)."""


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _is_participant(conversation: Conversation, user_id: str) -> bool:
    return user_id in (conversation.seeker_id, conversation.recruiter_id)


def start_conversation(db: Session, *, user: User, other_user: User) -> Conversation:
    """Get-or-create the thread between a seeker and a recruiter.

    Raises MessageOwnershipError when the pair is invalid (same role).
    """
    if user.role == ROLE_JOB_SEEKER and other_user.role == ROLE_RECRUITER:
        seeker_id, recruiter_id = user.id, other_user.id
    elif user.role == ROLE_RECRUITER and other_user.role == ROLE_JOB_SEEKER:
        seeker_id, recruiter_id = other_user.id, user.id
    else:
        raise MessageOwnershipError("Messaging is between a job seeker and a recruiter")

    conversation = db.scalar(
        select(Conversation).where(
            Conversation.seeker_id == seeker_id,
            Conversation.recruiter_id == recruiter_id,
        )
    )
    if conversation is not None:
        return conversation
    conversation = Conversation(seeker_id=seeker_id, recruiter_id=recruiter_id)
    db.add(conversation)
    db.commit()
    db.refresh(conversation)
    return conversation


def list_conversations(db: Session, user_id: str) -> list[ConversationLite]:
    """The caller's inbox: threads newest-last-message first, each with the
    other participant's name/role/headline, a preview, and the unread count."""
    convos = db.scalars(
        select(Conversation)
        .where(
            (Conversation.seeker_id == user_id) | (Conversation.recruiter_id == user_id)
        )
        .order_by(Conversation.last_message_at.desc())
    ).all()

    out: list[ConversationLite] = []
    for c in convos:
        other = c.recruiter if user_id == c.seeker_id else c.seeker
        messages = sorted(c.messages, key=lambda m: m.created_at)
        last = messages[-1] if messages else None
        unread = sum(
            1 for m in messages if m.sender_id != user_id and m.read_at is None
        )
        # Recruiters have no resume analysis, so their headline is their profile
        # title (empty for now) — the UI falls back to the role label.
        out.append(
            ConversationLite(
                id=c.id,
                other_user_id=other.id,
                other_name=other.name,
                other_role=other.role,
                other_headline="",
                preview=last.body if last else "Start a conversation",
                last_message_at=(last.created_at if last else c.last_message_at).isoformat(),
                unread_count=unread,
            )
        )
    return out


def get_conversation(
    db: Session, conversation_id: str, user_id: str
) -> ConversationDetail | None:
    """The full thread for a participant. Marks the other side's messages read."""
    conversation = db.get(Conversation, conversation_id)
    if conversation is None or not _is_participant(conversation, user_id):
        return None

    messages = sorted(conversation.messages, key=lambda m: m.created_at)
    # Reading the thread clears the other participant's unread messages.
    touched = False
    for m in messages:
        if m.sender_id != user_id and m.read_at is None:
            m.read_at = _now()
            touched = True
    if touched:
        db.commit()

    return ConversationDetail(
        id=conversation.id,
        seeker_id=conversation.seeker_id,
        recruiter_id=conversation.recruiter_id,
        seeker_name=conversation.seeker.name if conversation.seeker else "",
        recruiter_name=conversation.recruiter.name if conversation.recruiter else "",
        seeker_role=conversation.seeker.role if conversation.seeker else "job_seeker",
        recruiter_role=conversation.recruiter.role if conversation.recruiter else "recruiter",
        messages=[
            MessageOut(
                id=m.id,
                conversation_id=m.conversation_id,
                sender_id=m.sender_id,
                body=m.body,
                created_at=m.created_at.isoformat(),
                read=m.read_at is not None,
            )
            for m in messages
        ],
        unread_count=0,
    )


def send_message(
    db: Session, conversation_id: str, sender_id: str, body: str
) -> MessageOut:
    """Append a message. Raises MessageOwnershipError when not a participant."""
    conversation = db.get(Conversation, conversation_id)
    if conversation is None or not _is_participant(conversation, sender_id):
        raise MessageOwnershipError(conversation_id)

    message = Message(conversation_id=conversation_id, sender_id=sender_id, body=body.strip())
    conversation.last_message_at = _now()
    db.add(message)
    db.commit()
    db.refresh(message)
    return MessageOut(
        id=message.id,
        conversation_id=message.conversation_id,
        sender_id=message.sender_id,
        body=message.body,
        created_at=message.created_at.isoformat(),
        read=False,
    )


def conversation_between(db: Session, seeker_id: str, recruiter_id: str) -> Conversation | None:
    """The existing thread for the recruiter candidate detail, or None."""
    return db.scalar(
        select(Conversation).where(
            Conversation.seeker_id == seeker_id,
            Conversation.recruiter_id == recruiter_id,
        )
    )
