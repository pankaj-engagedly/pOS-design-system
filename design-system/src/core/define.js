/**
 * Safe customElements.define wrapper.
 * Skips registration if the tag is already defined — prevents errors
 * when multiple bundles or CDN script tags load the same component.
 *
 * @param {string} tagName
 * @param {CustomElementConstructor} elementClass
 */
export function define(tagName, elementClass) {
  if (!customElements.get(tagName)) {
    customElements.define(tagName, elementClass);
  }
}
