'use strict';
// 无头浏览器 JS 覆盖率的门禁阈值（独立常量文件：这是测试工具配置，不进入站点功能配置 tuning.json5）。
// 口径：只统计构建产物 /assets/js/** 映射回 js/** 的脚本（vendor、内联脚本、config.*.json 不计）；
// 行覆盖分母为非空白行；函数覆盖以 CDP 精确覆盖的 functions[].ranges[0] 区间为单位。
// 初始阈值策略：首次实测后取「向下取整到 5 的倍数且不高于实测 - 3%」，下限 50。
// 首测（2026-10-01）：行 57.8%（阈值 55）、函数 57.1%（阈值 55）；
// 推导：min(57.8, 56.07)→floor5=55；min(57.1, 55.39)→floor5=55。详见 docs/plans/2026-09-29-test-expansion.md。
module.exports = {
  LINES_PCT: 55,
  FUNCTIONS_PCT: 55,
  FLOOR_PCT: 50
};
