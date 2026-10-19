import fs from 'node:fs';
import path from 'node:path';

const FORBIDDEN_DIRECTORIES = new Set([
  'host-backend', 'data', 'db', 'host-data', 'signatures', 'uploads',
  'backups', 'daily-backups', 'invoices', 'vouchers', 'contracts', 'api'
]);

const BLOCKED_BUNDLE = /^(?:LicenseManager|DebugCenter|AppDownloadCenterModal|ReleaseManager|BuildRelease)-[A-Za-z0-9_-]+\.js$/i;
const BLOCKED_FILE = /(?:\.(?:php\d*|phtml|phar|sh|bash|bat|cmd|ps1|sql|sqlite|db|pfx|jks|pem|key|crt|cer))$/i;

function isForbiddenFile(name) {
  const lower = name.toLowerCase();
  return BLOCKED_FILE.test(name) ||
    lower === '.htaccess' ||
    lower === 'backups.htaccess' ||
    lower === 'daily-cron.php' ||
    lower === 'daily-backup.sh' ||
    lower === 'readme.txt' ||
    lower.startsWith('.env') ||
    lower.startsWith('build-android-apk.') ||
    BLOCKED_BUNDLE.test(name);
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
    }
  }
  return violations;
}

export function sanitizeClientBuild(targetDir = path.resolve('dist'), verifyOnly = false) {
  const root = path.resolve(targetDir);
  if (!fs.existsSync(path.join(root, 'index.html'))) {
    throw new Error(`Client output is missing index.html: ${root}`);
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
            if (fs.readdirSync(full).length === 0 && entry.name.toLowerCase() === 'downloads') {
              fs.rmSync(full, { recursive: true, force: true });
            }
          }
        } else if (isForbiddenFile(entry.name)) {
          fs.rmSync(full, { force: true });
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
    throw new Error(`Client build contains forbidden server/admin tooling: ${details}`);
  }
  console.log(`Client-build security gate passed for ${root}; no PHP/server/admin/release tools found.`);
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invokedPath === path.resolve(new URL(import.meta.url).pathname) ||
    invokedPath === path.resolve(decodeURIComponent(new URL(import.meta.url).pathname))) {
  const target = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'dist';
  sanitizeClientBuild(target, process.argv.includes('--verify-only'));
}
