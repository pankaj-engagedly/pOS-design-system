class PosFeedWatcherApp extends HTMLElement {
  connectedCallback() {
    this.attachShadow({ mode: 'open' }).innerHTML = `
      <style>
        :host {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 60vh;
          color: var(--pos-color-text-secondary, #64748b);
        }
        h2 { margin: 0 0 8px; font-size: 28px; }
        p { margin: 0; font-size: 16px; }
      </style>
      <h2>Feed Watcher</h2>
      <p>Coming soon</p>
    `;
  }
}

customElements.define( + tag + , PosFeedWatcherApp);
