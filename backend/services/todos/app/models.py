"""Todo models — TodoList, Task, Subtask."""

from sqlalchemy import Boolean, Column, Date, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import relationship

from pos_contracts.models import UserScopedBase


class TodoList(UserScopedBase):
    """A named list of tasks."""

    __tablename__ = "todo_lists"

    name = Column(String(255), nullable=False)
    position = Column(Integer, nullable=False, default=0)

    tasks = relationship("Task", back_populates="list", cascade="all, delete-orphan")


class Task(UserScopedBase):
    """A single todo task."""

    __tablename__ = "tasks"

    list_id = Column(UUID(as_uuid=True), ForeignKey("todo_lists.id"), nullable=False, index=True)
    title = Column(String(500), nullable=False)
    description = Column(Text, nullable=True)
    status = Column(String(20), nullable=False, default="todo")  # todo, in_progress, done, archived
    priority = Column(String(10), nullable=False, default="none")  # none, low, medium, high, urgent
    due_date = Column(Date, nullable=True)
    is_important = Column(Boolean, nullable=False, default=False)
    is_urgent = Column(Boolean, nullable=False, default=False)
    position = Column(Integer, nullable=False, default=0)
    attachment_ids = Column(JSON, nullable=False, default=list)

    list = relationship("TodoList", back_populates="tasks")
    subtasks = relationship("Subtask", back_populates="task", cascade="all, delete-orphan")


class Subtask(UserScopedBase):
    """A checklist item within a task."""

    __tablename__ = "subtasks"

    task_id = Column(UUID(as_uuid=True), ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(500), nullable=False)
    is_completed = Column(Boolean, nullable=False, default=False)
    position = Column(Integer, nullable=False, default=0)

    task = relationship("Task", back_populates="subtasks")
