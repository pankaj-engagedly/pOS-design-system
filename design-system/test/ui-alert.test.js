import { expect } from '@esm-bundle/chai';
import { fixture, html } from '@open-wc/testing-helpers';
import '../src/components/ui-alert.js';

describe('ui-alert', () => {
  it('renders shadow DOM with alert div', async () => {
    const el = await fixture(html`<ui-alert>Message</ui-alert>`);
    const alert = el.shadowRoot.querySelector('.alert');
    expect(alert).to.exist;
  });

  it('defaults to info variant', async () => {
    const el = await fixture(html`<ui-alert>Info</ui-alert>`);
    const alert = el.shadowRoot.querySelector('.alert');
    expect(alert.getAttribute('data-variant')).to.equal('info');
  });

  it('reflects variant attribute', async () => {
    for (const v of ['info', 'success', 'warning', 'danger']) {
      const el = await fixture(html`<ui-alert variant="${v}">X</ui-alert>`);
      expect(el.shadowRoot.querySelector('.alert').getAttribute('data-variant')).to.equal(v);
    }
  });

  it('shows close button when dismissible', async () => {
    const el = await fixture(html`<ui-alert dismissible>X</ui-alert>`);
    const btn = el.shadowRoot.querySelector('.close-btn');
    expect(btn).to.exist;
  });

  it('fires dismiss event and hides on close click', async () => {
    const el = await fixture(html`<ui-alert dismissible>X</ui-alert>`);
    let dismissed = false;
    el.addEventListener('dismiss', () => { dismissed = true; });
    el.shadowRoot.querySelector('.close-btn').click();
    expect(dismissed).to.be.true;
    expect(el.style.display).to.equal('none');
  });

  it('has header slot', async () => {
    const el = await fixture(html`<ui-alert><span slot="header">Title</span>Body</ui-alert>`);
    const headerSlot = el.shadowRoot.querySelector('slot[name="header"]');
    expect(headerSlot).to.exist;
  });

  it('has default body slot', async () => {
    const el = await fixture(html`<ui-alert>Content</ui-alert>`);
    const slot = el.shadowRoot.querySelector('.content slot:not([name])');
    expect(slot).to.exist;
  });
});
