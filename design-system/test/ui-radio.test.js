import { expect } from '@esm-bundle/chai';
import { fixture, html } from '@open-wc/testing-helpers';
import '../src/components/ui-radio.js';

describe('ui-radio', () => {
  it('renders shadow DOM with hidden radio and styled circle', async () => {
    const el = await fixture(html`<ui-radio>Option</ui-radio>`);
    expect(el.shadowRoot.querySelector('input[type="radio"]')).to.exist;
    expect(el.shadowRoot.querySelector('.circle')).to.exist;
    expect(el.shadowRoot.querySelector('label')).to.exist;
  });

  it('reflects name attribute to internal input', async () => {
    const el = await fixture(html`<ui-radio name="group1">X</ui-radio>`);
    expect(el.shadowRoot.querySelector('input').name).to.equal('group1');
  });

  it('reflects value attribute', async () => {
    const el = await fixture(html`<ui-radio value="a">X</ui-radio>`);
    expect(el.value).to.equal('a');
  });

  it('reflects checked attribute', async () => {
    const el = await fixture(html`<ui-radio checked>X</ui-radio>`);
    expect(el.checked).to.be.true;
    expect(el.shadowRoot.querySelector('input').checked).to.be.true;
  });

  it('reflects disabled attribute', async () => {
    const el = await fixture(html`<ui-radio disabled>X</ui-radio>`);
    expect(el.shadowRoot.querySelector('input').disabled).to.be.true;
  });

  it('fires change event on click', async () => {
    const el = await fixture(html`<ui-radio name="test" value="a">X</ui-radio>`);
    let changed = false;
    el.addEventListener('change', () => { changed = true; });
    el.shadowRoot.querySelector('input').click();
    expect(changed).to.be.true;
  });
});
