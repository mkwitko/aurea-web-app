import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
});

// jsdom não implementa a API de Pointer Capture nem scrollIntoView, que os
// componentes do Radix (Select, HoverCard) chamam ao abrir. Sem estes stubs o
// teste falha com "hasPointerCapture is not a function".
Element.prototype.hasPointerCapture = vi.fn();
Element.prototype.releasePointerCapture = vi.fn();
Element.prototype.setPointerCapture = vi.fn();
Element.prototype.scrollIntoView = vi.fn();

globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
