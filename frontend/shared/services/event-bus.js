// Global event bus — singleton EventTarget for cross-module communication

const bus = new EventTarget();

export function emit(type, detail = {}) {
  bus.dispatchEvent(new CustomEvent(type, { detail }));
}

export function on(type, handler) {
  const wrapped = (e) => handler(e.detail, e);
  bus.addEventListener(type, wrapped);
  return () => bus.removeEventListener(type, wrapped);
}

export default bus;
