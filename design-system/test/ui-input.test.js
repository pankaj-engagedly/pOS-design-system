import { expect } from '@esm-bundle/chai';
import { fixture, html } from '@open-wc/testing-helpers';
import '../src/components/ui-input.js';

describe('ui-input', () => {
  it('renders shadow DOM with internal input', async () => {
    const el = await fixture(html`<ui-input></ui-input>`);
    const input = el.shadowRoot.querySelector('input');
    expect(input).to.exist;
  });

  it('mirrors type attribute', async () => {
    const el = await fixture(html`<ui-input type="email"></ui-input>`);
    const input = el.shadowRoot.querySelector('input');
    expect(input.type).to.equal('email');
  });

  it('mirrors placeholder attribute', async () => {
    const el = await fixture(html`<ui-input placeholder="Enter..."></ui-input>`);
    const input = el.shadowRoot.querySelector('input');
    expect(input.placeholder).to.equal('Enter...');
  });

  it('mirrors disabled attribute', async () => {
    const el = await fixture(html`<ui-input disabled></ui-input>`);
    const input = el.shadowRoot.querySelector('input');
    expect(input.disabled).to.be.true;
  });

  it('exposes value property', async () => {
    const el = await fixture(html`<ui-input></ui-input>`);
    el.shadowRoot.querySelector('input').value = 'hello';
    expect(el.value).to.equal('hello');
  });

  it('sets value via property', async () => {
    const el = await fixture(html`<ui-input></ui-input>`);
    el.value = 'test';
    expect(el.shadowRoot.querySelector('input').value).to.equal('test');
  });

  it('fires change event', async () => {
    const el = await fixture(html`<ui-input></ui-input>`);
    let changed = false;
    el.addEventListener('change', () => { changed = true; });
    const input = el.shadowRoot.querySelector('input');
    input.value = 'new';
    input.dispatchEvent(new Event('change'));
    expect(changed).to.be.true;
  });
});
