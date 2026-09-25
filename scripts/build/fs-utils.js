'use strict';
// 共享文件系统工具（自 scripts/build.js 机械拆分）。
const fs = require('fs');
const path = require('path');

// Recursive file listing — returns absolute paths of all files under a directory.
function getAllFiles(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...getAllFiles(full));
    else results.push(full);
  }
  return results;
}

module.exports = { getAllFiles };
