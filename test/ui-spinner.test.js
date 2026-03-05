import { expect } from '@esm-bundle/chai';
import { fixture, html } from '@open-wc/testing-helpers';
import '../src/components/ui-spinner.js';

describe('ui-spinner', () => {
  it('renders shadow DOM with spinner div', async () => {
    const el = await fixture(html`<ui-spinner></ui-spinner>`);
    const spinner = el.shadowRoot.querySelector('.spinner');
    expect(spinner).to.exist;
  });

  it('has role="status"', async () => {
    const el = await fixture(html`<ui-spinner></ui-spinner>`);
    const spinner = el.shadowRoot.querySelector('.spinner');
    expect(spinner.getAttribute('role')).to.equal('status');
  });

  it('has aria-label="Loading"', async () => {
    const el = await fixture(html`<ui-spinner></ui-spinner>`);
    const spinner = el.shadowRoot.querySelector('.spinner');
    expect(spinner.getAttribute('aria-label')).to.equal('Loading');
  });

  it('defaults to md size', async () => {
    const el = await fixture(html`<ui-spinner></ui-spinner>`);
    const spinner = el.shadowRoot.querySelector('.spinner');
    expect(spinner.getAttribute('data-size')).to.equal('md');
  });

  it('reflects size attribute', async () => {
    const el = await fixture(html`<ui-spinner size="lg"></ui-spinner>`);
    const spinner = el.shadowRoot.querySelector('.spinner');
    expect(spinner.getAttribute('data-size')).to.equal('lg');
  });
});
