import { expect } from '@esm-bundle/chai';
import { fixture, html } from '@open-wc/testing-helpers';
import '../src/components/ui-toggle.js';

describe('ui-toggle', () => {
  it('renders shadow DOM with track and thumb', async () => {
    const el = await fixture(html`<ui-toggle>Dark mode</ui-toggle>`);
    expect(el.shadowRoot.querySelector('.track')).to.exist;
    expect(el.shadowRoot.querySelector('.thumb')).to.exist;
    expect(el.shadowRoot.querySelector('label')).to.exist;
  });

  it('has role="switch" on internal input', async () => {
    const el = await fixture(html`<ui-toggle>X</ui-toggle>`);
    const input = el.shadowRoot.querySelector('input');
    expect(input.getAttribute('role')).to.equal('switch');
  });

  it('defaults to unchecked', async () => {
    const el = await fixture(html`<ui-toggle>X</ui-toggle>`);
    expect(el.checked).to.be.false;
  });

  it('reflects checked attribute', async () => {
    const el = await fixture(html`<ui-toggle checked>X</ui-toggle>`);
    expect(el.checked).to.be.true;
    expect(el.shadowRoot.querySelector('input').checked).to.be.true;
  });

  it('supports checked property setter', async () => {
    const el = await fixture(html`<ui-toggle>X</ui-toggle>`);
    el.checked = true;
    expect(el.hasAttribute('checked')).to.be.true;
  });

  it('reflects disabled attribute', async () => {
    const el = await fixture(html`<ui-toggle disabled>X</ui-toggle>`);
    expect(el.shadowRoot.querySelector('input').disabled).to.be.true;
  });

  it('fires change event on click', async () => {
    const el = await fixture(html`<ui-toggle>X</ui-toggle>`);
    let changed = false;
    el.addEventListener('change', () => { changed = true; });
    el.shadowRoot.querySelector('input').click();
    expect(changed).to.be.true;
    expect(el.checked).to.be.true;
  });
});
