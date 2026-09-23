import base64

from app.core import totp

# RFC 6238 appendix B secret ("12345678901234567890"); the 6-digit code is the last 6 of the 8-digit vector.
RFC_SECRET = base64.b32encode(b"12345678901234567890").decode().rstrip("=")


def test_matches_rfc_6238_vectors():
    assert totp._hotp(RFC_SECRET, 59 // 30) == "287082"
    assert totp._hotp(RFC_SECRET, 1111111109 // 30) == "081804"
    assert totp._hotp(RFC_SECRET, 1234567890 // 30) == "005924"


def test_verify_accepts_current_and_adjacent_step_only():
    now = 1_700_000_000
    step = totp.current_step(now)
    assert totp.verify(RFC_SECRET, totp._hotp(RFC_SECRET, step), now=now) == step
    assert totp.verify(RFC_SECRET, totp._hotp(RFC_SECRET, step - 1), now=now) == step - 1
    assert totp.verify(RFC_SECRET, totp._hotp(RFC_SECRET, step + 1), now=now) == step + 1
    assert totp.verify(RFC_SECRET, totp._hotp(RFC_SECRET, step + 5), now=now) is None
    assert totp.verify(RFC_SECRET, "abc123", now=now) is None
    assert totp.verify(RFC_SECRET, "12345", now=now) is None


def test_a_used_code_cannot_be_replayed():
    now = 1_700_000_000
    step = totp.current_step(now)
    code = totp._hotp(RFC_SECRET, step)
    assert totp.verify(RFC_SECRET, code, last_used_step=step - 1, now=now) == step
    assert totp.verify(RFC_SECRET, code, last_used_step=step, now=now) is None
    # An older-but-still-in-window code is refused once a newer one was used.
    older = totp._hotp(RFC_SECRET, step - 1)
    assert totp.verify(RFC_SECRET, older, last_used_step=step, now=now) is None


def test_secret_encryption_round_trip_and_generated_secret_is_usable():
    secret = totp.generate_secret()
    stored = totp.encrypt_secret(secret)
    assert stored != secret
    assert totp.decrypt_secret(stored) == secret
    assert totp.decrypt_secret("not-a-valid-token") is None
    assert totp.verify(secret, totp._hotp(secret, totp.current_step())) is not None


def test_recovery_codes_are_unique_and_hash_case_insensitively():
    codes = totp.generate_recovery_codes()
    assert len(codes) == totp.RECOVERY_CODE_COUNT == len(set(codes))
    assert all(totp.looks_like_recovery_code(c) for c in codes)
    assert not totp.looks_like_recovery_code("123456")
    assert totp.hash_recovery_code(codes[0]) == totp.hash_recovery_code(codes[0].upper())


def test_provisioning_uri_contains_secret_and_issuer():
    uri = totp.provisioning_uri("ABCDEF", "a@b.com")
    assert uri.startswith("otpauth://totp/ExamPlanner%3Aa%40b.com?secret=ABCDEF")
    assert "issuer=ExamPlanner" in uri
