import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'src', 'styles.css');
const targetDir = path.join(root, 'dist');
const target = path.join(targetDir, 'styles.css');

fs.mkdirSync(targetDir, { recursive: true });
fs.copyFileSync(source, target);
console.log(`[tutor-ai] copied src/styles.css -> dist/styles.css`);
