import pytest

from app.config.settings import settings


@pytest.fixture(autouse=True)
def _super_admin_mfa_off_by_default(monkeypatch):
    """Most tests just need a Super Admin token. Tests of the MFA flow switch this back on explicitly."""
    monkeypatch.setattr(settings, "SUPERADMIN_MFA_REQUIRED", False)
