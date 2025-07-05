/*
 *
 * Helper: `spoofGamepads`.
 *
 */
import spoofNative from "./spoofNative.mjs";
import createFunctionWithProxyForList from "./createFunctionWithProxyForList.mjs";
import deepFreeze from "./deepFreeze.mjs";

const defineFakeGamepadClass = () => {
  if (typeof window.Gamepad === "function") return;

  const FakeGamepad = function () {
    throw new TypeError("Illegal constructor");
  };

  Object.defineProperties(FakeGamepad.prototype, {
    connected: {
      get() {
        return true;
      },
      enumerable: true,
    },
    id: {
      get() {
        return "Fake Gamepad";
      },
      enumerable: true,
    },
    index: {
      get() {
        return 0;
      },
      enumerable: true,
    },
    mapping: {
      get() {
        return "standard";
      },
      enumerable: true,
    },
    timestamp: {
      get() {
        return Date.now();
      },
      enumerable: true,
    },
    axes: {
      get() {
        return [0, 0, 0, 0];
      },
      enumerable: true,
    },
    buttons: {
      get() {
        return [];
      },
      enumerable: true,
    },
    hapticActuators: {
      get() {
        return [];
      },
      enumerable: true,
    },
  });

  spoofNative(FakeGamepad, "Gamepad");
  spoofNative(FakeGamepad.prototype.constructor, "Gamepad");
  Object.defineProperty(window, "Gamepad", {
    value: FakeGamepad,
    writable: false,
    configurable: false,
    enumerable: false,
  });
};

const wrapAsGamepadInstance = (data, index) => {
  const proto = window.Gamepad?.prototype || Object.prototype;
  const gamepad = Object.create(proto);
  Object.assign(gamepad, data, { index });
  deepFreeze(gamepad);
  return gamepad;
};

/**
 * Patch the `navigator.getGamepads()` API to return a spoofed gamepad
 * array, with the option to pass in a custom gamepad object.
 *
 * If the first argument is an array of objects, each will be used to
 * create a fake gamepad object and returned as the result of the
 * `getGamepads()` call.
 *
 * If the first argument is not an array, or is an empty array, the
 * function will return an array of four fake gamepads.
 *
 * @param {Object[]} [gamepads] - An array of objects to create fake
 *   gamepad objects from.
 *
 * @returns {void} - This function does not return a value. It
 *   modifies the `navigator.getGamepads()` API in-place.
 */
const spoofGamepads = (gamepads = []) => {
  if (typeof navigator === "undefined") return;

  defineFakeGamepadClass();

  const frozenGamepads = Array.from({ length: 4 }, (_, i) => {
    const gp = gamepads[i] ?? null;
    if (gp && typeof gp === "object") {
      return wrapAsGamepadInstance(gp, i);
    }
    return null;
  });

  const spoofedGamepads = Object.freeze(frozenGamepads);

  const nativeGetGamepads = spoofNative(function getGamepads() {},
  "getGamepads");

  const getGamepads = createFunctionWithProxyForList({
    spoofedFunction: nativeGetGamepads,
    name: "getGamepads",
    handlerExtra: {
      apply(target, thisArg, argumentsList) {
        return spoofedGamepads;
      },
    },
  });

  try {
    Object.defineProperty(Object.getPrototypeOf(navigator), "getGamepads", {
      value: getGamepads,
      writable: false,
      configurable: true,
      enumerable: false,
    });
  } catch (e) {
    console.warn("Unable to define navigator.getGamepads", e);
  }

  spoofedGamepads.forEach((gp) => {
    if (!gp) return;

    const randomDelay = 100 + Math.floor(Math.random() * 100); // 100–200ms

    setTimeout(() => {
      const connectEvent = new Event("gamepadconnected", {
        bubbles: true,
        cancelable: false,
      });
      Object.defineProperty(connectEvent, "gamepad", {
        value: gp,
        enumerable: true,
      });
      window.dispatchEvent(connectEvent);
    }, randomDelay);
  });

  Object.freeze(getGamepads);
  Object.freeze(spoofedGamepads);
};

export default spoofGamepads;
