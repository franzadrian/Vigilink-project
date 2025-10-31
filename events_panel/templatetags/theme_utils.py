from django import template
import re

register = template.Library()

_THEME_PATTERNS = [
    ("halloween", re.compile(r"\b(hallowe'en|halloween|haloween|hallowen|spooky|trick[- ]?or[- ]?treat|pumpkin|ghost|ghoul)\b", re.I)),
    ("christmas", re.compile(r"\b(christmas|xmas|chrismas|cristmas|yuletide|santa|holiday)\b", re.I)),
    ("emergency", re.compile(r"\b(emergency|urgent|alert|warning|evac|sos)\b", re.I)),
    ("maintenance", re.compile(r"\b(maintenance|maintainance|repair|service\s*outage|water\s*interruption|power\s*outage|downtime)\b", re.I)),
    ("meeting", re.compile(r"\b(meeting|meetup|town\s*hall|assembly|board\s*meeting|hoa|sync)\b", re.I)),
    ("social", re.compile(r"\b(social|gathering|picnic|festival|celebration)\b", re.I)),
    ("announcement", re.compile(r"\b(announcement|announce|update|notice)\b", re.I)),
]

@register.filter(name="detect_theme")
def detect_theme(title: str, event_type: str = "") -> str:
    """Return normalized theme slug from title/type with typo tolerance."""
    text = f"{title or ''} {event_type or ''}"
    for slug, pattern in _THEME_PATTERNS:
        if pattern.search(text):
            return slug
    return "generic"


