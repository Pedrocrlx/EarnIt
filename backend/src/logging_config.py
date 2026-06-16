"""Logging setup — one stdlib config for the whole project.

Call configure_logging() once, before the app starts serving requests (see
main.py). Every module then gets its own logger via
``logging.getLogger(__name__)`` and inherits this configuration.

Rule: never log secrets. That means verification codes, passwords, PINs,
password/PIN hashes, and JWTs never appear in a log record. Once a request
has been resolved to an account, log its ``user_id`` (a non-enumerable UUID)
rather than the email address.
"""

import logging

from src.core.config import settings


def configure_logging() -> None:
    logging.basicConfig(
        level=settings.LOG_LEVEL,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )
