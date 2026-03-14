/**
 * pOS Design System — barrel entry point.
 *
 * Importing this module:
 *   1. Registers all base components as custom elements
 *   2. Exports loadPlugin + createHostSDK for plugin runtime
 */

// Components — side-effect: registers custom elements via define()
import './components/ui-button.js';
import './components/ui-input.js';
import './components/ui-badge.js';
import './components/ui-tag.js';
import './components/ui-spinner.js';
import './components/ui-icon.js';
import './components/ui-card.js';
import './components/ui-divider.js';
import './components/ui-dialog.js';
import './components/ui-tooltip.js';
import './components/ui-checkbox.js';
import './components/ui-radio.js';
import './components/ui-toggle.js';
import './components/ui-select.js';
import './components/ui-textarea.js';
import './components/ui-alert.js';
import './components/ui-progress.js';
import './components/ui-nav-item.js';
import './components/ui-side-panel.js';
import './components/ui-app-layout.js';

// Plugin runtime — re-exported for consumers
export { loadPlugin, createHostSDK } from './plugins/loader.js';
