/*
 *
 * Helper: `spoofCanvas`.
 *
 */
import spoofNative from "./spoofNative.mjs";

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash >>> 0;
}

function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t ^ (t >>> 14));
    return (t >>> 0) / 4294967296;
  };
}

function getCanvasSeed(canvas) {
  const w = canvas.width || 300;
  const h = canvas.height || 150;
  const ctx = canvas.getContext("2d");
  const font = ctx?.font || "";
  return hashString(`${w}x${h}:${font}`);
}

function applyGamma(x) {
  return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
}

function removeGamma(x) {
  return x <= 0.0031308 ? x * 12.92 : 1.055 * Math.pow(x, 1 / 2.4) - 0.055;
}

function getNoiseIntensity(area) {
  if (area < 10000) return 0.003;
  if (area < 50000) return 0.005;
  return 0.007;
}

function addGammaNoise(imageData, width, height, seed) {
  const area = width * height;
  const noiseLevel = getNoiseIntensity(area);
  const data = imageData.data;
  const rand = mulberry32(seed);
  for (let i = 0; i < data.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      let val = data[i + c] / 255;
      val = removeGamma(val);
      val += (rand() < 0.5 ? -1 : 1) * noiseLevel;
      val = applyGamma(val);
      data[i + c] = Math.max(0, Math.min(255, val * 255));
    }
    data[i + 3] = Math.max(
      0,
      Math.min(255, data[i + 3] + (rand() < 0.5 ? -1 : 1))
    );
  }
}

function generateDynamicStateProps(seed) {
  const rand = mulberry32(seed);
  const fontSize = 13 + rand() * 2;
  return {
    fillStyle: `rgba(${Math.floor(rand() * 255)},${Math.floor(
      rand() * 255
    )},${Math.floor(rand() * 255)},${(0.5 + rand() * 0.5).toFixed(2)})`,
    font: `${fontSize}px Arial`,
    shadowBlur: Math.floor(rand() * 6),
    shadowColor: `rgba(0,0,0,${(0.2 + rand() * 0.5).toFixed(2)})`,
    lineWidth: 1,
    globalAlpha: 1,
    __fontSize: fontSize,
  };
}

function estimateOperationDelay(width, height, fontSize = 14) {
  const area = width * height;
  const sizeFactor = area / 45000;
  const fontFactor = fontSize / 14;
  return {
    toDataURLDuration: +(3.2 + sizeFactor * fontFactor * 1.4).toFixed(2),
    toBlobDuration: +(3.5 + sizeFactor * fontFactor * 1.6).toFixed(2),
  };
}

function spoofCanvasPrototype(proto, ctxNativeMethods) {
  const origGetContext = proto.getContext;
  proto.getContext = spoofNative(function (type, ...args) {
    const ctx = origGetContext.call(this, type, ...args);
    if (type === "2d" && ctx) {
      const seed = getCanvasSeed(this);
      const props = generateDynamicStateProps(seed);

      for (const method in ctxNativeMethods) {
        if (method in ctx && ctxNativeMethods[method].spoof) {
          const nativeImpl = CanvasRenderingContext2D.prototype[method];
          const spoofed = spoofNative(function (...a) {
            const result = nativeImpl.apply(this, a);
            if (method === "getImageData") {
              const { width, height } = this.canvas;
              if (width > 0 && height > 0) {
                addGammaNoise(result, width, height, seed);
              }
            }
            return result;
          }, method);
          ctx[method] = spoofed.bind(ctx);
        }
      }

      Object.entries(props).forEach(([k, v]) => {
        if (k === "__fontSize") return;
        try {
          Object.defineProperty(ctx, k, {
            value: v,
            writable: true,
            configurable: true,
          });
        } catch {}
      });

      Object.defineProperty(ctx, "__fontSize", {
        value: props.__fontSize,
        writable: false,
        configurable: false,
      });

      Object.defineProperty(CanvasRenderingContext2D.prototype, "isContext2D", {
        value: true,
        writable: false,
        configurable: false,
      });
    }
    return ctx;
  }, "getContext");

  if (typeof proto.toDataURL === "function") {
    const orig = proto.toDataURL;
    proto.toDataURL = spoofNative(function (...args) {
      const start = performance.now();
      const result = orig.apply(this, args);
      const duration = performance.now() - start;
      const fontSize = this.getContext?.("2d")?.__fontSize || 14;
      const { toDataURLDuration } = estimateOperationDelay(
        this.width,
        this.height,
        fontSize
      );
      const delay = toDataURLDuration - duration;
      if (delay > 0)
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, delay);
      return result;
    }, "toDataURL");
  }

  if (typeof proto.toBlob === "function") {
    const orig = proto.toBlob;
    proto.toBlob = spoofNative(function (callback, ...args) {
      const start = performance.now();
      orig.call(
        this,
        (blob) => {
          const duration = performance.now() - start;
          const fontSize = this.getContext?.("2d")?.__fontSize || 14;
          const { toBlobDuration } = estimateOperationDelay(
            this.width,
            this.height,
            fontSize
          );
          const delay = toBlobDuration - duration;
          if (delay > 0) setTimeout(() => callback(blob), delay);
          else callback(blob);
        },
        ...args
      );
    }, "toBlob");
  }
}

const spoofCanvas = (canvasFP) => {
  const { ctxNativeMethods = {}, canvasClassName, ctxClassName } = canvasFP;

  spoofCanvasPrototype(HTMLCanvasElement.prototype, ctxNativeMethods);
  if (typeof OffscreenCanvas !== "undefined") {
    spoofCanvasPrototype(OffscreenCanvas.prototype, ctxNativeMethods);
  }

  HTMLCanvasElement.prototype.toString = function () {
    return "[object HTMLCanvasElement]";
  };

  if (canvasClassName) {
    Object.defineProperty(HTMLCanvasElement.prototype.constructor, "name", {
      value: canvasClassName,
      configurable: true,
    });
  }
  if (ctxClassName) {
    Object.defineProperty(
      CanvasRenderingContext2D.prototype.constructor,
      "name",
      {
        value: ctxClassName,
        configurable: true,
      }
    );
  }
};

export default spoofCanvas;
