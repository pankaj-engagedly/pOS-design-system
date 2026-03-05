/**
 * PosBaseElement — base class for all pOS Web Components.
 *
 * Provides:
 *   - Open-mode Shadow DOM attached in the constructor
 *   - adoptStyles(css) for performant stylesheet adoption with caching
 *
 * Intentionally has NO emit() helper. Native DOM events (click, input,
 * change, focus, blur) bubble through Shadow DOM naturally when emitted
 * by native elements inside. Custom events are created inline when needed.
 */

const sheetCache = new Map();

export class PosBaseElement extends HTMLElement {
  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
  }

  /**
   * Adopt a CSS string into the Shadow DOM via CSSStyleSheet.
   * Parsed once per unique CSS string, shared across all instances.
   * @param {string} css
   */
  adoptStyles(css) {
    let sheet = sheetCache.get(css);
    if (!sheet) {
      sheet = new CSSStyleSheet();
      sheet.replaceSync(css);
      sheetCache.set(css, sheet);
    }
    this.shadow.adoptedStyleSheets = [sheet];
  }
}
