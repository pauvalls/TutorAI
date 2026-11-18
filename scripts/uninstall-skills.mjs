import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = path.resolve(HERE, '..');
const PACKAGE_NAME = 'tutor-ai';
const MARKER_FILE = '.tutorai-skills.json';
const GITIGNORE_FILE = '.gitignore';
const GITIGNORE_START = '# >>> tutor-ai generated skills >>>';
const GITIGNORE_END = '# <<< tutor-ai generated skills <<<';

function stripOwnPackage(input) {
  const parts = path.resolve(input).split(path.sep);
  for (let i = parts.length - 1; i >= 0; i -= 1) {
    if (parts[i] === 'node_modules' && parts[i + 1] === PACKAGE_NAME) {
      return parts.slice(0, i).join(path.sep) || path.sep;
    }
  }
  return path.resolve(input);
}

function isOwnPackageRoot(dir) {
  try {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(dir, 'package.json'), 'utf8'),
    );
    return pkg.name === PACKAGE_NAME;
  } catch {
    return false;
  }
}

function detectRoot() {
  const candidates = [
    process.env.INIT_CWD,
    process.env.npm_config_local_prefix,
    process.cwd(),
  ].filter((value) => typeof value === 'string' && value.trim().length > 0);
  for (const candidate of candidates) {
    const resolved = stripOwnPackage(candidate);
    if (isOwnPackageRoot(resolved)) continue;
    try {
      if (fs.statSync(resolved).isDirectory()) return resolved;
    } catch {
      /* try the next candidate */
    }
  }
  return process.cwd();
}

function allowedPrefixes(root) {
  const prefixes = [
    path.join(root, '.claude', 'skills') + path.sep,
    path.join(root, '.agents', 'skills') + path.sep,
  ];
  const extra = process.env.TUTOR_AI_SKILLS_DIR;
  if (extra && extra.trim()) {
    const dir = path.isAbsolute(extra)
      ? path.resolve(extra)
      : path.join(root, extra);
    prefixes.push(dir + path.sep);
  }
  return prefixes;
}

/**
 * Removes the managed block from `<root>/.gitignore`, leaving every other line
 * untouched. Best-effort: returns a status, never throws.
 */
function removeGitignoreBlock(root) {
  const file = path.join(root, GITIGNORE_FILE);
  let current;
  try {
    current = fs.readFileSync(file, 'utf8');
  } catch {
    return { status: 'absent' };
  }
  const startIndex = current.indexOf(GITIGNORE_START);
  const endIndex =
    startIndex === -1 ? -1 : current.indexOf(GITIGNORE_END, startIndex);
  if (startIndex === -1 || endIndex === -1) return { status: 'absent' };

  const lines = current.split('\n');
  const startLine = lines.findIndex((line) => line.trim() === GITIGNORE_START);
  const endLine = lines.findIndex(
    (line, index) => index > startLine && line.trim() === GITIGNORE_END,
  );
  if (startLine === -1 || endLine === -1) return { status: 'absent' };

  const before = lines.slice(0, startLine);
  const after = lines.slice(endLine + 1);
  // Drop the single blank separator the installer may have added before the block.
  if (after.length === 1 && after[0] === '' && before[before.length - 1] === '') {
    before.pop();
  }
  const next = [...before, ...after].join('\n');
  fs.writeFileSync(file, next);
  return { status: 'removed', file };
}

function main() {
  if (process.env.TUTOR_AI_SKIP_SKILLS === '1') {
    console.log('[tutor-ai] skills removal skipped (TUTOR_AI_SKIP_SKILLS=1)');
    return;
  }

  const root = detectRoot();
  if (isOwnPackageRoot(root)) {
    console.log('[tutor-ai] self-install detected; nothing to remove');
    return;
  }
  let gitignoreStatus = 'absent';
  try {
    const result = removeGitignoreBlock(root);
    gitignoreStatus = result.status;
    console.log(
      `[tutor-ai] gitignore block: ${result.status}${result.file ? ` (${result.file})` : ''}`,
    );
  } catch (error) {
    gitignoreStatus = 'failed (ignored)';
    console.warn(
      '[tutor-ai] could not update .gitignore:',
      error instanceof Error ? error.message : String(error),
    );
  }

  const markerPath = path.join(root, MARKER_FILE);
  let marker;
  try {
    marker = JSON.parse(fs.readFileSync(markerPath, 'utf8'));
  } catch {
    console.log(
      `[tutor-ai] no skills marker found; nothing else to remove (gitignore: ${gitignoreStatus})`,
    );
    return;
  }

  const files = Array.isArray(marker.installed) ? marker.installed : [];
  const prefixes = allowedPrefixes(root);
  let removed = 0;
  let refused = 0;

  for (const entry of files) {
    if (typeof entry !== 'string' || entry.includes('\u0000')) {
      refused += 1;
      continue;
    }
    const target = path.resolve(root, entry);
    const allowed = prefixes.some((prefix) => target.startsWith(prefix));
    if (!allowed || target === root) {
      refused += 1;
      continue;
    }
    try {
      fs.rmSync(target, { force: true });
      removed += 1;
      const parent = path.dirname(target);
      if (fs.existsSync(parent) && fs.readdirSync(parent).length === 0) {
        fs.rmdirSync(parent);
      }
    } catch {
      refused += 1;
    }
  }

  fs.rmSync(markerPath, { force: true });
  console.log(`[tutor-ai] removed ${removed} skill file(s) from ${root}`);
  if (refused) console.log(`[tutor-ai] skipped ${refused} unsafe/missing path(s)`);
  console.log(`[tutor-ai] deleted ${MARKER_FILE}`);
}

try {
  main();
} catch (error) {
  console.warn(
    '[tutor-ai] could not remove Agent Skills:',
    error instanceof Error ? error.message : String(error),
  );
}
process.exitCode = 0;
