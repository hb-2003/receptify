"""Django management command to launch scheduled campaigns whose scheduled_at time has arrived."""

import logging
import threading

from django.core.management.base import BaseCommand
from django.db.models import Q
from django.utils import timezone

from campaigns.models import Campaign
from campaigns.dialer import is_campaign_launchable

log = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Launch campaigns whose scheduled_at time has arrived (or has no schedule) and are in 'scheduled' status."

    def handle(self, *args, **options):
        now = timezone.now()

        # Find all campaigns that are scheduled and ready to run
        # This includes campaigns with a scheduled_at in the past,
        # or campaigns with no scheduled_at (e.g. launched immediately but thread died)
        due_campaigns = Campaign.objects.filter(
            status='scheduled',
        ).filter(
            Q(scheduled_at__isnull=True) | Q(scheduled_at__lte=now)
        )

        if not due_campaigns:
            self.stdout.write(self.style.SUCCESS("No scheduled campaigns ready to launch."))
            return

        launched = 0
        skipped = 0

        for campaign in due_campaigns:
            launchable, reason = is_campaign_launchable(campaign)
            if not launchable:
                log.warning(f"Campaign {campaign.id} ({campaign.name}) skipped: {reason}")
                skipped += 1
                continue

            from campaigns.dialer import run_live_campaign_dialer
            thread = threading.Thread(
                target=run_live_campaign_dialer,
                args=(str(campaign.id),),
                daemon=True
            )
            thread.start()
            log.info(f"Launched campaign {campaign.id} ({campaign.name})")
            launched += 1

        msg = f"Scheduler run complete: {launched} launched, {skipped} skipped."
        self.stdout.write(self.style.SUCCESS(msg))
        log.info(msg)
