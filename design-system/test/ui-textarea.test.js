import { expect } from '@esm-bundle/chai';
import { fixture, html } from '@open-wc/testing-helpers';
import '../src/components/ui-textarea.js';

describe('ui-textarea', () => {
  it('renders shadow DOM with native textarea', async () => {
    const el = await fixture(html`<ui-textarea></ui-textarea>`);
    expect(el.shadowRoot.querySelector('textarea')).to.exist;
    expect(el.shadowRoot.querySelector('.wrapper')).to.exist;
  });

  it('mirrors placeholder attribute', async () => {
    const el = await fixture(html`<ui-textarea placeholder="Enter..."></ui-textarea>`);
    expect(el.shadowRoot.querySelector('textarea').placeholder).to.equal('Enter...');
  });

  it('mirrors rows attribute', async () => {
    const el = await fixture(html`<ui-textarea rows="5"></ui-textarea>`);
    expect(el.shadowRoot.querySelector('textarea').rows).to.equal(5);
  });

  it('defaults to 3 rows', async () => {
    const el = await fixture(html`<ui-textarea></ui-textarea>`);
    expect(el.shadowRoot.querySelector('textarea').rows).to.equal(3);
  });

  it('mirrors disabled attribute', async () => {
    const el = await fixture(html`<ui-textarea disabled></ui-textarea>`);
    expect(el.shadowRoot.querySelector('textarea').disabled).to.be.true;
  });

  it('exposes value property', async () => {
    const el = await fixture(html`<ui-textarea></ui-textarea>`);
    el.shadowRoot.querySelector('textarea').value = 'hello';
    expect(el.value).to.equal('hello');
  });

  it('sets value via property', async () => {
    const el = await fixture(html`<ui-textarea></ui-textarea>`);
    el.value = 'test';
    expect(el.shadowRoot.querySelector('textarea').value).to.equal('test');
  });

  it('fires change event', async () => {
    const el = await fixture(html`<ui-textarea></ui-textarea>`);
    let changed = false;
    el.addEventListener('change', () => { changed = true; });
    const ta = el.shadowRoot.querySelector('textarea');
    ta.value = 'new';
    ta.dispatchEvent(new Event('change'));
    expect(changed).to.be.true;
  });
});
