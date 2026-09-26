const { readdirSync } = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const TEST_SUFFIX = '.test.js';

function collectTestFiles(dir) {
  return readdirSync(dir, { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.endsWith(TEST_SUFFIX))
    .map(entry => path.join(dir, entry.name))
    .sort();
}

function main() {
  const dir = __dirname;
  const files = collectTestFiles(dir);
  if (files.length === 0) {
    console.error(`[run-tests] no ${TEST_SUFFIX} files found in ${dir}`);
    process.exitCode = 1;
    return;
  }
  const result = spawnSync(
    process.execPath,
    ['--test', ...process.argv.slice(2), ...files],
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
