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

function tempRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'tutorai-test-'));
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
  assert.equal(marker.version, '0.1.0');
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
