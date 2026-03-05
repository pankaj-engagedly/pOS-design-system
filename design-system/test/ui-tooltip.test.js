import { expect } from '@esm-bundle/chai';
import { fixture, html } from '@open-wc/testing-helpers';
import '../src/components/ui-tooltip.js';

describe('ui-tooltip', () => {
  it('renders shadow DOM with trigger and tooltip', async () => {
    const el = await fixture(html`<ui-tooltip text="Hint"><span>Hover</span></ui-tooltip>`);
    expect(el.shadowRoot.querySelector('.trigger')).to.exist;
    expect(el.shadowRoot.querySelector('.tooltip')).to.exist;
  });

  it('sets tooltip text from attribute', async () => {
    const el = await fixture(html`<ui-tooltip text="Hello"><span>X</span></ui-tooltip>`);
    const tip = el.shadowRoot.querySelector('.tooltip');
    expect(tip.textContent).to.equal('Hello');
  });

  it('has role="tooltip"', async () => {
    const el = await fixture(html`<ui-tooltip text="Tip"><span>X</span></ui-tooltip>`);
    const tip = el.shadowRoot.querySelector('.tooltip');
    expect(tip.getAttribute('role')).to.equal('tooltip');
  });

  it('sets aria-describedby on trigger', async () => {
    const el = await fixture(html`<ui-tooltip text="Tip"><span>X</span></ui-tooltip>`);
    const trigger = el.shadowRoot.querySelector('.trigger');
    const tip = el.shadowRoot.querySelector('.tooltip');
    expect(trigger.getAttribute('aria-describedby')).to.equal(tip.id);
  });

  it('reflects position attribute', async () => {
    const el = await fixture(html`<ui-tooltip text="Tip" position="bottom"><span>X</span></ui-tooltip>`);
    const tip = el.shadowRoot.querySelector('.tooltip');
    expect(tip.getAttribute('data-position')).to.equal('bottom');
  });
});
