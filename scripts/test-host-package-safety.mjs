import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const backend = path.join(root, 'host-backend');
const dist = path.join(root, 'dist');
const fixtures = [
  path.join(backend, 'data', '__ci-private-registry-fixture.json'),
  path.join(backend, '.env.ci-private-fixture'),
  path.join(backend, 'host-data', '__ci-customer-fixture.json'),
  path.join(backend, '__ci-private-db-fixture.sqlite')
];
const createdDirs = [];
const runtimeDirs = [
  'data', 'db', 'host-data', 'signatures', 'uploads', 'invoices',
  'vouchers', 'contracts', 'backups', 'daily-backups', 'api'
];
const privateFilename = (name) => {
  const lower = name.toLowerCase();
  if (lower === '.env.example') return false;
  return /^\.env(?:$|\.)/i.test(name) ||
    /(?:^|[_.-])(?:workspaces_auth|api_rate_limits)(?:[_.-]|$)/i.test(name) ||
    /\.(?:sqlite(?:3)?|db|pem|key|p12|pfx|jks|log|bak)$/i.test(lower);
};
const findings = [];
const expectAbsent = (filePath) => {
  if (fs.existsSync(filePath)) findings.push(`private fixture leaked: ${path.relative(root, filePath)}`);
};
const scanDist = (dir, relative = '') => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    const rel = relative ? `${relative}/${entry.name}` : entry.name;
    if (entry.isDirectory()) scanDist(full, rel);
    else if (entry.isFile() && privateFilename(entry.name)) {
      findings.push(`private filename in dist: ${rel}`);
    }
  }
};

try {
  if (!fs.existsSync(path.join(dist, 'index.html'))) {
    throw new Error('Run the web build first; dist/index.html is missing.');
  }
  if (fixtures.some((file) => fs.existsSync(file))) {
    throw new Error('A reserved CI fixture filename already exists; refusing to overwrite source data.');
  }

  for (const dir of [
    path.join(backend, 'data'),
    path.join(backend, 'host-data')
  ]) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      createdDirs.push(dir);
    }
  }
  const contents = [
    '{"admin_secret_key":"CI-ONLY-NOT-A-REAL-SECRET","license_signing_private_key":"CI-ONLY"}',
    'CI_ONLY_FAKE_ENV=value',
    '{"customer":"CI_ONLY_FAKE_CUSTOMER_DATA"}',
    'CI_ONLY_NOT_A_DATABASE'
  ];
  fixtures.forEach((file, index) => fs.writeFileSync(file, contents[index], { flag: 'wx' }));

  const build = spawnSync(process.execPath, ['prepare-dist.js'], {
    cwd: root,
    encoding: 'utf8',
    timeout: 120000
  });
  if (build.stdout) process.stdout.write(build.stdout);
  if (build.stderr) process.stderr.write(build.stderr);
  if (build.error) throw build.error;
  if (build.status !== 0) throw new Error(`prepare-dist.js failed with status ${build.status}`);

  for (const fixture of fixtures) {
    const relative = path.relative(backend, fixture);
    const firstSegment = relative.split(path.sep)[0];
    let output;
    if (relative === '.env.ci-private-fixture') output = path.join(dist, relative);
    else if (firstSegment === 'data') output = path.join(dist, 'data', path.basename(fixture));
    else if (firstSegment === 'host-data') output = path.join(dist, 'host-data', path.basename(fixture));
    else output = path.join(dist, path.basename(fixture));
    expectAbsent(output);
  }

  if (!fs.existsSync(path.join(dist, 'data', '.htaccess'))) {
    findings.push('dist/data/.htaccess deny-rules file is missing');
  }
  scanDist(dist);

  for (const runtimeDir of runtimeDirs) {
    const outputDir = path.join(dist, runtimeDir);
    if (!fs.existsSync(outputDir)) continue;
    const walkRuntime = (dir) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walkRuntime(full);
        else if (entry.isFile() && !['index.html', '.htaccess'].includes(entry.name)) {
          findings.push(`unexpected runtime payload in dist/${runtimeDir}: ${path.relative(outputDir, full)}`);
        }
      }
    };
    walkRuntime(outputDir);
  }

  if (findings.length) {
    throw new Error('Host package safety validation failed:\n- ' + findings.join('\n- '));
  }
  console.log('PASS: host package excludes private registry, environment files, databases and runtime customer payloads.');
} finally {
  for (const fixture of fixtures) {
    try { fs.rmSync(fixture, { force: true }); } catch {}
  }
  for (const dir of createdDirs.reverse()) {
    try { fs.rmdirSync(dir); } catch {}
  }
}
