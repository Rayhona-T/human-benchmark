"""Access scope for reading and deleting stored sessions (Cycle 9).

Every endpoint that reads or deletes stored sessions depends on
`require_owner_scope`, and every such store query is filtered through the
returned `OwnerScope`. That is the single place a future ownership proof (a
participant key, DATA_AND_PRIVACY.md section 4) replaces local-owner mode.

LOCAL-OWNER MODE IS NOT OWNERSHIP PROOF. Its scope is "every session in this
local database": anyone who can reach the API on this computer can read and
delete everything. It is therefore available only when BOTH hold:

- `HB_ENV` is "development", and
- `HB_LOCAL_OWNER_ACCESS` is explicitly true.

Anything else, including missing or unrecognized settings, fails closed. The
check is made twice: `create_app` does not register these routes at all, and
`require_owner_scope` re-checks the live settings on every request.
"""

from dataclasses import dataclass
from typing import Annotated, Literal

from fastapi import Depends, Request
from sqlalchemy import ColumnElement

from .config import Settings
from .errors import ApiError


@dataclass(frozen=True)
class OwnerScope:
    """Which stored sessions a request may read or delete."""

    kind: Literal["local_owner"]

    def session_conditions(self) -> tuple[ColumnElement[bool], ...]:
        """SQL conditions on `sessions` rows. Local owner: the whole database."""
        return ()


LOCAL_OWNER = OwnerScope(kind="local_owner")


def local_owner_enabled(settings: object) -> bool:
    return (
        isinstance(settings, Settings)
        and settings.env == "development"
        and settings.local_owner_access is True
    )


def require_owner_scope(request: Request) -> OwnerScope:
    if not local_owner_enabled(getattr(request.app.state, "settings", None)):
        raise ApiError(
            403,
            "local_owner_access_disabled",
            "Reading and deleting stored sessions is not enabled on this server.",
        )
    return LOCAL_OWNER


Scope = Annotated[OwnerScope, Depends(require_owner_scope)]
