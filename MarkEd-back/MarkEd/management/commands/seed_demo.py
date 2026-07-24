"""`python manage.py seed_demo` — run the demo seeder.

Self-gating: by default it only seeds when SEED_ON_START=true, so it can sit
unconditionally in the deploy start command and be a no-op on normal boots.
Pass --force to seed regardless of the flag (e.g. from the Render shell).

The seed itself lives in seed_demo.py at the backend root and is idempotent
(get_or_create / update_or_create), so re-running never duplicates data — but it
never *deletes* stale rows either. To wipe the database back to a fresh,
all-unsubmitted state before seeding (e.g. a hosted DB with no shell), set
SEED_RESET=true (or pass --reset). Use it once, then turn it off — while it is
on, every deploy erases all data.
"""
import os

from django.conf import settings
from django.core.management import call_command
from django.core.management.base import BaseCommand


def _truthy(value: str) -> bool:
    return value.lower() in ('1', 'true', 'yes', 'on')


class Command(BaseCommand):
    help = "Seed demo data (gated on SEED_ON_START unless --force; --reset wipes first)."

    def add_arguments(self, parser):
        parser.add_argument(
            '--force', action='store_true',
            help='Seed even when SEED_ON_START is not "true".',
        )
        parser.add_argument(
            '--reset', action='store_true',
            help='Flush ALL data before seeding (fresh, all-unsubmitted state).',
        )

    def handle(self, *args, **options):
        enabled = _truthy(os.getenv('SEED_ON_START', 'false'))
        reset = options['reset'] or _truthy(os.getenv('SEED_RESET', 'false'))

        if not enabled and not options['force'] and not reset:
            self.stdout.write(
                'SEED_ON_START is not "true"; skipping demo seed. '
                '(Use --force / --reset, or set SEED_ON_START=true to seed.)'
            )
            return

        if reset:
            # Wipe every table's rows (keeps the schema) so no stale submissions,
            # marks or reviews survive. Existing bearer tokens point at deleted
            # users afterwards, so everyone is signed out — expected on a reset.
            self.stdout.write(self.style.WARNING(
                'SEED_RESET: flushing ALL data before reseeding...'
            ))
            call_command('flush', '--no-input')

        seed_path = os.path.join(settings.BASE_DIR, 'seed_demo.py')
        if not os.path.exists(seed_path):
            self.stderr.write(f'seed_demo.py not found at {seed_path}')
            return

        self.stdout.write('Running demo seed...')
        with open(seed_path) as fh:
            exec(fh.read(), {'__name__': '__seed__'})
        self.stdout.write(self.style.SUCCESS('Demo seed complete.'))
