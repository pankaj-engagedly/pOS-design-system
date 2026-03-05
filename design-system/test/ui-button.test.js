import { expect } from '@esm-bundle/chai';
import { fixture, html } from '@open-wc/testing-helpers';
import '../src/components/ui-button.js';

describe('ui-button', () => {
  it('renders shadow DOM with internal button', async () => {
    const el = await fixture(html`<ui-button>Click</ui-button>`);
    const btn = el.shadowRoot.querySelector('button');
    expect(btn).to.exist;
    expect(btn.textContent).to.include('');
  });

  it('defaults to solid variant', async () => {
    const el = await fixture(html`<ui-button>Solid</ui-button>`);
    const btn = el.shadowRoot.querySelector('button');
    expect(btn.getAttribute('data-variant')).to.equal('solid');
  });

  it('reflects variant attribute', async () => {
    const el = await fixture(html`<ui-button variant="danger">Del</ui-button>`);
    const btn = el.shadowRoot.querySelector('button');
    expect(btn.getAttribute('data-variant')).to.equal('danger');
  });

  it('reflects size attribute', async () => {
    const el = await fixture(html`<ui-button size="lg">Big</ui-button>`);
    const btn = el.shadowRoot.querySelector('button');
    expect(btn.getAttribute('data-size')).to.equal('lg');
  });

  it('reflects disabled attribute', async () => {
    const el = await fixture(html`<ui-button disabled>No</ui-button>`);
    const btn = el.shadowRoot.querySelector('button');
    expect(btn.disabled).to.be.true;
  });

  it('fires click event', async () => {
    const el = await fixture(html`<ui-button>Click</ui-button>`);
    let clicked = false;
    el.addEventListener('click', () => { clicked = true; });
    el.shadowRoot.querySelector('button').click();
    expect(clicked).to.be.true;
  });
});
