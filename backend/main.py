import httpx
from fastapi import FastAPI

app = FastAPI()


@app.get("/")
def read_root():
    return {"Hello": "World"}


@app.post("/test-email")
async def send_test_email():
    """
    Sends a test email to pedro@gmail.com using Mailpit's REST API.
    Assumes Mailpit is accessible at http://mailpit:8025 (internal docker network).
    """
    # Use 'mailpit' if running in Docker, 'localhost' if running locally
    mailpit_host = "mailpit"
    url = f"http://{mailpit_host}:8025/api/v1/send"

    payload = {
        "From": {"Name": "EarnIt System", "Email": "system@earnit.local"},
        "To": [{"Name": "Pedro", "Email": "pedro@gmail.com"}],
        "Subject": "Mailpit Test - Lorem Ipsum",
        "Text": "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod "
        "tempor incididunt ut labore et dolore magna aliqua.",
        "HTML": "<h1>Lorem Ipsum</h1><p>Lorem ipsum dolor sit amet</p>",
    }

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(url, json=payload)
            response.raise_for_status()
            return {"status": "success", "mailpit_response": response.json()}
    except httpx.ConnectError:
        # Fallback for local development outside Docker
        url = "http://localhost:8025/api/v1/send"
        async with httpx.AsyncClient() as client:
            response = await client.post(url, json=payload)
            return {"status": "success", "mailpit_response": response.json(), "mode": "local"}
    except Exception as e:
        return {"status": "error", "message": str(e)}
