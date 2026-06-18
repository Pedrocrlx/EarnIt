"""Stateless email-verification service.

`core` holds the global HMAC engine; `flows` holds the user-facing orchestration
(rotate/verify/send), parameterised by purpose.
"""

from src.services.verification import core, flows

__all__ = ["core", "flows"]
