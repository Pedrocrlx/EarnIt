"""Password/PIN hashing — async bcrypt wrappers.

bcrypt is deliberately slow (that's its security property), which would block
the event loop if run inline. Both helpers offload the work to the default
thread pool so request handling stays responsive under concurrent logins.
"""

import asyncio

import bcrypt


async def hash_secret(plain: str) -> str:
    """Return a bcrypt hash of `plain`.

    Runs in a thread pool to avoid blocking the event loop.
    """
    loop = asyncio.get_running_loop()
    hashed: bytes = await loop.run_in_executor(
        None, bcrypt.hashpw, plain.encode(), bcrypt.gensalt()
    )
    return hashed.decode()


async def verify_secret(plain: str, hashed: str) -> bool:
    """Return True iff `plain` matches `hashed`. Runs in a thread pool."""
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(
        None, bcrypt.checkpw, plain.encode(), hashed.encode()
    )
