"""Utilities for extracting plain text from Tiptap JSON documents."""


def extract_plain_text(tiptap_json: dict, max_length: int = 500) -> str:
    """Extract plain text from Tiptap JSON document.

    Walks the document tree recursively, collecting text node values.
    Paragraph-level blocks are joined with newlines, truncated to max_length.
    """
    if not tiptap_json or not isinstance(tiptap_json, dict):
        return ""

    blocks = []
    _collect_block_texts(tiptap_json, blocks)
    full_text = "\n".join(blocks).strip()

    if len(full_text) > max_length:
        return full_text[:max_length].rstrip()
    return full_text


def _collect_block_texts(node: dict, blocks: list[str]) -> None:
    """Recursively collect text from block-level nodes."""
    node_type = node.get("type", "")
    content = node.get("content")

    # Top-level doc node — recurse into children
    if node_type == "doc":
        for child in content or []:
            _collect_block_texts(child, blocks)
        return

    # Block-level nodes (paragraph, heading, blockquote, listItem, etc.)
    # Collect all inline text within this block
    texts = []
    _collect_inline_texts(node, texts)
    if texts:
        blocks.append("".join(texts))
    elif content:
        # Nested blocks (e.g., blockquote containing paragraphs)
        for child in content:
            _collect_block_texts(child, blocks)


def _collect_inline_texts(node: dict, texts: list[str]) -> None:
    """Recursively collect text from inline/text nodes."""
    if node.get("type") == "text":
        text_val = node.get("text", "")
        if text_val:
            texts.append(text_val)
        return

    for child in node.get("content") or []:
        _collect_inline_texts(child, texts)
