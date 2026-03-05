import { expect } from '@esm-bundle/chai';
import { fixture, html } from '@open-wc/testing-helpers';
import '../src/components/ui-card.js';

describe('ui-card', () => {
  it('renders shadow DOM with card structure', async () => {
    const el = await fixture(html`<ui-card><p>Body</p></ui-card>`);
    const card = el.shadowRoot.querySelector('.card');
    expect(card).to.exist;
    expect(el.shadowRoot.querySelector('.header')).to.exist;
    expect(el.shadowRoot.querySelector('.body')).to.exist;
    expect(el.shadowRoot.querySelector('.footer')).to.exist;
  });

  it('has header slot', async () => {
    const el = await fixture(html`<ui-card><span slot="header">Title</span></ui-card>`);
    const headerSlot = el.shadowRoot.querySelector('.header slot[name="header"]');
    expect(headerSlot).to.exist;
  });

  it('has footer slot', async () => {
    const el = await fixture(html`<ui-card><span slot="footer">Foot</span></ui-card>`);
    const footerSlot = el.shadowRoot.querySelector('.footer slot[name="footer"]');
    expect(footerSlot).to.exist;
  });

  it('has default body slot', async () => {
    const el = await fixture(html`<ui-card><p>Content</p></ui-card>`);
    const bodySlot = el.shadowRoot.querySelector('.body slot:not([name])');
    expect(bodySlot).to.exist;
  });
});
