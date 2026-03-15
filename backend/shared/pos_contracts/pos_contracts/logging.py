"""Centralized logging for all pOS services — powered by loguru.

Setup:
    In each service's main.py, call setup_logging() in the lifespan:

        from pos_contracts.logging import setup_logging
        setup_logging(config.SERVICE_NAME, config.LOG_LEVEL)

Levels (from most to least verbose):
    TRACE   — function entry/exit with args and return values.
              Use this when learning how the codebase executes.
              Enable: LOG_LEVEL=TRACE make dev
    DEBUG   — internal state, SQL echo, detailed diagnostics
    INFO    — production default: startup, shutdown, requests, events
    WARNING — something unexpected but recoverable
    ERROR   — something broke

Function tracing:
    Decorate any function (sync or async) with @trace to log entry/exit
    at TRACE level. Zero overhead when LOG_LEVEL is INFO or above —
    loguru short-circuits the call entirely.

        from pos_contracts.logging import trace

        @trace
        async def create_note(session, user_id, data):
            ...

    Output at TRACE level:
        TRACE | pos-notes | → create_note(user_id=abc-123, data=NoteCreate(...))
        TRACE | pos-notes | ← create_note returned <Note id=def-456> (12.3ms)
"""

import functools
import logging
import sys
import time
from typing import Any, Callable

from loguru import logger


def setup_logging(service_name: str, level: str = "INFO") -> None:
    """Configure loguru as the sole logger for a pOS service.

    - Removes loguru's default handler (no duplicate output)
    - Adds a single stderr handler with the service name in every line
    - Intercepts stdlib logging (uvicorn, sqlalchemy, etc.) so ALL log
      output flows through loguru with a consistent format
    """
    # Remove default loguru handler
    logger.remove()

    # Format: timestamp | level | service | module:function:line | message
    # Colors only in terminal (loguru auto-detects)
    fmt = (
        "<green>{time:HH:mm:ss.SSS}</green> | "
        "<level>{level: <8}</level> | "
        "<cyan>{extra[service]: <12}</cyan> | "
        "<dim>{name}:{function}:{line}</dim> | "
        "{message}"
    )

    # Single handler — stderr so it doesn't mix with stdout JSON responses
    logger.configure(extra={"service": service_name})
    logger.add(sys.stderr, level=level.upper(), format=fmt)

    # Intercept stdlib logging → loguru
    # This captures uvicorn, sqlalchemy, and any library using stdlib logging.
    # Without this, those logs bypass loguru and appear unformatted.
    logging.basicConfig(handlers=[_InterceptHandler()], level=0, force=True)

    logger.info("Logging initialized (level={})", level.upper())


class _InterceptHandler(logging.Handler):
    """Bridge stdlib logging → loguru.

    Any library that uses Python's built-in logging (uvicorn, sqlalchemy,
    aio-pika, etc.) will have its output routed through loguru, so all
    log lines have the same format and respect the same LOG_LEVEL.
    """

    def emit(self, record: logging.LogRecord) -> None:
        # Map stdlib level to loguru level
        try:
            level = logger.level(record.levelname).name
        except ValueError:
            level = record.levelno

        # Find the caller frame (skip this handler + stdlib logging frames)
        frame, depth = logging.currentframe(), 0
        while frame and (depth == 0 or frame.f_code.co_filename == logging.__file__):
            frame = frame.f_back
            depth += 1

        logger.opt(depth=depth, exception=record.exc_info).log(level, record.getMessage())


def trace(func: Callable) -> Callable:
    """Decorator that logs function entry and exit at TRACE level.

    Works with both sync and async functions. Logs:
    - Entry: function name + all arguments
    - Exit:  function name + return value + elapsed time

    When LOG_LEVEL is INFO or above, loguru skips TRACE entirely —
    no string formatting, no performance overhead. Safe to leave
    on all service/route functions permanently.

    Usage:
        @trace
        async def create_note(session, user_id, data):
            ...
    """
    is_async = _is_coroutine_function(func)
    name = func.__qualname__

    if is_async:
        @functools.wraps(func)
        async def wrapper(*args: Any, **kwargs: Any) -> Any:
            _log_entry(name, args, kwargs)
            start = time.perf_counter()
            try:
                result = await func(*args, **kwargs)
                _log_exit(name, result, start)
                return result
            except Exception as e:
                _log_exception(name, e, start)
                raise
        return wrapper
    else:
        @functools.wraps(func)
        def wrapper(*args: Any, **kwargs: Any) -> Any:
            _log_entry(name, args, kwargs)
            start = time.perf_counter()
            try:
                result = func(*args, **kwargs)
                _log_exit(name, result, start)
                return result
            except Exception as e:
                _log_exception(name, e, start)
                raise
        return wrapper


def _is_coroutine_function(func: Callable) -> bool:
    """Check if a function is async — handles both plain async and decorated."""
    import asyncio
    return asyncio.iscoroutinefunction(func)


def _log_entry(name: str, args: tuple, kwargs: dict) -> None:
    """Log function entry at TRACE level with arguments."""
    # Skip 'self' and session-like objects — show meaningful args only
    display_args = []
    for arg in args:
        type_name = type(arg).__name__
        if type_name in ("AsyncSession", "Session"):
            continue
        display_args.append(_summarize(arg))
    for k, v in kwargs.items():
        display_args.append(f"{k}={_summarize(v)}")

    logger.trace("→ {}({})", name, ", ".join(display_args))


def _log_exit(name: str, result: Any, start: float) -> None:
    """Log function exit at TRACE level with return value and duration."""
    elapsed = (time.perf_counter() - start) * 1000
    logger.trace("← {} returned {} ({:.1f}ms)", name, _summarize(result), elapsed)


def _log_exception(name: str, exc: Exception, start: float) -> None:
    """Log function exception at TRACE level."""
    elapsed = (time.perf_counter() - start) * 1000
    logger.trace("✗ {} raised {}('{}') ({:.1f}ms)", name, type(exc).__name__, exc, elapsed)


def _summarize(val: Any, max_len: int = 80) -> str:
    """Create a short string representation of a value for trace logs.

    Truncates long strings, shows type+id for models, keeps primitives as-is.
    """
    # SQLAlchemy models — show class name + id if available
    if hasattr(val, "__tablename__"):
        model_id = getattr(val, "id", "?")
        return f"<{type(val).__name__} id={model_id}>"

    # Pydantic models — show class name + fields
    if hasattr(val, "model_dump"):
        return f"{type(val).__name__}({val})"

    # UUIDs — short form
    if hasattr(val, "hex") and hasattr(val, "int"):
        return str(val)

    # Lists — show count
    if isinstance(val, list):
        return f"[{len(val)} items]"

    s = repr(val)
    if len(s) > max_len:
        return s[: max_len - 3] + "..."
    return s
