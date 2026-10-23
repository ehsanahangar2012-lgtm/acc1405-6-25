/**
 * Build real Windows artifacts using electron-builder; never fabricate EXE files.
 * Outputs consistent names used by the download portal and a ZIP containing the
 * self-contained Portable EXE for users who prefer an archive.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import JSZip from 'jszip';

const rootDir = process.cwd();
const outputDir = path.join(rootDir, 'dist_electron');
const packageJson = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
const appVersion = String(packageJson.version || '0.0.0');
const isClientBuild = process.argv.includes('--client-build');
const destinations = [
  path.join(rootDir, 'downloads'),
  path.join(rootDir, 'public', 'downloads'),
  ...(isClientBuild ? [] : [path.join(rootDir, 'dist', 'downloads')])
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

// Fail closed before packaging if the Electron renderer still contains server/admin/release tools.
run(process.execPath, ['scripts/sanitize-client-build.js', path.join(rootDir, 'dist'), '--verify-only']);

fs.mkdirSync(outputDir, { recursive: true });
// Remove only old top-level deliverables; keep electron-builder's unpacked cache.
for (const name of fs.readdirSync(outputDir)) {
  if (name.toLowerCase().endsWith('.exe') ||
      /^ashkeghalam-windows-portable-v.*\.zip$/i.test(name)) {
    fs.rmSync(path.join(outputDir, name), { force: true });
  }
}

// Harden the packaged renderer bundle before electron-builder archives it.
run(process.execPath, ['scripts/obfuscate-release.js']);

const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
// Publishing a release remains a separate version-tag action, not an implicit builder side effect.
run(npx, ['electron-builder', '--win', ...targets, '--publish', 'never']);

const executables = fs.readdirSync(outputDir)
  .filter(name => name.toLowerCase().endsWith('.exe'))
  .map(name => path.join(outputDir, name));

if (executables.length === 0) {
  throw new Error('electron-builder completed without producing any .exe file.');
}

for (const requiredTarget of targets) {
  const expected = requiredTarget === 'nsis'
    ? `AshkeGhalam-Setup-v${appVersion}.exe`
    : `AshkeGhalam-Portable-v${appVersion}.exe`;
  if (!executables.some(file => path.basename(file) === expected)) {
    throw new Error(`electron-builder did not produce expected output: ${expected}`);
  }
}

const distributables = [...executables];
if (targets.includes('portable')) {
  const portableName = `AshkeGhalam-Portable-v${appVersion}.exe`;
  const portablePath = executables.find(file => path.basename(file) === portableName);
  if (!portablePath) throw new Error(`Portable EXE missing: ${portableName}`);

  const zip = new JSZip();
  zip.file(portableName, fs.readFileSync(portablePath));
  zip.file('README.txt',
    `AshkeGhalam ${appVersion} - Windows Portable\n\n` +
    'Extract this archive and run the Portable EXE.\n' +
    'The current Windows client uses Electron; the .NET/SQLite migration is a future roadmap item.\n'
  );
  const archive = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 }
  });
  const zipPath = path.join(outputDir, `AshkeGhalam-Windows-Portable-v${appVersion}.zip`);
  fs.writeFileSync(zipPath, archive);
  distributables.push(zipPath);
}

for (const directory of destinations) {
  fs.mkdirSync(directory, { recursive: true });
  for (const file of distributables) {
    fs.copyFileSync(file, path.join(directory, path.basename(file)));
  }
}

console.log(`Built ${executables.length} real Windows executable(s) and ${distributables.length - executables.length} archive(s) in ${outputDir}`);
for (const file of distributables) console.log(` - ${path.basename(file)}`);
