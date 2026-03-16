"""create_attachments_table

Revision ID: 358fe3f00c11
Revises:
Create Date: 2026-03-10 19:25:03.654244

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '358fe3f00c11'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'attachments',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('filename', sa.String(500), nullable=False),
        sa.Column('content_type', sa.String(255), nullable=False),
        sa.Column('size', sa.Integer(), nullable=False),
        sa.Column('storage_path', sa.String(1000), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_attachments_user_id', 'attachments', ['user_id'])


def downgrade() -> None:
    op.drop_index('ix_attachments_user_id', table_name='attachments')
    op.drop_table('attachments')
