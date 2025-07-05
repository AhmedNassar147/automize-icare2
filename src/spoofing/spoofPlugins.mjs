// === spoofPlugins ONLY (Final Realistic Version Matching Real Browser Behavior) ===

import spoofNative from "./spoofNative.mjs";

const PluginPrototype = {};
const MimeTypePrototype = {};

Object.defineProperty(PluginPrototype, Symbol.toStringTag, {
  value: "Plugin",
  writable: false,
  configurable: true,
});

Object.defineProperty(MimeTypePrototype, Symbol.toStringTag, {
  value: "MimeType",
  writable: false,
  configurable: true,
});

const spoofPlugins = (plugins) => {
  const mimeTypeInstances = [];
  const mimeTypeMap = new Map();

  const pluginInstances = plugins.map((plugin) => {
    const pluginObj = {
      name: plugin.name,
      filename: plugin.filename,
      description: plugin.description,
      length: plugin.mimeTypes.length,
      item: spoofNative(function item(i) {
        if (!this || this.mimeTypes === undefined) {
          throw new TypeError("Illegal invocation");
        }
        return this.mimeTypes[i];
      }, "item"),
      namedItem: spoofNative(function namedItem(name) {
        if (!this || this.mimeTypes === undefined) {
          throw new TypeError("Illegal invocation");
        }
        return this.mimeTypes.find((m) => m.type === name);
      }, "namedItem"),
    };

    plugin.mimeTypes.forEach((m) => {
      if (!mimeTypeMap.has(m.type)) {
        const mime = {
          type: m.type,
          description: m.description,
          suffixes: m.suffixes,
        };
        Object.defineProperty(mime, "enabledPlugin", {
          get: () => pluginObj,
        });
        Object.setPrototypeOf(mime, MimeTypePrototype);
        mimeTypeMap.set(m.type, mime);
        mimeTypeInstances.push(mime);
      }
    });

    Object.setPrototypeOf(pluginObj, PluginPrototype);
    return pluginObj;
  });

  const pluginArray = new Proxy(pluginInstances, {
    get(target, prop) {
      if (prop === "length") return target.length;
      if (prop === "item")
        return spoofNative(function item(i) {
          if (this !== pluginArray) throw new TypeError("Illegal invocation");
          return target[i];
        }, "item");
      if (prop === "namedItem")
        return spoofNative(function namedItem(name) {
          if (this !== pluginArray) throw new TypeError("Illegal invocation");
          return target.find((p) => p.name === name);
        }, "namedItem");
      if (prop === "refresh")
        return spoofNative(function refresh() {
          if (this !== pluginArray) throw new TypeError("Illegal invocation");
        }, "refresh");
      if (prop === Symbol.iterator)
        return function* () {
          for (let i = 0; i < target.length; i++) yield target[i];
        };
      if (!isNaN(prop)) return target[prop];
      return target[prop];
    },
    ownKeys: () =>
      [...Array(pluginInstances.length).keys()]
        .map(String)
        .concat(pluginInstances.map((p) => p.name)),
    getOwnPropertyDescriptor: (_, prop) => {
      if (
        !isNaN(prop) ||
        ["length", "item", "namedItem", "refresh"].includes(prop)
      ) {
        return { enumerable: true, configurable: true };
      }
    },
  });
  Object.defineProperty(pluginArray, Symbol.toStringTag, {
    value: "PluginArray",
  });

  pluginArray.forEach = Array.prototype.forEach.bind(pluginInstances);

  const mimeTypeArray = new Proxy(mimeTypeInstances, {
    get(target, prop) {
      if (prop === "length") return target.length;
      if (prop === "item")
        return spoofNative(function item(i) {
          if (this !== mimeTypeArray) throw new TypeError("Illegal invocation");
          return target[i];
        }, "item");
      if (prop === "namedItem")
        return spoofNative(function namedItem(name) {
          if (this !== mimeTypeArray) throw new TypeError("Illegal invocation");
          return target.find((m) => m.type === name);
        }, "namedItem");
      if (prop === Symbol.iterator)
        return function* () {
          for (let i = 0; i < target.length; i++) yield target[i];
        };
      if (!isNaN(prop)) return target[prop];
      return target[prop];
    },
    ownKeys: () =>
      [...Array(mimeTypeInstances.length).keys()]
        .map(String)
        .concat(mimeTypeInstances.map((m) => m.type)),
    getOwnPropertyDescriptor: (_, prop) => {
      if (!isNaN(prop) || ["length", "item", "namedItem"].includes(prop)) {
        return { enumerable: true, configurable: true };
      }
    },
  });
  Object.defineProperty(mimeTypeArray, Symbol.toStringTag, {
    value: "MimeTypeArray",
  });

  mimeTypeArray.forEach = Array.prototype.forEach.bind(mimeTypeInstances);

  Object.defineProperty(navigator, "plugins", {
    get: () => pluginArray,
    configurable: true,
  });

  Object.defineProperty(navigator, "mimeTypes", {
    get: () => mimeTypeArray,
    configurable: true,
  });
};

export default spoofPlugins;
