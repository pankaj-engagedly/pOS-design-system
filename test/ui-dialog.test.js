import { expect } from '@esm-bundle/chai';
import { fixture, html } from '@open-wc/testing-helpers';
import '../src/components/ui-dialog.js';

describe('ui-dialog', () => {
  it('renders shadow DOM with native dialog', async () => {
    const el = await fixture(html`<ui-dialog></ui-dialog>`);
    const dialog = el.shadowRoot.querySelector('dialog');
    expect(dialog).to.exist;
  });

  it('has open() and close() methods', async () => {
    const el = await fixture(html`<ui-dialog></ui-dialog>`);
    expect(typeof el.open).to.equal('function');
    expect(typeof el.close).to.equal('function');
  });

  it('shows close button when closable', async () => {
    const el = await fixture(html`<ui-dialog closable></ui-dialog>`);
    const closeBtn = el.shadowRoot.querySelector('.close-btn');
    expect(closeBtn).to.exist;
    expect(getComputedStyle(closeBtn).display).to.not.equal('none');
  });

  it('has header/body/footer slots', async () => {
    const el = await fixture(html`<ui-dialog></ui-dialog>`);
    expect(el.shadowRoot.querySelector('slot[name="header"]')).to.exist;
    expect(el.shadowRoot.querySelector('slot:not([name])')).to.exist;
    expect(el.shadowRoot.querySelector('slot[name="footer"]')).to.exist;
  });

  it('fires close event when closed', async () => {
    const el = await fixture(html`<ui-dialog closable></ui-dialog>`);
    let closed = false;
    el.addEventListener('close', () => { closed = true; });
    el.open();
    el.close();
    // The native dialog close event is async
    await new Promise(r => setTimeout(r, 50));
    expect(closed).to.be.true;
  });
});
