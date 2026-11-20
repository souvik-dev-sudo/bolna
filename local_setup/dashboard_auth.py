"""Dashboard login (TRACKER F7): one account, DASHBOARD_USERNAME + DASHBOARD_PASSWORD in .env.

Used by bolna-app (quickstart_server.py) and plivo-app (plivo_api_server.py); each image copies this file.

- Signing in sets a signed session cookie (expiry + HMAC). The signing key is derived from the
  username and password, so changing either signs everyone out.
- plivo-app's own requests to bolna-app carry an internal token (also derived from the password),
  so the two services need no extra shared setting.
- With either setting unset nothing is accepted: the dashboard stays locked rather than open.
"""

import hashlib
import hmac
import os
import time
from collections import deque

COOKIE_NAME = "nn_session"
SESSION_SECONDS = 7 * 24 * 3600
INTERNAL_HEADER = "X-Internal-Token"

MAX_BAD_PASSWORDS, LOCKOUT_SECONDS = 5, 900
_bad_passwords = deque()


def _username():
    return os.getenv("DASHBOARD_USERNAME", "").strip()


def _password():
    return os.getenv("DASHBOARD_PASSWORD", "")


def enabled():
    return bool(_username()) and bool(_password())


def _sign(purpose, message):
    secret = f"{_username()}\n{_password()}".encode()
    key = hmac.new(secret, f"nexaneura-dashboard:{purpose}".encode(), hashlib.sha256).digest()
    return hmac.new(key, message.encode(), hashlib.sha256).hexdigest()


def _same(candidate, expected):
    # Compare digests so the comparison takes the same time whatever the lengths.
    return hmac.compare_digest(hashlib.sha256(str(candidate).encode()).digest(), hashlib.sha256(expected.encode()).digest())


def credentials_ok(username, password):
    """Usernames ignore case and surrounding spaces; passwords are exact. Both are always compared,
    so a wrong username takes as long as a wrong password."""
    if not enabled():
        return False
    user_ok = _same(str(username).strip().lower(), _username().lower())
    password_ok = _same(password, _password())
    return user_ok and password_ok


def locked_out():
    """True after MAX_BAD_PASSWORDS wrong passwords within LOCKOUT_SECONDS (per process)."""
    cutoff = time.time() - LOCKOUT_SECONDS
    while _bad_passwords and _bad_passwords[0] < cutoff:
        _bad_passwords.popleft()
    return len(_bad_passwords) >= MAX_BAD_PASSWORDS


def record_bad_password():
    _bad_passwords.append(time.time())


def new_session():
    expires = int(time.time()) + SESSION_SECONDS
    return f"{expires}.{_sign('session', str(expires))}"


def session_ok(token):
    if not enabled() or not token or "." not in token:
        return False
    expires, signature = token.split(".", 1)
    if not expires.isdigit() or int(expires) < time.time():
        return False
    return hmac.compare_digest(signature, _sign("session", expires))


def bearer_token(request):
    header = request.headers.get("authorization", "")
    return header[7:].strip() if header[:7].lower() == "bearer " else ""


def request_session_ok(request):
    """Signed in by the session cookie (dashboard served same-origin) or by
    "Authorization: Bearer <token>" (dashboard on another site, e.g. Firebase Hosting)."""
    return session_ok(request.cookies.get(COOKIE_NAME)) or session_ok(bearer_token(request))


# Sites whose pages may call the APIs from the browser (CORS). DASHBOARD_ORIGINS in .env
# (comma-separated) replaces this list.
DEFAULT_ORIGINS = [
    "https://nexaneura-voice-agent-studio.web.app",
    "https://nexaneura-voice-agent-studio.firebaseapp.com",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]


def allowed_origins():
    configured = [o.strip().rstrip("/") for o in os.getenv("DASHBOARD_ORIGINS", "").split(",") if o.strip()]
    return configured or DEFAULT_ORIGINS


def internal_token():
    return _sign("internal", "plivo-app")


def internal_ok(token):
    return enabled() and bool(token) and hmac.compare_digest(str(token), internal_token())


def cookie_options(secure):
    """Settings for Response.set_cookie; secure when the request came in over https."""
    return {
        "key": COOKIE_NAME,
        "max_age": SESSION_SECONDS,
        "httponly": True,
        "samesite": "lax",
        "secure": secure,
        "path": "/",
    }


def is_https(request):
    return request.url.scheme == "https" or request.headers.get("x-forwarded-proto", "").split(",")[0].strip() == "https"
