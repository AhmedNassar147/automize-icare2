/*
 *
 * Helper: `spoofUsbDevices`.
 *
 */
import spoofNative from "./spoofNative.mjs";
import createFunctionWithProxyForList from "./createFunctionWithProxyForList.mjs";

/**
 * Spoof the USB API by creating a fake `navigator.usb` object and
 * `USBDevice` class.
 *
 * @param {Array<USBDeviceOptions>} usbDevices - List of USB devices to
 *   emulate.
 * @returns {void}
 */
const spoofUSB = (usbDevices = []) => {
  if (typeof navigator === "undefined") return;

  const deviceState = new WeakMap();

  // Internal symbol to mimic browser internal slot for USBDevice
  const USB_DEVICE_INTERNAL_SLOT = Symbol("[[USBDeviceInternals]]");

  class USBDevice {
    constructor(info) {
      this.productId = info.productId ?? 0;
      this.vendorId = info.vendorId ?? 0;
      this.manufacturerName = info.manufacturerName ?? "Unknown Manufacturer";
      this.productName = info.productName ?? "Unknown Device";
      this.serialNumber = info.serialNumber ?? "000000000";
      deviceState.set(this, { opened: false });

      // Mimic internal slot, non-enumerable and frozen
      Object.defineProperty(this, USB_DEVICE_INTERNAL_SLOT, {
        value: {
          internalStateFlag: true,
          createdAt: Date.now(),
        },
        writable: false,
        enumerable: false,
        configurable: false,
      });

      Object.defineProperty(this, Symbol.toStringTag, {
        value: "USBDevice",
        configurable: true,
      });

      Object.freeze(this);
    }

    open() {
      deviceState.get(this).opened = true;
      return Promise.resolve();
    }

    close() {
      deviceState.get(this).opened = false;
      return Promise.resolve();
    }

    forget() {
      return Promise.resolve();
    }

    get opened() {
      return deviceState.get(this).opened;
    }
  }

  ["open", "close", "forget"].forEach((method) => {
    USBDevice.prototype[method] = spoofNative(
      USBDevice.prototype[method],
      method
    );
  });

  spoofNative(USBDevice, "USBDevice");

  const deviceList = usbDevices.map((info) => new USBDevice(info));

  // Internal symbol to mimic internal slot for USB object
  const USB_INTERNAL_SLOT = Symbol("[[USBInternal]]");

  const nativeGetDevices = spoofNative(
    () => Promise.resolve([...deviceList]),
    "getDevices"
  );

  const nativeRequestDevice = spoofNative((options = {}) => {
    const hasAcceptAll = options.acceptAllDevices === true;
    const hasValidFilters =
      Array.isArray(options.filters) && options.filters.length > 0;

    if (!hasAcceptAll && !hasValidFilters) {
      return Promise.reject(
        new TypeError(
          "Failed to execute 'requestDevice' on 'USB': Failed to read the 'filters' property from 'USBDeviceRequestOptions': Required member is undefined"
        )
      );
    }

    let matches = [];
    if (hasAcceptAll) {
      matches = deviceList;
    } else {
      matches = deviceList.filter((device) =>
        options.filters.some(
          (filter) =>
            (!filter.vendorId || filter.vendorId === device.vendorId) &&
            (!filter.productId || filter.productId === device.productId)
        )
      );
    }

    if (matches.length === 0) {
      return Promise.reject(
        new DOMException("No devices found", "NotFoundError")
      );
    }

    return Promise.resolve(matches[0]);
  }, "requestDevice");

  const getDevices = createFunctionWithProxyForList({
    name: "getDevices",
    spoofedFunction: nativeGetDevices,
  });

  const requestDevice = createFunctionWithProxyForList({
    name: "requestDevice",
    spoofedFunction: nativeRequestDevice,
  });

  let _onconnect = null;
  let _ondisconnect = null;

  // Event listeners support with options
  const _eventListeners = { connect: [], disconnect: [] };

  const rawUSB = Object.create(null);

  Object.defineProperties(rawUSB, {
    getDevices: { value: getDevices, writable: false, enumerable: true },
    requestDevice: { value: requestDevice, writable: false, enumerable: true },
    addEventListener: {
      value: (type, handler, options) => {
        if (!_eventListeners[type]) return;
        if (typeof handler !== "function") return;

        // Support { once } option
        if (options && options.once) {
          const onceWrapper = (event) => {
            handler(event);
            rawUSB.removeEventListener(type, onceWrapper);
          };
          _eventListeners[type].push(onceWrapper);
        } else {
          _eventListeners[type].push(handler);
        }
      },
      writable: false,
      enumerable: true,
    },

    removeEventListener: {
      value: (type, handler) => {
        if (!_eventListeners[type]) return;
        const idx = _eventListeners[type].indexOf(handler);
        if (idx >= 0) _eventListeners[type].splice(idx, 1);
      },
      writable: false,
      enumerable: true,
    },

    onconnect: {
      get: () => _onconnect,
      set: (v) => {
        _onconnect = typeof v === "function" ? v : null;
      },
      enumerable: true,
    },

    ondisconnect: {
      get: () => _ondisconnect,
      set: (v) => {
        _ondisconnect = typeof v === "function" ? v : null;
      },
      enumerable: true,
    },

    [Symbol.toStringTag]: { value: "USB", configurable: true },

    // Internal symbol to mimic browser internal slot on USB object
    [USB_INTERNAL_SLOT]: {
      value: {
        devicesCount: deviceList.length,
        internalFlag: true,
      },
      writable: false,
      enumerable: false,
      configurable: false,
    },
  });

  const USB = function USB() {};
  spoofNative(USB, "USB");

  Object.setPrototypeOf(rawUSB, USB.prototype);

  const usb = new Proxy(rawUSB, {
    get(target, prop, receiver) {
      if (prop === "constructor") return USB;
      return Reflect.get(target, prop, receiver);
    },
    getOwnPropertyDescriptor(target, prop) {
      return Reflect.getOwnPropertyDescriptor(target, prop);
    },
    has(target, prop) {
      return Reflect.has(target, prop);
    },
  });

  Object.defineProperty(Object.getPrototypeOf(navigator), "usb", {
    get: () => usb,
    configurable: true,
    enumerable: false,
  });

  // Dispatch USB connect/disconnect events on navigator.usb only
  if (deviceList.length > 0) {
    setTimeout(() => {
      const connectEvent = new Event("connect", {
        bubbles: false,
        cancelable: false,
      });
      connectEvent.device = deviceList[0];
      if (typeof usb.onconnect === "function") {
        usb.onconnect(connectEvent);
      }
      _eventListeners.connect.slice().forEach((cb) => {
        try {
          cb(connectEvent);
        } catch (e) {}
      });
    }, 100);

    setTimeout(() => {
      const disconnectEvent = new Event("disconnect", {
        bubbles: false,
        cancelable: false,
      });
      disconnectEvent.device = deviceList[0];
      if (typeof usb.ondisconnect === "function") {
        usb.ondisconnect(disconnectEvent);
      }
      _eventListeners.disconnect.slice().forEach((cb) => {
        try {
          cb(disconnectEvent);
        } catch (e) {}
      });
    }, 6000);
  }

  Object.freeze(usb);
};

export default spoofUSB;
