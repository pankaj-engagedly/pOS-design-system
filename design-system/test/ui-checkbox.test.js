import { expect } from '@esm-bundle/chai';
import { fixture, html } from '@open-wc/testing-helpers';
import '../src/components/ui-checkbox.js';

describe('ui-checkbox', () => {
  it('renders shadow DOM with hidden input and styled box', async () => {
    const el = await fixture(html`<ui-checkbox>Check me</ui-checkbox>`);
    expect(el.shadowRoot.querySelector('input[type="checkbox"]')).to.exist;
    expect(el.shadowRoot.querySelector('.box')).to.exist;
    expect(el.shadowRoot.querySelector('label')).to.exist;
  });

  it('defaults to unchecked', async () => {
    const el = await fixture(html`<ui-checkbox>X</ui-checkbox>`);
    expect(el.checked).to.be.false;
  });

  it('reflects checked attribute', async () => {
    const el = await fixture(html`<ui-checkbox checked>X</ui-checkbox>`);
    expect(el.checked).to.be.true;
    expect(el.shadowRoot.querySelector('input').checked).to.be.true;
  });

  it('supports checked property setter', async () => {
    const el = await fixture(html`<ui-checkbox>X</ui-checkbox>`);
    el.checked = true;
    expect(el.hasAttribute('checked')).to.be.true;
  });

  it('supports indeterminate property', async () => {
    const el = await fixture(html`<ui-checkbox>X</ui-checkbox>`);
    el.indeterminate = true;
    expect(el.hasAttribute('indeterminate')).to.be.true;
  });

  it('reflects disabled attribute', async () => {
    const el = await fixture(html`<ui-checkbox disabled>X</ui-checkbox>`);
    expect(el.shadowRoot.querySelector('input').disabled).to.be.true;
  });

  it('fires change event on click', async () => {
    const el = await fixture(html`<ui-checkbox>X</ui-checkbox>`);
    let changed = false;
    el.addEventListener('change', () => { changed = true; });
    el.shadowRoot.querySelector('input').click();
    expect(changed).to.be.true;
    expect(el.checked).to.be.true;
  });

  it('clears indeterminate on click', async () => {
    const el = await fixture(html`<ui-checkbox>X</ui-checkbox>`);
    el.indeterminate = true;
    el.shadowRoot.querySelector('input').click();
    expect(el.indeterminate).to.be.false;
  });
});
