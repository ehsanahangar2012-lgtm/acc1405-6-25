/**
 * Builds real Windows artifacts with electron-builder.
 * This script intentionally never fabricates executable-looking files.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const rootDir = process.cwd();
const outputDir = path.join(rootDir, 'dist_electron');
const destinations = [
  path.join(rootDir, 'downloads'),
  path.join(rootDir, 'public', 'downloads'),
  path.join(rootDir, 'dist', 'downloads')
];

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: rootDir,
    stdio: 'inherit',
    shell: process.platform === 'win32'
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`Command failed: ${command} ${args.join(' ')} (exit ${result.status ?? 'unknown'})`);
  }
}

const target = (process.argv[2] || 'all').toLowerCase();
const targetsByName = {
  all: ['nsis', 'portable'],
  nsis: ['nsis'],
  installer: ['nsis'],
  portable: ['portable'],
  exe: ['portable']
};
const targets = targetsByName[target];
if (!targets) {
  console.error('Usage: node scripts/build-windows.js [all|nsis|portable]');
  process.exit(2);
}

if (!fs.existsSync(path.join(rootDir, 'dist', 'index.html'))) {
  throw new Error('dist/index.html not found. Run the web build first (npm run build:web).');
}

fs.mkdirSync(outputDir, { recursive: true });

// Harden the packaged renderer bundle before electron-builder archives it.
run(process.execPath, ['scripts/obfuscate-release.js']);

const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
// Disable electron-builder's implicit CI publishing. This workflow only builds artifacts;
// publishing GitHub releases is a separate, explicit operation requiring a release token.
run(npx, ['electron-builder', '--win', ...targets, '--publish', 'never']);

const executables = fs.readdirSync(outputDir)
  .filter(name => name.toLowerCase().endsWith('.exe'))
  .map(name => path.join(outputDir, name));

if (executables.length === 0) {
  throw new Error('electron-builder completed without producing any .exe file.');
}

for (const directory of destinations) {
  fs.mkdirSync(directory, { recursive: true });
  for (const executable of executables) {
    fs.copyFileSync(executable, path.join(directory, path.basename(executable)));
  }
}

console.log(`Built ${executables.length} real Windows executable(s) in ${outputDir}`);
for (const executable of executables) console.log(` - ${path.basename(executable)}`);
