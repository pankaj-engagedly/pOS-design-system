import { expect } from '@esm-bundle/chai';
import { fixture, html } from '@open-wc/testing-helpers';
import '../src/components/ui-progress.js';

describe('ui-progress', () => {
  it('renders shadow DOM with track and fill', async () => {
    const el = await fixture(html`<ui-progress value="50"></ui-progress>`);
    expect(el.shadowRoot.querySelector('.track')).to.exist;
    expect(el.shadowRoot.querySelector('.fill')).to.exist;
  });

  it('sets fill width based on value/max', async () => {
    const el = await fixture(html`<ui-progress value="50" max="100"></ui-progress>`);
    const fill = el.shadowRoot.querySelector('.fill');
    expect(fill.style.width).to.equal('50%');
  });

  it('defaults max to 100', async () => {
    const el = await fixture(html`<ui-progress value="25"></ui-progress>`);
    const fill = el.shadowRoot.querySelector('.fill');
    expect(fill.style.width).to.equal('25%');
  });

  it('clamps fill at 100%', async () => {
    const el = await fixture(html`<ui-progress value="150" max="100"></ui-progress>`);
    const fill = el.shadowRoot.querySelector('.fill');
    expect(fill.style.width).to.equal('100%');
  });

  it('enters indeterminate mode when no value', async () => {
    const el = await fixture(html`<ui-progress></ui-progress>`);
    expect(el.hasAttribute('data-indeterminate')).to.be.true;
  });

  it('exits indeterminate mode when value is set', async () => {
    const el = await fixture(html`<ui-progress></ui-progress>`);
    el.setAttribute('value', '30');
    expect(el.hasAttribute('data-indeterminate')).to.be.false;
    expect(el.shadowRoot.querySelector('.fill').style.width).to.equal('30%');
  });

  it('has role="progressbar"', async () => {
    const el = await fixture(html`<ui-progress value="50"></ui-progress>`);
    expect(el.getAttribute('role')).to.equal('progressbar');
  });

  it('has aria-valuenow in determinate mode', async () => {
    const el = await fixture(html`<ui-progress value="50" max="100"></ui-progress>`);
    expect(el.getAttribute('aria-valuenow')).to.equal('50');
    expect(el.getAttribute('aria-valuemin')).to.equal('0');
    expect(el.getAttribute('aria-valuemax')).to.equal('100');
  });

  it('omits aria-valuenow in indeterminate mode', async () => {
    const el = await fixture(html`<ui-progress></ui-progress>`);
    expect(el.hasAttribute('aria-valuenow')).to.be.false;
  });
});
