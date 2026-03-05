import { expect } from '@esm-bundle/chai';
import { fixture, html } from '@open-wc/testing-helpers';
import '../src/components/ui-divider.js';

describe('ui-divider', () => {
  it('renders shadow DOM with hr', async () => {
    const el = await fixture(html`<ui-divider></ui-divider>`);
    const hr = el.shadowRoot.querySelector('hr');
    expect(hr).to.exist;
  });

  it('defaults to horizontal', async () => {
    const el = await fixture(html`<ui-divider></ui-divider>`);
    expect(el.hasAttribute('orientation')).to.be.false;
  });

  it('supports vertical orientation', async () => {
    const el = await fixture(html`<ui-divider orientation="vertical"></ui-divider>`);
    expect(el.getAttribute('orientation')).to.equal('vertical');
  });
});
