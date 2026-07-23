import random
import time
from celery import shared_task
from datetime import timedelta
from django.utils import timezone
from .models import PeerReviewComment, Feedback
from django.conf import settings
from .generative_feedback.generate_feedback import OpenAIModels, chat
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
import logging

logger = logging.getLogger(__name__)

@shared_task
def process_feedback_with_llm(comment_id: int):
    print("Processing feedback with LLM")
    try:
        comment = PeerReviewComment.objects.get(id=comment_id)
        
        query = f"""
        Selected text: {comment.selected_text}
        Feedback: {comment.feedback}
        Margin text before: {comment.margin_text_top}
        Margin text after: {comment.margin_text_bottom}
        """
        
        system_message = f"""
        You are a Feedback Coach evaluating the quality of feedback given to an author. 
        Analyze ONLY the feedback's effectiveness, not its content.

        You should reply with the following format: 

        First, provide a single-word rating of the feedback's quality: "Terrible," "Poor," 
        "OK," or "Excellent." If the feedback seems to be complete and useful for the 
        author, give a rating of "Excellent". If the feedback seems to be incomplete, 
        irrelevant, harsh, unprofessional, not clear or not useful for the author, 
        give a rating of "Terrible".

        After giving the rating, you should give 2-3 suggestions for specific improvements 
        that the feedback needs. Write brief sentences, not bullet points.

        Example:
        Selected text: "The introduction is too vague."
        Feedback: "Your introduction needs more detail."
        Rating: Poor
        Your introduction comment lacks specificity. Consider mentioning which aspects 
        of the introduction need more detail. Also, try providing a concrete suggestion 
        for improvement, such as adding a clear thesis statement or contextual background.

        Good feedback should be:
        - Clear and specific
        - Actionable and helpful
        - Constructive and professional wording
        - Not harsh or overly critical: Must be respectful and constructive
        - Balanced and encouraging
        - Improvement-focused and goal-oriented
        - Higher-Order Issues First: Prioritise argument clarity, structure, and evidence 
        before minor grammar or wording issues.
        """

        if (not comment.llm_comment or comment.llm_comment_dismissed):
            print("query", query)
            
            llm_feedback = chat(query, temperature=0.1, system_message=system_message, max_tokens=500, model=OpenAIModels.O3_MINI)
            
            print("llm_feedback", llm_feedback)
            
            try:
                # Check if response is at least 4 characters long
                if len(llm_feedback) < 4:
                    logger.error(f"LLM response too short: {llm_feedback}")
                    return
                    
                # Try to extract the rating word
                rating_line = llm_feedback.split('\n')[0] if '\n' in llm_feedback else llm_feedback
                rating_word = rating_line.strip().lower()
                
                # Check if the rating word is one of the expected values
                valid_ratings = ["terrible", "poor", "ok", "excellent"]
                
                if not any(rating in rating_word for rating in valid_ratings):
                    logger.error(f"Invalid rating word: {rating_word}")
                    return
                
                # Only provide feedback for terrible and poor ratings
                if "terrible" in rating_word or "poor" in rating_word:
                    # Get the feedback part (everything after the first line)
                    feedback_part = llm_feedback[len(rating_line):].strip() if '\n' in llm_feedback else ""
                    if not feedback_part:
                        logger.error("Empty feedback after rating")
                        return
                        
                    PeerReviewComment.objects.filter(id=comment_id).update(
                        llm_comment=feedback_part,
                        llm_comment_dismissed=False
                    )

                    channel_layer = get_channel_layer()
                    group_name = f'peer_review_{comment.review_allocation.assignment_id}_{comment.review_allocation.submission_id}'
                    
                    async_to_sync(channel_layer.group_send)(
                        group_name,
                        {
                            'type': 'send_llm_feedback_update',
                            'comment_id': comment.id,
                            'llm_feedback': feedback_part,
                        }
                    )
            except Exception as e:
                logger.error(f"Error processing LLM feedback for comment {comment_id}: {str(e)}")
                logger.error(f"Raw LLM response: {llm_feedback}")
        else:
            print("Skipping comment", comment_id, "because it was already processed")
            
    except PeerReviewComment.DoesNotExist:
        logger.error(f"Comment {comment_id} not found")
