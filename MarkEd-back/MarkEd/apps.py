from django.apps import AppConfig

class MarkedConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'MarkEd'

    def ready(self):
        """Import signal handlers when Django starts"""
        import MarkEd.signals  # noqa 