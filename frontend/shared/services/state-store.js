// Minimal reactive state primitives for per-module state
// Each module creates its own store instance

export function createStore(initialState = {}) {
  let state = { ...initialState };
  const listeners = new Set();

  return {
    getState() {
      return state;
    },

    setState(updater) {
      const newState = typeof updater === 'function' ? updater(state) : updater;
      state = { ...state, ...newState };
      listeners.forEach(fn => fn(state));
    },

    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}
