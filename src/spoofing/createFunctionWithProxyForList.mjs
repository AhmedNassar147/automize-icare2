/*
 *
 * Helper: `createFunctionWithProxyForList`.
 *
 */
const createFunctionWithProxyForList = ({
  spoofedFunction,
  name,
  handlerExtra,
}) => {
  const handler = {
    ...(handlerExtra || {}),
    get(target, prop, receiver) {
      switch (prop) {
        case Symbol.toStringTag:
          return "Function";
        case "name":
          return name;
        case "length":
          return 0;
        case "prototype":
          return undefined;
        case "toString":
          return spoofedFunction.toString.bind(spoofedFunction);
        case "caller":
        case "arguments":
          throw new TypeError(`'${prop}' is not accessible in strict mode`);
        default:
          return Reflect.get(target, prop, receiver);
      }
    },
    has(target, prop) {
      return (
        [
          "toString",
          "name",
          "length",
          "prototype",
          Symbol.toStringTag,
          prop === "prototype",
        ].includes(prop) || Reflect.has(target, prop)
      );
    },
    getPrototypeOf() {
      return Function.prototype;
    },
    getOwnPropertyDescriptor(target, prop) {
      if (prop === Symbol.toStringTag) {
        return {
          value: "Function",
          configurable: true,
          enumerable: false,
          writable: false,
        };
      }
      if (prop === "length") {
        return {
          value: 0,
          configurable: true,
          enumerable: false,
          writable: false,
        };
      }
      if (prop === "name") {
        return {
          value: name,
          configurable: true,
          enumerable: false,
          writable: false,
        };
      }
      if (prop === "toString") {
        return {
          value: spoofedFunction.toString.bind(spoofedFunction),
          configurable: true,
          enumerable: false,
          writable: false,
        };
      }
      if (prop === "prototype") {
        return {
          value: undefined,
          configurable: true,
          enumerable: false,
          writable: false,
        };
      }
      return Reflect.getOwnPropertyDescriptor(target, prop);
    },
  };

  const functionWithProxy = new Proxy(spoofedFunction, handler);

  spoofNative(spoofedFunction.constructor, "Function");

  return functionWithProxy;
};

export default createFunctionWithProxyForList;
