// Jest setup file
// Add TextEncoder/TextDecoder polyfills for jsdom
if (typeof globalThis.TextEncoder === 'undefined') {
  const { TextEncoder, TextDecoder } = require('util');
  globalThis.TextEncoder = TextEncoder;
  globalThis.TextDecoder = TextDecoder;
}

require('@testing-library/jest-dom');
