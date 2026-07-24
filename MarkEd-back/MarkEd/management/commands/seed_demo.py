"""`python manage.py seed_demo` — run the demo seeder.

Self-gating: by default it only seeds when SEED_ON_START=true, so it can sit
unconditionally in the deploy start command and be a no-op on normal boots.
Pass --force to seed regardless of the flag (e.g. from the Render shell).

The seed itself lives in seed_demo.py at the backend root and is idempotent
(get_or_create / update_or_create), so re-running never duplicates data.
"""
import os

from django.conf import settings
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Seed demo data (gated on SEED_ON_START unless --force)."

    def add_arguments(self, parser):
        parser.add_argument(
            '--force',
            action='store_true',
            help='Seed even when SEED_ON_START is not "true".',
        )

    def handle(self, *args, **options):
        enabled = os.getenv('SEED_ON_START', 'false').lower() == 'true'
        if not enabled and not options['force']:
            self.stdout.write(
                'SEED_ON_START is not "true"; skipping demo seed. '
                '(Use --force or set SEED_ON_START=true to seed.)'
            )
            return

        # Run the idempotent seed script at the project root.
        seed_path = os.path.join(settings.BASE_DIR, 'seed_demo.py')
        if not os.path.exists(seed_path):
            self.stderr.write(f'seed_demo.py not found at {seed_path}')
            return

        self.stdout.write('Running demo seed...')
        with open(seed_path) as fh:
            exec(fh.read(), {'__name__': '__seed__'})
        self.stdout.write(self.style.SUCCESS('Demo seed complete.'))
