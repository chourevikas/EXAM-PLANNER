"""RFC 6238 TOTP (SHA-1, 6 digits, 30 s) plus at-rest encryption and recovery codes.

Implemented with the standard library so no extra dependency is needed. Compatible with Google
Authenticator, Authy, 1Password and other authenticator apps.
"""
import base64
import hashlib
import hmac
import secrets
import struct
import time
from typing import Optional
from urllib.parse import quote

from cryptography.fernet import Fernet, InvalidToken

from app.config.settings import settings

PERIOD = 30
DIGITS = 6
# Accept the previous and next code as well, to tolerate small clock drift.
WINDOW = 1
RECOVERY_CODE_COUNT = 8


def generate_secret() -> str:
    return base64.b32encode(secrets.token_bytes(20)).decode("ascii").rstrip("=")


def _hotp(secret: str, counter: int) -> str:
    padded = secret + "=" * (-len(secret) % 8)
    key = base64.b32decode(padded, casefold=True)
    digest = hmac.new(key, struct.pack(">Q", counter), hashlib.sha1).digest()
    offset = digest[-1] & 0x0F
    code = (struct.unpack(">I", digest[offset : offset + 4])[0] & 0x7FFFFFFF) % (10**DIGITS)
    return str(code).zfill(DIGITS)


def current_step(now: Optional[float] = None) -> int:
    return int((now if now is not None else time.time()) // PERIOD)


def verify(secret: str, code: str, last_used_step: Optional[int] = None, now: Optional[float] = None) -> Optional[int]:
    """Return the matched time step if `code` is valid and not a replay, else None."""
    code = (code or "").strip().replace(" ", "")
    if len(code) != DIGITS or not code.isdigit():
        return None
    step_now = current_step(now)
    for step in range(step_now - WINDOW, step_now + WINDOW + 1):
        if last_used_step is not None and step <= last_used_step:
            continue  # a code (or an older one) that was already used
        if hmac.compare_digest(_hotp(secret, step), code):
            return step
    return None


def provisioning_uri(secret: str, account: str, issuer: str = "ExamPlanner") -> str:
    label = quote(f"{issuer}:{account}")
    return f"otpauth://totp/{label}?secret={secret}&issuer={quote(issuer)}&algorithm=SHA1&digits={DIGITS}&period={PERIOD}"


# ── secret encryption (key derived from SECRET_KEY) ──
def _fernet() -> Fernet:
    key = base64.urlsafe_b64encode(hashlib.sha256(f"totp:{settings.SECRET_KEY}".encode()).digest())
    return Fernet(key)


def encrypt_secret(secret: str) -> str:
    return _fernet().encrypt(secret.encode()).decode()


def decrypt_secret(stored: str) -> Optional[str]:
    try:
        return _fernet().decrypt(stored.encode()).decode()
    except (InvalidToken, ValueError):
        return None  # SECRET_KEY changed; the authenticator must be re-enrolled


# ── one-time recovery codes ──
def generate_recovery_codes() -> list[str]:
    alphabet = "abcdefghjkmnpqrstuvwxyz23456789"
    return [
        "-".join("".join(secrets.choice(alphabet) for _ in range(5)) for _ in range(2))
        for _ in range(RECOVERY_CODE_COUNT)
    ]


def hash_recovery_code(code: str) -> str:
    normalized = code.strip().lower().replace(" ", "")
    return hashlib.sha256(f"recovery:{normalized}".encode()).hexdigest()


def looks_like_recovery_code(code: str) -> bool:
    c = (code or "").strip()
    return "-" in c and len(c) == 11
