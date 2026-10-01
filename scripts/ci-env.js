#!/usr/bin/env node
'use strict';

// CI 环境导出（GHA 步骤内运行；本地直接运行仅打印）。
// 把 internals.json5 的关键值写入 $GITHUB_ENV，供后续步骤以环境变量消费，
// 避免在 workflow 中重复写死 Node 版本/输出目录/项目名。

const fs = require('fs');
const path = require('path');
const { loadInternals } = require('./lib/internals');

const ROOT = path.resolve(__dirname, '..');
const internals = loadInternals();

const entries = {
  SYNAPSE_OUT_DIR: path.resolve(ROOT, internals.deploy.workerAssetsDir),
  SYNAPSE_CACHE_DIR: path.resolve(ROOT, internals.paths.cacheDir),
  SYNAPSE_ARTIFACTS_DIR: path.resolve(ROOT, internals.paths.artifactsDir),
  PAGES_PROJECT: internals.deploy.pagesProject,
  NODE_VERSION: internals.ci.nodeVersion,
  COMPAT_NODE_VERSION: internals.ci.compatNodeVersion,
  CI_AGGREGATE: internals.ci.aggregate ? '1' : '0'
};

const lines = Object.keys(entries).map((key) => key + '=' + entries[key]).join('\n') + '\n';
const envFile = process.env.GITHUB_ENV;
if (envFile) {
  fs.appendFileSync(envFile, lines, 'utf-8');
  console.log('[ci-env] 已写入 $GITHUB_ENV：\n' + lines);
} else {
  console.log('[ci-env] 未检测到 $GITHUB_ENV（本地运行），导出值：\n' + lines);
}
