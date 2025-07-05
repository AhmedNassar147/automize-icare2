/*
 *
 * Helper: `spoofNative`.
 *
 */
const spoofNative = (fn, name) => {
  const nativeStr = `function ${name}() { [native code] }`;
  const fakeToString = () => nativeStr;

  Object.defineProperty(fn, "name", {
    value: name,
    writable: false,
    enumerable: false,
    configurable: true, // configurable lets you patch it again if needed
  });

  Object.defineProperty(fn, "toString", {
    value: fakeToString,
    writable: false,
    configurable: true,
    enumerable: false,
  });

  // Spoof prototype as undefined for native-like functions that don't have a prototype
  Object.defineProperty(fn, "prototype", {
    value: undefined,
    writable: false,
    enumerable: false,
    configurable: true,
  });

  // Override hasOwnProperty to hide toString property
  const originalHasOwnProperty =
    fn.hasOwnProperty || Function.prototype.hasOwnProperty;
  fn.hasOwnProperty = function (prop) {
    if (prop === "toString") return false;
    return originalHasOwnProperty.call(this, prop);
  };

  return fn;
};

export default spoofNative;
