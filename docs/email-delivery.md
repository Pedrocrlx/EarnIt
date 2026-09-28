# Email delivery: Mailpit and Brevo

The same FastMail SMTP client sends account verification, password reset and
parental PIN reset messages. Templates and code lifetimes are shared across
environments.

## Development

Run the usual `docker compose up -d` at the repository root, or in `backend/` for
the backend alone. Both configurations use `mailpit:1025`, without credentials or
TLS. Open <http://localhost:8025> to inspect captured messages.

When running Python on the host, use `MAIL_SERVER=localhost` and `MAIL_PORT=1025`.
The default settings require no Brevo account. Compose explicitly selects the
local transport, so production SMTP credentials in a mounted `.env` do not
silently redirect development mail.

## Brevo on the VPS

For production behind the VPS's main Nginx, follow the
[VPS deployment guide](deployment-vps.md). It uses `compose.prod.yaml` and a
single root `.env` containing the Brevo settings alongside the application
settings. The overlay below is only for testing real email with the development
stack; its separate env file is not needed in production.

This overlay configures **email only**. The existing Compose application still
uses development settings for the frontend, source mounts and HTTP proxy; this
is not a complete production deployment configuration.

1. In Brevo, add and authenticate your domain using the DNS records provided by
   the dashboard, then configure the sender address for that domain.
2. In **SMTP & API → SMTP**, copy the SMTP login and generate an SMTP key. Use
   the SMTP key, not an HTTP API key or the password for your Brevo account.
3. At the repository root, copy the example and replace its placeholders:

   ```sh
   cp backend/.env.brevo.example backend/.env.brevo.local
   chmod 600 backend/.env.brevo.local
   ```

   `.env.brevo.local` is ignored by Git. Keep the existing backend `.env` for
   database and application settings. Single-quote a key containing `$` so
   Compose does not interpolate it.

4. With Docker Compose **2.24.4 or newer**, validate and start with the overlay:

   ```sh
   docker compose --env-file backend/.env.brevo.local -f compose.yaml -f compose.dev.yaml config --quiet
   docker compose --env-file backend/.env.brevo.local -f compose.yaml -f compose.dev.yaml up -d
   ```

   Use both files and the same env file on subsequent Compose commands. Prefer
   `config --quiet` when validating: ordinary `config` prints resolved secrets.

   For the backend-only stack, run from the repository root with
   `-f backend/compose.yaml -f compose.dev.yaml` instead.

The overlay fixes the server to `smtp-relay.brevo.com:587`, requires sender and
credentials, enables STARTTLS and certificate validation, and disables implicit
TLS. Ensure the VPS allows outbound connections to port 587.

Mailpit is placed behind the `development-mail` profile, its host ports are
removed, and the API no longer depends on it. Do not enable that profile in
production. If migrating an already-running development stack, first stop and
remove its Mailpit container using the original Compose configuration:

```sh
docker compose stop mailpit
docker compose rm -f mailpit
```

For a backend-only stack, add `-f backend/compose.yaml` to those two commands.
The overlay does not automatically stop containers started by earlier commands.

For deployments without Compose, set the following environment variables in
addition to the application's required database and signing-key settings:

```dotenv
MAIL_SERVER=smtp-relay.brevo.com
MAIL_PORT=587
MAIL_FROM=noreply@your-domain.com
MAIL_USERNAME=your-brevo-smtp-login
MAIL_PASSWORD='your-brevo-smtp-key'
MAIL_STARTTLS=True
MAIL_SSL_TLS=False
MAIL_USE_CREDENTIALS=True
MAIL_VALIDATE_CERTS=True
```

`MAIL_STARTTLS` and `MAIL_SSL_TLS` are mutually exclusive. Enabling credentials
requires a nonempty username and password. Defaults for the four switches are
`False`, `False`, `False` and `True`, respectively.

## Verification

Automated tests use a local SMTP server with a temporary certificate authority
to exercise plaintext delivery, STARTTLS, authentication and rejection of
untrusted certificates. They do not contact Brevo or send real emails. Existing
API tests cover account verification and password/PIN recovery with captured
messages.

After configuring Brevo, use an account whose inbox you control to register,
receive the code and verify the account. Exercise password and PIN recovery as
well, respecting the existing code expiry/retry windows. Check Brevo's
transactional logs and the recipient inbox/spam folder: SMTP acceptance alone
does not prove inbox delivery. Never copy codes or SMTP keys into issue logs.

The free plan currently allows 300 messages per day; recheck your account's
quota before deployment. All verification, reset and resend messages consume
that quota. Quota exhaustion can delay time-sensitive codes.

References:

- [Brevo SMTP setup](https://help.brevo.com/hc/en-us/articles/7924908994450-Send-transactional-emails-using-Brevo-SMTP)
- [Brevo free plan limits](https://help.brevo.com/hc/en-us/articles/208580669-FAQs-What-are-the-limits-of-the-Free-plan)
- [Docker Compose merge rules](https://docs.docker.com/reference/compose-file/merge/)
