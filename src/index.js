/**
 * pOS Design System — barrel entry point.
 *
 * Importing this module:
 *   1. Registers ui-button and ui-input as custom elements
 *   2. Exports loadPlugin + createHostSDK for plugin runtime
 */

// Components — side-effect: registers custom elements via define()
import './components/ui-button.js';
import './components/ui-input.js';

// Plugin runtime — re-exported for consumers
export { loadPlugin, createHostSDK } from './plugins/loader.js';
