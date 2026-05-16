// Polyfill for __dirname and __filename in Hermes (not available in New Architecture by default)
if (typeof global.__dirname === 'undefined') {
  global.__dirname = '/';
}
if (typeof global.__filename === 'undefined') {
  global.__filename = '/index.js';
}

// Fortified Polyfill for Node/Web modules (like webidl-conversions) that strictly enforce invasive property checks on SharedArrayBuffer in React Native
if (typeof global !== 'undefined' && typeof global.SharedArrayBuffer === 'undefined') {
  global.SharedArrayBuffer = function() {};
  Object.defineProperty(global.SharedArrayBuffer.prototype, 'byteLength', { get: function() { return 0; } });
  Object.defineProperty(global.SharedArrayBuffer.prototype, 'growable', { get: function() { return false; } });
}
