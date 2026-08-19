import os
import json
from typing import Dict, Any
from app.config.secret_loaders.base import BaseSecretLoader

from app.config.logger import setup_logger

logger = setup_logger("AWSSecretManagerLoader")


class AWSSecretManagerLoader(BaseSecretLoader):
    """Secret loader fetching JSON secret payload from AWS Secrets Manager."""

    def __init__(self, secret_name: str = None, region_name: str = None):
        self.secret_name = (
            secret_name or os.getenv("AWS_SECRET_NAME") or os.getenv("SECRET_NAME")
        )
        self.region_name = region_name or os.getenv("AWS_REGION", "us-east-1")

    def load_secrets(self) -> Dict[str, Any]:
        if not self.secret_name:
            logger.warning(
                "PLATFORM is set to 'aws' but AWS_SECRET_NAME is not configured in env. Falling back to OS env vars & defaults."
            )
            return {}

        try:
            import boto3

            client = boto3.client("secretsmanager", region_name=self.region_name)
            response = client.get_secret_value(SecretId=self.secret_name)
            if "SecretString" in response:
                return json.loads(response["SecretString"])
            elif "SecretBinary" in response:
                return json.loads(response["SecretBinary"].decode("utf-8"))
        except ImportError:
            logger.warning(
                "boto3 package not installed; skipping AWS Secrets Manager lookup."
            )
        except Exception as err:
            logger.warning(
                f"Failed fetching secret '{self.secret_name}' from AWS Secrets Manager: {err}"
            )
        return {}
