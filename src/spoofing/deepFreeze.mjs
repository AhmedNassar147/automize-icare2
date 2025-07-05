/*
 *
 *  helper: `deepFreeze`.
 *
 */
const deepFreeze = (obj) => {
  if (obj === null || typeof obj !== "object" || Object.isFrozen(obj)) return;

  Object.freeze(obj); // freeze this object

  Object.getOwnPropertyNames(obj).forEach((prop) => {
    const value = obj[prop];
    if (
      typeof value === "object" &&
      value !== null &&
      !Object.isFrozen(value)
    ) {
      deepFreeze(value); // recursively freeze nested objects
    }
  });
};

export default deepFreeze;
