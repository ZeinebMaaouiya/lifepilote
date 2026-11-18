"""add Better Auth identity linkage without changing existing owner keys

Revision ID: 9f42a801c3da
Revises: 13b0b6e26060
Create Date: 2026-11-06 00:00:00.000000
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

revision: str = "9f42a801c3da"
down_revision: str | None = "13b0b6e26060"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "user_profiles",
        sa.Column("better_auth_user_id", sa.String(length=255), nullable=True),
    )
    op.create_index(
        "ix_user_profiles_better_auth_user_id",
        "user_profiles",
        ["better_auth_user_id"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("ix_user_profiles_better_auth_user_id", table_name="user_profiles")
    op.drop_column("user_profiles", "better_auth_user_id")
