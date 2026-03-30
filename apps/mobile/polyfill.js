// Fortified Polyfill for Node/Web modules (like webidl-conversions) that strictly enforce invasive property checks on SharedArrayBuffer in React Native
if (typeof global !== 'undefined' && typeof global.SharedArrayBuffer === 'undefined') {
  global.SharedArrayBuffer = function() {};
  Object.defineProperty(global.SharedArrayBuffer.prototype, 'byteLength', { get: function() { return 0; } });
  Object.defineProperty(global.SharedArrayBuffer.prototype, 'growable', { get: function() { return false; } });
}
