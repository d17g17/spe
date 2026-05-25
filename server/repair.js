#!/usr/bin/env node
'use strict';

// Repairs known-broken nested npm dependencies by downloading the tarball
// directly from registry.npmjs.org and extracting in-place, bypassing npm
// (which often silently loses files when AV / Defender quarantines them
// during extraction on Windows).
//
// Usage:
//   cd server
//   node repair.js
// or:
//   npm run repair

const fs = require('fs');
const path = require('path');
const https = require('https');
const zlib = require('zlib');
const { execSync } = require('child_process');

const SERVER_ROOT = __dirname;
const NODE_MODULES = path.join(SERVER_ROOT, 'node_modules');

// Things we know go wrong. Each entry says "if this nested file is missing,
// re-fetch this package version directly and extract it into this folder".
const REPAIR_TARGETS = [
  {
    description: 'agent-base@9 used by socks-proxy-agent',
    package: 'agent-base',
    version: '9.0.0',
    targetDir: path.join(NODE_MODULES, 'socks-proxy-agent', 'node_modules', 'agent-base'),
    canaryFile: 'dist/index.js',
  },
  {
    description: 'agent-base@7 used by https-proxy-agent (if nested)',
    package: 'agent-base',
    version: '7.1.3',
    targetDir: path.join(NODE_MODULES, 'https-proxy-agent', 'node_modules', 'agent-base'),
    canaryFile: 'dist/index.js',
    optional: true,
  },
];

const banner = (s) => {
  const line = '='.repeat(70);
  console.log(`\n${line}\n  ${s}\n${line}`);
};

const ok = (m) => console.log(`  [ok]    ${m}`);
const info = (m) => console.log(`         ${m}`);
const fail = (m) => console.log(`  [FAIL]  ${m}`);

const exists = (p) => { try { return fs.statSync(p); } catch { return null; } };

// Download a buffer from a URL, following redirects.
const downloadBuffer = (url, maxRedirects = 5) => new Promise((resolve, reject) => {
  const req = https.get(url, (res) => {
    if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
      if (maxRedirects <= 0) return reject(new Error('Too many redirects'));
      res.resume();
      return resolve(downloadBuffer(res.headers.location, maxRedirects - 1));
    }
    if (res.statusCode !== 200) {
      res.resume();
      return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
    }
    const chunks = [];
    res.on('data', (c) => chunks.push(c));
    res.on('end', () => resolve(Buffer.concat(chunks)));
    res.on('error', reject);
  });
  req.on('error', reject);
  req.setTimeout(30000, () => { req.destroy(new Error('Timeout')); });
});

// Minimal tar parser. Reads a (decompressed) tar buffer and yields file entries
// as { name, type, content }. Only handles regular files and directories, which
// is all npm tarballs contain. Sufficient for extracting an npm package without
// needing the `tar` npm dep.
const parseTar = (buf) => {
  const entries = [];
  let offset = 0;
  while (offset + 512 <= buf.length) {
    const header = buf.slice(offset, offset + 512);
    // Empty (zero-filled) header signals end of archive
    if (header.every((b) => b === 0)) break;

    const readStr = (start, len) => {
      const slice = header.slice(start, start + len);
      const nul = slice.indexOf(0);
      return slice.slice(0, nul === -1 ? len : nul).toString('utf8');
    };
    const readOct = (start, len) => parseInt(readStr(start, len).trim() || '0', 8);

    let name = readStr(0, 100);
    const size = readOct(124, 12);
    const typeflag = String.fromCharCode(header[156]) || '0';
    const prefix = readStr(345, 155);
    if (prefix) name = `${prefix}/${name}`;

    offset += 512;
    const dataLen = size;
    const padded = Math.ceil(dataLen / 512) * 512;
    const content = buf.slice(offset, offset + dataLen);
    offset += padded;

    if (!name) continue;
    if (typeflag === '5') {
      entries.push({ name, type: 'dir' });
    } else if (typeflag === '0' || typeflag === '') {
      entries.push({ name, type: 'file', content });
    }
  }
  return entries;
};

const writeFileEnsuringDirs = (filePath, content) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
};

const repair = async (target) => {
  console.log(`\n--- ${target.description} ---`);
  console.log(`  Target dir: ${target.targetDir}`);

  // Quick sanity: is the parent package even installed?
  const parentRoot = path.dirname(path.dirname(target.targetDir));
  if (!exists(parentRoot)) {
    if (target.optional) {
      info(`Parent package not installed (optional). Skipping.`);
      return { ok: true, skipped: true };
    }
    fail(`Parent package directory does not exist: ${parentRoot}`);
    return { ok: false };
  }

  const canary = path.join(target.targetDir, target.canaryFile);
  if (exists(canary)) {
    ok(`Already healthy: ${target.canaryFile} present.`);
    return { ok: true, skipped: true };
  }

  // Fetch the version metadata so we get the dist.tarball URL.
  const metaUrl = `https://registry.npmjs.org/${target.package}/${target.version}`;
  info(`Fetching metadata: ${metaUrl}`);
  let meta;
  try {
    const buf = await downloadBuffer(metaUrl);
    meta = JSON.parse(buf.toString('utf8'));
  } catch (err) {
    fail(`Could not fetch package metadata: ${err.message}`);
    return { ok: false };
  }
  const tarballUrl = meta.dist && meta.dist.tarball;
  if (!tarballUrl) {
    fail('Metadata did not include dist.tarball.');
    return { ok: false };
  }
  info(`Tarball URL: ${tarballUrl}`);

  let tgz;
  try {
    info('Downloading tarball...');
    tgz = await downloadBuffer(tarballUrl);
    info(`Downloaded ${(tgz.length / 1024).toFixed(1)} KB`);
  } catch (err) {
    fail(`Could not download tarball: ${err.message}`);
    return { ok: false };
  }

  let tarBuf;
  try {
    tarBuf = zlib.gunzipSync(tgz);
  } catch (err) {
    fail(`Could not gunzip tarball: ${err.message}`);
    return { ok: false };
  }

  let entries;
  try {
    entries = parseTar(tarBuf);
  } catch (err) {
    fail(`Could not parse tar: ${err.message}`);
    return { ok: false };
  }
  info(`Parsed ${entries.length} entries from tarball.`);

  // npm tarballs contain a top-level "package/" prefix we need to strip.
  let written = 0;
  let skipped = 0;
  for (const entry of entries) {
    if (entry.type !== 'file') continue;
    const stripped = entry.name.replace(/^package\//, '');
    if (!stripped || stripped === entry.name) continue; // no package/ prefix => skip
    const dest = path.join(target.targetDir, stripped);
    try {
      writeFileEnsuringDirs(dest, entry.content);
      written += 1;
    } catch (err) {
      skipped += 1;
      info(`  could not write ${stripped}: ${err.message}`);
    }
  }
  info(`Wrote ${written} files (${skipped} skipped).`);

  if (exists(canary)) {
    ok(`Repaired: ${target.canaryFile} now exists.`);
    return { ok: true };
  }
  fail(`Canary file ${target.canaryFile} STILL missing after repair.`);
  info('Antivirus is probably deleting the file as fast as we write it.');
  info('Add the project folder to Windows Defender exclusions and re-run:');
  info('  (Admin PowerShell) Add-MpPreference -ExclusionPath "C:\\spe"');
  return { ok: false };
};

const run = async () => {
  banner('npm install repair');
  console.log(`  Server root: ${SERVER_ROOT}`);

  if (!exists(NODE_MODULES)) {
    fail('node_modules does not exist. Run `npm install` first.');
    process.exit(1);
  }

  const results = [];
  for (const target of REPAIR_TARGETS) {
    results.push(await repair(target));
  }

  banner('Repair summary');
  const failed = results.filter((r) => !r.ok);
  if (failed.length === 0) {
    ok('All targets healthy.');
    console.log('\n  Verify with:  npm run diagnose');
    console.log('  Then start :  cd .. && npm run dev\n');
    process.exit(0);
  }
  fail(`${failed.length}/${results.length} target(s) still broken.`);
  console.log('\n  Next step: add Defender exclusion and reinstall.');
  console.log('  In an Administrator PowerShell:');
  console.log('    Add-MpPreference -ExclusionPath "' + path.dirname(SERVER_ROOT) + '"');
  console.log('    cd "' + SERVER_ROOT + '"');
  console.log('    Remove-Item -Recurse -Force node_modules');
  console.log('    npm install');
  console.log('    npm run repair');
  console.log('    npm run diagnose\n');
  process.exit(1);
};

run().catch((err) => {
  console.error(`\n[FAIL] repair crashed: ${err.message}`);
  console.error(err.stack);
  process.exit(2);
});
