from contextlib import asynccontextmanager

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi_mail import MessageSchema, MessageType

from app.config import settings
from app.jobs.purge import scheduled_purge
from app.mail import mail

# APScheduler instance — started on app startup, shut down on app teardown.
scheduler = AsyncIOScheduler()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Run the limbo-user purge sweep every hour.
    scheduler.add_job(scheduled_purge, "interval", hours=1, id="limbo_purge")
    scheduler.start()
    yield
    scheduler.shutdown()


app = FastAPI(lifespan=lifespan)

# Allow the frontend dev servers and any origins listed in settings to send
# credentialed requests (cookies).
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/healthz")
async def health_check():
    return {"status": "ok"}


@app.post("/test-email")
async def send_test_email():
    """Dev endpoint: fires a test email through Mailpit SMTP to confirm the mail pipeline.

    Open http://localhost:8025 in a browser to see the captured message.
    """
    message = MessageSchema(
        subject="EarnIt – Mailpit Test",
        recipients=["test@example.com"],
        body="<h1>Mail pipeline OK</h1><p>fastapi-mail → Mailpit is working.</p>",
        subtype=MessageType.html,
    )
    await mail.send_message(message)
    return {"status": "success", "message": "Test email sent via SMTP → Mailpit."}
