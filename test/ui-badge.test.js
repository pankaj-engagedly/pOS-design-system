import { expect } from '@esm-bundle/chai';
import { fixture, html } from '@open-wc/testing-helpers';
import '../src/components/ui-badge.js';

describe('ui-badge', () => {
  it('renders shadow DOM with span', async () => {
    const el = await fixture(html`<ui-badge>New</ui-badge>`);
    const span = el.shadowRoot.querySelector('span');
    expect(span).to.exist;
  });

  it('defaults to neutral variant', async () => {
    const el = await fixture(html`<ui-badge>Tag</ui-badge>`);
    const span = el.shadowRoot.querySelector('span');
    expect(span.getAttribute('data-variant')).to.equal('neutral');
  });

  it('reflects variant attribute', async () => {
    const el = await fixture(html`<ui-badge variant="primary">P</ui-badge>`);
    const span = el.shadowRoot.querySelector('span');
    expect(span.getAttribute('data-variant')).to.equal('primary');
  });

  it('supports all variants', async () => {
    for (const v of ['neutral', 'primary', 'success', 'warning', 'danger', 'purple']) {
      const el = await fixture(html`<ui-badge variant="${v}">X</ui-badge>`);
      expect(el.shadowRoot.querySelector('span').getAttribute('data-variant')).to.equal(v);
    }
  });

  it('reflects size attribute', async () => {
    const el = await fixture(html`<ui-badge size="lg">Big</ui-badge>`);
    const span = el.shadowRoot.querySelector('span');
    expect(span.getAttribute('data-size')).to.equal('lg');
  });
});
