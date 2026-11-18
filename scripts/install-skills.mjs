import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = path.resolve(HERE, '..');
const PACKAGE_NAME = 'tutor-ai';
const MARKER_FILE = '.tutorai-skills.json';
const SKILLS_SOURCE = path.join(PACKAGE_ROOT, 'skills');

function readVersion() {
  try {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(PACKAGE_ROOT, 'package.json'), 'utf8'),
    );
    return String(pkg.version ?? '0.0.0');
  } catch {
    return '0.0.0';
  }
}

/** Walk up out of `<root>/node_modules/tutor-ai` when npm points us at the package. */
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

function destinationDirs(root) {
  const dirs = [
    path.join(root, '.claude', 'skills'),
    path.join(root, '.agents', 'skills'),
  ];
  const extra = process.env.TUTOR_AI_SKILLS_DIR;
  if (extra && extra.trim()) {
    dirs.push(path.isAbsolute(extra) ? path.resolve(extra) : path.join(root, extra));
  }
  return dirs;
}

function listShippedSkills() {
  try {
    return fs
      .readdirSync(SKILLS_SOURCE, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .filter((entry) =>
        fs.existsSync(path.join(SKILLS_SOURCE, entry.name, 'SKILL.md')),
      )
      .map((entry) => entry.name);
  } catch {
    return [];
  }
}

function relative(root, target) {
  return path.relative(root, target).split(path.sep).join('/');
}

function copyDirectory(source, destination, force, root, copied) {
  fs.mkdirSync(destination, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const from = path.join(source, entry.name);
    const to = path.join(destination, entry.name);
    if (entry.isDirectory()) {
      copyDirectory(from, to, force, root, copied);
    } else if (entry.isFile()) {
      if (!force && fs.existsSync(to)) continue;
      fs.mkdirSync(path.dirname(to), { recursive: true });
      fs.copyFileSync(from, to);
      copied.push(relative(root, to));
    }
  }
}

function main() {
  if (process.env.TUTOR_AI_SKIP_SKILLS === '1') {
    console.log('[tutor-ai] skills install skipped (TUTOR_AI_SKIP_SKILLS=1)');
    return;
  }

  const root = detectRoot();
  if (isOwnPackageRoot(root)) {
    console.log('[tutor-ai] self-install detected; no consumer skills to generate');
    return;
  }
  const force = process.env.TUTOR_AI_SKILLS_FORCE === '1';
  const skills = listShippedSkills();
  const installed = [];
  const skipped = [];
  const copied = [];

  for (const destination of destinationDirs(root)) {
    for (const skill of skills) {
      const target = path.join(destination, skill);
      if (
        !force &&
        fs.existsSync(path.join(target, 'SKILL.md'))
      ) {
        skipped.push(relative(root, target));
        continue;
      }
      copyDirectory(
        path.join(SKILLS_SOURCE, skill),
        target,
        force,
        root,
        copied,
      );
      installed.push(relative(root, target));
    }
  }

  const markerPath = path.join(root, MARKER_FILE);
  let previous = {};
  try {
    previous = JSON.parse(fs.readFileSync(markerPath, 'utf8'));
  } catch {
    previous = {};
  }
  const previousFiles = Array.isArray(previous.installed)
    ? previous.installed
    : [];
  fs.writeFileSync(
    markerPath,
    `${JSON.stringify(
      {
        version: readVersion(),
        installed: Array.from(new Set([...previousFiles, ...copied])),
        updatedAt: new Date().toISOString(),
      },
      null,
      2,
    )}\n`,
  );

  console.log(`[tutor-ai] skills root: ${root}`);
  console.log(
    `[tutor-ai] installed: ${installed.length ? installed.join(', ') : 'none'}`,
  );
  console.log(
    `[tutor-ai] skipped (already present): ${skipped.length ? skipped.join(', ') : 'none'}`,
  );
  console.log(`[tutor-ai] marker: ${MARKER_FILE}`);
  console.log(
    '[tutor-ai] disable with TUTOR_AI_SKIP_SKILLS=1; overwrite with TUTOR_AI_SKILLS_FORCE=1',
  );
}

try {
  main();
} catch (error) {
  console.warn(
    '[tutor-ai] could not install Agent Skills:',
    error instanceof Error ? error.message : String(error),
  );
}
process.exitCode = 0;
