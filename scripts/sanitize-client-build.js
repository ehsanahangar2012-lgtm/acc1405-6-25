import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FORBIDDEN_DIRECTORIES = new Set([
  'host-backend', 'data', 'db', 'host-data', 'signatures', 'uploads',
  'backups', 'daily-backups', 'invoices', 'vouchers', 'contracts', 'api', 'downloads'
]);

const BLOCKED_BUNDLE = /^(?:LicenseManager|DebugCenter|AppDownloadCenterModal|ReleaseManager|BuildRelease)-[A-Za-z0-9_-]+\.js$/i;
const BLOCKED_FILE = /\.(?:php\d*|phtml|phar|sh|bash|bat|cmd|ps1|sql|sqlite|db|pfx|jks|pem|key|crt|cer|exe|zip|msi|dmg|deb|rpm)$/i;
const BLOCKED_MANIFEST_KEY = /^(?:windowsInstallerUrl|windowsPortableUrl|hostPackageUrl|portableUrl|installerUrl|exeUrl|msiUrl|releaseAssets|artifactUrl)$/i;
const BLOCKED_BINARY_URL = /\.(?:exe|zip|msi|dmg|deb|rpm)(?:[?#].*)?$/i;

function isForbiddenFile(name) {
  const lower = name.toLowerCase();
  return BLOCKED_FILE.test(name) ||
    lower === '.htaccess' ||
    lower === 'backups.htaccess' ||
    lower === 'readme.txt' ||
    lower.startsWith('.env') ||
    lower.startsWith('build-android-apk.') ||
    BLOCKED_BUNDLE.test(name);
}

function scrubVersionManifest(filename) {
  let parsed;
  try { parsed = JSON.parse(fs.readFileSync(filename, 'utf8')); } catch { return; }
  const visit = (value) => {
    if (!value || typeof value !== 'object') return;
    for (const key of Object.keys(value)) {
      const child = value[key];
      if (BLOCKED_MANIFEST_KEY.test(key) ||
          (typeof child === 'string' && /(?:url|download|package|artifact)/i.test(key) && BLOCKED_BINARY_URL.test(child))) {
        delete value[key];
      } else {
        visit(child);
      }
    }
  };
  visit(parsed);
  fs.writeFileSync(filename, JSON.stringify(parsed, null, 2) + '\n', 'utf8');
}

function collectViolations(dir, relative = '') {
  const violations = [];
  if (!fs.existsSync(dir)) return [relative || dir];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    const rel = path.posix.join(relative, entry.name);
    if (entry.isSymbolicLink()) {
      violations.push(rel + ' (symlink)');
    } else if (entry.isDirectory()) {
      if (FORBIDDEN_DIRECTORIES.has(entry.name.toLowerCase())) violations.push(rel + '/');
      else violations.push(...collectViolations(full, rel));
    } else if (isForbiddenFile(entry.name)) {
      violations.push(rel);
    } else if (entry.name.toLowerCase() === 'version.json') {
      let data;
      try { data = JSON.parse(fs.readFileSync(full, 'utf8')); } catch {}
      const inspect = (value, at = rel) => {
        const errors = [];
        if (!value || typeof value !== 'object') return errors;
        for (const [key, child] of Object.entries(value)) {
          if (BLOCKED_MANIFEST_KEY.test(key) ||
              (typeof child === 'string' && /(?:url|download|package|artifact)/i.test(key) && BLOCKED_BINARY_URL.test(child))) {
            errors.push(at + '.' + key);
          } else errors.push(...inspect(child, at + '.' + key));
        }
        return errors;
      };
      if (data) violations.push(...inspect(data));
      else violations.push(rel + ' (invalid JSON)');
    }
  }
  return violations;
}

export function sanitizeClientBuild(targetDir = path.resolve('dist'), verifyOnly = false) {
  const root = path.resolve(targetDir);
  if (!fs.existsSync(path.join(root, 'index.html'))) {
    throw new Error('Client output is missing index.html: ' + root);
  }

  if (!verifyOnly) {
    const clean = (dir) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isSymbolicLink()) {
          fs.rmSync(full, { force: true });
        } else if (entry.isDirectory()) {
          if (FORBIDDEN_DIRECTORIES.has(entry.name.toLowerCase())) {
            fs.rmSync(full, { recursive: true, force: true });
          } else {
            clean(full);
          }
        } else if (isForbiddenFile(entry.name)) {
          fs.rmSync(full, { force: true });
        } else if (entry.name.toLowerCase() === 'version.json') {
          scrubVersionManifest(full);
        }
      }
    };
    clean(root);
    fs.writeFileSync(path.join(root, 'client-build-info.json'), JSON.stringify({
      product: 'AshkeGhalam',
      edition: 'native-client',
      serverAdminTools: false,
      licenseIssuance: false
    }, null, 2) + '\n', 'utf8');
    fs.writeFileSync(path.join(root, 'README-CLIENT.txt'),
      'AshkeGhalam client package. License issuance, tenant administration, and release/build tools are available only in the mother web portal.\n',
      'utf8');
  }

  const violations = collectViolations(root);
  let marker = null;
  try { marker = JSON.parse(fs.readFileSync(path.join(root, 'client-build-info.json'), 'utf8')); } catch {}
  if (violations.length || marker?.edition !== 'native-client' || marker?.serverAdminTools !== false || marker?.licenseIssuance !== false) {
    const details = violations.length ? violations.join(', ') : 'client-build-info.json is missing or invalid';
    throw new Error('Client build contains forbidden server/admin tooling: ' + details);
  }
  console.log('Client-build security gate passed for ' + root + '; no PHP/server/admin/release tools found.');
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invokedPath === path.resolve(fileURLToPath(import.meta.url))) {
  const target = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'dist';
  sanitizeClientBuild(target, process.argv.includes('--verify-only'));
}
