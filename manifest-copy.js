import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import packageJson from './package.json' with { type: 'json' };

// Usage: node manifest-copy.js [firefox]
// Chrome only supports background.service_worker in manifest version 3,
// and Firefox only supports background.scripts.
const isFirefox = process.argv[2] === 'firefox';

const manifest = JSON.parse(readFileSync('src/manifest.json', 'utf8'));
manifest.version = packageJson.version;
if (isFirefox) {
  manifest.background = {
    scripts: [manifest.background.service_worker],
  };
}

mkdirSync('dist', { recursive: true });
cpSync('src/_locales', 'dist/_locales', { recursive: true });
writeFileSync('dist/manifest.json', `${JSON.stringify(manifest, null, 2)}\n`);
