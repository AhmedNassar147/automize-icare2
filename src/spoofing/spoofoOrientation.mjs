/*
 *
 * Helper: `spoofoOrientation`.
 *
 */
import spoofNative from "./spoofNative.mjs";

const spoofoOrientation = () => {
  const orientationState = {
    angle: 0,
    type: "landscape-primary",
    _onchange: null,
  };

  if (typeof window.ScreenOrientation !== "function") {
    function ScreenOrientation() {
      throw new TypeError("Illegal constructor");
    }

    Object.defineProperty(ScreenOrientation.prototype, Symbol.toStringTag, {
      value: "ScreenOrientation",
    });

    Object.defineProperty(window, "ScreenOrientation", {
      value: ScreenOrientation,
      configurable: true,
      writable: true,
    });
  }

  if (!("orientation" in screen)) {
    const fakeOrientation = {
      get angle() {
        return orientationState.angle;
      },
      get type() {
        return orientationState.type;
      },
    };

    // ✅ Conditionally define `onchange`
    if (orientationInfo.onchangeExists) {
      Object.defineProperty(fakeOrientation, "onchange", {
        get() {
          return orientationState._onchange;
        },
        set(fn) {
          orientationState._onchange = typeof fn === "function" ? fn : null;
        },
        configurable: true,
        enumerable: true,
      });

      spoofNative(fakeOrientation.onchange, "onchange");
    }

    // ✅ Conditionally define `lock`
    if (orientationInfo.lockExists) {
      Object.defineProperty(fakeOrientation, "lock", {
        value() {
          return Promise.resolve();
        },
        configurable: true,
        enumerable: true,
      });

      spoofNative(fakeOrientation.unlock, "lock");
    }

    // ✅ Conditionally define `unlock`
    if (orientationInfo.unlockExists) {
      Object.defineProperty(fakeOrientation, "unlock", {
        value() {},
        writable: true,
        configurable: true,
        enumerable: true,
      });

      spoofNative(fakeOrientation.unlock, "unlock");
    }

    // Optional: Event listeners
    fakeOrientation.addEventListener = function (type, handler) {
      if (type === "change" && typeof handler === "function") {
        orientationState._onchange = handler;
      }
    };
    fakeOrientation.removeEventListener = function (type, handler) {
      if (type === "change" && orientationState._onchange === handler) {
        orientationState._onchange = null;
      }
    };

    spoofNative(fakeOrientation.addEventListener, "addEventListener");
    spoofNative(fakeOrientation.removeEventListener, "removeEventListener");

    Object.defineProperty(screen, "orientation", {
      get: () => fakeOrientation,
      configurable: true,
      enumerable: true,
    });
  }
};

export default spoofoOrientation;
