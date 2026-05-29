// Export modern native DOMException available globally in Node 18+ and browsers for both CJS and ESM interop
const NativeDOMException = globalThis.DOMException || class DOMException extends Error {
  constructor(message, name) {
    super(message);
    this.name = name || 'DOMException';
  }
};

class ExtensibleDOMException extends NativeDOMException {
  constructor(message, name) {
    super(message, name);
  }
}

ExtensibleDOMException.DOMException = ExtensibleDOMException;
ExtensibleDOMException.default = ExtensibleDOMException;

module.exports = ExtensibleDOMException;


