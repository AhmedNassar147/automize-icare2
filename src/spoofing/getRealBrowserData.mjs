// DOM + Navigator Properties

// chrome://flags/#enable-unsafe-webgpu

//   "SharedArrayBuffer": {
//   "minVersion": 68,
//   "path": "window.SharedArrayBuffer",
//   "isFunction": false,
//   "methods": [],
//   "checkRuntime": true
// },

// "WebGPU": {
//   "minVersion": 113,
//   "path": "navigator.gpu",
//   "isFunction": false,
//   "methods": ["requestAdapter"],
//   "weight": 3
// },

// navigator.userAgent.includes("Headless")
// window.outerWidth !== window.innerWidth
// chrome://flags/#enable-unsafe-webgpu

const getValuesOfObject = (obj) => {
  const keys = Object.getOwnPropertyNames(Object.getPrototypeOf(obj));

  return keys.reduce((acc, key) => {
    const value = obj[key];
    const type = typeof value;
    if (
      type === "string" ||
      type === "number" ||
      type === "boolean" ||
      type === "undefined"
    ) {
      acc[key] = value;
    }
    return acc;
  }, {});
};

const res = await (async () => {
  const getWebGLFingerprint = () => {
    const canvas = document.createElement("canvas");
    let contextType = "webgl";
    let gl = canvas.getContext(contextType);

    if (!gl) {
      contextType = "experimental-webgl";
      canvas.getContext(contextType);
    }

    if (!gl) return null;

    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    const khrDebug = gl.getExtension("KHR_debug");

    const khrDebugMaxDebugLoggedMessages = khrDebug
      ? gl.getParameter(khrDebug.MAX_DEBUG_LOGGED_MESSAGES)
      : null;
    const khrDebugMaxDebugMessageLength = khrDebug
      ? gl.getParameter(khrDebug.MAX_DEBUG_MESSAGE_LENGTH)
      : null;
    const khrDebugMaxDebugMessageBufferSize = khrDebug
      ? gl.getParameter(khrDebug.MAX_DEBUG_MESSAGE_BUFFER_SIZE)
      : null;
    const khrDebugMaxDebugMessageArguments = khrDebug
      ? gl.getParameter(khrDebug.MAX_DEBUG_MESSAGE_ARGUMENTS)
      : null;

    const floatColorBufferSupported = !!gl.getExtension(
      "WEBGL_color_buffer_float"
    );
    const floatTextureSupported = !!gl.getExtension("OES_texture_float");
    const halfFloatTextureSupported = !!gl.getExtension(
      "OES_texture_half_float"
    );

    const drawBuffersSupported = !!gl.getExtension("WEBGL_draw_buffers");
    const depthTextureSupported = !!gl.getExtension("WEBGL_depth_texture");
    const shaderLodSupported = !!gl.getExtension("EXT_shader_texture_lod");
    const debugShadersSupported = !!gl.getExtension("WEBGL_debug_shaders");
    const loseContextSupported = !!gl.getExtension("WEBGL_lose_context");
    const anisotropicFiltering =
      gl.getExtension("EXT_texture_filter_anisotropic") ||
      gl.getExtension("WEBKIT_EXT_texture_filter_anisotropic") ||
      gl.getExtension("MOZ_EXT_texture_filter_anisotropic");

    const shaderPrecision = {
      vertex: {
        high: getValuesOfObject(
          gl.getShaderPrecisionFormat(gl.VERTEX_SHADER, gl.HIGH_FLOAT)
        ),
        medium: getValuesOfObject(
          gl.getShaderPrecisionFormat(gl.VERTEX_SHADER, gl.MEDIUM_FLOAT)
        ),
        low: getValuesOfObject(
          gl.getShaderPrecisionFormat(gl.VERTEX_SHADER, gl.LOW_FLOAT)
        ),
      },
      fragment: {
        high: getValuesOfObject(
          gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT)
        ),
        medium: getValuesOfObject(
          gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.MEDIUM_FLOAT)
        ),
        low: getValuesOfObject(
          gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.LOW_FLOAT)
        ),
      },
    };

    const uniformValues = (() => {
      const program = gl.createProgram();
      const vs = gl.createShader(gl.VERTEX_SHADER);
      gl.shaderSource(
        vs,
        "attribute vec2 a;void main(){gl_Position=vec4(a,0,1);}"
      );
      gl.compileShader(vs);
      gl.attachShader(program, vs);

      const fs = gl.createShader(gl.FRAGMENT_SHADER);
      gl.shaderSource(fs, "void main(){gl_FragColor=vec4(0,1,0,1);}");
      gl.compileShader(fs);
      gl.attachShader(program, fs);

      gl.linkProgram(program);
      gl.useProgram(program);

      const loc = gl.getUniformLocation(program, "u");
      if (loc) gl.uniform1f(loc, 1.0);

      return {
        linkStatus: gl.getProgramParameter(program, gl.LINK_STATUS),
        shaderCompileStatus: gl.getShaderParameter(vs, gl.COMPILE_STATUS),
        shaderLog: gl.getShaderInfoLog(vs),
      };
    })();

    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);

    const pixelsHash = (() => {
      const pixels = new Uint8Array(32 * 32 * 4);
      gl.readPixels(0, 0, 32, 32, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      let hash = 0;
      for (let i = 0; i < pixels.length; i++) {
        hash = ((hash << 5) - hash + pixels[i]) | 0;
      }
      return hash;
    })();

    // Read pixel test – sensitive check used by reCAPTCHA
    // const pixels = new Uint8Array(4); // RGBA
    // let pixelReadSHA1 = null;
    // try {
    //   gl.clearColor(0.5, 0.5, 0.5, 1.0); // Set background color to gray
    //   gl.clear(gl.COLOR_BUFFER_BIT);
    //   gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    //   pixelReadSHA1 = await sha1Hash(pixels.buffer);
    // } catch (err) {
    //   pixelReadSHA1 = "error";
    // }

    // // Buffer error test
    // let errorAfterBuffer = null;
    // try {
    //   const buffer = gl.createBuffer();
    //   gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    //   gl.bufferData(
    //     gl.ARRAY_BUFFER,
    //     new Float32Array([0, 0, 0]),
    //     gl.STATIC_DRAW
    //   );
    //   errorAfterBuffer = gl.getError();
    // } catch {
    //   errorAfterBuffer = "error";
    // }

    // Dummy texture upload test
    const dummyPixelData = new Uint8Array([255, 0, 0, 255]); // Red pixel
    const dummyTex = gl.createTexture();
    let pixelReadAfterTextureUpload = "error happened";

    try {
      gl.bindTexture(gl.TEXTURE_2D, dummyTex);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        1,
        1,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        dummyPixelData
      );

      const pixelsAfterTex = new Uint8Array(4);
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixelsAfterTex);
      pixelReadAfterTextureUpload = [...pixelsAfterTex];
    } catch {
      pixelReadAfterTextureUpload = "error happened";
    }

    const methodToStrings = {
      getParameter: Function.prototype.toString.call(gl.getParameter),
      getShaderPrecisionFormat: Function.prototype.toString.call(
        gl.getShaderPrecisionFormat
      ),
      getSupportedExtensions: Function.prototype.toString.call(
        gl.getSupportedExtensions
      ),
      getExtension: Function.prototype.toString.call(gl.getExtension),
      readPixels: Function.prototype.toString.call(gl.readPixels),
      getError: Function.prototype.toString.call(gl.getError),
      isContextLost: Function.prototype.toString.call(gl.isContextLost),
      createProgram: Function.prototype.toString.call(gl.createProgram),
      clear: Function.prototype.toString.call(gl.clear),
      clearColor: Function.prototype.toString.call(gl.clearColor),
      useProgram: Function.prototype.toString.call(gl.useProgram),
      enableVertexAttribArray: Function.prototype.toString.call(
        gl.enableVertexAttribArray
      ),
      disableVertexAttribArray: Function.prototype.toString.call(
        gl.disableVertexAttribArray
      ),
      bindBuffer: Function.prototype.toString.call(gl.bindBuffer),
      bufferData: Function.prototype.toString.call(gl.bufferData),
      createShader: Function.prototype.toString.call(gl.createShader),
      shaderSource: Function.prototype.toString.call(gl.shaderSource),
      compileShader: Function.prototype.toString.call(gl.compileShader),
      createTexture: Function.prototype.toString.call(gl.createTexture),
      texImage2D: Function.prototype.toString.call(gl.texImage2D),
      drawArrays: Function.prototype.toString.call(gl.drawArrays),
      drawElements: Function.prototype.toString.call(gl.drawElements),
      getContextAttributes: Function.prototype.toString.call(
        gl.getContextAttributes
      ),
    };

    const measure = (fn, ...args) => {
      const t0 = performance.now();
      const result = fn(...args);
      const t1 = performance.now();
      return { result, duration: t1 - t0 };
    };

    const paramKeys = [
      gl.VERSION,
      gl.SHADING_LANGUAGE_VERSION,
      gl.VENDOR,
      gl.RENDERER,
      gl.SUBPIXEL_BITS,
      gl.MAX_TEXTURE_SIZE,
      gl.ALIASED_LINE_WIDTH_RANGE,
      gl.ALIASED_POINT_SIZE_RANGE,
      gl.MAX_RENDERBUFFER_SIZE,
    ];

    const paramValues = {};
    const paramDurations = {};
    const paramToStrings = {};

    for (const key of paramKeys) {
      const { result, duration } = measure(() => gl.getParameter(key));
      paramValues[key] = result;
      paramDurations[key] = duration;
      paramToStrings[key] = Function.prototype.toString.call(gl.getParameter);
    }

    const contextAttributes = gl.getContextAttributes();

    return {
      contextType,
      vendor: ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : null,
      renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : null,
      version: gl.getParameter(gl.VERSION),
      timeGetParameterVersion: paramDurations[gl.VERSION],
      shadingLanguageVersion: gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
      supportedExtensions: gl.getSupportedExtensions(),
      debugInfo: getValuesOfObject(ext),
      contextClass: gl.constructor.name,
      floatTextureSupported,
      floatColorBufferSupported,
      halfFloatTextureSupported,
      drawBuffersSupported,
      depthTextureSupported,
      shaderLodSupported,
      debugShadersSupported,
      loseContextSupported,
      hasKhrDebug: !!khrDebug,
      khrDebugMaxDebugLoggedMessages,
      khrDebugMaxDebugMessageLength,
      khrDebugMaxDebugMessageBufferSize,
      khrDebugMaxDebugMessageArguments,
      anisotropicFiltering: !!anisotropicFiltering,
      maxAnisotropy: anisotropicFiltering
        ? gl.getParameter(anisotropicFiltering.MAX_TEXTURE_MAX_ANISOTROPY_EXT)
        : null,
      glShadingLanguageVersion: paramValues[gl.SHADING_LANGUAGE_VERSION],
      timeGetParameterShadingLang: paramDurations[gl.SHADING_LANGUAGE_VERSION],
      maxTextureSize: paramValues[gl.MAX_TEXTURE_SIZE],
      glRenderBufferSize: paramValues[gl.MAX_RENDERBUFFER_SIZE],
      glVendor: paramValues[gl.VENDOR],
      timeGetParameterVendor: paramDurations[gl.VENDOR],

      glRenderer: paramValues[gl.RENDERER],
      timeGetParameterGlRenderer: paramDurations[gl.RENDERER],
      glAliasedLineWidthRange: paramValues[gl.ALIASED_LINE_WIDTH_RANGE],
      glAliasedPointSizeRange: paramValues[gl.ALIASED_POINT_SIZE_RANGE],
      maxCubeMapSize: gl.getParameter(gl.MAX_CUBE_MAP_SIZE),
      maxCubeMapTextureSize: gl.getParameter(gl.MAX_CUBE_MAP_TEXTURE_SIZE),
      maxRenderBufferSize: gl.getParameter(gl.MAX_RENDERBUFFER_SIZE),
      maxVertexAttribs: gl.getParameter(gl.MAX_VERTEX_ATTRIBS),
      maxVaryingVectors: gl.getParameter(gl.MAX_VARYING_VECTORS),
      maxVertexUniformVectors: gl.getParameter(gl.MAX_VERTEX_UNIFORM_VECTORS),
      maxFragmentUniformVectors: gl.getParameter(
        gl.MAX_FRAGMENT_UNIFORM_VECTORS
      ),
      subPixelBits: paramValues[gl.SUBPIXEL_BITS],
      precisionFormats: shaderPrecision,
      programChecks: uniformValues,
      framebufferStatus: status,
      isContextLost: gl.isContextLost(),
      pixelsHash: pixelsHash,
      pixelReadAfterTextureUpload,
      contextAttributes: contextAttributes
        ? {
            alpha: contextAttributes.alpha,
            depth: contextAttributes.depth,
            stencil: contextAttributes.stencil,
            antialias: contextAttributes.antialias,
            premultipliedAlpha: contextAttributes.premultipliedAlpha,
            preserveDrawingBuffer: contextAttributes.preserveDrawingBuffer,
            failIfMajorPerformanceCaveat:
              contextAttributes.failIfMajorPerformanceCaveat,
          }
        : null,
      drawingBufferWidth: gl.drawingBufferWidth,
      drawingBufferHeight: gl.drawingBufferHeight,
      methodToStrings,
    };
  };

  const collectWebRTCFingerprint = async () => {
    const parseCandidate = (str) => {
      const parts = str.trim().split(" ");

      // Basic structure of candidate line
      // [foundation] [component] [protocol] [priority] [IP] [port] typ [type] ...
      const candidate = {
        foundation: parts[0].split(":")[1],
        component: parts[1],
        protocol: parts[2],
        priority: parseInt(parts[3]),
        ip: parts[4],
        port: parseInt(parts[5]),
        type: null,
        relatedAddress: null,
        relatedPort: null,
      };

      for (let i = 6; i < parts.length; i++) {
        const key = parts[i];
        const val = parts[i + 1];
        if (key === "typ") candidate.type = val;
        if (key === "raddr") candidate.relatedAddress = val;
        if (key === "rport") candidate.relatedPort = parseInt(val);
      }

      return candidate;
    };

    return new Promise((resolve) => {
      const pc = new RTCPeerConnection({ iceServers: [] });
      pc.createDataChannel("channel");

      const candidates = [];

      pc.onicecandidate = (event) => {
        const cand = event?.candidate;
        if (!cand) {
          resolve(candidates);
          pc.close();
          return;
        }

        const parsed = parseCandidate(cand.candidate);

        candidates.push({
          candidate: cand.candidate,
          address: cand.address || parsed.ip || null,
          relatedAddress: cand.relatedAddress || parsed.relatedAddress || null,
          relatedPort: cand.relatedPort || parsed.relatedPort || null,
          foundation: cand.foundation || parsed.foundation || null,
          component: cand.component || parsed.component || null,
          protocol: parsed.protocol,
          priority: parsed.priority,
          port: parsed.port,
          type: parsed.type,
        });
      };

      pc.createOffer()
        .then((offer) => pc.setLocalDescription(offer))
        .catch(() => resolve(candidates));
    });
  };

  const getCanvasFingerprint = async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 300;
    canvas.height = 150;

    // Capture CSS size (style) vs attribute size
    const cssWidth = canvas.style.width || "";
    const cssHeight = canvas.style.height || "";

    const ctx = canvas.getContext("2d");

    // Draw with entropy
    ctx.textBaseline = "top";
    ctx.font = "14px 'Arial'";
    ctx.fillStyle = "#f60";
    ctx.fillRect(125, 1, 62, 20);
    ctx.fillStyle = "#069";
    ctx.fillText("fingerprint", 2, 15);
    ctx.fillStyle = "rgba(102, 204, 0, 0.7)";
    ctx.fillText("fingerprint", 4, 17);

    // Extra blend and effects
    ctx.shadowColor = "rgba(0,0,0,0.5)";
    ctx.shadowBlur = 5;
    ctx.globalCompositeOperation = "multiply";
    ctx.beginPath();
    ctx.arc(100, 25, 20, 0, Math.PI * 2, true);
    ctx.fill();

    // Measure time for toDataURL
    const t0DataURL = performance.now();
    const dataURL = canvas.toDataURL();
    const t1DataURL = performance.now();
    const toDataURLDuration = t1DataURL - t0DataURL;

    // SHA1 for dataURL
    const dataURLLength = dataURL.length;
    const dataURLHashBuffer = await crypto.subtle?.digest?.(
      "SHA-1",
      new TextEncoder().encode(dataURL)
    );
    const dataURLHash = [...new Uint8Array(dataURLHashBuffer)]
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    // Get imageData & hash
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const imageDataHashBuffer = await crypto.subtle?.digest?.(
      "SHA-1",
      imageData
    );
    const imageDataHash = [...new Uint8Array(imageDataHashBuffer)]
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    // Calculate noise statistics (mean, variance)
    let sum = 0,
      sumSq = 0;
    for (let i = 0; i < imageData.length; i++) {
      sum += imageData[i];
      sumSq += imageData[i] * imageData[i];
    }
    const mean = sum / imageData.length;
    const variance = sumSq / imageData.length - mean * mean;

    // Analyze subtle rounding / antialiasing differences:
    // Simple approach: pixel differences between neighbors horizontally
    let diffSum = 0,
      diffCount = 0;
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width - 1; x++) {
        const idx = (y * canvas.width + x) * 4;
        const nextIdx = (y * canvas.width + (x + 1)) * 4;
        // Compute pixel difference as sum of abs diff RGBA channels
        let diff = 0;
        for (let c = 0; c < 4; c++) {
          diff += Math.abs(imageData[idx + c] - imageData[nextIdx + c]);
        }
        diffSum += diff;
        diffCount++;
      }
    }
    const avgPixelNeighborDiff = diffSum / diffCount;

    // Measure time for toBlob
    let toBlobHash = null;
    let blobSize = null;
    let toBlobDuration = null;
    if (canvas.toBlob) {
      const t0Blob = performance.now();
      const blob = await new Promise((resolve) =>
        canvas.toBlob(resolve, "image/png")
      );
      const t1Blob = performance.now();
      toBlobDuration = t1Blob - t0Blob;
      blobSize = blob?.size || null;
      const arrayBuffer = await blob.arrayBuffer();
      const blobHashBuffer = await crypto.subtle?.digest?.(
        "SHA-1",
        arrayBuffer
      );
      const blobHashArray = Array.from(new Uint8Array(blobHashBuffer));
      toBlobHash = blobHashArray
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    }

    // Native check for toDataURL and toBlob
    const isToDataURLNative =
      typeof canvas.toDataURL === "function" &&
      Function.prototype.toString
        .call(canvas.toDataURL)
        .includes("[native code]");

    const isToBlobNative =
      typeof canvas.toBlob === "function" &&
      Function.prototype.toString.call(canvas.toBlob).includes("[native code]");

    const isGetContextNative =
      typeof HTMLCanvasElement.prototype.getContext === "function" &&
      Function.prototype.toString
        .call(HTMLCanvasElement.prototype.getContext)
        .includes("[native code]");

    const toStringToDataURL =
      typeof canvas.toDataURL === "function"
        ? Function.prototype.toString.call(canvas.toDataURL)
        : "";

    const toStringToBlob =
      typeof canvas.toBlob === "function"
        ? Function.prototype.toString.call(canvas.toBlob)
        : "";

    const toStringGetContext = Function.prototype.toString.call(
      HTMLCanvasElement.prototype.getContext
    );

    // toDataURL props
    const toDataURLProps = {
      length: canvas.toDataURL.length,
      name: canvas.toDataURL.name,
    };

    // Mutation detection
    let hasCanvasMutation = false;
    try {
      const observer = new MutationObserver(() => {
        hasCanvasMutation = true;
      });
      observer.observe(canvas, {
        attributes: true,
        childList: true,
        subtree: true,
      });
      await new Promise((r) => setTimeout(r, 10));
      observer.disconnect();
    } catch {
      hasCanvasMutation = "error";
    }

    // ctx state inspection + native checks for some ctx methods
    const ctxStateProps = {
      shadowBlur: ctx.shadowBlur,
      shadowColor: ctx.shadowColor,
      fillStyle: ctx.fillStyle,
      font: ctx.font,
      globalCompositeOperation: ctx.globalCompositeOperation,
      textBaseline: ctx.textBaseline,
      lineWidth: ctx.lineWidth,
      lineCap: ctx.lineCap,
      lineJoin: ctx.lineJoin,
      miterLimit: ctx.miterLimit,
      shadowOffsetX: ctx.shadowOffsetX,
      shadowOffsetY: ctx.shadowOffsetY,
      globalAlpha: ctx.globalAlpha,
    };

    // Native check for some ctx methods
    const ctxNativeMethods = {};
    const methods = [
      "fillRect",
      "fillText",
      "beginPath",
      "arc",
      "getImageData",
      "toDataURL",
      "toBlob",
    ];

    const getFunctionMeta = (fn, name) => {
      const toString = Function.prototype.toString.call(fn);

      const descriptors = Object.getOwnPropertyDescriptors(fn);
      return {
        spoof: toString.includes("[native code]"),
        length: fn.length,
        name: fn.name || name,
        toString: toString,
        prototypeIsUndefined:
          fn.hasOwnProperty("prototype") && fn.prototype === undefined,
        hasOwnPropertyToString: fn.hasOwnProperty("toString")
          ? fn.toString === Function.prototype.toString
          : false,
        descriptors,
      };
    };

    for (const method of methods) {
      const fn = method in ctx ? ctx[method] : canvas[method];
      if (typeof fn !== "function") continue;
      ctxNativeMethods[method] = getFunctionMeta(fn, method);
    }

    const canvasClassName = canvas.constructor?.name || "unknown";
    const ctxClassName = ctx.constructor?.name || "unknown";

    return {
      width: canvas.width,
      height: canvas.height,
      devicePixelRatio: window.devicePixelRatio || 1,
      dataURL,
      dataURLLength,
      sha1: dataURLHash,
      toDataURLDuration,
      toBlobDuration,
      toBlobHash,
      blobSize,
      imageDataHash,
      meanPixelValue: mean,
      pixelVariance: variance,
      avgPixelNeighborDiff,
      isToDataURLNative,
      isToBlobNative,
      isGetContextNative,
      toStringToDataURL,
      toStringToBlob,
      toStringGetContext,
      toDataURLProps,
      hasCanvasMutation,
      ctxStateProps,
      ctxNativeMethods,
      canvasClassName,
      ctxClassName,
      cssWidth,
      cssHeight,
    };
  };

  const getRealPermissions = async () => {
    const permissionNames = [
      "camera",
      "microphone",
      "geolocation",
      "notifications",
      "persistent-storage",
      "push",
      "accelerometer",
      "gyroscope",
      "ambient-light-sensor",
      "clipboard-read",
      "clipboard-write",
      "background-sync",
      "midi",
      "magnetometer",
      "accessibility-events",
      "clipboard",
      "payment-handler",
      "periodic-background-sync",
      "window-placement",
      "idle_detection",
      "bluetooth",
      "usb",
    ];

    const permissionsResults = {};
    const results = await Promise.allSettled(
      permissionNames.map((name) =>
        navigator.permissions.query({ name }).then((p) => ({
          name: p.name || name,
          state: p.state,
          onchangeExists: typeof p.onchange === "function",
          addEventListenerExists: typeof p.addEventListener === "function",
          removeEventListenerExists:
            typeof p.removeEventListener === "function",
        }))
      )
    );

    results.forEach((result, i) => {
      const name = permissionNames[i];
      if (result.status === "fulfilled") {
        permissionsResults[name] = result.value;
      } else {
        permissionsResults[name] = {
          name,
          state: "unsupported",
          error: result.reason?.message,
          errorType: result.reason?.constructor?.name,
        };
      }
    });

    return permissionsResults;
  };

  const collectRealFontData = async () => {
    const fontReadyStart = performance.now();
    const statusBeforeReady = document.fonts.status;
    await document.fonts.ready;
    const fontReadyTime = performance.now() - fontReadyStart;
    const statusAfterReady = document.fonts.status;

    const baseFonts = ["monospace", "sans-serif", "serif"];

    const testFonts = [
      "Arial",
      "Times New Roman",
      "Courier New",
      "Helvetica",
      "Segoe UI",
      "Tahoma",
      "Verdana",
      "Georgia",
      "Comic Sans MS",
      "Impact",
      "Calibri",
      "Cambria",
      "Lucida Console",
      "Palatino Linotype",
      "Gill Sans",
      "Trebuchet MS",
    ];

    const testStrings = [
      "mmmmmmmmmmlli",
      "abcdefghijklmnopqrstuvwxyz",
      "1234567890",
      "WWWWWWWWWW",
    ];

    const sizes = [12, 14, 16, 18];

    const canvas = document.createElement("canvas");
    canvas.width = 400;
    canvas.height = 100;
    const ctx = canvas.getContext("2d");

    const getTextWidth = (font, base, size = 72, text = "mmmmmmmmmmlli") => {
      ctx.font = `${size}px '${font}',${base}`;
      return ctx.measureText(text).width;
    };

    const renderWidths = {};
    const fontDetection = testFonts.map((font) => {
      const widths = {};
      let detected = false;
      for (const base of baseFonts) {
        widths[base] = {};
        for (const text of testStrings) {
          const fallback = getTextWidth("fallbackFont", base, 72, text);
          const width = getTextWidth(font, base, 72, text);
          widths[base][text] = width;
          if (width !== fallback) detected = true;
        }
      }
      renderWidths[font] = widths;
      return { font, detected };
    });

    const fontSizeChecks = testFonts.flatMap((font) =>
      sizes.map((size) => ({
        font,
        size,
        check: document.fonts.check(`${size}px "${font}"`),
      }))
    );

    const genericFonts = [
      "serif",
      "sans-serif",
      "monospace",
      "cursive",
      "fantasy",
      "system-ui",
    ];

    const genericSupport = genericFonts.map((g) => ({
      font: g,
      check: document.fonts.check(`16px ${g}`),
    }));

    const loadedFontFaces = [...document.fonts].map((f) => ({
      family: f.family,
      style: f.style,
      weight: f.weight,
      stretch: f.stretch,
      unicodeRange: f.unicodeRange,
      variant: f.variant,
      featureSettings: f.featureSettings,
      status: f.status,
    }));

    const fontToString = Function.prototype.toString.call(document.fonts.check);
    const isNativeFontsCheck = fontToString.includes("[native code]");

    let fontFaceSetToString = null;

    if (typeof FontFaceSet !== "undefined") {
      try {
        fontFaceSetToString = Function.prototype.toString.call(
          FontFaceSet.prototype.add
        );
      } catch (e) {
        fontFaceSetToString = "error";
      }
    } else {
      fontFaceSetToString = "not available";
    }

    let fontFaceToString = null;

    if (typeof FontFaceSet !== "undefined") {
      try {
        fontFaceToString = Function.prototype.toString.call(
          FontFace.prototype.load
        );
      } catch (e) {
        fontFaceSetToString = "error";
      }
    } else {
      fontFaceSetToString = "not available";
    }

    const hasCustomFonts = [...document.fonts].some(
      (f) => f.family.includes("url(") || f.status === "loading"
    );

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const hashBuffer = await crypto.subtle?.digest?.("SHA-1", imageData);
    const canvasRenderHash = [...new Uint8Array(hashBuffer)]
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const widthsHashBuffer = await crypto.subtle?.digest?.(
      "SHA-1",
      new TextEncoder().encode(JSON.stringify(renderWidths))
    );
    const widthsHash = [...new Uint8Array(widthsHashBuffer)]
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    return {
      fontReadyTime: fontReadyTime.toFixed(2),
      statusBeforeReady,
      statusAfterReady,
      fontsStatus: document.fonts.status,
      documentFontsCheckIsNative: isNativeFontsCheck,
      fontFaceSetToString,
      fontFaceToString,
      hasCustomFonts,
      fontDetection,
      fontSizeChecks,
      genericSupport,
      renderWidths,
      renderWidthsSHA1: widthsHash,
      loadedFontFaces,
      canvasRenderHash,
    };
  };

  const getPluginsAndMemiTypes = () => {
    const plugins = [...(navigator.plugins || [])].map((p) => ({
      name: p.name,
      filename: p.filename,
      description: p.description,
      length: p.length,
      mimeTypes: [...p].map((m) => ({
        type: m.type,
        description: m.description,
        suffixes: m.suffixes,
        enabledPlugin: {
          name: m.enabledPlugin?.name,
          filename: m.enabledPlugin?.filename,
          description: m.enabledPlugin?.description,
          length: m.enabledPlugin.length,
        },
      })),
    }));

    const mimeTypes = [...(navigator.mimeTypes || [])].map((m) => ({
      type: m.type,
      description: m.description,
      suffixes: m.suffixes,
      enabledPlugin: {
        name: m.enabledPlugin?.name,
        filename: m.enabledPlugin?.filename,
        description: m.enabledPlugin?.description,
        length: m.length,
      },
    }));

    return {
      pluginsLength: navigator.plugins?.length,
      mimeTypesLength: navigator.mimeTypes?.length,
      plugins,
      mimeTypes,
    };
  };

  const getRealMediaSupport = async () => {
    const mediaQueries = [
      "(prefers-color-scheme: dark)",
      "(prefers-color-scheme: light)",
      "(prefers-reduced-motion: reduce)",
      "(prefers-contrast: more)",
      "(hover: hover)",
      "(hover: none)",
      "(pointer: fine)",
      "(pointer: coarse)",
      "(any-pointer: fine)",
      "(any-hover: hover)",
      "(aspect-ratio: 16/9)",
      "(orientation: landscape)",
      "(orientation: portrait)",
      "(resolution: 96dpi)",
      "(min-width: 768px)",
      "(max-width: 1920px)",
    ];

    const mediaResults = {};
    const mediaMediaValues = {};
    for (const query of mediaQueries) {
      const m = window.matchMedia(query);
      mediaResults[query] = m.matches;
      mediaMediaValues[query] = m.media;
    }

    const cssSupportsChecks = [
      ["display", "grid"],
      ["display", "contents"],
      ["color", "color(display-p3 1 0 0)"],
      ["backdrop-filter", "blur(4px)"],
      ["position", "sticky"],
      ["text-decoration", "underline dotted"],
      ["-webkit-appearance", "none"],
      ["font-variation-settings", '"wght" 700'],
      ["aspect-ratio", "1/1"],
    ];

    const cssSupports = {};
    for (const [prop, val] of cssSupportsChecks) {
      cssSupports[`${prop}: ${val}`] = CSS.supports(prop, val);
    }

    const orientation = getValuesOfObject(screen.orientation || {});

    const mediaOrientation = matchMedia("(orientation: portrait)").matches
      ? "portrait"
      : "landscape";

    const orientationMatch = orientation?.type?.includes(mediaOrientation);

    const orientationInfo = {
      ...orientation,
      onchangeExists: typeof orientation.onchange === "function",
      lockExists: typeof orientation.lock === "function",
      unlockExists: typeof orientation.unlock === "function",
    };

    const objectProtoToStringCall_WinMatchMedia =
      Object.prototype.toString.call(window.matchMedia);

    const matchMediaPrototype = Object.getOwnPropertyNames(
      Object.getPrototypeOf(window.matchMedia("(min-width: 1px)"))
    ).sort();

    const enumeratedDevices =
      (await navigator.mediaDevices?.enumerateDevices?.()) ?? [];

    const supportedConstraints =
      navigator.mediaDevices?.getSupportedConstraints?.() ?? {};

    const _getUserMedia = navigator.mediaDevices?.getUserMedia;

    const mediaCapabilities = {
      hasGetUserMedia: !!_getUserMedia,
      getUserMediaIsFunction: typeof _getUserMedia === "function",
      enumeratedDevices,
      supportedConstraints,
    };

    return {
      mediaQueriesNamesChecked: mediaResults,
      mediaOrientation,
      orientationMatchMediaOrientation: orientationMatch,
      objectProtoToStringCall_WinMatchMedia,
      cssSupports,
      matchMediaPrototype,
      mediaCapabilities,
      orientationInfo,
    };
  };

  const getStorgae = async () => {
    const estimate = (await navigator.storage?.estimate?.()) ?? {};
    const persisted = (await navigator.storage?.persisted?.()) ?? false;

    return {
      hasLocalStorage: !!window.localStorage,
      hasSessionStorage: !!window.sessionStorage,
      hasIndexedDB: !!window.indexedDB,
      persisted: persisted,
      quota: estimate.quota,
      usage: estimate.usage,
      usageDetails: estimate?.usageDetails,
      supportsPersistence: typeof navigator.storage?.persist === "function",
      supportsEstimate: typeof navigator.storage?.estimate === "function",
      supportsGetDirectory:
        typeof navigator.storage?.getDirectory === "function",
    };
  };

  const getBattery = async () => {
    let batteryInfo = null;
    try {
      if (navigator.getBattery) {
        const battery = await navigator.getBattery();
        batteryInfo = {
          charging: battery.charging,
          chargingTime: battery.chargingTime,
          dischargingTime: battery.dischargingTime,
          level: battery.level,
        };
      }
    } catch (err) {}

    return batteryInfo;
  };

  const getUsbDevices = async () => {
    let usbDevices = [];
    try {
      if (navigator.usb?.getDevices) {
        usbDevices = await navigator.usb.getDevices();
      }
    } catch (err) {}

    return usbDevices;
  };

  const getConnection = () => {
    const initialConnection = getValuesOfObject(
      navigator.connection || navigator.webkitConnection
    );

    return {
      ...initialConnection,
      rtt: initialConnection?.rtt ?? 50,
      downlink: initialConnection?.downlink ?? 10,
      effectiveType: initialConnection?.effectiveType ?? "4g",
      saveData: initialConnection?.saveData ?? false,
    };
  };

  const getGamePads = () => {
    const gamepads = navigator.getGamepads?.();
    return [...gamepads].filter(Boolean).map((gp) => ({
      id: gp.id,
      index: gp.index,
      connected: gp.connected,
      mapping: gp.mapping,
      axes: gp.axes,
      buttons: gp.buttons,
    }));
  };

  const getBluetoothAvailability = async () => {
    let isBluetoothAvailable = false;
    try {
      if (navigator.bluetooth?.getAvailability) {
        isBluetoothAvailable = await navigator.bluetooth.getAvailability();
      }
    } catch (err) {
      isBluetoothAvailable = false;
    }

    return isBluetoothAvailable;
  };

  const getUserAgentData = async () => {
    const userAgent = navigator.userAgent;

    const userAgentData = navigator.userAgentData || null;

    let brands = {};
    try {
      if (navigator.userAgentData?.getHighEntropyValues) {
        brands = await navigator.userAgentData.getHighEntropyValues([
          "brands",
          "platform",
          "platformVersion",
          "architecture",
          "uaFullVersion",
          "fullVersionList",
          "model",
          "mobile",
        ]);
      }
    } catch (e) {
      brands = {};
    }

    return {
      userAgent,
      userAgentData,
      userAgentHighEntropyValues: brands,
    };
  };

  const getAudioFingerprint = async () => {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    const analyser = audioCtx.createAnalyser();
    const compressor = audioCtx.createDynamicsCompressor();
    const gainNode = audioCtx.createGain();

    analyser.fftSize = 2048;
    gainNode.gain.value = 0;

    const bufferLength = analyser.frequencyBinCount;
    const freqData = new Float32Array(bufferLength);
    analyser.getFloatFrequencyData(freqData);

    const audioValues = {
      audioCtxSampleRate: audioCtx.sampleRate,
      audioCtxBaseLatency: audioCtx.baseLatency,
      audioCtxState: audioCtx.state,
      isRunning: audioCtx.state === "running",
      sinkId: audioCtx.sinkId || "",

      channelCount: audioCtx.destination.channelCount,
      channelCountMode: audioCtx.destination.channelCountMode,
      maxChannelCount: audioCtx.destination.maxChannelCount,
      numberOfInputs: audioCtx.destination.numberOfInputs,
      numberOfOutputs: audioCtx.destination.numberOfOutputs,

      destinationToString: audioCtx.destination.toString?.(),
      destinationClass: audioCtx.destination.constructor?.name || null,

      closeIsNative: Function.prototype.toString
        .call(audioCtx.close)
        .includes("[native code]"),
      audioContextNative: Function.prototype.toString.call(AudioContext),
      offlineContextNative:
        Function.prototype.toString.call(OfflineAudioContext),
      audioContextToStringIsNative: Function.prototype.toString
        .call(AudioContext)
        .includes("[native code]"),
      offlineContextToStringIsNative: Function.prototype.toString
        .call(OfflineAudioContext)
        .includes("[native code]"),
      compressorToStringIsNative: Function.prototype.toString
        .call(audioCtx.createDynamicsCompressor)
        .includes("[native code]"),

      analyserBinCount: bufferLength,
      analyserSample: freqData.slice(0, 32), // Save some sample for replay/spoof
      gainValue: gainNode.gain.value,
      compressor: {
        threshold: getValuesOfObject(compressor.threshold),
        knee: getValuesOfObject(compressor.knee),
        ratio: getValuesOfObject(compressor.ratio),
        attack: getValuesOfObject(compressor.attack),
        release: getValuesOfObject(compressor.release),
      },
    };

    // Render via OfflineAudioContext
    const renderStart = performance.now();
    const context = new OfflineAudioContext(1, 44100, 44100); // mono 1s

    const oscillator = context.createOscillator();
    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(10000, context.currentTime);

    const comp = context.createDynamicsCompressor();
    comp.threshold.setValueAtTime(-50, context.currentTime);
    comp.knee.setValueAtTime(40, context.currentTime);
    comp.ratio.setValueAtTime(12, context.currentTime);
    comp.attack.setValueAtTime(0, context.currentTime);
    comp.release.setValueAtTime(0.25, context.currentTime);

    oscillator.connect(comp);
    comp.connect(context.destination);
    oscillator.start(0);

    const buffer = await context.startRendering();
    const renderLatency = performance.now() - renderStart;

    const output = buffer.getChannelData(0);
    let sum = 0;
    for (let i = 0; i < output.length; i++) {
      sum += Math.abs(output[i]);
    }

    const floatProfile = sum.toFixed(3);
    const hashBuffer = await crypto.subtle.digest(
      "SHA-1",
      new TextEncoder().encode(floatProfile)
    );
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    return {
      fingerprint: {
        sum: floatProfile,
        sha1: hashHex,
        renderLatency: renderLatency.toFixed(2),
      },
      metadata: audioValues,
    };
  };

  const getAudioVideoData = async () => {
    const audio = document.createElement("audio");
    const video = document.createElement("video");
    const stream = await navigator.mediaDevices
      .getUserMedia({ audio: true, video: true })
      .catch(() => null);

    const mediaDevicesProps = Object.getOwnPropertyNames(
      navigator.mediaDevices || {}
    );
    const audioProps = Object.getOwnPropertyNames(Object.getPrototypeOf(audio));
    const videoProps = Object.getOwnPropertyNames(Object.getPrototypeOf(video));

    const audioEvents = Object.keys(audio).filter((k) => k.startsWith("on"));
    const videoEvents = Object.keys(video).filter((k) => k.startsWith("on"));

    const supportedMimeTypes = [
      "audio/webm",
      "audio/mp4",
      "audio/mpeg",
      "audio/ogg",
      "video/webm",
      "video/mp4",
      "video/ogg",
    ].filter((type) => MediaRecorder.isTypeSupported(type));

    const capabilities = stream
      ? stream.getTracks().map((track) => ({
          kind: track.kind,
          capabilities: track.getCapabilities?.(),
          settings: track.getSettings?.(),
          constraints: track.getConstraints?.(),
        }))
      : [];

    return {
      mediaDevices: {
        prototype: Object.getPrototypeOf(navigator.mediaDevices)?.constructor
          ?.name,
        props: mediaDevicesProps,
      },
      audio: {
        prototype: Object.getPrototypeOf(audio)?.constructor?.name,
        props: audioProps,
        events: audioEvents,
      },
      video: {
        prototype: Object.getPrototypeOf(video)?.constructor?.name,
        props: videoProps,
        events: videoEvents,
      },
      supportedMimeTypes,
      streamCapabilities: capabilities,
    };
  };

  const getVideoFingerprint = async () => {
    const screenHeight = screen.height;
    const screenWidth = screen.width;

    const video = document.createElement("video");

    // List of codecs to test
    const codecTests = [
      'video/webm; codecs="vp8, vorbis"',
      'video/webm; codecs="vp9"',
      'video/mp4; codecs="avc1.42E01E"',
      'video/mp4; codecs="hev1"',
      'video/ogg; codecs="theora"',
      'video/mp4; codecs="av01.0.05M.08"', // AV1 (modern)
    ];

    // Support results from canPlayType
    const canPlayResults = {};
    for (const codec of codecTests) {
      canPlayResults[codec] = video.canPlayType(codec);
    }

    // MediaCapabilities API test
    let decodingInfo = null;
    if (navigator.mediaCapabilities?.decodingInfo) {
      try {
        decodingInfo = await navigator.mediaCapabilities.decodingInfo({
          type: "file",
          video: {
            contentType: 'video/mp4; codecs="avc1.42E01E"',
            width: screenWidth,
            height: screenHeight,
            bitrate: 1200000,
            framerate: 30,
          },
        });
      } catch (e) {
        decodingInfo = { error: e.message };
      }
    }

    // Properties of the video element
    const videoProps = {
      autoplay: video.autoplay,
      controls: video.controls,
      loop: video.loop,
      muted: video.muted,
      defaultMuted: video.defaultMuted,
      playsInline: video.playsInline,
      preload: video.preload,
      volume: video.volume,
      readyState: video.readyState,
      networkState: video.networkState,
      width: video.width,
      height: video.height,
      videoWidth: video.videoWidth,
      videoHeight: video.videoHeight,
    };

    // Native checks
    const toStringNative = {
      canPlayType: Function.prototype.toString.call(video.canPlayType),
      constructor: Function.prototype.toString.call(
        HTMLVideoElement.prototype.constructor
      ),
      addTextTrack: Function.prototype.toString.call(video.addTextTrack),
    };

    const isNative = {
      canPlayType: toStringNative.canPlayType.includes("[native code]"),
      constructor: toStringNative.constructor.includes("[native code]"),
      addTextTrack: toStringNative.addTextTrack.includes("[native code]"),
    };

    // Track support and audio/video tracks (some bots forget to populate)
    const hasTracks = {
      textTracks:
        Array.isArray(video.textTracks) || video.textTracks.length >= 0,
      audioTracks: "audioTracks" in video,
      videoTracks: "videoTracks" in video,
    };

    return {
      screenWidth,
      screenHeight,
      canPlayTypeResults: canPlayResults,
      mediaCapabilitiesDecodingInfo: decodingInfo,
      videoProps,
      hasTracks,
      isNative,
      videoFingerprintToString: toStringNative,
    };
  };

  const getDateTimeValues = () => {
    const intlDateTimeOptions = Intl.DateTimeFormat().resolvedOptions();
    const intlNumberFormatOptions = Intl.NumberFormat().resolvedOptions();

    const now = new Date();

    const timezoneOffset = now.getTimezoneOffset(); // in minutes (e.g., -180 for UTC+3)
    const timezoneOffsetMs = timezoneOffset * 60 * 1000;

    const timezoneOffsetHours = Math.floor(Math.abs(timezoneOffset) / 60);
    const timezoneOffsetMinutes = Math.abs(timezoneOffset) % 60;

    const offsetSign = timezoneOffset <= 0 ? "+" : "-";

    // Example: "+03:00"
    const timezoneOffsetString = `${offsetSign}${timezoneOffsetHours
      .toString()
      .padStart(2, "0")}:${timezoneOffsetMinutes.toString().padStart(2, "0")}`;

    // Example: "+0300" (no colon), used in some date headers
    const compactOffset = `${offsetSign}${timezoneOffsetHours
      .toString()
      .padStart(2, "0")}${timezoneOffsetMinutes.toString().padStart(2, "0")}`;

    // Optional: UTC string with offset applied
    const utcDate = new Date(now.getTime() - timezoneOffsetMs);
    const localDateISO = new Date(now - timezoneOffsetMs).toISOString();

    const timezoneOffsetUtcString = `${timezoneOffsetHours
      .toString()
      .padStart(2, "0")}:${timezoneOffsetMinutes.toString().padStart(2, "0")}Z`;

    return {
      intlDateTimeOptions,
      intlNumberFormatOptions,
      timezoneOffset,
      timezoneOffsetString, // "+03:00"
      compactOffset, // "+0300"
      localDate: now.toString(),
      utcDate: utcDate.toUTCString(),
      localDateISO,
      timezoneOffsetUtcString,
    };
  };

  const getLanguages = () => {
    let languages = [...navigator.languages]; // copy the array to allow reordering safely

    const language = navigator.language;
    const languageLower = language.toLowerCase();

    const isFirstLangMatch = languages[0]?.toLowerCase() === languageLower;

    if (!isFirstLangMatch) {
      languages = [
        language,
        ...languages.filter((l) => l.toLowerCase() !== languageLower),
      ];
    }

    return {
      language,
      languages,
    };
  };

  const [
    canvasFP,
    audioFP,
    videoFP,
    mediaData,
    fontsData,
    permissions,
    webrtcCandidates,
    userAgentData,
    stoarge,
    batteryInfo,
    usbDevices,
    isBluetoothAvailable,
    audioAndVideoData,
  ] = await Promise.all([
    getCanvasFingerprint(),
    getAudioFingerprint(),
    getVideoFingerprint(),
    getRealMediaSupport(),
    collectRealFontData(),
    getRealPermissions(),
    collectWebRTCFingerprint(),
    getUserAgentData(),
    getStorgae(),
    getBattery(),
    getUsbDevices(),
    getBluetoothAvailability(),
    getAudioVideoData(),
  ]);

  const runtime = window.chrome?.runtime;
  const platformInfo = await runtime?.getPlatformInfo?.();
  const packageDirectoryEntry = await runtime?.getPackageDirectoryEntry?.();

  const chromeFunctionsValues = {
    platformInfo,
    packageDirectoryEntry: {
      isDirectory: packageDirectoryEntry?.isDirectory,
      isFile: packageDirectoryEntry?.isFile,
      name: packageDirectoryEntry?.name,
      fullPath: packageDirectoryEntry?.fullPath,
    },
  };

  const data = {
    hasResizeObserver: "ResizeObserver" in window,
    webDriver: navigator.webdriver,
    navigator: {
      ...getLanguages(),
      deviceMemory: navigator.deviceMemory,
      hardwareConcurrency: navigator.hardwareConcurrency || 4,
      maxTouchPoints: navigator.maxTouchPoints || 0,
      platform: navigator.platform,
      vendor: navigator.vendor,
      pdfViewerEnabled: navigator.pdfViewerEnabled,
      appName: navigator.appName,
      appVersion: navigator.appVersion,
      appCodeName: navigator.appCodeName,
      product: navigator.product,
      productSub: navigator.productSub,
      doNotTrack: navigator.doNotTrack,
      ...userAgentData,
    },
    userActivation: getValuesOfObject(navigator.userActivation),
    visualViewport: {
      width: window.visualViewport?.width,
      height: window.visualViewport?.height,
      scale: window.visualViewport?.scale ?? window.devicePixelRatio ?? 1,
      offsetLeft: window.visualViewport?.offsetLeft ?? 0,
      offsetTop: window.visualViewport?.offsetTop ?? 0,
      pageLeft: window.visualViewport?.pageLeft ?? 0,
      pageTop: window.visualViewport?.pageTop ?? 0,
    },
    window: {
      windowName: window.name,
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      outerWidth: window.outerWidth,
      outerHeight: window.outerHeight,
      devicePixelRatio: window.devicePixelRatio,
      scrollX: window.scrollX,
      scrollY: window.scrollY,
    },
    webstore: window.chrome.webstore,
    windowChrome: { ...window.chrome },
    chromeFunctionsValues,
    screen: {
      availWidth: screen.availWidth,
      availHeight: screen.availHeight,
      availTop: screen.availTop ?? 0,
      availLeft: screen.availLeft ?? 0,
      colorDepth: screen.colorDepth ?? 0,
      pixelDepth: screen.pixelDepth ?? 0,
      height: screen.height,
      width: screen.width,
    },
    documentElement: {
      clientWidth: document.documentElement.clientWidth ?? 0,
      clientHeight: document.documentElement.clientHeight ?? 0,
      scrollWidth: document.documentElement.scrollWidth ?? 0,
      scrollHeight: document.documentElement.scrollHeight ?? 0,
      offsetLeft: document.documentElement.offsetLeft ?? 0,
      offsetTop: document.documentElement.offsetTop ?? 0,
      scrollLeft: document.documentElement.scrollLeft ?? 0,
      scrollTop: document.documentElement.scrollTop ?? 0,
      offsetWidth: document.documentElement.offsetWidth ?? 0,
      offsetHeight: document.documentElement.offsetHeight ?? 0,
    },
    performanceMemory: {
      jsHeapSizeLimit: performance?.memory?.jsHeapSizeLimit,
      totalJSHeapSize: performance?.memory?.totalJSHeapSize,
      usedJSHeapSize: performance?.memory?.usedJSHeapSize,
    },
    visibility: {
      hidden: document.hidden,
      visibilityState: document.visibilityState,
    },
    touchSupport: {
      ontouchstart_in_Window: "ontouchstart" in window,
      ontouchend_in_Window: "ontouchend" in window,
      pointerEvent_in_Window: "PointerEvent" in window,
      touchEvent_in_Window: "TouchEvent" in window,
      deviceMotionEvent_in_Window: "DeviceMotionEvent" in window,
      maxTouchPoints: navigator.maxTouchPoints,
      pointerEnabled: navigator.pointerEnabled,
    },
    clipboard: {
      hasReadText: !!navigator.clipboard?.readText,
      hasWriteText: !!navigator.clipboard?.writeText,
    },
    math: {
      acos: Math.acos(0.123456789),
      sin: Math.sin(1),
      tan: Math.tan(-1),
      exp: Math.exp(1),
    },
    evalFunction: {
      typeofEval: typeof eval,
      typeofFunction: typeof Function,
    },
    chromeRuntime: !!window.chrome?.runtime,
    ...getPluginsAndMemiTypes(),
    connection: getConnection(),
    gamepads: getGamePads(),
    dateValues: getDateTimeValues(),
    ...mediaData,
    stoarge,
    permissions,
    webrtcCandidates,
    batteryInfo,
    usbDevices,
    isBluetoothAvailable,
    canvasFP,
    audioFP,
    videoFP,
    audioAndVideoData,
    fontsData,
    canvasSize: {
      width: 300,
      height: 150,
    },
    webglFP: getWebGLFingerprint(),
  };

  console.log("🧠 Complete Browser Fingerprint:", data);
})();

console.log(res);
