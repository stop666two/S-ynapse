'use strict';
// 配置项计数（README/config-reference 声明的口径，canonical 实现）：
//   对象逐层展开；数组元素逐项计入且元素为对象时不再展开。
// 供 scripts/config-count.test.js 锁定文档计数与实际配置一致。
const fs = require('fs');
const path = require('path');
const json5 = require('json5');

function countLeaves(value) {
  if (Array.isArray(value)) {
    let n = 0;
    for (const item of value) {
      n += item !== null && typeof item === 'object' ? 1 : countLeaves(item);
    }
    return n;
  }
  if (value !== null && typeof value === 'object') {
    let n = 0;
    for (const key of Object.keys(value)) n += countLeaves(value[key]);
    return n;
  }
  return 1;
}

function readJson5(file) {
  let raw = fs.readFileSync(file, 'utf-8');
  if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
  return json5.parse(raw);
}

// 统计单个配置文件：topKeys（顶层键数）与 items（叶子计数）。
function countConfig(parsed) {
  return { topKeys: Object.keys(parsed).length, items: countLeaves(parsed) };
}

// 统计目录下给定文件集合：{ perFile: {name: {...}}, total }。
function countConfigFiles(rootDir, fileNames) {
  const perFile = {};
  let total = 0;
  for (const name of fileNames) {
    const stats = countConfig(readJson5(path.join(rootDir, name)));
    perFile[name] = stats;
    total += stats.items;
  }
  return { perFile, total };
}

// README 声明的 14 个配置文件（顺序无关，用于总量口径）。
const ALL_CONFIG_FILES = [
  'site.json5', 'theme.json5', 'navigation.json5', 'sidebar.json5', 'footer.json5',
  'security.json5', 'content-policy.json5', 'tag-aliases.json5', 'friends.json5',
  'features.json5', 'ui-strings.json5', 'tuning.json5', 'guard.json5', 'compression.json5'
];

module.exports = { countLeaves, countConfig, countConfigFiles, ALL_CONFIG_FILES, readJson5 };
