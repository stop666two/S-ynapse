'use strict';

// scripts/lib/tracked-files.js 的回归测试（副作用）：
// 多个「删除键/模块无残留引用」用例曾直接遍历工作树，于是本地任何未跟踪但被
// gitignore 的仓库副本（如 backups/ 下的旧快照）都会被当成源文件命中，
// 造成「CI 绿、本地恒红」的假失败。本文件锁定两条不变量：
//   1. 有 git 时只返回跟踪文件（未跟踪副本不得进入清单）；
//   2. 无 git 时（发布归档解压后）回退遍历仍然可用，且跳过构建产物目录。
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { listSourceFiles, SKIP_DIRS } = require('./lib/tracked-files.js');

const ROOT = path.resolve(__dirname, '..');

function gitAvailable(root) {
  const r = spawnSync('git', ['rev-parse', '--is-inside-work-tree'], { cwd: root, encoding: 'utf-8' });
  return r.status === 0 && String(r.stdout).trim() === 'true';
}

test('listSourceFiles：有 git 时只返回跟踪文件，未跟踪副本不得进入清单', (t) => {
  if (!gitAvailable(ROOT)) {
    t.skip('无 git 环境（发布归档）：本用例只验证跟踪文件口径');
    return;
  }
  const files = listSourceFiles(ROOT, /\.js$/);
  assert.ok(files.length > 100, '应返回足量源文件，实际 ' + files.length);
  assert.ok(
    !files.some((f) => f.split(path.sep).includes('backups')),
    '未跟踪的 backups/ 副本不得出现在源码清单里'
  );
  assert.ok(
    !files.some((f) => f.split(path.sep).includes('node_modules')),
    'node_modules 不得出现在源码清单里'
  );
  const trackedOut = spawnSync('git', ['ls-files', '-z'], { cwd: ROOT, encoding: 'utf-8', maxBuffer: 64 * 1024 * 1024 });
  const tracked = new Set(
    String(trackedOut.stdout || '').split('\0').filter(Boolean).map((p) => p.split('/').join(path.sep))
  );
  const untracked = files.filter((f) => !tracked.has(path.relative(ROOT, f))).map((f) => path.relative(ROOT, f));
  assert.deepStrictEqual(untracked, [], '清单里的每个文件都必须是 git 跟踪文件');
});

test('listSourceFiles：无 git 时回退遍历，并跳过已知产物目录', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 's-ynapse-tracked-'));
  try {
    fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'node_modules', 'x'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'dist'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'src', 'a.js'), '// a\n');
    fs.writeFileSync(path.join(dir, 'src', 'b.ejs'), '<div></div>\n');
    fs.writeFileSync(path.join(dir, 'node_modules', 'x', 'index.js'), '// dep\n');
    fs.writeFileSync(path.join(dir, 'dist', 'bundle.js'), '// built\n');

    const js = listSourceFiles(dir, /\.js$/).map((f) => path.relative(dir, f).split(path.sep).join('/')).sort();
    assert.deepStrictEqual(js, ['src/a.js'], '只应返回源目录下的 js，且跳过 node_modules/dist');
    const all = listSourceFiles(dir).map((f) => path.relative(dir, f).split(path.sep).join('/')).sort();
    assert.deepStrictEqual(all, ['src/a.js', 'src/b.ejs']);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  assert.ok(SKIP_DIRS.includes('node_modules') && SKIP_DIRS.includes('dist'));
});
