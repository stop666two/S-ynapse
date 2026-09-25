function compareFeatures(user, defaults) {
  const errors = [];
  const overrides = [];
  function walk(cfg, def, p) {
    if (cfg === null || typeof cfg !== 'object') {
      if (def === undefined) { errors.push(p + ' 仅存在于 features.json5（schema 缺失默认值）'); return; }
      if (JSON.stringify(cfg) !== JSON.stringify(def)) {
        overrides.push(p + ' 配置=' + JSON.stringify(cfg) + '（默认=' + JSON.stringify(def) + '）');
      }
      return;
    }
    if (Array.isArray(cfg)) {
      if (def !== undefined && !Array.isArray(def)) { errors.push(p + ' 类型不一致：配置为数组、默认非数组'); return; }
      if (Array.isArray(def) && def.length === 0) return;
      cfg.forEach((v, i) => walk(v, (def || [])[i], p + '[' + i + ']'));
      return;
    }
    for (const k of Object.keys(cfg)) {
      const d = def ? def[k] : undefined;
      if (d === undefined) { errors.push(p + '.' + k + ' 仅存在于 features.json5（schema 缺失默认值）'); continue; }
      walk(cfg[k], d, p + '.' + k);
    }
  }
  walk(user, defaults, 'features');
  return { errors, overrides };
}

module.exports = { compareFeatures };
