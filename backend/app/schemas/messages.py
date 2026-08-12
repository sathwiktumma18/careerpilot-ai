from pydantic import BaseModel, Field


class StartConversationRequest(BaseModel):
    """Start (or fetch) a thread with another user."""
    user_id: str = Field(min_length=1)


class SendMessageRequest(BaseModel):
    body: str = Field(min_length=1, max_length=4000)


class MessageOut(BaseModel):
    id: str
    conversation_id: str
    sender_id: str
    body: str
    created_at: str
    read: bool


class ConversationLite(BaseModel):
    """One row in the inbox — the other participant + a preview."""
    id: str
    other_user_id: str
    other_name: str
    other_role: str
    other_headline: str = ""
    preview: str
    last_message_at: str
    unread_count: int


class ConversationDetail(BaseModel):
    id: str
    seeker_id: str
    recruiter_id: str
    # Participant display info so a deep-linked thread can name the other side
    # without an extra inbox fetch.
    seeker_name: str = ""
    recruiter_name: str = ""
    seeker_role: str = "job_seeker"
    recruiter_role: str = "recruiter"
    messages: list[MessageOut]
    unread_count: int
