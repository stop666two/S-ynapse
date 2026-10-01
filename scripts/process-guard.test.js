'use strict';

// 进程守卫行为测试：绝对生命周期、父进程死亡、环境未激活不干预、受控运行器超时与透传。
// 所有子进程都设置硬超时，若守卫失效测试会自行结束并报错，不会挂住测试运行器。

const test = require('node:test');
const assert = require('node:assert');
const { spawn } = require('node:child_process');
const path = require('node:path');

const GUARD = path.join(__dirname, 'lib', 'process-guard.js').replace(/\\/g, '/');
const SPAWNER = path.join(__dirname, 'spawn.js');

function runGuardedNode(code, envOverrides, timeoutMs = 20000) {
  return new Promise((resolve, reject) => {
    const env = { ...process.env };
    for (const key of ['SYNAPSE_GUARD', 'SYNAPSE_MAX_MS', 'SYNAPSE_PARENT_PID']) delete env[key];
    Object.assign(env, envOverrides);
    const child = spawn(process.execPath, ['--require', GUARD, '-e', code], { env, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { out += d; });
    const guardTimer = setTimeout(() => {
      try { child.kill('SIGKILL'); } catch { /* 忽略 */ }
      reject(new Error('测试自身超时：守卫未生效'));
    }, timeoutMs);
    guardTimer.unref();
    child.on('error', (err) => { clearTimeout(guardTimer); reject(err); });
    child.on('close', (code) => { clearTimeout(guardTimer); resolve({ code, out }); });
  });
}

function runSpawner(args, timeoutMs = 25000) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [SPAWNER, ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { out += d; });
    const guardTimer = setTimeout(() => {
      try { child.kill('SIGKILL'); } catch { /* 忽略 */ }
      reject(new Error('测试自身超时：spawn.js 未生效'));
    }, timeoutMs);
    guardTimer.unref();
    child.on('error', (err) => { clearTimeout(guardTimer); reject(err); });
    child.on('close', (code) => { clearTimeout(guardTimer); resolve({ code, out }); });
  });
}

test('绝对生命周期：到点清理并退出（code 87）', async () => {
  const started = Date.now();
  const { code, out } = await runGuardedNode('setInterval(function(){}, 1000);', {
    SYNAPSE_GUARD: '1',
    SYNAPSE_MAX_MS: '1200',
  });
  assert.strictEqual(code, 87);
  assert.ok(Date.now() - started < 15000, '应在超时后数秒内退出');
  assert.match(out, /最大生命周期/);
});

test('父进程死亡：随之清理并退出（code 86）', async () => {
  const deadPid = await new Promise((resolve) => {
    const c = spawn(process.execPath, ['-e', '0']);
    c.on('exit', () => resolve(c.pid));
  });
  const { code, out } = await runGuardedNode('setInterval(function(){}, 1000);', {
    SYNAPSE_GUARD: '1',
    SYNAPSE_MAX_MS: '0',
    SYNAPSE_PARENT_PID: String(deadPid),
  });
  assert.strictEqual(code, 86);
  assert.match(out, /父进程已退出/);
});

test('环境未激活：不干预正常退出', async () => {
  const { code } = await runGuardedNode('process.exit(3);', {});
  assert.strictEqual(code, 3);
});

test('受控运行器：超时清理子进程树并返回 124', async () => {
  const started = Date.now();
  const { code, out } = await runSpawner(['--max-ms', '1500', '--', process.execPath, '-e', 'setInterval(function(){}, 1000);']);
  assert.strictEqual(code, 124);
  assert.ok(Date.now() - started < 20000, '超时后应在数秒内返回');
  assert.match(out, /--max-ms=1500/);
});

test('受控运行器：正常透传退出码', async () => {
  const { code } = await runSpawner(['--', process.execPath, '-e', 'process.exit(5);']);
  assert.strictEqual(code, 5);
});
