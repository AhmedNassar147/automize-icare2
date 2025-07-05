/*
 *
 * Helper: `spoofWebGL`.
 *
 */
import spoofNative from "./spoofNative.mjs";

const spoofWebGL = (webglFP) => {
  const {
    drawingBufferWidth = 300,
    drawingBufferHeight = 150,

    glVersion = "WebGL 1.0 (OpenGL ES 2.0 Chromium)",
    glShadingLanguageVersion = "WebGL GLSL ES 1.0 (OpenGL ES GLSL ES 1.0 Chromium)",

    maxTextureSize = 16384,
    glRenderBufferSize = 16384,

    glLineWidthRange = { 0: 1, 1: 1 },
    glPointSizeRange = { 0: 1, 1: 1024 },

    hasAnisotropicFiltering = true,
    hasFloatTextures = true,
    hasDrawBuffers = true,

    vendor = "Google Inc. (Intel)",
    renderer = "ANGLE (Intel, Intel(R) Iris(R) Xe Graphics (0x0000A7A0) Direct3D11 vs_5_0 ps_5_0, D3D11)",

    vertexFloatPrecision = {
      rangeMin: 127,
      rangeMax: 127,
      precision: 23,
    },
    fragmentFloatPrecision = {
      rangeMin: 127,
      rangeMax: 127,
      precision: 23,
    },
    getShaderPrecisionFormatSupported = true,

    extensions = [
      "ANGLE_instanced_arrays",
      "EXT_blend_minmax",
      "EXT_clip_control",
      "EXT_color_buffer_half_float",
      "EXT_depth_clamp",
      "EXT_disjoint_timer_query",
      "EXT_float_blend",
      "EXT_frag_depth",
      "EXT_polygon_offset_clamp",
      "EXT_shader_texture_lod",
      "EXT_texture_compression_bptc",
      "EXT_texture_compression_rgtc",
      "EXT_texture_filter_anisotropic",
      "EXT_texture_mirror_clamp_to_edge",
      "EXT_sRGB",
      "KHR_parallel_shader_compile",
      "OES_element_index_uint",
      "OES_fbo_render_mipmap",
      "OES_standard_derivatives",
      "OES_texture_float",
      "OES_texture_float_linear",
      "OES_vertex_array_object",
      "WEBGL_blend_func_extended",
      "WEBGL_color_buffer_float",
      "WEBGL_compressed_texture_s3tc",
      "WEBGL_debug_renderer_info",
      "WEBGL_debug_shaders",
      "WEBGL_depth_texture",
      "WEBGL_draw_buffers",
      "WEBGL_lose_context",
      "WEBGL_multi_draw",
    ],

    pixelRead = [128, 128, 128, 255],
    pixelReadSHA1 = "a2259bc05eb9feb2cdc8d3c95ba64e80e5b522d5",

    contextAttributes = {
      alpha: true,
      depth: true,
      stencil: false,
      antialias: true,
      premultipliedAlpha: true,
      preserveDrawingBuffer: false,
      failIfMajorPerformanceCaveat: false,
    },

    subPixelBits = 4,

    timeGetParameterVendor = 0,
    timeGetParameterRenderer = 0,
    timeGetParameterVersion = 0.10000000894069672,
    timeGetParameterShadingLang = 0.20000000298023224,

    pixelReadAfterTextureUpload = [128, 128, 128, 255],

    maxVertexUniformVectors = 4096,
    maxFragmentUniformVectors = 1024,
    maxVertexAttribs = 16,
    maxVaryingVectors = 30,

    sha1 = "62252ea1610f8886791ae5e26f7abe0f19428e5c",
    contextClass = "WebGLRenderingContext",

    glKHRDebugSupported = false,
    glDebugShaders = true,

    errorAfterBuffer = 0,

    // Newly added fields
    extensionCount = 35,
    extensionCountSHA1 = "error",
    contextType = "webgl",
    contextIsNative = true,
  } = webglFP;

  // Async sleep instead of sync delay
  const sleepAsync = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // Measure execution time helper
  const measureExecution = async (fn, ...args) => {
    const t0 = performance.now();
    const result = await fn.apply(this, args);
    const t1 = performance.now();
    return { result, duration: t1 - t0 };
  };

  // Patch createContext()
  const origGetContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = spoofNative(function (
    type,
    ...args
  ) {
    const gl = origGetContext.call(this, type, ...args);

    if (!gl || !["webgl", "experimental-webgl"].includes(type)) return gl;

    this.width = drawingBufferWidth;
    this.height = drawingBufferHeight;

    // Set fixed buffer size
    Object.defineProperty(gl, "drawingBufferWidth", {
      value: drawingBufferWidth,
      configurable: false,
      writable: false,
    });
    Object.defineProperty(gl, "drawingBufferHeight", {
      value: drawingBufferHeight,
      configurable: false,
      writable: false,
    });

    // Helper: Mimic rendering pipeline timing
    const addJitter = (baseMs) => baseMs * (0.95 + Math.random() * 0.1);

    // Patch getParameter
    gl.getParameter = spoofNative(async function (pname) {
      let result;

      switch (pname) {
        case gl.VERSION:
          result = glVersion;
          break;
        case gl.SHADING_LANGUAGE_VERSION:
          result = glShadingLanguageVersion;
          break;
        case gl.VENDOR:
          result = vendor;
          break;
        case gl.RENDERER:
          result = renderer;
          break;
        case gl.SUBPIXEL_BITS:
          result = subPixelBits;
          break;
        case gl.MAX_TEXTURE_SIZE:
          result = maxTextureSize;
          break;
        case gl.MAX_RENDERBUFFER_SIZE:
          result = glRenderBufferSize;
          break;
        case gl.ALIASED_LINE_WIDTH_RANGE:
          result = new Float32Array([glLineWidthRange[0], glLineWidthRange[1]]);
          break;
        case gl.ALIASED_POINT_SIZE_RANGE:
          result = new Float32Array([glPointSizeRange[0], glPointSizeRange[1]]);
          break;
        case gl.MAX_VERTEX_UNIFORM_VECTORS:
          result = maxVertexUniformVectors;
          break;
        case gl.MAX_FRAGMENT_UNIFORM_VECTORS:
          result = maxFragmentUniformVectors;
          break;
        case gl.MAX_VERTEX_ATTRIBS:
          result = maxVertexAttribs;
          break;
        case gl.MAX_VARYING_VECTORS:
          result = maxVaryingVectors;
          break;
        default:
          result = WebGLRenderingContext.prototype.getParameter.apply(
            this,
            arguments
          );
      }

      let expectedDelay = 0;
      switch (pname) {
        case gl.VENDOR:
          expectedDelay = addJitter(timeGetParameterVendor);
          break;
        case gl.RENDERER:
          expectedDelay = addJitter(timeGetParameterRenderer);
          break;
        case gl.VERSION:
          expectedDelay = addJitter(timeGetParameterVersion);
          break;
        case gl.SHADING_LANGUAGE_VERSION:
          expectedDelay = addJitter(timeGetParameterShadingLang);
          break;
        default:
          expectedDelay = addJitter(0.1); // fallback small jitter
      }

      const start = performance.now();
      while (performance.now() - start < expectedDelay) {}

      return result;
    }, "getParameter");

    // Patch getShaderPrecisionFormat
    gl.getShaderPrecisionFormat = spoofNative((shadertype, precisiontype) => {
      const VERTEX_SHADER = 0x8b31;
      const FRAGMENT_SHADER = 0x8b30;

      const precisionFormatData =
        shadertype === VERTEX_SHADER
          ? vertexFloatPrecision
          : fragmentFloatPrecision;

      return createPrecisionFormat(precisionFormatData);
    }, "getShaderPrecisionFormat");

    // Supporting function: createPrecisionFormat
    const createPrecisionFormat = ({ rangeMin, rangeMax, precision }) => {
      return {
        rangeMin,
        rangeMax,
        precision,
        constructor: WebGLShaderPrecisionFormat,
        __proto__: WebGLShaderPrecisionFormat?.prototype,
        toString: () => "[object WebGLShaderPrecisionFormat]",
      };
    };

    // Patch getExtension & getSupportedExtensions
    const extList = [...extensions];
    gl.getExtension = spoofNative((name) => {
      if (
        (name === "EXT_texture_filter_anisotropic" &&
          !hasAnisotropicFiltering) ||
        (name === "OES_texture_float" && !hasFloatTextures) ||
        (name === "WEBGL_draw_buffers" && !hasDrawBuffers)
      ) {
        return null;
      }

      if (!extList.includes(name)) return null;
      return WebGLRenderingContext.prototype.getExtension.call(this, name);
    }, "getExtension");

    gl.getSupportedExtensions = spoofNative(
      () => [...extList],
      "getSupportedExtensions"
    );

    // Validate full extension list SHA-1
    const validateExtensionHash = async () => {
      const encoder = new TextEncoder();
      const encoded = encoder.encode(JSON.stringify(extList));
      const hashBuffer = await crypto.subtle.digest("SHA-1", encoded);
      const actualHash = Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      console.assert(
        actualHash === webglFP.extensionsSHA1,
        `Extension SHA-1 mismatch: ${actualHash} ≠ ${webglFP.extensionsSHA1}`
      );
    };

    validateExtensionHash().catch(console.warn);

    // Validate extension count SHA-1
    const validateExtensionCountHash = async () => {
      const encoder = new TextEncoder();
      const encoded = encoder.encode(extensionCount.toString());
      const hashBuffer = await crypto.subtle.digest("SHA-1", encoded);
      const actualHash = Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      console.assert(
        actualHash === extensionCountSHA1,
        `Extension count SHA-1 mismatch: ${actualHash} ≠ ${extensionCountSHA1}`
      );
    };

    validateExtensionCountHash().catch(console.warn);

    // Patch readPixels
    gl.readPixels = spoofNative((x, y, width, height, format, type, pixels) => {
      if (pixels instanceof Uint8Array && pixels.length >= 4) {
        pixels[0] = pixelRead[0]; // R
        pixels[1] = pixelRead[1]; // G
        pixels[2] = pixelRead[2]; // B
        pixels[3] = pixelRead[3]; // A
      }
      return WebGLRenderingContext.prototype.readPixels.apply(this, arguments);
    }, "readPixels");

    // Validate pixel output against SHA-1
    const validatePixelOutput = async (buffer) => {
      const hashBuffer = await crypto.subtle.digest("SHA-1", buffer);
      const actualHash = Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      console.assert(
        actualHash === pixelReadSHA1,
        `WebGL pixel SHA-1 mismatch: ${actualHash} ≠ ${pixelReadSHA1}`
      );
    };

    const dummyPixelData = new Uint8Array(pixelRead);
    validatePixelOutput(dummyPixelData.buffer).catch(console.warn);

    // Patch getContextAttributes
    gl.getContextAttributes = spoofNative(
      () => ({ ...contextAttributes }),
      "getContextAttributes"
    );

    // Patch isContextLost
    gl.isContextLost = spoofNative(() => false, "isContextLost");

    // Patch getError
    gl.getError = spoofNative(() => errorAfterBuffer, "getError");

    // Patch method signatures using provided values
    for (const [methodName, signature] of Object.entries(
      webglFP.methodSignatures
    )) {
      const origFn = gl[methodName];

      if (typeof origFn === "function") {
        const spoofedFn = spoofNative(origFn.bind(gl), methodName);
        spoofedFn.toString = () => signature;
        gl[methodName] = spoofedFn;
      }
    }

    // Spoof texture upload realism
    gl.texImage2D = spoofNative(
      (
        target,
        level,
        internalformat,
        width,
        height,
        border,
        format,
        type,
        pixels
      ) => {
        if (
          target === gl.TEXTURE_2D &&
          width === 1 &&
          height === 1 &&
          pixels instanceof Uint8Array
        ) {
          pixels[0] = pixelReadAfterTextureUpload[0]; // R
          pixels[1] = pixelReadAfterTextureUpload[1]; // G
          pixels[2] = pixelReadAfterTextureUpload[2]; // B
          pixels[3] = pixelReadAfterTextureUpload[3]; // A
        }

        return WebGLRenderingContext.prototype.texImage2D.apply(
          this,
          arguments
        );
      },
      "texImage2D"
    );

    // Optionally hide debug-related APIs
    if (!glKHRDebugSupported) {
      const debugExts = [
        "KHR_debug",
        "WEBGL_debug_shaders",
        "WEBGL_debug_renderer_info",
      ];
      for (const ext of debugExts) {
        gl.getExtension = function (name) {
          if (debugExts.includes(name)) return null;
          return WebGLRenderingContext.prototype.getExtension.call(this, name);
        };
      }
    }

    // Spoof class names
    Object.defineProperty(WebGLRenderingContext.prototype.constructor, "name", {
      value: contextClass,
      configurable: true,
    });

    gl.toString = () => "[object WebGLRenderingContext]";
  },
  "getContext");

  // Optional: Validate full object SHA-1
  const validateFullObjectHash = async () => {
    const stringified = JSON.stringify(webglFP);
    const encoder = new TextEncoder();
    const buffer = encoder.encode(stringified);

    const hashBuffer = await crypto.subtle.digest("SHA-1", buffer);
    const actualHash = Array.from(hashBuffer)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    console.assert(
      actualHash === webglFP.sha1,
      `WebGL fingerprint SHA-1 mismatch: ${actualHash} ≠ ${webglFP.sha1}`
    );
  };

  validateFullObjectHash().catch(console.warn);

  return {
    status: "Spoofed",
    sha1: webglFP.sha1,
  };
};

export default spoofWebGL;
