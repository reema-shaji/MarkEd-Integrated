from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from .models import PeerReviewComment

@receiver([post_save, post_delete], sender=PeerReviewComment)
def update_review_status(sender, instance, **kwargs):
    """Update the review status whenever a comment is created or deleted"""
    instance.review_allocation.update_status() 