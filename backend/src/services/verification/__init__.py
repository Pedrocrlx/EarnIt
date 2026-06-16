"""Stateless email-verification service.

`core` holds the global HMAC engine; per-purpose modules (`account`,
`password_reset`, `pin_reset`) hold the orchestration for each flow.
"""

from src.services.verification import account, core, password_reset, pin_reset

__all__ = ["account", "core", "password_reset", "pin_reset"]
