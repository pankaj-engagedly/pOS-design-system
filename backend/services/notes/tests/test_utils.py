"""Tests for extract_preview_text utility."""

import sys
from pathlib import Path

# Allow importing app module from test context
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.utils import extract_preview_text


def test_extract_from_simple_paragraph():
    content = {
        "type": "doc",
        "content": [
            {
                "type": "paragraph",
                "content": [{"type": "text", "text": "Hello world"}],
            }
        ],
    }
    assert extract_preview_text(content) == "Hello world"


def test_extract_from_nested_content():
    content = {
        "type": "doc",
        "content": [
            {
                "type": "heading",
                "content": [{"type": "text", "text": "Title"}],
            },
            {
                "type": "paragraph",
                "content": [{"type": "text", "text": "Body text here"}],
            },
            {
                "type": "bulletList",
                "content": [
                    {
                        "type": "listItem",
                        "content": [
                            {
                                "type": "paragraph",
                                "content": [{"type": "text", "text": "list item"}],
                            }
                        ],
                    }
                ],
            },
        ],
    }
    result = extract_preview_text(content)
    assert "Title" in result
    assert "Body text here" in result
    assert "list item" in result


def test_truncates_long_content():
    long_text = "a" * 300
    content = {
        "type": "doc",
        "content": [
            {"type": "paragraph", "content": [{"type": "text", "text": long_text}]}
        ],
    }
    result = extract_preview_text(content)
    assert len(result) == 200


def test_returns_none_for_null_content():
    assert extract_preview_text(None) is None


def test_returns_none_for_empty_doc():
    content = {"type": "doc", "content": []}
    assert extract_preview_text(content) is None


def test_returns_none_for_empty_dict():
    assert extract_preview_text({}) is None


def test_handles_multiple_text_nodes():
    content = {
        "type": "doc",
        "content": [
            {
                "type": "paragraph",
                "content": [
                    {"type": "text", "text": "Hello "},
                    {"type": "text", "marks": [{"type": "bold"}], "text": "world"},
                ],
            }
        ],
    }
    result = extract_preview_text(content)
    assert "Hello" in result
    assert "world" in result
