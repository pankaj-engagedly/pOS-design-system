/**
 * createHostSDK — creates a minimal host SDK bound to a specific plugin element.
 *
 * Returns a plain object (no class, no prototype) with:
 *   - emit(eventName, payload)  — dispatch a composed CustomEvent from the element
 *   - getToken(name)            — read a resolved CSS custom property value
 *
 * Each plugin element gets its own SDK instance so emit() always
 * dispatches from the correct element.
 *
 * @param {HTMLElement} element — the plugin's host element
 * @returns {{ emit: Function, getToken: Function }}
 */
export function createHostSDK(element) {
  return {
    /**
     * Emit a custom event from the plugin element.
     * Always composed + bubbling so it's observable anywhere in the tree.
     * @param {string} eventName
     * @param {unknown} payload
     */
    emit(eventName, payload) {
      element.dispatchEvent(
        new CustomEvent(eventName, {
          bubbles: true,
          composed: true,
          detail: payload,
        })
      );
    },

    /**
     * Read the current computed value of a CSS custom property.
     * Reflects whatever theme is active at call time.
     * @param {string} name — e.g. '--pos-color-accent'
     * @returns {string}
     */
    getToken(name) {
      return getComputedStyle(document.documentElement)
        .getPropertyValue(name)
        .trim();
    },
  };
}
