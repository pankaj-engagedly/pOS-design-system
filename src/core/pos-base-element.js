/**
 * PosBaseElement — base class for all pOS Web Components.
 *
 * Provides:
 *   - Open-mode Shadow DOM attached in the constructor
 *   - adoptStyles(css) for performant stylesheet adoption
 *
 * Intentionally has NO emit() helper. Native DOM events (click, input,
 * change, focus, blur) bubble through Shadow DOM naturally when emitted
 * by native elements inside. Custom events are created inline when needed.
 */
export class PosBaseElement extends HTMLElement {
  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
  }

  /**
   * Adopt a CSS string into the Shadow DOM via CSSStyleSheet.
   * Parsed once, shared across all instances.
   * @param {string} css
   */
  adoptStyles(css) {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(css);
    this.shadow.adoptedStyleSheets = [sheet];
  }
}
