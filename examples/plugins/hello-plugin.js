/**
 * HelloPlugin — example pOS plugin.
 *
 * Demonstrates:
 *   1. Reading host theme tokens via this.hostSDK.getToken()
 *   2. Emitting a composed custom event via this.hostSDK.emit()
 *   3. CSS custom property inheritance through Shadow DOM
 *
 * SDK injection: the host sets `element.hostSDK = createHostSDK(element)`
 * BEFORE appending to the DOM, so it's available in connectedCallback.
 *
 * Usage (host page):
 *   import { loadPlugin, createHostSDK } from './dist/pos-design-system.js';
 *   const { tagName } = await loadPlugin({ url: './plugins/hello-plugin.js', tagName: 'plugin-hello' });
 *   const el = document.createElement(tagName);
 *   el.hostSDK = createHostSDK(el);
 *   document.body.appendChild(el);
 */

const CSS = `
  :host {
    display: inline-block;
  }

  .card {
    padding: 16px 20px;
    border: 1px solid var(--pos-color-border);
    border-radius: 8px;
    background: var(--pos-color-bg);
    font-family: inherit;
    font-size: 14px;
    color: var(--pos-color-fg);
  }

  .label {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--pos-color-muted);
    margin-bottom: 8px;
  }

  button {
    margin-top: 12px;
    padding: 6px 14px;
    background: var(--pos-color-accent);
    color: var(--pos-color-bg);
    border: none;
    border-radius: 5px;
    font-size: 13px;
    cursor: pointer;
  }

  button:hover {
    background: var(--pos-color-accent-hover);
  }

  button:focus-visible {
    outline: 2px solid var(--pos-color-focus);
    outline-offset: 2px;
  }

  .token-val {
    font-family: monospace;
    font-size: 12px;
    color: var(--pos-color-accent);
  }
`;

class HelloPlugin extends HTMLElement {
  constructor() {
    super();
    this._shadow = this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(CSS);
    this._shadow.adoptedStyleSheets = [sheet];

    // Read host theme token — proves CSS var inheritance through Shadow DOM
    const accentToken = this.hostSDK
      ? this.hostSDK.getToken('--pos-color-accent')
      : '(no SDK)';

    this._shadow.innerHTML = `
      <div class="card">
        <div class="label">plugin-hello</div>
        <div>Host accent token: <span class="token-val">${accentToken}</span></div>
        <button id="btn">Emit event</button>
      </div>
    `;

    this._shadow.getElementById('btn').addEventListener('click', () => {
      if (this.hostSDK) {
        this.hostSDK.emit('plugin:hello:action', {
          source: 'plugin-hello',
          token: this.hostSDK.getToken('--pos-color-accent'),
        });
      }
    });
  }
}

export default HelloPlugin;
