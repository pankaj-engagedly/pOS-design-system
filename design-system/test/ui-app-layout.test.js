import { expect } from '@esm-bundle/chai';
import { fixture, html } from '@open-wc/testing-helpers';
import '../src/components/ui-app-layout.js';

describe('ui-app-layout', () => {
  it('renders shadow DOM with sidebar and main', async () => {
    const el = await fixture(html`<ui-app-layout><div slot="sidebar">Side</div><div>Main</div></ui-app-layout>`);
    expect(el.shadowRoot.querySelector('.sidebar')).to.exist;
    expect(el.shadowRoot.querySelector('.main')).to.exist;
  });

  it('has sidebar slot', async () => {
    const el = await fixture(html`<ui-app-layout><div slot="sidebar">Side</div></ui-app-layout>`);
    const slot = el.shadowRoot.querySelector('.sidebar slot[name="sidebar"]');
    expect(slot).to.exist;
  });

  it('has default slot for main content', async () => {
    const el = await fixture(html`<ui-app-layout><div>Content</div></ui-app-layout>`);
    const slot = el.shadowRoot.querySelector('.main slot:not([name])');
    expect(slot).to.exist;
  });

  it('uses default sidebar width of 240px', async () => {
    const el = await fixture(html`<ui-app-layout></ui-app-layout>`);
    const sidebar = el.shadowRoot.querySelector('.sidebar');
    const style = getComputedStyle(sidebar);
    expect(style.width).to.equal('240px');
  });

  it('applies custom sidebar width via attribute', async () => {
    const el = await fixture(html`<ui-app-layout sidebar-width="300"></ui-app-layout>`);
    const val = el.style.getPropertyValue('--_sidebar-width');
    expect(val).to.equal('300px');
  });

  it('takes full height', async () => {
    const el = await fixture(html`<ui-app-layout style="height: 400px"><div slot="sidebar">S</div><div>M</div></ui-app-layout>`);
    const style = getComputedStyle(el);
    expect(style.height).to.equal('400px');
  });
});
