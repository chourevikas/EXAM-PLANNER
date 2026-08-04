import os
from typing import Dict, Type, Optional
from app.config.secret_loaders.base import BaseSecretLoader
from app.config.secret_loaders.env_loader import EnvSecretLoader
from app.config.secret_loaders.aws_loader import AWSSecretManagerLoader

from app.config.logger import setup_logger

logger = setup_logger("SecretLoaderFactory")


_LOADER_REGISTRY: Dict[str, Type[BaseSecretLoader]] = {
    "aws": AWSSecretManagerLoader,
    "env": EnvSecretLoader,
    "local": EnvSecretLoader,
}


def register_secret_loader(name: str, loader_cls: Type[BaseSecretLoader]):
    """Registers a new custom modular secret loader (e.g., 'gcp', 'vault')."""
    _LOADER_REGISTRY[name.lower()] = loader_cls


def get_secret_loader(platform: Optional[str] = None) -> BaseSecretLoader:
    """
    Returns the appropriate modular secret loader based on platform configuration.
    If platform is 'aws', returns AWSSecretManagerLoader.
    If platform is unspecified or 'local'/'env', returns EnvSecretLoader.
    """
    target_platform = (
        platform
        or os.getenv("PLATFORM")
        or os.getenv("CLOUD_PROVIDER")
        or os.getenv("SECRET_MANAGER_TYPE")
        or "env"
    ).lower()

    loader_cls = _LOADER_REGISTRY.get(target_platform, EnvSecretLoader)
    logger.debug(f"Resolved secret loader '{loader_cls.__name__}' for target platform '{target_platform}'.")
    return loader_cls()
