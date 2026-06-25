"""Validation and filesystem storage for task-submission proof images."""

from pathlib import Path
from uuid import UUID

import anyio
from fastapi import HTTPException, UploadFile

from src.config import settings

PROOF_CONTENT_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}


def _matches_image_type(data: bytes, content_type: str) -> bool:
    if content_type == "image/jpeg":
        return data.startswith(b"\xff\xd8\xff")
    if content_type == "image/png":
        return data.startswith(b"\x89PNG\r\n\x1a\n")
    if content_type == "image/webp":
        return len(data) >= 12 and data.startswith(b"RIFF") and data[8:12] == b"WEBP"
    return False


async def read_proof_upload(proof: UploadFile) -> tuple[bytes, str]:
    """Validate and read one required JPEG/PNG/WebP proof image."""
    content_type = proof.content_type or ""
    suffix = PROOF_CONTENT_TYPES.get(content_type)
    if suffix is None:
        raise HTTPException(
            status_code=415,
            detail="Proof must be a JPEG, PNG, or WebP image.",
        )

    data = await proof.read(settings.SUBMISSION_PROOF_MAX_BYTES + 1)
    if len(data) > settings.SUBMISSION_PROOF_MAX_BYTES:
        raise HTTPException(status_code=413, detail="Proof image is too large.")
    if not data:
        raise HTTPException(status_code=422, detail="Proof image is required.")
    if not _matches_image_type(data, content_type):
        raise HTTPException(status_code=422, detail="Proof image is invalid.")
    return data, suffix


def _replace_proof_file(
    directory: Path, submission_id: UUID, data: bytes, suffix: str
) -> Path:
    directory.mkdir(parents=True, exist_ok=True)
    for existing_file in directory.glob(f"{submission_id}.*"):
        existing_file.unlink(missing_ok=True)
    path = directory / f"{submission_id}{suffix}"
    path.write_bytes(data)
    return path


async def store_proof(submission_id: UUID, data: bytes, suffix: str) -> None:
    await anyio.to_thread.run_sync(
        _replace_proof_file,
        Path(settings.SUBMISSION_PROOF_UPLOAD_DIR),
        submission_id,
        data,
        suffix,
    )


def _find_proof_file(directory: Path, submission_id: UUID) -> Path | None:
    return next(directory.glob(f"{submission_id}.*"), None)


async def find_proof(submission_id: UUID) -> Path | None:
    return await anyio.to_thread.run_sync(
        _find_proof_file,
        Path(settings.SUBMISSION_PROOF_UPLOAD_DIR),
        submission_id,
    )


def _delete_proof_file(directory: Path, submission_id: UUID) -> None:
    for existing_file in directory.glob(f"{submission_id}.*"):
        existing_file.unlink(missing_ok=True)


async def delete_proof(submission_id: UUID) -> None:
    """Delete every stored proof variant for a reviewed submission."""
    await anyio.to_thread.run_sync(
        _delete_proof_file,
        Path(settings.SUBMISSION_PROOF_UPLOAD_DIR),
        submission_id,
    )


def proof_media_type(path: Path) -> str:
    return next(
        (
            content_type
            for content_type, suffix in PROOF_CONTENT_TYPES.items()
            if suffix == path.suffix
        ),
        "application/octet-stream",
    )
