"""Initial schema: participants, sessions, trials.

Revision ID: 0001
Revises:
Create Date: 2026-11-22

A frozen snapshot: it deliberately does not import app.models, so later
model changes cannot silently alter this migration.
tests/test_migrations.py checks that upgrading to head matches app.models.
CHECK names use op.f() so the models' naming convention is not applied twice.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

INVALID_REASONS = (
    "'focus_lost', 'visibility_lost', 'presentation_failed', 'input_failed', "
    "'timing_error', 'deadline_unavailable', 'interrupt', 'protocol_error'"
)
TIMING_COLUMNS = (
    "fixation_onset_ms",
    "stimulus_onset_ms",
    "response_timestamp_ms",
    "deadline_ms",
    "stimulus_offset_ms",
    "iti_end_ms",
)


def upgrade() -> None:
    op.create_table(
        "participants",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_participants"),
    )

    op.create_table(
        "sessions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("client_session_id", sa.Uuid(), nullable=False),
        sa.Column("participant_id", sa.Uuid(), nullable=True),
        sa.Column("data_schema_version", sa.Integer(), nullable=False),
        sa.Column("experiment_id", sa.String(length=32), nullable=False),
        sa.Column("protocol_id", sa.String(length=64), nullable=False),
        sa.Column("protocol_version", sa.String(length=64), nullable=False),
        sa.Column("configuration_id", sa.String(length=64), nullable=False),
        sa.Column("configuration_version", sa.String(length=64), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("consent_notice_version", sa.String(length=64), nullable=False),
        sa.Column("seed", sa.BigInteger(), nullable=True),
        sa.Column("prng_id", sa.String(length=64), nullable=True),
        sa.Column("randomization_version", sa.String(length=64), nullable=True),
        sa.Column("schedule_generation_status", sa.String(length=16), nullable=False),
        sa.Column("allocation_details", sa.JSON(), nullable=True),
        sa.Column("realized_schedule", sa.JSON(), nullable=False),
        sa.Column("break_taken", sa.Boolean(), nullable=False),
        sa.Column("break_duration_ms", sa.Float(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "experiment_id IN ('stroop', 'flanker')", name=op.f("ck_sessions_experiment_id")
        ),
        sa.CheckConstraint(
            "status IN ('complete', 'incomplete', 'interrupted', 'technical_error')",
            name=op.f("ck_sessions_status"),
        ),
        sa.CheckConstraint(
            "schedule_generation_status IN ('not_started', 'generated', 'failed')",
            name=op.f("ck_sessions_schedule_generation_status"),
        ),
        sa.CheckConstraint(
            "data_schema_version >= 1", name=op.f("ck_sessions_data_schema_version")
        ),
        sa.CheckConstraint(
            "seed IS NULL OR (seed >= 0 AND seed <= 4294967295)",
            name=op.f("ck_sessions_seed_range"),
        ),
        sa.CheckConstraint(
            "schedule_generation_status <> 'generated'"
            " OR (seed IS NOT NULL AND prng_id IS NOT NULL)",
            name=op.f("ck_sessions_generated_has_seed"),
        ),
        sa.CheckConstraint(
            "break_duration_ms IS NULL OR break_duration_ms >= 0",
            name=op.f("ck_sessions_break_duration_nonnegative"),
        ),
        sa.CheckConstraint(
            "NOT break_taken OR break_duration_ms IS NOT NULL",
            name=op.f("ck_sessions_break_taken_has_duration"),
        ),
        sa.ForeignKeyConstraint(
            ["participant_id"],
            ["participants.id"],
            name="fk_sessions_participant_id_participants",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_sessions"),
        sa.UniqueConstraint("client_session_id", name="uq_sessions_client_session_id"),
    )
    op.create_index("ix_sessions_participant_created", "sessions", ["participant_id", "created_at"])
    op.create_index("ix_sessions_experiment_created", "sessions", ["experiment_id", "created_at"])

    op.create_table(
        "trials",
        sa.Column(
            "id",
            sa.BigInteger().with_variant(sa.Integer(), "sqlite"),
            autoincrement=True,
            nullable=False,
        ),
        sa.Column("session_id", sa.Uuid(), nullable=False),
        sa.Column("phase", sa.String(length=16), nullable=False),
        sa.Column("trial_index", sa.Integer(), nullable=False),
        sa.Column("condition", sa.String(length=16), nullable=False),
        sa.Column("stimulus", sa.JSON(), nullable=False),
        sa.Column("correct_response", sa.String(length=16), nullable=False),
        sa.Column("response_key", sa.String(length=16), nullable=True),
        sa.Column("outcome", sa.String(length=16), nullable=False),
        sa.Column("invalid_reason", sa.String(length=32), nullable=True),
        sa.Column("reaction_time_ms", sa.Float(), nullable=True),
        *(sa.Column(column, sa.Float(), nullable=True) for column in TIMING_COLUMNS),
        sa.CheckConstraint("phase IN ('practice', 'main')", name=op.f("ck_trials_phase")),
        sa.CheckConstraint("trial_index >= 1", name=op.f("ck_trials_trial_index_positive")),
        sa.CheckConstraint(
            "condition IN ('congruent', 'incongruent', 'neutral')", name=op.f("ck_trials_condition")
        ),
        sa.CheckConstraint(
            "outcome IN ('correct', 'incorrect', 'timeout', 'invalid')",
            name=op.f("ck_trials_outcome"),
        ),
        sa.CheckConstraint(
            f"invalid_reason IS NULL OR invalid_reason IN ({INVALID_REASONS})",
            name=op.f("ck_trials_invalid_reason_value"),
        ),
        sa.CheckConstraint(
            "(outcome = 'invalid' AND invalid_reason IS NOT NULL)"
            " OR (outcome <> 'invalid' AND invalid_reason IS NULL)",
            name=op.f("ck_trials_invalid_reason_iff_invalid"),
        ),
        sa.CheckConstraint(
            "(outcome IN ('correct', 'incorrect')"
            " AND response_key IS NOT NULL AND reaction_time_ms IS NOT NULL)"
            " OR (outcome IN ('timeout', 'invalid')"
            " AND response_key IS NULL AND reaction_time_ms IS NULL)",
            name=op.f("ck_trials_response_matches_outcome"),
        ),
        sa.CheckConstraint(
            "outcome <> 'correct' OR response_key = correct_response",
            name=op.f("ck_trials_correct_key_matches"),
        ),
        sa.CheckConstraint(
            "outcome <> 'incorrect' OR response_key <> correct_response",
            name=op.f("ck_trials_incorrect_key_differs"),
        ),
        sa.CheckConstraint(
            "reaction_time_ms IS NULL OR reaction_time_ms >= 0",
            name=op.f("ck_trials_reaction_time_nonnegative"),
        ),
        *(
            sa.CheckConstraint(
                f"{column} IS NULL OR {column} >= 0", name=op.f(f"ck_trials_{column}_nonnegative")
            )
            for column in TIMING_COLUMNS
        ),
        sa.ForeignKeyConstraint(
            ["session_id"],
            ["sessions.id"],
            name="fk_trials_session_id_sessions",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_trials"),
        sa.UniqueConstraint(
            "session_id", "phase", "trial_index", name="uq_trials_session_phase_index"
        ),
    )


def downgrade() -> None:
    op.drop_table("trials")
    op.drop_index("ix_sessions_experiment_created", table_name="sessions")
    op.drop_index("ix_sessions_participant_created", table_name="sessions")
    op.drop_table("sessions")
    op.drop_table("participants")
