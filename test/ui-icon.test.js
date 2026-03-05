import { expect } from '@esm-bundle/chai';
import { fixture, html } from '@open-wc/testing-helpers';
import '../src/components/ui-icon.js';

describe('ui-icon', () => {
  it('renders shadow DOM with slot', async () => {
    const el = await fixture(html`<ui-icon><span>X</span></ui-icon>`);
    const slot = el.shadowRoot.querySelector('slot');
    expect(slot).to.exist;
  });

  it('applies color token via attribute', async () => {
    const el = await fixture(html`<ui-icon color="action"><span>A</span></ui-icon>`);
    expect(el.hasAttribute('data-color')).to.be.true;
    expect(el.style.getPropertyValue('--_icon-color')).to.include('--pos-color-action-primary');
  });

  it('defaults to no color override', async () => {
    const el = await fixture(html`<ui-icon><span>X</span></ui-icon>`);
    expect(el.hasAttribute('data-color')).to.be.false;
  });
});
