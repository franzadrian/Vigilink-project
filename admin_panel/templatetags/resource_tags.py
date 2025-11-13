"""
Custom template tags for resource templates
"""
from django import template

register = template.Library()

@register.filter
def get_item(dictionary, key):
    """Get an item from a dictionary using a variable key"""
    if dictionary is None:
        return ''
    if not isinstance(dictionary, dict):
        return ''
    return dictionary.get(key, '')

