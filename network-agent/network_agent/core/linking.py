"""Identity resolution: match an action target to a Person record."""
from __future__ import annotations

from typing import Optional

from rapidfuzz import fuzz
from sqlmodel import Session, select

from network_agent.models.people import Person

# Thresholds
URL_MATCH = True
EMAIL_MATCH = True
FUZZY_NAME_THRESHOLD = 85  # WRatio score 0–100


def find_person_by_url(session: Session, linkedin_url: str) -> Optional[Person]:
    if not linkedin_url:
        return None
    url = linkedin_url.rstrip("/").lower()
    stmt = select(Person).where(Person.linkedin_url.isnot(None))
    for person in session.exec(stmt):
        if person.linkedin_url and person.linkedin_url.rstrip("/").lower() == url:
            return person
    return None


def find_person_by_email(session: Session, email: str) -> Optional[Person]:
    if not email:
        return None
    stmt = select(Person).where(Person.email == email.lower().strip())
    return session.exec(stmt).first()


def fuzzy_find_person(
    session: Session,
    name: str,
    company: str = "",
    threshold: int = FUZZY_NAME_THRESHOLD,
) -> list[tuple[Person, int]]:
    """Return list of (Person, score) sorted by descending score above threshold."""
    if not name:
        return []
    stmt = select(Person)
    candidates: list[tuple[Person, int]] = []
    for person in session.exec(stmt):
        name_score = fuzz.WRatio(name.lower(), person.full_name.lower())
        company_bonus = 0
        if company and person.company_or_school:
            company_score = fuzz.partial_ratio(
                company.lower(), person.company_or_school.lower()
            )
            company_bonus = 5 if company_score >= 80 else 0
        combined = min(100, name_score + company_bonus)
        if combined >= threshold:
            candidates.append((person, combined))
    candidates.sort(key=lambda x: x[1], reverse=True)
    return candidates


def resolve_target(
    session: Session,
    linkedin_url: str = "",
    email: str = "",
    name: str = "",
    company: str = "",
    interactive: bool = False,
) -> tuple[Optional[int], Optional[str]]:
    """
    Try to resolve a target to a person_id.

    Returns (person_id, warning_message).
    If ambiguous / no match, returns (None, reason_string).
    """
    # 1. URL match
    if linkedin_url:
        p = find_person_by_url(session, linkedin_url)
        if p:
            return p.person_id, None

    # 2. Email match
    if email:
        p = find_person_by_email(session, email)
        if p:
            return p.person_id, None

    # 3. Fuzzy name match
    if name:
        matches = fuzzy_find_person(session, name, company)
        if len(matches) == 1:
            return matches[0][0].person_id, None
        if len(matches) > 1:
            top_score = matches[0][1]
            second_score = matches[1][1]
            # Only auto-link if clearly best match
            if top_score - second_score >= 10:
                return matches[0][0].person_id, None
            # Ambiguous
            names = ", ".join(
                f"id={p.person_id} {p.full_name} ({s}%)" for p, s in matches[:5]
            )
            return None, f"Ambiguous name match: {names}. Storing as target_name_raw."

    return None, "No matching person found. Storing as target_name_raw."
