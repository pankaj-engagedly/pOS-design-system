import { expect } from '@esm-bundle/chai';
import { fixture, html } from '@open-wc/testing-helpers';
import '../src/components/ui-side-panel.js';

describe('ui-side-panel', () => {
  it('renders shadow DOM with header, content, footer', async () => {
    const el = await fixture(html`<ui-side-panel><p>Content</p></ui-side-panel>`);
    expect(el.shadowRoot.querySelector('.header')).to.exist;
    expect(el.shadowRoot.querySelector('.content')).to.exist;
    expect(el.shadowRoot.querySelector('.footer')).to.exist;
  });

  it('has header slot', async () => {
    const el = await fixture(html`<ui-side-panel><span slot="header">Title</span></ui-side-panel>`);
    const slot = el.shadowRoot.querySelector('.header slot[name="header"]');
    expect(slot).to.exist;
  });

  it('has footer slot', async () => {
    const el = await fixture(html`<ui-side-panel><span slot="footer">Actions</span></ui-side-panel>`);
    const slot = el.shadowRoot.querySelector('.footer slot[name="footer"]');
    expect(slot).to.exist;
  });

  it('has default content slot', async () => {
    const el = await fixture(html`<ui-side-panel><p>Items</p></ui-side-panel>`);
    const slot = el.shadowRoot.querySelector('.content slot:not([name])');
    expect(slot).to.exist;
  });

  it('renders as flex column by default', async () => {
    const el = await fixture(html`<ui-side-panel></ui-side-panel>`);
    const style = getComputedStyle(el);
    expect(style.display).to.equal('flex');
    expect(style.flexDirection).to.equal('column');
  });

  it('applies custom width via attribute', async () => {
    const el = await fixture(html`<ui-side-panel width="300"></ui-side-panel>`);
    const val = el.style.getPropertyValue('--_panel-width');
    expect(val).to.equal('300px');
  });
});
