import { expect } from '@esm-bundle/chai';
import { fixture, html } from '@open-wc/testing-helpers';
import '../src/components/ui-tag.js';

describe('ui-tag', () => {
  it('renders shadow DOM with tag span', async () => {
    const el = await fixture(html`<ui-tag>Label</ui-tag>`);
    const tag = el.shadowRoot.querySelector('.tag');
    expect(tag).to.exist;
  });

  it('defaults to neutral variant', async () => {
    const el = await fixture(html`<ui-tag>X</ui-tag>`);
    expect(el.shadowRoot.querySelector('.tag').getAttribute('data-variant')).to.equal('neutral');
  });

  it('reflects variant attribute', async () => {
    const el = await fixture(html`<ui-tag variant="purple">P</ui-tag>`);
    expect(el.shadowRoot.querySelector('.tag').getAttribute('data-variant')).to.equal('purple');
  });

  it('shows close button when removable', async () => {
    const el = await fixture(html`<ui-tag removable>X</ui-tag>`);
    const btn = el.shadowRoot.querySelector('.close');
    expect(btn).to.exist;
  });

  it('hides close button when not removable', async () => {
    const el = await fixture(html`<ui-tag>X</ui-tag>`);
    const btn = el.shadowRoot.querySelector('.close');
    expect(btn).to.not.exist;
  });

  it('fires remove event on close click', async () => {
    const el = await fixture(html`<ui-tag removable>X</ui-tag>`);
    let removed = false;
    el.addEventListener('remove', () => { removed = true; });
    el.shadowRoot.querySelector('.close').click();
    expect(removed).to.be.true;
  });
});
