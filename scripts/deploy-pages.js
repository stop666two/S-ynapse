#!/usr/bin/env node
'use strict';

// Cloudflare Pages 部署（npm run deploy:pages）：
//   项目名与产物目录来自 internals.deploy（pagesProject / workerAssetsDir），与
//   workers/wrangler.toml 的 [assets] directory 及构建输出目录保持单源一致；
//   verifyOnDeploy=true 时先运行 verify:internals 守卫，目录漂移即中止部署。
// 通过本地安装的 wrangler CLI 执行（官方推荐通路；不依赖平台 UI 的图形操作子集）。

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { loadInternals } = require('./lib/internals');

const ROOT = path.resolve(__dirname, '..');
const internals = loadInternals();
const deploy = internals.deploy;

function run(command, args) {
  return spawnSync(command, args, { cwd: ROOT, stdio: 'inherit' });
}

if (deploy.verifyOnDeploy) {
  const guard = run(process.execPath, [path.join(ROOT, 'scripts', 'check-internals.js')]);
  if (guard.status !== 0) {
    console.error('[deploy:pages] verify:internals 未通过：已中止部署（目录/版本漂移必须先修复）');
    process.exit(guard.status || 1);
  }
}

const wranglerCli = [
  path.join(ROOT, 'node_modules', 'wrangler', 'bin', 'wrangler.js'),
  path.join(ROOT, 'node_modules', 'wrangler', 'wrangler.js')
].find((file) => fs.existsSync(file));
if (!wranglerCli) {
  console.error('[deploy:pages] 未找到本地 wrangler；请先 npm install（devDependencies.wrangler）');
  process.exit(1);
}

const outputDir = path.resolve(ROOT, deploy.workerAssetsDir);
if (!fs.existsSync(outputDir)) {
  console.error('[deploy:pages] 产物目录不存在：' + outputDir + '；请先 npm run build');
  process.exit(1);
}

const result = run(process.execPath, [
  wranglerCli,
  'pages', 'deploy', deploy.workerAssetsDir,
  '--project-name=' + deploy.pagesProject
]);
process.exit(result.status === null ? 1 : result.status);
