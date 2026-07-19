#!/usr/bin/env node
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
try {
  execSync('git config core.hooksPath .githooks', { cwd: ROOT, stdio: 'pipe' });
  console.log('[OK] Git hooks configured: .githooks/');
} catch {
  console.warn('[WARN] Could not set git hooks path. Is this a git repo?');
}
const gitignorePath = path.join(ROOT, '.gitignore');
if (fs.existsSync(gitignorePath)) {
  const content = fs.readFileSync(gitignorePath, 'utf-8');
  const required = ['node_modules/', 'dist/', '.env', 'AGENTS.md', 'AGENTS.txt', 'AGENT.md', 'AGENT.txt', 'agent-readme.md', 'RULES.md'];
  let needsUpdate = false;
  for (const line of required) {
    if (!content.includes(line)) {
      fs.appendFileSync(gitignorePath, '\n' + line, 'utf-8');
      console.log(`[OK] Added "${line}" to .gitignore`);
      needsUpdate = true;
    }
  }
  if (!needsUpdate) console.log('[OK] .gitignore already up to date');
} else {
  console.warn('[WARN] .gitignore not found');
}
const gitattributesPath = path.join(ROOT, '.gitattributes');
if (!fs.existsSync(gitattributesPath)) {
  fs.writeFileSync(gitattributesPath, '# Auto detect text files and perform LF normalization\n* text=auto\n', 'utf-8');
  console.log('[OK] Created .gitattributes');
}
console.log('\nProject initialization complete.');
