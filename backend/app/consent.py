"""Server-side allowlist of consent notice versions.

A session is stored only if its `consent.notice_version` is listed here
(exact, case-sensitive match). Adding a notice is a reviewed code change:
write the notice text, give it a new ID, record its approval, then list it.

PROVISIONAL: the only entry below is a placeholder for local development and
automated tests. No participant-facing notice text has been written or
approved yet (docs/backend/DATA_AND_PRIVACY.md section 5, R1-R2). It must not
be used to collect real participant data.
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class ConsentNotice:
    version: str
    # False until the project owner approves the notice text for real
    # participant data collection.
    approved_for_participant_data: bool
    description: str


PROVISIONAL_NOTICE_VERSION = "HB-NOTICE-0.1-PROVISIONAL"

ACCEPTED_NOTICES: dict[str, ConsentNotice] = {
    PROVISIONAL_NOTICE_VERSION: ConsentNotice(
        version=PROVISIONAL_NOTICE_VERSION,
        approved_for_participant_data=False,
        description=(
            "PROVISIONAL placeholder for local development and tests only. "
            "No notice text exists yet; NOT approved for real participant data."
        ),
    ),
}


def is_accepted_notice(version: str) -> bool:
    return version in ACCEPTED_NOTICES
