"""Render checks for the email templates.

fastapi-mail renders these through Jinja2 at send time, and the suite mocks
send_message — so nothing else exercises the `{% extends "_base.html" %}`
inheritance. These render each template the same way fastapi-mail does and assert
the shared chrome + per-purpose copy both land.
"""

import pytest
from jinja2 import Environment, FileSystemLoader

from src.mail import _TEMPLATE_FOLDER

_env = Environment(loader=FileSystemLoader(_TEMPLATE_FOLDER), autoescape=True)

# template -> a distinctive phrase only that purpose's copy contains
_CASES = {
    "verification_code.html": "verify your EarnIt account",
    "password_reset_code.html": "reset your EarnIt password",
    "pin_reset_code.html": "reset your EarnIt parental PIN",
}


@pytest.mark.parametrize("template_name, phrase", _CASES.items())
def test_template_renders_with_shared_chrome_and_own_copy(template_name, phrase):
    html = _env.get_template(template_name).render(code="ABCD1234", expiry_minutes=10)

    # per-purpose copy (proves the child blocks rendered)
    assert phrase in html
    # shared base rendered: code, expiry, and the inlined styles + footer
    assert "ABCD1234" in html
    assert "expires in 10 minutes" in html
    assert ".code {" in html  # the <style> block from _base.html
    assert "Family Allowance Manager" in html  # the shared footer
