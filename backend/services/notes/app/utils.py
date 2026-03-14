"""Notes utility functions."""


def extract_preview_text(content_json: dict | None, max_length: int = 200) -> str | None:
    """Extract plain text from a Tiptap JSON document.

    Recursively walks the document tree, collecting text from all text nodes,
    then truncates to max_length characters.
    """
    if not content_json:
        return None

    parts: list[str] = []
    _collect_text(content_json, parts)
    text = " ".join(p for p in parts if p.strip())

    if not text:
        return None

    return text[:max_length] if len(text) > max_length else text


def _collect_text(node: dict, parts: list[str]) -> None:
    """Recursively extract text from Tiptap JSON node."""
    if not isinstance(node, dict):
        return

    node_type = node.get("type")

    # Leaf text node
    if node_type == "text":
        text = node.get("text", "")
        if text:
            parts.append(text)
        return

    # Recurse into children
    for child in node.get("content", []):
        _collect_text(child, parts)
