#!/usr/bin/env python3
"""
Seed a dev account and print its access_token cookie value.

Run from backend/:
    uv run quickaccess/seed.py
    uv run quickaccess/seed.py --email custom@test.com --password Pass123! --family-name Demo
"""
from __future__ import annotations

import argparse
import asyncio
import hashlib
import hmac
import os
import sys
from datetime import UTC
from pathlib import Path
from uuid import UUID

import asyncpg
import httpx


# ── .env loader ───────────────────────────────────────────────────────────────


def _load_dotenv(path: Path) -> None:
    if not path.exists():
        return
    for raw in path.read_text().splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, val = line.partition("=")
        os.environ.setdefault(key.strip(), val.strip().strip("\"'"))


_load_dotenv(Path(__file__).parent.parent / ".env")


# ── config (mirrors src/core/config.py) ───────────────────────────────────────

BASE_URL = os.getenv("BASE_URL", "http://localhost:8000")
SECRET_KEY = os.environ["SECRET_KEY"]
CHARSET = os.getenv("VERIFICATION_CODE_CHARSET", "ABCDEFGHJKLMNPQRSTUVWXYZ23456789")
CODE_LEN = int(os.getenv("VERIFICATION_CODE_LENGTH", "8"))

PG_USER = os.environ["POSTGRES_USER"]
PG_PASS = os.environ["POSTGRES_PASSWORD"]
PG_HOST = os.getenv("POSTGRES_HOST", "localhost")
PG_PORT = int(os.getenv("POSTGRES_PORT", "5432"))
PG_DB = os.environ["POSTGRES_DB"]

_PURPOSE = "account_verification"


# ── helpers ───────────────────────────────────────────────────────────────────


def _derive_code(user_id: UUID, anchor) -> str:
    """Same HMAC logic as src/services/verification/core.py::generate_code."""
    msg = f"{user_id}:{_PURPOSE}:{anchor.isoformat()}".encode()
    digest = hmac.new(SECRET_KEY.encode(), msg, hashlib.sha256).digest()
    return "".join(CHARSET[b % len(CHARSET)] for b in digest[:CODE_LEN])


def _cookie(response: httpx.Response, name: str) -> str | None:
    val = response.cookies.get(name)
    if val:
        return val
    for chunk in response.headers.get("set-cookie", "").split(","):
        if f"{name}=" in chunk:
            return chunk.split(f"{name}=", 1)[1].split(";")[0].strip()
    return None


def _die(msg: str) -> None:
    print(f"\nError: {msg}", file=sys.stderr)
    sys.exit(1)


# ── core flow ─────────────────────────────────────────────────────────────────


async def seed(email: str, password: str, family_name: str) -> None:
    try:
        conn = await asyncpg.connect(
            user=PG_USER, password=PG_PASS, host=PG_HOST, port=PG_PORT, database=PG_DB
        )
    except Exception as exc:
        _die(f"Cannot connect to Postgres: {exc}\nIs the DB container running?")

    async with httpx.AsyncClient(base_url=BASE_URL) as http:
        # 1. Try login — account may already be verified
        login_res = await http.post(
            "/api/v1/auth/login", json={"email": email, "password": password}
        )
        if login_res.status_code == 200:
            await conn.close()
            _print(email, password, _cookie(login_res, "access_token"), "existing verified account")
            return

        # 2. Register
        reg_res = await http.post(
            "/api/v1/auth/register",
            json={"email": email, "password": password, "family_name": family_name},
        )

        if reg_res.status_code == 201:
            pending_token = _cookie(reg_res, "pending_verification_token")
        elif reg_res.status_code == 409:
            # Already in limbo — login's 403 re-issues a fresh pending_verification_token
            pending_token = _cookie(login_res, "pending_verification_token")
            if not pending_token:
                _die(
                    "Account exists but login didn't return a pending_verification_token.\n"
                    "The account may be disabled or verified with a different password."
                )
        else:
            _die(f"Registration failed {reg_res.status_code}: {reg_res.text}")

        # 3. Derive verification code straight from DB (no email needed)
        row = await conn.fetchrow(
            "SELECT id, updated_at FROM users WHERE email = $1", email
        )
        await conn.close()

        if row is None:
            _die("User row not found in DB after registration.")

        code = _derive_code(UUID(str(row["id"])), row["updated_at"].replace(tzinfo=UTC))

        # 4. Verify
        verify_res = await http.post(
            "/api/v1/auth/verify",
            json={"code": code},
            cookies={"pending_verification_token": pending_token},
        )
        if verify_res.status_code != 200:
            _die(f"Verification failed {verify_res.status_code}: {verify_res.text}")

        _print(email, password, _cookie(verify_res, "access_token"), "newly registered account")


def _print(email: str, password: str, token: str | None, note: str) -> None:
    if not token:
        _die("access_token not found in response.")

    rule = "─" * 62
    print(f"\n{rule}")
    print(f"  EarnIt dev account  ({note})")
    print(rule)
    print(f"  email:    {email}")
    print(f"  password: {password}")
    print()
    print("  access_token:")
    print(f"    {token}")
    print()
    print(f"  FastAPI docs → {BASE_URL}/docs → click Authorize → paste the access_token value")
    print(rule)


# ── entry point ───────────────────────────────────────────────────────────────


def main() -> None:
    p = argparse.ArgumentParser(description="Seed a dev EarnIt account and print its access_token.")
    p.add_argument("--email", default="dev@example.com", metavar="EMAIL")
    p.add_argument("--password", default="Password123!", metavar="PASS")
    p.add_argument("--family-name", default="DevFamily", metavar="NAME")
    args = p.parse_args()
    asyncio.run(seed(args.email, args.password, args.family_name))


if __name__ == "__main__":
    main()
