import { define } from '../core/define.js';
import { createHostSDK } from './host-sdk.js';

/**
 * loadPlugin — dynamically imports a plugin module and registers its custom element.
 *
 * Contract:
 *   - The module at `url` must have a default export that is a Custom Element class
 *   - The element will be registered under `tagName`
 *   - Duplicate loads for the same tagName are silently skipped (via define())
 *
 * SDK injection pattern (host responsibility):
 *   const el = document.createElement(tagName);
 *   el.hostSDK = createHostSDK(el);   // inject before connectedCallback fires
 *   container.appendChild(el);
 *
 * The loader exports createHostSDK so hosts don't need a separate import.
 *
 * @param {{ url: string, tagName: string }} options
 * @returns {Promise<{ tagName: string, ElementClass: CustomElementConstructor }>}
 */
export async function loadPlugin({ url, tagName }) {
  const module = await import(url);
  const ElementClass = module.default;

  if (!ElementClass) {
    throw new Error(`Plugin at "${url}" has no default export.`);
  }

  define(tagName, ElementClass);

  return { tagName, ElementClass };
}

export { createHostSDK };
