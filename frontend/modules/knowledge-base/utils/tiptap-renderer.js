/**
 * Lightweight Tiptap JSON → HTML renderer (no dependencies).
 * Covers StarterKit node types and common marks.
 */

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function applyMarks(text, marks) {
  if (!marks || !marks.length) return escapeHtml(text);

  let html = escapeHtml(text);

  for (const mark of marks) {
    switch (mark.type) {
      case 'bold':
        html = `<strong>${html}</strong>`;
        break;
      case 'italic':
        html = `<em>${html}</em>`;
        break;
      case 'strike':
        html = `<s>${html}</s>`;
        break;
      case 'code':
        html = `<code>${html}</code>`;
        break;
      case 'underline':
        html = `<u>${html}</u>`;
        break;
      case 'link': {
        const href = escapeHtml(mark.attrs?.href || '');
        html = `<a href="${href}" target="_blank" rel="noopener">${html}</a>`;
        break;
      }
    }
  }

  return html;
}

function renderNode(node) {
  if (!node) return '';

  switch (node.type) {
    case 'doc':
      return renderChildren(node);

    case 'paragraph':
      if (!node.content || !node.content.length) return '<p><br></p>';
      return `<p>${renderChildren(node)}</p>`;

    case 'heading': {
      const level = node.attrs?.level || 2;
      return `<h${level}>${renderChildren(node)}</h${level}>`;
    }

    case 'bulletList':
      return `<ul>${renderChildren(node)}</ul>`;

    case 'orderedList':
      return `<ol>${renderChildren(node)}</ol>`;

    case 'listItem':
      return `<li>${renderChildren(node)}</li>`;

    case 'blockquote':
      return `<blockquote>${renderChildren(node)}</blockquote>`;

    case 'codeBlock':
      return `<pre><code>${renderChildren(node)}</code></pre>`;

    case 'hardBreak':
      return '<br>';

    case 'horizontalRule':
      return '<hr>';

    case 'text':
      return applyMarks(node.text || '', node.marks);

    default:
      return renderChildren(node);
  }
}

function renderChildren(node) {
  if (!node.content) return '';
  return node.content.map(renderNode).join('');
}

export function tiptapToHtml(json) {
  if (!json) return '';
  if (typeof json === 'string') {
    try {
      json = JSON.parse(json);
    } catch {
      return escapeHtml(json);
    }
  }
  return renderNode(json);
}
