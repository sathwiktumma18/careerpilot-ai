"""ORM models. Importing this package registers all tables on `Base.metadata`."""
from app.models.resume import Resume

__all__ = ["Resume"]
