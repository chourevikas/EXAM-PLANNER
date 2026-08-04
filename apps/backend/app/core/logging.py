import logging
import sys

def setup_logging():
  logger = logging.getLogger("app")
  logger.setLevel(logging.INFO)
  
  handler = logging.StreamHandler(sys.stdout)
  formatter = logging.Formatter(
    "[%(asctime)s] [%(levelname)s] [%(name)s]: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
  )
  handler.setFormatter(formatter)
  
  if not logger.handlers:
    logger.addHandler(handler)
    
  return logger

logger = setup_logging()
