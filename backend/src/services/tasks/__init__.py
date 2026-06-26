"""Tasks service — business logic behind the task/submission/wallet routes.

Re-exports the public functions from the focused submodules so callers import
from one place: ``crud`` (task lifecycle), ``submissions`` (submit/review +
the daily maintenance loop), and ``wallet`` (balance and history). Cross-cutting
ownership checks live in ``_shared``.
"""

from src.services.tasks.crud import (
    create_task,
    delete_task,
    get_task_or_404,
    list_tasks,
    update_task,
)
from src.services.tasks.submissions import (
    approve_submission,
    batch_approve,
    fail_overdue_duty_slots,
    generate_daily_duty_slots,
    list_submissions,
    reject_submission,
    resubmit_task,
    start_daily_maintenance,
    stop_daily_maintenance,
    submit_task,
)
from src.services.tasks.wallet import get_balance, get_transaction_history

__all__ = [
    "approve_submission",
    "batch_approve",
    "create_task",
    "delete_task",
    "fail_overdue_duty_slots",
    "generate_daily_duty_slots",
    "get_balance",
    "get_task_or_404",
    "get_transaction_history",
    "list_submissions",
    "list_tasks",
    "reject_submission",
    "resubmit_task",
    "start_daily_maintenance",
    "stop_daily_maintenance",
    "submit_task",
    "update_task",
]
