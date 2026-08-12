"""Messaging endpoints — the inbox + thread API for both roles.

Conversations are one-per (seeker, recruiter) pair and participant-only:
anything outside the thread 404s like it doesn't exist (no existence disclosure).
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.user import User
from app.schemas.messages import (
    ConversationDetail,
    ConversationLite,
    MessageOut,
    SendMessageRequest,
    StartConversationRequest,
)
from app.services.auth_service import get_current_user
from app.services.message_service import (
    MessageOwnershipError,
    get_conversation,
    list_conversations,
    send_message,
    start_conversation,
)

router = APIRouter(prefix="/api/messages", tags=["messages"])


@router.get("", response_model=list[ConversationLite])
def inbox(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[ConversationLite]:
    return list_conversations(db, user.id)


@router.post("", response_model=ConversationDetail)
def open_conversation(
    payload: StartConversationRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ConversationDetail:
    other = db.get(User, payload.user_id)
    if other is None:
        raise HTTPException(status_code=404, detail="User not found")
    try:
        conversation = start_conversation(db, user=user, other_user=other)
    except MessageOwnershipError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    detail = get_conversation(db, conversation.id, user.id)
    assert detail is not None  # the caller just created/joined this thread
    return detail


@router.get("/{conversation_id}", response_model=ConversationDetail)
def thread(
    conversation_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ConversationDetail:
    detail = get_conversation(db, conversation_id, user.id)
    if detail is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return detail


@router.post("/{conversation_id}", response_model=MessageOut, status_code=201)
def send(
    conversation_id: str,
    payload: SendMessageRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> MessageOut:
    try:
        return send_message(db, conversation_id, user.id, payload.body)
    except MessageOwnershipError as exc:
        raise HTTPException(status_code=404, detail="Conversation not found") from exc
