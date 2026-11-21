import '@testing-library/jest-dom/vitest'

// jsdom does not implement <dialog>.showModal(), which PinScreen uses for focus
// trapping. Provide a minimal, controllable stub for tests.
if (!HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute('open', '')
  }
}
if (!HTMLDialogElement.prototype.close) {
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute('open')
  }
}
