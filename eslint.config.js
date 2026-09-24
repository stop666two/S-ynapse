// ESLint 9 扁平配置（Flat Config）
// 用途：静态检查三层代码——js/（浏览器端模块）、scripts/（Node 构建与验证脚本）、workers/（Cloudflare Worker）。
// 运行：npm run lint；CI 在 .github/workflows/deploy.yml 的 build job 中作为质量门禁执行。
// 设计取舍：
//   - 仅启用 @eslint/js 推荐规则集；不引入风格类规则（缩进/引号等），避免与既有代码风格产生大规模格式噪音。
//   - 忽略构建产物与依赖目录，避免扫描体积膨胀与临时文件误报。
//   - 三层运行环境各自声明 globals，避免 window/require 等未定义变量误报。
const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
  // 全局忽略：
  //   dist/                    构建产物（由 scripts/build.js 生成，不参与检查）
  //   node_modules/            依赖目录
  //   .tmp-scripts/            临时调试脚本目录（本地使用，不入库）
  //   workers/security-config.js  构建期由 security.json5 生成的安全配置（不入库）
  {
    ignores: ['dist/**', 'node_modules/**', '.tmp-scripts/**', 'workers/security-config.js']
  },
  // 基础规则：@eslint/js core recommended（所有可检文件默认套用）
  js.configs.recommended,
  // 浏览器端模块（js/**/*.js）：ESM 语法 + 浏览器全局（window/document/localStorage/fetch 等）
  {
    files: ['js/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: Object.assign({}, globals.browser)
    }
  },
  // 构建与验证脚本（scripts/**/*.js）：CommonJS 语法 + Node 全局（require/module/process/__dirname 等）
  {
    files: ['scripts/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: Object.assign({}, globals.node)
    }
  },
  // Cloudflare Worker（workers/**/*.js 与 *.mjs）：ESM 语法，同时使用平台与浏览器风格全局（fetch/crypto/URL 等）
  {
    files: ['workers/**/*.js', 'workers/**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: Object.assign({}, globals.node, globals.browser)
    }
  }
];
