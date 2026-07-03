"""WSGI config for the Silsilah project."""
import os

from django.core.wsgi import get_wsgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "silsilah.settings")

application = get_wsgi_application()
