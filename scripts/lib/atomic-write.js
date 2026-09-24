'use strict';

// 原子文件写入（构建产物抗中断）：
//   - 先写同目录临时文件（最终路径 + .tmp-<pid>-<seq>），成功后再 rename 覆盖目标；
//   - rename 在 POSIX 上原子，在 Windows 同卷内亦为原子替换；杀毒软件/资源管理器占用
//     可能造成 EPERM/EBUSY → 短暂退避后重试一次，仍失败则抛出（调用方可感知）；
//   - 失败时保证不留 .tmp- 残留，目标文件保持旧内容（要么旧、要么新，不产生半截文件）。
const fs = require('fs');

let seq = 0;

function atomicTempPath(filePath) {
  seq += 1;
  return filePath + '.tmp-' + process.pid + '-' + seq;
}

function sleepSync(ms) {
  // 同步退避：Atomics.wait 阻塞当前线程 ms 毫秒，避免忙等占用 CPU
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function renameWithRetry(from, to) {
  try {
    fs.renameSync(from, to);
  } catch (err) {
    const code = err && err.code;
    if (code === 'EPERM' || code === 'EBUSY' || code === 'EACCES') {
      sleepSync(60);
      fs.renameSync(from, to);
      return;
    }
    throw err;
  }
}

function commitAtomicTemp(tmpPath, filePath) {
  try {
    renameWithRetry(tmpPath, filePath);
  } catch (err) {
    try {
      fs.rmSync(tmpPath, { force: true });
    } catch (cleanupErr) {
      // 忽略：临时文件清理失败不影响本次错误上报，残留文件不影响产物正确性
    }
    throw err;
  }
}

function discardAtomicTemp(tmpPath) {
  try {
    fs.rmSync(tmpPath, { force: true });
  } catch (cleanupErr) {
    // 忽略：临时文件清理失败不影响产物正确性
  }
}

function writeFileAtomicSync(filePath, data) {
  const tmpPath = atomicTempPath(filePath);
  fs.writeFileSync(tmpPath, data);
  commitAtomicTemp(tmpPath, filePath);
}

module.exports = { writeFileAtomicSync, atomicTempPath, commitAtomicTemp, discardAtomicTemp };
