// npm run audit 转发器
// 背景：npm 12 在通过 `npm run` 执行脚本时会向子进程注入 npm_config_* 系列环境变量，
// 其中 npm_config_allow_scripts 会让嵌套的 `npm audit` 报 EALLOWSCRIPTS（"--allow-scripts is
// not allowed in project-scoped installs"）。因此这里先剥离全部 npm_config_* 再转发，
// 保证写法在各平台与 Node/npm 版本下都稳定可跑。
// 用途：本机镜像（如 npmmirror）会阻断 audit 接口，故固定官方 registry。
'use strict';

const { spawnSync } = require('node:child_process');

const env = Object.assign({}, process.env);
for (const key of Object.keys(env)) {
  if (/^npm_config_/i.test(key)) delete env[key];
}

const result = spawnSync('npm', ['audit', '--registry=https://registry.npmjs.org'], {
  stdio: 'inherit',
  env,
  shell: true
});

if (result.error) {
  console.error('[audit] 无法启动 npm audit：' + result.error.message);
  process.exit(1);
}
process.exit(result.status === null ? 1 : result.status);
