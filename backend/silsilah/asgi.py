"""ASGI config for the Silsilah project."""
import os

from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "silsilah.settings")

application = get_asgi_application()
