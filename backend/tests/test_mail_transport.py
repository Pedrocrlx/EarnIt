"""Exercise the application's mail client against a real, local SMTP server."""

import asyncio
import ssl
from email import policy
from email.parser import BytesParser

import pytest
import pytest_asyncio
import trustme
from aiosmtpd.smtp import SMTP, AuthResult, LoginPassword
from fastapi_mail import MessageSchema, MessageType
from fastapi_mail.errors import ConnectionErrors

from src.config import Settings
from src.mail import create_mail_client


@pytest.fixture
def mail_environment(monkeypatch):
    # Do not inherit SMTP credentials or flags from a developer's environment.
    for key in (
        "MAIL_SERVER",
        "MAIL_PORT",
        "MAIL_FROM",
        "MAIL_USERNAME",
        "MAIL_PASSWORD",
        "MAIL_STARTTLS",
        "MAIL_SSL_TLS",
        "MAIL_USE_CREDENTIALS",
        "MAIL_VALIDATE_CERTS",
        "SUPPRESS_SEND",
        "CERT_BUNDLE",
    ):
        monkeypatch.delenv(key, raising=False)


@pytest_asyncio.fixture
async def smtp_server(request, tmp_path, monkeypatch, mail_environment):
    secure = request.param
    messages = []
    authentications = []
    protocols = []
    ca = trustme.CA()
    certificate = ca.issue_cert("localhost")
    tls_context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    certificate.configure_cert(tls_context)
    ca_path = tmp_path / "ca.pem"
    ca.cert_pem.write_to_path(ca_path)
    monkeypatch.setenv("SSL_CERT_FILE", str(ca_path))

    class Handler:
        async def handle_DATA(self, server, session, envelope):
            messages.append(
                {
                    "sender": envelope.mail_from,
                    "recipients": envelope.rcpt_tos,
                    "message": BytesParser(policy=policy.default).parsebytes(
                        envelope.content
                    ),
                    "tls": bool(session.ssl),
                    "authenticated": bool(session.authenticated),
                }
            )
            return "250 Message accepted"

    def authenticate(server, session, envelope, mechanism, auth_data):
        authentications.append(bool(session.ssl))
        valid = isinstance(auth_data, LoginPassword) and (
            auth_data.login == b"smtp-user" and auth_data.password == b"smtp-test-key"
        )
        return AuthResult(success=valid, handled=False)

    def protocol_factory():
        protocol = SMTP(
            Handler(),
            tls_context=tls_context if secure else None,
            require_starttls=secure,
            auth_required=secure,
            authenticator=authenticate,
        )
        protocols.append(protocol)
        return protocol

    loop = asyncio.get_running_loop()
    server = await loop.create_server(protocol_factory, "127.0.0.1", 0)
    monkeypatch.setenv("MAIL_SERVER", "localhost")
    monkeypatch.setenv("MAIL_PORT", str(server.sockets[0].getsockname()[1]))
    monkeypatch.setenv("MAIL_FROM", "noreply@earnit.app")
    if secure:
        monkeypatch.setenv("MAIL_STARTTLS", "true")
        monkeypatch.setenv("MAIL_USE_CREDENTIALS", "true")
        monkeypatch.setenv("MAIL_USERNAME", "smtp-user")
        monkeypatch.setenv("MAIL_PASSWORD", "smtp-test-key")
    try:
        yield messages, authentications
    finally:
        server.close()
        for protocol in protocols:
            if protocol.transport:
                protocol.transport.close()
        await server.wait_closed()


async def send_code(template="verification_code.html"):
    client = create_mail_client(Settings())
    await client.send_message(
        MessageSchema(
            subject="EarnIt code",
            recipients=["parent@example.com"],
            template_body={"code": "ABC234", "expiry_minutes": 10},
            subtype=MessageType.html,
        ),
        template_name=template,
    )


@pytest.mark.parametrize("smtp_server", [False, True], indirect=True)
@pytest.mark.parametrize(
    "template",
    [
        "verification_code.html",
        "password_reset_code.html",
        "pin_reset_code.html",
    ],
)
async def test_delivers_rendered_code(smtp_server, template):
    messages, authentications = smtp_server
    await send_code(template)
    assert len(messages) == 1
    delivery = messages[0]
    assert delivery["sender"] == "noreply@earnit.app"
    assert delivery["recipients"] == ["parent@example.com"]
    assert delivery["message"]["Subject"] == "EarnIt code"
    html = delivery["message"].get_body(preferencelist=("html",)).get_content()
    assert "ABC234" in html
    assert "10 minutos" in html
    secure = Settings().MAIL_STARTTLS
    assert delivery["tls"] is secure
    assert delivery["authenticated"] is secure
    assert authentications == ([True] if secure else [])


@pytest.mark.parametrize("smtp_server", [True], indirect=True)
async def test_rejects_untrusted_certificate(smtp_server, monkeypatch):
    # Restore system trust; the temporary CA must now be rejected.
    monkeypatch.delenv("SSL_CERT_FILE")
    with pytest.raises(ConnectionErrors, match="CERTIFICATE_VERIFY_FAILED"):
        await send_code()
    messages, authentications = smtp_server
    assert messages == []
    assert authentications == []


@pytest.mark.parametrize("smtp_server", [True], indirect=True)
async def test_rejects_invalid_credentials(smtp_server, monkeypatch):
    monkeypatch.setenv("MAIL_PASSWORD", "wrong-key")
    with pytest.raises(ConnectionErrors, match="535"):
        await send_code()
    messages, authentications = smtp_server
    assert messages == []
    assert authentications and all(authentications)


def test_rejects_conflicting_tls_modes(mail_environment, monkeypatch):
    monkeypatch.setenv("MAIL_STARTTLS", "true")
    monkeypatch.setenv("MAIL_SSL_TLS", "true")
    with pytest.raises(ValueError, match="mutually exclusive"):
        Settings()


@pytest.mark.parametrize("missing", ["MAIL_USERNAME", "MAIL_PASSWORD"])
def test_requires_complete_credentials(mail_environment, monkeypatch, missing):
    monkeypatch.setenv("MAIL_USE_CREDENTIALS", "true")
    monkeypatch.setenv("MAIL_USERNAME", "smtp-user")
    monkeypatch.setenv("MAIL_PASSWORD", "smtp-test-key")
    monkeypatch.delenv(missing)
    with pytest.raises(ValueError, match="are required"):
        Settings()
