/**
 * Applies conservative JavaScript obfuscation to production bundles only.
 * This raises the effort required to inspect packaged code; it is not encryption.
 */
import fs from 'node:fs';
import path from 'node:path';
import JavaScriptObfuscator from 'javascript-obfuscator';

const root = process.cwd();
const distDir = path.join(root, 'dist');
const assetsDir = path.join(distDir, 'assets');

if (!fs.existsSync(path.join(distDir, 'index.html'))) {
  throw new Error('dist/index.html not found. Build the production frontend first.');
}
if (!fs.existsSync(assetsDir)) {
  throw new Error('dist/assets not found. No production bundles are available to protect.');
}

function walk(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...walk(fullPath));
    else results.push(fullPath);
  }
  return results;
}

// Production bundles are built without source maps. Remove any accidentally generated
// maps defensively so they cannot be copied into Windows or Android deliverables.
for (const file of walk(distDir).filter(file => file.endsWith('.map'))) {
  fs.rmSync(file, { force: true });
}

const bundles = walk(assetsDir).filter(file => file.endsWith('.js') && !file.endsWith('.js.map'));
if (bundles.length === 0) {
  throw new Error('No JavaScript bundles found under dist/assets.');
}

for (const file of bundles) {
  const source = fs.readFileSync(file, 'utf8');
  const result = JavaScriptObfuscator.obfuscate(source, {
    compact: true,
    simplify: true,
    identifierNamesGenerator: 'hexadecimal',
    renameGlobals: false,
    selfDefending: false,
    stringArray: true,
    stringArrayEncoding: ['base64'],
    stringArrayThreshold: 0.25,
    rotateStringArray: true,
    stringArrayShuffle: true,
    controlFlowFlattening: false,
    deadCodeInjection: false,
    splitStrings: false,
    transformObjectKeys: false,
    numbersToExpressions: false,
    sourceMap: false,
    target: 'browser',
    log: false
  });
  fs.writeFileSync(file, result.getObfuscatedCode(), 'utf8');
}

const remainingMaps = walk(distDir).filter(file => file.endsWith('.map'));
if (remainingMaps.length > 0) {
  throw new Error(`Source maps remain in the release output: ${remainingMaps.length}`);
}

console.log(`Protected ${bundles.length} JavaScript bundles and verified that release source maps are absent.`);
