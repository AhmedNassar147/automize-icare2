(function collectPluginMimeTypeInfo() {
  const result = {
    pluginArrayType: Object.prototype.toString.call(navigator.plugins),
    mimeTypeArrayType: Object.prototype.toString.call(navigator.mimeTypes),
    plugins: [],
    mimeTypes: [],
    pluginProps: [],
    mimeTypeProps: [],
    pluginPrototypeTag: Object.prototype.toString.call(
      Object.getPrototypeOf(navigator.plugins[0])
    ),
    mimeTypePrototypeTag: Object.prototype.toString.call(
      Object.getPrototypeOf(navigator.mimeTypes[0])
    ),
    pluginArrayHas: {
      item: typeof navigator.plugins.item,
      namedItem: typeof navigator.plugins.namedItem,
      refresh: typeof navigator.plugins.refresh,
    },
    mimeTypeArrayHas: {
      item: typeof navigator.mimeTypes.item,
      namedItem: typeof navigator.mimeTypes.namedItem,
    },
    pluginInstanceChecks: {
      isInstance: navigator.plugins[0] instanceof Plugin,
      hasRefresh: typeof navigator.plugins[0].refresh,
      hasItem: typeof navigator.plugins[0].item,
      hasNamedItem: typeof navigator.plugins[0].namedItem,
    },
    mimeTypeInstanceChecks: {
      isInstance: navigator.mimeTypes[0] instanceof MimeType,
      hasItem: typeof navigator.mimeTypes[0].item,
      hasNamedItem: typeof navigator.mimeTypes[0].namedItem,
    },
  };

  for (let i = 0; i < navigator.plugins.length; i++) {
    const p = navigator.plugins[i];
    result.plugins.push({
      name: p.name,
      filename: p.filename,
      description: p.description,
      length: p.length,
      types: Array.from(p).map((m) => m.type),
    });
  }

  for (let i = 0; i < navigator.mimeTypes.length; i++) {
    const m = navigator.mimeTypes[i];
    result.mimeTypes.push({
      type: m.type,
      description: m.description,
      suffixes: m.suffixes,
      enabledPluginName: m.enabledPlugin?.name,
      enabledPluginLength: m.enabledPlugin?.length,
    });
  }

  result.pluginProps = Object.getOwnPropertyNames(navigator.plugins);
  result.mimeTypeProps = Object.getOwnPropertyNames(navigator.mimeTypes);

  console.log("=== Plugin & MimeType Fingerprint ===");
  console.log(JSON.stringify(result, null, 2));
})();
