#!/usr/bin/env node
'use strict';

// 矩阵文档生成器：把配置开关盘点结果写入 docs/config-switch-matrix.md。
// 消费方：scripts/check-config-single-source.js 校验文档与生成结果一致（禁止手改）。
const fs = require('fs');
const path = require('path');
const { buildMatrix, ROOT } = require('./lib/config-switch-inventory.js');

const target = path.join(ROOT, 'docs', 'config-switch-matrix.md');
const text = buildMatrix();
fs.writeFileSync(target, text, 'utf-8');
console.log('[gen:config-matrix] 已写入 ' + path.relative(ROOT, target).split(path.sep).join('/'));
