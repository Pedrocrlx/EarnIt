# Mail (Mailpit)

This directory holds the **Mailpit** service definition — the dev/test SMTP
sink that the backend sends verification, password-reset, and PIN-reset
emails to. It's isolated here, separate from the EarnIt application services
(`compose.yaml` at the repo root, `backend/compose.yaml`), so it can be
started, stopped, and debugged independently — e.g. you can read captured
emails without bringing up the full stack, or restart Mailpit without
touching `db`/`api`.

## How it's wired in

[`compose.yaml`](compose.yaml) defines a single `mailpit` service. Both the
root [`compose.yaml`](../../compose.yaml) and [`backend/compose.yaml`](../compose.yaml)
pull it in via the Compose [`include:`](https://docs.docker.com/compose/multiple-compose-files/include/)
directive:

```yaml
include:
  - backend/mail/compose.yaml   # from the repo root
  - mail/compose.yaml           # from backend/
```

`include` merges the service into the same Compose project/network as the
including file, so the backend can still reach it at `MAIL_SERVER=mailpit`
(`MAIL_PORT=1025`) regardless of which compose file you ran.

## Usage

Starting either the full stack (`docker compose up --build` from the repo
root) or the backend-only stack (`docker compose up --build` from
`backend/`) brings Mailpit up automatically as part of that project.

To work with Mailpit on its own:

```bash
docker compose -f backend/mail/compose.yaml up -d      # start just Mailpit
docker compose -f backend/mail/compose.yaml logs -f    # tail its logs
docker compose -f backend/mail/compose.yaml down       # stop it
```

From `backend/`, the same is available via `make mail-up` / `make mail-logs`
/ `make mail-down` (see [`backend/Makefile`](../Makefile)).

## Endpoints

- **Web UI** (read captured emails): http://localhost:8025
- **SMTP sink** (what the API sends to): `localhost:1025`

## CI

`.github/workflows/ci.yml` does **not** use this file — CI defines `mailpit`
directly as a GitHub Actions service container, independent of these Compose
files.
