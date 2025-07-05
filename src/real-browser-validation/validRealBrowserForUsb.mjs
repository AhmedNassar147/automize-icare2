async function validRealBrowserForUsb() {
  const results = [];

  const check = (desc, fn) => {
    try {
      const val = fn();
      results.push({ desc, pass: true, value: val });
    } catch (err) {
      results.push({ desc, pass: false, value: err.toString() });
    }
  };

  const asyncCheck = async (desc, fn) => {
    try {
      const val = await fn();
      results.push({ desc, pass: true, value: val });
    } catch (err) {
      results.push({ desc, pass: false, value: err.toString() });
    }
  };

  const has = Object.prototype.hasOwnProperty;

  // Top-level USB object
  check(
    "navigator.hasOwnProperty('usb') === false",
    () => !has.call(navigator, "usb")
  );
  check(
    "typeof navigator.usb === 'object'",
    () => typeof navigator.usb === "object"
  );
  check("navigator.usb !== null", () => navigator.usb !== null);
  check(
    "Object.prototype.toString.call(navigator.usb) === '[object USB]'",
    () => Object.prototype.toString.call(navigator.usb) === "[object USB]"
  );
  check(
    "Symbol.toStringTag in Object.getPrototypeOf(navigator.usb)",
    () => Symbol.toStringTag in Object.getPrototypeOf(navigator.usb)
  );
  check(
    "navigator.usb.constructor.name === 'USB'",
    () => navigator.usb.constructor.name === "USB"
  );

  // USB Methods: getDevices
  check(
    "typeof navigator.usb.getDevices === 'function'",
    () => typeof navigator.usb.getDevices === "function"
  );
  check(
    "navigator.usb.getDevices.name === 'getDevices'",
    () => navigator.usb.getDevices.name === "getDevices"
  );
  check(
    "navigator.usb.getDevices.length === 0",
    () => navigator.usb.getDevices.length === 0
  );
  check(
    "navigator.usb.getDevices instanceof Function",
    () => navigator.usb.getDevices instanceof Function
  );
  check(
    "navigator.usb.getDevices.constructor === Function",
    () => navigator.usb.getDevices.constructor === Function
  );
  check(
    "navigator.usb.getDevices.prototype === undefined",
    () => navigator.usb.getDevices.prototype === undefined
  );
  check("navigator.usb.getDevices.toString().includes('[native code]')", () =>
    navigator.usb.getDevices.toString().includes("[native code]")
  );
  check(
    "!navigator.usb.getDevices.hasOwnProperty('toString')",
    () => !has.call(navigator.usb.getDevices, "toString")
  );
  check(
    "Object.getPrototypeOf(navigator.usb.getDevices) === Function.prototype",
    () => Object.getPrototypeOf(navigator.usb.getDevices) === Function.prototype
  );
  check(
    "Object.getOwnPropertyNames(navigator.usb.getDevices).length <= 3",
    () => Object.getOwnPropertyNames(navigator.usb.getDevices).length <= 3
  );
  check(
    "Object.keys(navigator.usb.getDevices).length === 0",
    () => Object.keys(navigator.usb.getDevices).length === 0
  );

  // USB Methods: requestDevice
  check(
    "typeof navigator.usb.requestDevice === 'function'",
    () => typeof navigator.usb.requestDevice === "function"
  );
  check(
    "navigator.usb.requestDevice.name === 'requestDevice'",
    () => navigator.usb.requestDevice.name === "requestDevice"
  );
  check(
    "navigator.usb.requestDevice.length === 1",
    () => navigator.usb.requestDevice.length === 1
  );
  check(
    "navigator.usb.requestDevice.toString().includes('[native code]')",
    () => navigator.usb.requestDevice.toString().includes("[native code]")
  );

  // Event properties
  check(
    "navigator.usb.onconnect === null",
    () => navigator.usb.onconnect === null
  );
  check(
    "navigator.usb.ondisconnect === null",
    () => navigator.usb.ondisconnect === null
  );

  // Prototype check for navigator.usb
  check(
    "typeof Object.getPrototypeOf(navigator.usb) === 'object'",
    () => typeof Object.getPrototypeOf(navigator.usb) === "object"
  );

  // Symbol check
  check(
    "Object.prototype.toString.call(navigator.usb) === '[object USB]'",
    () => Object.prototype.toString.call(navigator.usb) === "[object USB]"
  );

  // get property descriptor
  check(
    "Object.getOwnPropertyDescriptor(Object.getPrototypeOf(navigator), 'usb')?.get instanceof Function",
    () =>
      Object.getOwnPropertyDescriptor(Object.getPrototypeOf(navigator), "usb")
        ?.get instanceof Function
  );

  // Illegal traps
  check("accessing navigator.usb.getDevices.caller throws", () => {
    try {
      // eslint-disable-next-line no-unused-expressions
      navigator.usb.getDevices.caller;
    } catch (e) {
      return /TypeError/.test(e.toString());
    }
    return false;
  });

  check("accessing navigator.usb.getDevices.arguments throws", () => {
    try {
      // eslint-disable-next-line no-unused-expressions
      navigator.usb.getDevices.arguments;
    } catch (e) {
      return /TypeError/.test(e.toString());
    }
    return false;
  });

  // Async checks
  await asyncCheck(
    "navigator.usb.getDevices() returns Promise",
    async () => navigator.usb.getDevices() instanceof Promise
  );

  await asyncCheck(
    "(await navigator.usb.getDevices()).length is number",
    async () => {
      const devices = await navigator.usb.getDevices();
      return typeof devices.length === "number";
    }
  );

  // Print results
  console.log("🔍 USB Spoof Validity Check Results:", results);

  return results;
}
export default validRealBrowserForUsb;
