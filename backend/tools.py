from langchain_core.tools import tool
from backend.memory import (
    save_mistake_db,
    save_learner_profile_db,
    get_learner_profile_db
)

@tool
def save_mistake(original: str, correction: str, category: str = "grammar") -> str:
    """
    Save an English mistake made by the student.
    Use this only for important or repeated English mistakes (e.g. subject-verb agreement, tense errors).
    Do NOT call this for casual texting style, missing capitalization, or minor typos.
    """
    return save_mistake_db(original=original, correction=correction, category=category)

@tool
def save_learner_profile(name: str = None, english_level: str = None, goal: str = None) -> str:
    """
    Save or update the student's learner profile when they explicitly share their name, English level, or learning goals.
    Example: 'My name is Achu and I want to improve my spoken English.'
    """
    return save_learner_profile_db(name=name, english_level=english_level, goal=goal)

@tool
def get_learner_profile() -> dict:
    """
    Retrieve the student's saved profile (name, English level, learning goals).
    Use this when knowing the student's saved details helps answer their question or personalize feedback.
    """
    return get_learner_profile_db()