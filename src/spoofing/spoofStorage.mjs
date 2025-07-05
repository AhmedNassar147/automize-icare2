/*
 *
 * helper: `spoofStorage`.
 *
 */
import spoofNative from "./spoofNative.mjs";
import deepFreeze from "./deepFreeze.mjs";

/**
 * @function spoofStorage
 * @description Spoofs the StorageManager object
 * @param {Object} [storage] - An object containing the following properties:
 *   - `persisted`: A boolean indicating whether the storage is persisted
 *   - `quota`: The quota for the storage in bytes
 *   - `supportsPersistence`: A boolean indicating whether the storage supports persistence
 *   - `supportsEstimate`: A boolean indicating whether the storage supports estimating storage usage
 *   - `supportsGetDirectory`: A boolean indicating whether the storage supports getting a directory
 * @returns {void}
 */
const spoofStorage = (storage = {}) => {
  const {
    persisted,
    quota,
    supportsEstimate,
    supportsGetDirectory,
    supportsPersistence,
  } = {
    supportsPersistence: storage?.supportsPersistence,
    supportsEstimate: storage?.supportsEstimate,
    supportsGetDirectory: storage?.supportsGetDirectory,
    persisted: storage?.persisted ?? false, // default to false if not provided
    quota: storage?.quota ?? 500 * 1024 * 1024, // 500MB default quota
  };

  if (typeof navigator === "undefined") return;

  // Compose usageDetails with some randomness for realism
  const usageDetails = {
    indexedDB: Math.floor(
      100 * 1024 * 1024 + Math.random() * 100 * 1024 * 1024
    ), // 100MB–200MB
    caches: Math.floor(50 * 1024 * 1024 + Math.random() * 50 * 1024 * 1024), // 50MB–100MB
    serviceWorkerRegistrations: Math.floor(Math.random() * 1024 * 1024), // 0–1MB
  };

  const totalUsage = Object.values(usageDetails).reduce(
    (acc, v) => acc + (v || 0),
    0
  );

  // Storage state object (freeze to prevent tampering)
  const storageState = Object.freeze({
    persisted,
    quota,
    supportsPersistence,
    supportsEstimate,
    supportsGetDirectory,
    usage: totalUsage,
    usageDetails,
  });

  // Base object holding the spoofed StorageManager methods
  const storageImpl = {};

  if (storageState.supportsPersistence) {
    Object.defineProperty(storageImpl, "persisted", {
      value: spoofNative(
        () => Promise.resolve(storageState.persisted),
        "persisted"
      ),
      enumerable: false,
      writable: false,
      configurable: false,
    });

    Object.defineProperty(storageImpl, "persist", {
      value: spoofNative(
        () => Promise.resolve(storageState.persisted),
        "persist"
      ),
      enumerable: false,
      writable: false,
      configurable: false,
    });
  }

  if (storageState.supportsEstimate) {
    Object.defineProperty(storageImpl, "estimate", {
      value: spoofNative(
        () =>
          Promise.resolve({
            quota: storageState.quota,
            usage: storageState.usage,
            usageDetails: storageState.usageDetails,
          }),
        "estimate"
      ),
      enumerable: false,
      writable: false,
      configurable: false,
    });
  }

  if (storageState.supportsGetDirectory) {
    Object.defineProperty(storageImpl, "getDirectory", {
      value: spoofNative(
        () => Promise.resolve({ kind: "directory", name: "" }),
        "getDirectory"
      ),
      enumerable: false,
      writable: false,
      configurable: false,
    });
  }

  // Freeze the implementation object deeply
  deepFreeze(storageImpl);

  // Fake StorageManager prototype for realism
  const StorageManagerProto = {};
  Object.defineProperty(StorageManagerProto, Symbol.toStringTag, {
    value: "StorageManager",
    configurable: true,
  });
  deepFreeze(StorageManagerProto);

  // Fake constructor spoofed as native function
  const StorageManagerCtor = spoofNative(function StorageManager() {},
  "StorageManager");
  Object.defineProperty(StorageManagerCtor, "prototype", {
    value: StorageManagerProto,
    writable: false,
    configurable: false,
    enumerable: false,
  });

  // Proxy to mimic native StorageManager behavior
  const storageProxy = new Proxy(storageImpl, {
    get(target, prop, receiver) {
      if (prop === Symbol.toStringTag) return "StorageManager";
      if (prop === "toString")
        return StorageManagerCtor.toString.bind(StorageManagerCtor);
      if (Object.prototype.hasOwnProperty.call(target, prop)) {
        return Reflect.get(target, prop, receiver);
      }
      return undefined;
    },
    has(target, prop) {
      return Object.prototype.hasOwnProperty.call(target, prop);
    },
    ownKeys(target) {
      return Reflect.ownKeys(target);
    },
    getPrototypeOf() {
      return StorageManagerProto;
    },
    getOwnPropertyDescriptor(target, prop) {
      if (prop === Symbol.toStringTag) {
        return {
          value: "StorageManager",
          writable: false,
          enumerable: false,
          configurable: true,
        };
      }
      if (prop === "toString") {
        return {
          value: StorageManagerCtor.toString.bind(StorageManagerCtor),
          writable: false,
          enumerable: false,
          configurable: true,
        };
      }
      return Reflect.getOwnPropertyDescriptor(target, prop) || undefined;
    },
  });

  Object.defineProperty(storageProxy, "constructor", {
    value: StorageManagerCtor,
    writable: false,
    enumerable: false,
    configurable: true,
  });

  // Patch navigator.storage property with our proxy
  Object.defineProperty(navigator, "storage", {
    get: () => storageProxy,
    configurable: true, // allow overriding in dev tools
    enumerable: false,
  });

  if (!Object.isFrozen(storageProxy)) {
    Object.freeze(storageProxy);
  }
};

export default spoofStorage;
