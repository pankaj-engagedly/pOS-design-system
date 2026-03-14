import { expect } from '@esm-bundle/chai';
import { fixture, html } from '@open-wc/testing-helpers';
import '../src/components/ui-nav-item.js';

describe('ui-nav-item', () => {
  it('renders shadow DOM with nav-row', async () => {
    const el = await fixture(html`<ui-nav-item>Inbox</ui-nav-item>`);
    const row = el.shadowRoot.querySelector('.nav-row');
    expect(row).to.exist;
  });

  it('displays label via default slot', async () => {
    const el = await fixture(html`<ui-nav-item>Tasks</ui-nav-item>`);
    const slot = el.shadowRoot.querySelector('.label slot:not([name])');
    expect(slot).to.exist;
  });

  it('displays count when attribute is set', async () => {
    const el = await fixture(html`<ui-nav-item count="5">Inbox</ui-nav-item>`);
    const count = el.shadowRoot.querySelector('.count');
    expect(count.textContent).to.equal('5');
  });

  it('hides count when attribute is absent', async () => {
    const el = await fixture(html`<ui-nav-item>Inbox</ui-nav-item>`);
    const count = el.shadowRoot.querySelector('.count');
    const style = getComputedStyle(count);
    expect(style.display).to.equal('none');
  });

  it('has icon slot', async () => {
    const el = await fixture(html`<ui-nav-item><span slot="icon">*</span>Tasks</ui-nav-item>`);
    const iconSlot = el.shadowRoot.querySelector('slot[name="icon"]');
    expect(iconSlot).to.exist;
  });

  it('reflects selected attribute', async () => {
    const el = await fixture(html`<ui-nav-item selected>Inbox</ui-nav-item>`);
    expect(el.hasAttribute('selected')).to.be.true;
  });

  it('fires nav-select event on click', async () => {
    const el = await fixture(html`<ui-nav-item>Inbox</ui-nav-item>`);
    let fired = false;
    el.addEventListener('nav-select', () => { fired = true; });
    el.shadowRoot.querySelector('.nav-row').click();
    expect(fired).to.be.true;
  });

  it('nav-select event is composed (crosses shadow boundaries)', async () => {
    const el = await fixture(html`<ui-nav-item>Inbox</ui-nav-item>`);
    let composed = false;
    el.addEventListener('nav-select', (e) => { composed = e.composed; });
    el.shadowRoot.querySelector('.nav-row').click();
    expect(composed).to.be.true;
  });
});
