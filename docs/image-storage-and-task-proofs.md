# EarnIt Image Storage and Task Proofs

## Purpose

EarnIt uses uploaded images for two different purposes:

1. persistent child profile avatars;
2. temporary photographic proof attached to task submissions.

Although both flows begin with an HTML file input and accept the same image
formats, their storage lifetime and business rules are intentionally different.

## Supported Images

Both avatar and task-proof uploads accept:

- JPEG;
- PNG;
- WebP;
- a maximum file size of 5 MiB.

The frontend checks the MIME type and size before upload. The backend repeats
these checks and validates the file signature, so renaming an unsupported file
to an image extension is not sufficient.

## Child Profile Avatars

### Upload flow

1. The parent selects an image using an `<input type="file">`.
2. The frontend creates `FormData` with the file under the `avatar` field.
3. The file is sent to:

   ```text
   POST /api/v1/profiles/children/{child_id}/avatar
   ```

4. The backend verifies that the child belongs to the authenticated family.
5. The image is stored using the child ID as its filename.
6. The child's `avatar_url` is updated to the authenticated image endpoint.

### Storage

In the integrated Docker Compose stack, avatars are stored at:

```text
/app/uploads/avatars
```

This directory is backed by the named Docker volume:

```text
avatar_uploads
```

The avatar therefore survives API container recreation and application
restarts.

### Replacement and lifetime

- An avatar is optional.
- Uploading another avatar replaces the previous file for that child.
- The image remains available until it is replaced or the Docker volume is
  removed.
- Existing children can receive or replace an avatar from the profile
  management page.
- Avatars selected during onboarding are uploaded after the child profile is
  created.

## Task Submission Proofs

### Upload flow

1. The child selects **Enviar** or **Reenviar** for a task.
2. EarnIt opens a dialog requiring a photograph.
3. The child selects or captures an image through an
   `<input type="file" capture="environment">`.
4. A local preview is displayed before submission.
5. The frontend creates `FormData` with the file under the `proof` field.
6. The proof is sent together with the task submission:

   ```text
   POST /api/v1/children/{child_id}/tasks/{task_id}/submit
   ```

   A rejected task uses:

   ```text
   PATCH /api/v1/children/{child_id}/submissions/{submission_id}
   ```

7. The backend refuses the submission when the photograph is missing or
   invalid.
8. The file is stored using the submission ID and `proof_url` is returned with
   the submission.

### Storage

Task proofs are stored separately from avatars at:

```text
/app/uploads/submission-proofs
```

This directory is backed by:

```text
submission_proofs
```

Separating both volumes prevents temporary task evidence from being mixed with
persistent profile images.

### Parent review

While a submission is pending, the parent can see the photograph:

- in the parent dashboard submission preview;
- on the complete submissions management page;
- at a larger size using the **Abrir imagem** action.

The proof endpoint is authenticated and checks that the submission belongs to
the current family:

```text
GET /api/v1/tasks/submissions/{submission_id}/proof
```

### Deletion and lifetime

Task evidence is temporary:

- approving a submission deletes the image from the volume;
- rejecting a submission also deletes the image;
- after deletion, `proof_url` is cleared;
- a rejected task requires a new photograph when the child resubmits it;
- the new photograph replaces any previous proof for that submission.

This means the photograph exists only during the parent-review window.

## Database Changes

`task_submissions` includes a nullable `proof_url` column.

It is nullable for compatibility with historical submissions created before
photographic proof became mandatory. New submissions and resubmissions require
a valid proof before entering the `pending` state.

The schema change is managed by the Alembic migration:

```text
a8c5e7f9b1d3_add_submission_proof_url.py
```

## Configuration

The backend supports these optional environment variables:

```text
AVATAR_UPLOAD_DIR=/app/uploads/avatars
AVATAR_MAX_BYTES=5242880
SUBMISSION_PROOF_UPLOAD_DIR=/app/uploads/submission-proofs
SUBMISSION_PROOF_MAX_BYTES=5242880
```

## Summary

| Image type | Required | Stored in | Lifetime |
| --- | --- | --- | --- |
| Child avatar | No | `avatar_uploads` | Persistent until replaced or volume removal |
| Task proof | Yes for submission | `submission_proofs` | Deleted after approval or rejection |
