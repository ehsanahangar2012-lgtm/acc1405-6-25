/**
 * Builds a real Android APK through Capacitor + the Gradle Android project.
 * No APK, DEX file, or signature is fabricated by this script.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const rootDir = process.cwd();
const androidDir = path.join(rootDir, 'android');
const gradleWrapper = path.join(androidDir, process.platform === 'win32' ? 'gradlew.bat' : 'gradlew');
const packageJson = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
const appVersion = packageJson.version || '0.0.0';
const apkName = `AshkeGhalam-v${appVersion}.apk`;
const apkSource = path.join(androidDir, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');

function run(command, args, cwd = rootDir) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: 'inherit',
    shell: process.platform === 'win32'
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`Command failed: ${command} ${args.join(' ')} (exit ${result.status ?? 'unknown'})`);
  }
}

if (!fs.existsSync(path.join(rootDir, 'dist', 'index.html'))) {
  throw new Error('dist/index.html not found. Run the web build first (npm run build:web).');
}
if (!fs.existsSync(androidDir) || !fs.existsSync(gradleWrapper)) {
  throw new Error('The Android Gradle project or Gradle wrapper is missing.');
}

const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
run(npx, ['cap', 'sync', 'android']);

// Fail early if the Android bundle regresses to Tailwind v4 syntax that older WebViews ignore.
const androidPublicDir = path.join(androidDir, 'app', 'src', 'main', 'assets', 'public');
const bundledHtmlPath = path.join(androidPublicDir, 'index.html');
if (!fs.existsSync(bundledHtmlPath)) {
  throw new Error('Capacitor sync did not create android/app/src/main/assets/public/index.html.');
}
const bundledHtml = fs.readFileSync(bundledHtmlPath, 'utf8');
const cssRefs = [...bundledHtml.matchAll(/href="([^"]+\.css)"/g)].map(match => match[1]);
if (cssRefs.length === 0) {
  throw new Error('No compiled CSS stylesheet was linked from the Android WebView entry point.');
}
for (const cssRef of cssRefs) {
  const relativeCssPath = decodeURIComponent(cssRef).replace(/^\.\//, '').replace(/^\//, '');
  const cssPath = path.resolve(androidPublicDir, relativeCssPath);
  if (!cssPath.startsWith(path.resolve(androidPublicDir) + path.sep) || !fs.existsSync(cssPath)) {
    throw new Error(`Android stylesheet is missing: ${cssRef}`);
  }
  const cssText = fs.readFileSync(cssPath, 'utf8');
  const unsupported = [
    /@layer\s/i.test(cssText) && '@layer',
    /oklch\s*\(/i.test(cssText) && 'oklch()',
    /color-mix\s*\(/i.test(cssText) && 'color-mix()',
  ].filter(Boolean);
  if (unsupported.length > 0) {
    throw new Error(`Android CSS compatibility pass did not finish; unsupported syntax remains: ${unsupported.join(', ')}`);
  }
}

if (process.platform !== 'win32') {
  fs.chmodSync(gradleWrapper, 0o755);
}
run(gradleWrapper, ['assembleDebug', '--no-daemon'], androidDir);

if (!fs.existsSync(apkSource)) {
  throw new Error(`Gradle reported success but the APK was not found: ${apkSource}`);
}
const apkBuffer = fs.readFileSync(apkSource);
if (apkBuffer.length < 100_000 || apkBuffer.subarray(0, 2).toString() !== 'PK') {
  throw new Error('The Android build output does not look like a valid APK archive.');
}

const destinations = [
  rootDir,
  path.join(rootDir, 'downloads'),
  path.join(rootDir, 'public', 'downloads'),
  path.join(rootDir, 'dist', 'downloads'),
  path.join(rootDir, 'dist')
];
for (const directory of destinations) {
  fs.mkdirSync(directory, { recursive: true });
  fs.copyFileSync(apkSource, path.join(directory, apkName));
}

console.log(`Built real debug APK: ${apkName} (${(apkBuffer.length / 1024 / 1024).toFixed(2)} MB)`);
console.log('Note: this is a debug-signed build for installation/testing; configure a private release keystore for production distribution.');
