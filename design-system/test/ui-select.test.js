import { expect } from '@esm-bundle/chai';
import { fixture, html } from '@open-wc/testing-helpers';
import '../src/components/ui-select.js';

describe('ui-select', () => {
  it('renders shadow DOM with native select', async () => {
    const el = await fixture(html`
      <ui-select>
        <option value="a">A</option>
        <option value="b">B</option>
      </ui-select>
    `);
    const select = el.shadowRoot.querySelector('select');
    expect(select).to.exist;
  });

  it('copies light DOM options to internal select', async () => {
    const el = await fixture(html`
      <ui-select>
        <option value="a">Alpha</option>
        <option value="b">Beta</option>
      </ui-select>
    `);
    const options = el.shadowRoot.querySelectorAll('select option');
    expect(options.length).to.equal(2);
    expect(options[0].textContent).to.equal('Alpha');
  });

  it('adds placeholder as disabled first option', async () => {
    const el = await fixture(html`
      <ui-select placeholder="Choose...">
        <option value="a">A</option>
      </ui-select>
    `);
    const first = el.shadowRoot.querySelector('select option');
    expect(first.textContent).to.equal('Choose...');
    expect(first.disabled).to.be.true;
    expect(first.hidden).to.be.true;
  });

  it('exposes value property', async () => {
    const el = await fixture(html`
      <ui-select>
        <option value="x">X</option>
        <option value="y">Y</option>
      </ui-select>
    `);
    el.shadowRoot.querySelector('select').value = 'y';
    expect(el.value).to.equal('y');
  });

  it('reflects disabled attribute', async () => {
    const el = await fixture(html`
      <ui-select disabled>
        <option>A</option>
      </ui-select>
    `);
    expect(el.shadowRoot.querySelector('select').disabled).to.be.true;
  });

  it('fires change event', async () => {
    const el = await fixture(html`
      <ui-select>
        <option value="a">A</option>
        <option value="b">B</option>
      </ui-select>
    `);
    let changed = false;
    el.addEventListener('change', () => { changed = true; });
    const select = el.shadowRoot.querySelector('select');
    select.value = 'b';
    select.dispatchEvent(new Event('change'));
    expect(changed).to.be.true;
  });

  it('has chevron indicator', async () => {
    const el = await fixture(html`<ui-select><option>A</option></ui-select>`);
    expect(el.shadowRoot.querySelector('.chevron')).to.exist;
  });
});
