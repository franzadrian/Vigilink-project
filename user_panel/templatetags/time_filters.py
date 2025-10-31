from django import template
from django.utils.timesince import timesince
import datetime

register = template.Library()

@register.filter(name='friendly_timesince')
def friendly_timesince(value):
    """
    Formats time as:
    - "X seconds ago" for < 1 minute
    - "X minutes ago" for < 1 hour
    - "X hours ago" for < 1 day
    - "X days ago" for < 1 month
    - "X months ago" for < 1 year
    - "X years ago" for >= 1 year
    """
    if not value:
        return ''
    
    now = datetime.datetime.now(datetime.timezone.utc if value.tzinfo else None)
    diff = now - value
    
    # Get the standard timesince value
    time_text = timesince(value, now)
    
    # Extract the first part (most significant unit)
    if ',' in time_text:
        time_text = time_text.split(',')[0]
    
    # Handle seconds (less than a minute)
    if diff.total_seconds() < 60:
        return f"{int(diff.total_seconds())} seconds ago"
    
    # Add "ago" to the end
    return f"{time_text} ago"

@register.filter
def get_item(dictionary, key):
    try:
        return dictionary.get(key)
    except Exception:
        return ""