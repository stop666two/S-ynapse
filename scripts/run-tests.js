require('./lib/process-guard.js');
const { readdirSync } = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const TEST_SUFFIX = '.test.js';
const FUZZ_SUFFIX = '.fuzz.test.js';

// 递归收集测试文件：默认收集 *.test.js 并排除 *.fuzz.test.js（随机套件由 --fuzz 单独运行，
// 避免慢速属性测试混入 npm test 门禁）；--fuzz 只收集 *.fuzz.test.js。
function collectFiles(dir, predicate, out) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      collectFiles(path.join(dir, entry.name), predicate, out);
    } else if (entry.isFile() && predicate(entry.name)) {
      out.push(path.join(dir, entry.name));
    }
  }
  return out;
}

function main() {
  const fuzzMode = process.argv.includes('--fuzz');
  const passthrough = process.argv.slice(2).filter((arg) => arg !== '--fuzz');
  const dir = __dirname;
  const files = collectFiles(dir, (name) => {
    if (!name.endsWith(TEST_SUFFIX)) return false;
    return fuzzMode ? name.endsWith(FUZZ_SUFFIX) : !name.endsWith(FUZZ_SUFFIX);
  }, []).sort();
  if (files.length === 0) {
    console.error(`[run-tests] no ${fuzzMode ? FUZZ_SUFFIX : TEST_SUFFIX} files found in ${dir}`);
    process.exitCode = 1;
    return;
  }
  const result = spawnSync(
    process.execPath,
    ['--test', ...passthrough, ...files],
    { stdio: 'inherit' }
  );
  if (result.error) {
    console.error(`[run-tests] failed to launch: ${result.error.message}`);
    process.exitCode = 1;
    return;
  }
  process.exitCode = result.status ?? 1;
}

main();
