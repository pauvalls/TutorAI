import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const INSTALLER = path.join(ROOT, 'scripts', 'install-skills.mjs');
const UNINSTALLER = path.join(ROOT, 'scripts', 'uninstall-skills.mjs');
const PKG = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

function tempRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'tutorai-test-'));
}

/** Temp consumer root that looks like a git repository to the installer. */
function gitRoot() {
  const root = tempRoot();
  fs.mkdirSync(path.join(root, '.git'));
  return root;
}

function run(script, root, extra = {}) {
  return execFileSync(process.execPath, [script], {
    encoding: 'utf8',
    env: {
      ...process.env,
      INIT_CWD: root,
      npm_config_local_prefix: '',
      TUTOR_AI_SKIP_SKILLS: '',
      TUTOR_AI_SKILLS_FORCE: '',
      TUTOR_AI_SKILLS_DIR: '',
      TUTOR_AI_SKIP_GITIGNORE: '',
      ...extra,
    },
  });
}

const skillDirs = ['tutor-ai', 'tutor-ai-authoring'];

test('copies skills into both default destinations and writes a marker', () => {
  const root = tempRoot();
  const output = run(INSTALLER, root);
  for (const dir of ['.claude/skills', '.agents/skills']) {
    for (const skill of skillDirs) {
      assert.ok(
        fs.existsSync(path.join(root, dir, skill, 'SKILL.md')),
        `missing ${dir}/${skill}/SKILL.md`,
      );
    }
  }
  assert.ok(fs.existsSync(path.join(root, '.claude/skills/tutor-ai/references/api.md')));
  const marker = JSON.parse(fs.readFileSync(path.join(root, '.tutorai-skills.json'), 'utf8'));
  assert.equal(marker.version, PKG.version);
  assert.ok(marker.installed.length >= 4);
  assert.ok(marker.updatedAt);
  assert.match(output, /skills root:/);
  assert.match(output, /TUTOR_AI_SKIP_SKILLS=1/);
});

test('is idempotent and never overwrites by default', () => {
  const root = tempRoot();
  run(INSTALLER, root);
  const file = path.join(root, '.claude/skills/tutor-ai/SKILL.md');
  fs.writeFileSync(file, 'CUSTOM CONTENT\n');
  const output = run(INSTALLER, root);
  assert.equal(fs.readFileSync(file, 'utf8'), 'CUSTOM CONTENT\n');
  assert.match(output, /skipped \(already present\)/);
});

test('force overwrites existing skill files', () => {
  const root = tempRoot();
  run(INSTALLER, root);
  const file = path.join(root, '.agents/skills/tutor-ai/SKILL.md');
  fs.writeFileSync(file, 'OLD\n');
  run(INSTALLER, root, { TUTOR_AI_SKILLS_FORCE: '1' });
  assert.match(fs.readFileSync(file, 'utf8'), /name: tutor-ai/);
});

test('skip env installs nothing', () => {
  const root = tempRoot();
  const output = run(INSTALLER, root, { TUTOR_AI_SKIP_SKILLS: '1' });
  assert.match(output, /skipped/);
  assert.equal(fs.existsSync(path.join(root, '.claude')), false);
  assert.equal(fs.existsSync(path.join(root, '.tutorai-skills.json')), false);
});

test('honors TUTOR_AI_SKILLS_DIR for an extra destination', () => {
  const root = tempRoot();
  run(INSTALLER, root, { TUTOR_AI_SKILLS_DIR: 'custom/skills' });
  assert.ok(
    fs.existsSync(path.join(root, 'custom/skills/tutor-ai/SKILL.md')),
  );
  const marker = JSON.parse(fs.readFileSync(path.join(root, '.tutorai-skills.json'), 'utf8'));
  assert.ok(marker.installed.some((entry) => entry.startsWith('custom/skills/')));
});

test('uninstall removes only marker-listed files and deletes the marker', () => {
  const root = tempRoot();
  run(INSTALLER, root);
  const keep = path.join(root, '.claude/skills/tutor-ai/user-note.txt');
  fs.writeFileSync(keep, 'do not touch\n');
  const foreign = path.join(root, 'important.txt');
  fs.writeFileSync(foreign, 'safe\n');

  run(UNINSTALLER, root);
  assert.equal(fs.existsSync(path.join(root, '.claude/skills/tutor-ai/SKILL.md')), false);
  assert.equal(fs.existsSync(path.join(root, '.tutorai-skills.json')), false);
  assert.equal(fs.readFileSync(keep, 'utf8'), 'do not touch\n');
  assert.equal(fs.readFileSync(foreign, 'utf8'), 'safe\n');
});

const BLOCK_START = '# >>> tutor-ai generated skills >>>';
const BLOCK_END = '# <<< tutor-ai generated skills <<<';

function countOccurrences(haystack, needle) {
  return haystack.split(needle).length - 1;
}

test('writes a managed gitignore block once in a git consumer', () => {
  const root = gitRoot();
  const output = run(INSTALLER, root);
  const content = fs.readFileSync(path.join(root, '.gitignore'), 'utf8');
  assert.equal(countOccurrences(content, BLOCK_START), 1);
  assert.equal(countOccurrences(content, BLOCK_END), 1);
  for (const entry of [
    '.claude/skills/tutor-ai/',
    '.claude/skills/tutor-ai-authoring/',
    '.agents/skills/tutor-ai/',
    '.agents/skills/tutor-ai-authoring/',
    '.tutorai-skills.json',
  ]) {
    assert.ok(content.includes(entry), `missing gitignore entry ${entry}`);
  }
  assert.match(output, /gitignore: written/);
});

test('second install does not duplicate the gitignore block', () => {
  const root = gitRoot();
  run(INSTALLER, root);
  const first = fs.readFileSync(path.join(root, '.gitignore'), 'utf8');
  const output = run(INSTALLER, root);
  const second = fs.readFileSync(path.join(root, '.gitignore'), 'utf8');
  assert.equal(first, second);
  assert.equal(countOccurrences(second, BLOCK_START), 1);
  assert.equal(countOccurrences(second, BLOCK_END), 1);
  assert.match(output, /gitignore: unchanged/);
});

test('preserves existing gitignore content', () => {
  const root = gitRoot();
  const file = path.join(root, '.gitignore');
  fs.writeFileSync(file, '# deps\nnode_modules\ndist\n');
  run(INSTALLER, root);
  const content = fs.readFileSync(file, 'utf8');
  assert.ok(content.startsWith('# deps\nnode_modules\ndist\n'));
  assert.equal(countOccurrences(content, BLOCK_START), 1);
  assert.ok(content.endsWith(`${BLOCK_END}\n`));
});

test('updates the block in place when it changes', () => {
  const root = gitRoot();
  const file = path.join(root, '.gitignore');
  fs.writeFileSync(file, `dist\n${BLOCK_START}\nstale-entry/\n${BLOCK_END}\nbuild\n`);
  const output = run(INSTALLER, root);
  const content = fs.readFileSync(file, 'utf8');
  assert.equal(countOccurrences(content, BLOCK_START), 1);
  assert.ok(!content.includes('stale-entry/'));
  assert.ok(content.startsWith('dist\n'));
  assert.ok(content.endsWith(`${BLOCK_END}\nbuild\n`));
  assert.match(output, /gitignore: updated/);
});

test('TUTOR_AI_SKIP_GITIGNORE=1 installs skills but writes no block', () => {
  const root = gitRoot();
  const output = run(INSTALLER, root, { TUTOR_AI_SKIP_GITIGNORE: '1' });
  assert.ok(fs.existsSync(path.join(root, '.claude/skills/tutor-ai/SKILL.md')));
  assert.ok(fs.existsSync(path.join(root, '.tutorai-skills.json')));
  assert.equal(fs.existsSync(path.join(root, '.gitignore')), false);
  assert.match(output, /TUTOR_AI_SKIP_GITIGNORE/);
});

test('does not create .gitignore outside a git repository', () => {
  const root = tempRoot();
  run(INSTALLER, root);
  assert.ok(fs.existsSync(path.join(root, '.claude/skills/tutor-ai/SKILL.md')));
  assert.equal(fs.existsSync(path.join(root, '.gitignore')), false);
});

test('extra destination inside the root is ignored in the block', () => {
  const root = gitRoot();
  run(INSTALLER, root, { TUTOR_AI_SKILLS_DIR: 'custom/skills' });
  const content = fs.readFileSync(path.join(root, '.gitignore'), 'utf8');
  assert.ok(content.includes('custom/skills/tutor-ai/'));
  assert.ok(content.includes('custom/skills/tutor-ai-authoring/'));
});

test('uninstall removes the gitignore block and keeps other lines', () => {
  const root = gitRoot();
  const file = path.join(root, '.gitignore');
  fs.writeFileSync(file, '# deps\nnode_modules\n');
  run(INSTALLER, root);
  assert.equal(countOccurrences(fs.readFileSync(file, 'utf8'), BLOCK_START), 1);

  const output = run(UNINSTALLER, root);
  const content = fs.readFileSync(file, 'utf8');
  assert.equal(content, '# deps\nnode_modules\n');
  assert.equal(countOccurrences(content, BLOCK_START), 0);
  assert.equal(countOccurrences(content, BLOCK_END), 0);
  assert.match(output, /gitignore block: removed/);
});
