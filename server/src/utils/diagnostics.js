'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const SERVER_ROOT = path.resolve(__dirname, '..', '..');
const NODE_MODULES = path.join(SERVER_ROOT, 'node_modules');

// Known critical packages (with their JS entry points) we must be able to load.
// If any of these fail, we know exactly which install is broken.
const CRITICAL_MODULES = [
  { name: 'express',           file: 'index.js' },
  { name: 'sequelize',         file: 'lib/index.js' },
  { name: 'umzug',             file: 'lib/index.js' },
  { name: 'sqlite3',           file: 'lib/sqlite3.js' },
  { name: 'socket.io',         file: 'wrapper.mjs' },
  { name: 'axios',             file: 'index.js' },
  { name: 'https-proxy-agent', file: 'dist/index.js' },
  { name: 'socks-proxy-agent', file: 'dist/index.js' },
  { name: 'agent-base',        file: 'dist/index.js' },
];

// Nested deps that are notoriously broken on partial installs.
const CRITICAL_NESTED = [
  {
    parent: 'socks-proxy-agent',
    nested: 'agent-base',
    file: 'dist/index.js',
  },
  {
    parent: 'https-proxy-agent',
    nested: 'agent-base',
    file: 'dist/index.js',
  },
];

const safeStat = (p) => {
  try { return fs.statSync(p); } catch (_) { return null; }
};

const safeReaddir = (p) => {
  try { return fs.readdirSync(p); } catch (_) { return null; }
};

const safeReadPkg = (modName) => {
  try {
    const pkgPath = path.join(NODE_MODULES, modName, 'package.json');
    return JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  } catch (_) { return null; }
};

const safeReadNestedPkg = (parent, child) => {
  try {
    const pkgPath = path.join(NODE_MODULES, parent, 'node_modules', child, 'package.json');
    return JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  } catch (_) { return null; }
};

const banner = (title) => {
  const line = '='.repeat(70);
  console.log(`\n${line}\n  ${title}\n${line}`);
};

const sub = (title) => {
  console.log(`\n--- ${title} ---`);
};

const ok = (msg) => console.log(`  [ok]    ${msg}`);
const warn = (msg) => console.log(`  [warn]  ${msg}`);
const fail = (msg) => console.log(`  [FAIL]  ${msg}`);
const info = (msg) => console.log(`         ${msg}`);

const reportEnvironment = () => {
  sub('Environment');
  console.log(`  Node:       ${process.version}`);
  console.log(`  Platform:   ${process.platform} ${process.arch}`);
  console.log(`  OS:         ${os.release()} (${os.type()})`);
  console.log(`  PID:        ${process.pid}`);
  console.log(`  CWD:        ${process.cwd()}`);
  console.log(`  Server root:${SERVER_ROOT}`);
  console.log(`  Has spaces: ${SERVER_ROOT.includes(' ') ? 'YES (problematic on some setups)' : 'no'}`);
  console.log(`  Has unicode:${/[^\x20-\x7e]/.test(SERVER_ROOT) ? 'YES (problematic)' : 'no'}`);

  const major = parseInt(process.version.replace(/^v/, '').split('.')[0], 10);
  if (major >= 22) {
    warn(`Node ${process.version} is bleeding-edge. If module resolution fails, downgrade to Node 20 LTS.`);
  } else if (major < 18) {
    warn(`Node ${process.version} is too old. Use Node 18+ (ideally Node 20 LTS).`);
  } else {
    ok(`Node ${process.version} version OK.`);
  }
};

const reportNodeModules = () => {
  sub('node_modules sanity');
  const stat = safeStat(NODE_MODULES);
  if (!stat) {
    fail(`node_modules MISSING at ${NODE_MODULES}`);
    info('Fix: cd server && npm install');
    return false;
  }
  const top = safeReaddir(NODE_MODULES) || [];
  console.log(`  ${top.length} top-level packages installed.`);
  if (top.length < 50) {
    warn(`Only ${top.length} packages found — install may be incomplete.`);
  }
  return true;
};

const reportCriticalModules = () => {
  sub('Critical modules (entry files)');
  let allGood = true;
  for (const mod of CRITICAL_MODULES) {
    const modDir = path.join(NODE_MODULES, mod.name);
    const entryFile = path.join(modDir, mod.file);
    const pkg = safeReadPkg(mod.name);

    if (!safeStat(modDir)) {
      fail(`${mod.name}: package directory MISSING`);
      allGood = false;
      continue;
    }
    if (!pkg) {
      fail(`${mod.name}: package.json unreadable`);
      allGood = false;
      continue;
    }
    if (!safeStat(entryFile)) {
      fail(`${mod.name}@${pkg.version}: entry file MISSING (${mod.file})`);
      // Dump what IS in that folder to give a hint.
      const distDir = path.dirname(entryFile);
      const what = safeReaddir(distDir);
      if (what) info(`Files actually present in ${path.relative(NODE_MODULES, distDir)}: ${what.join(', ')}`);
      else info(`Directory ${path.relative(NODE_MODULES, distDir)} does not exist`);
      allGood = false;
      continue;
    }
    ok(`${mod.name}@${pkg.version}`);
  }
  return allGood;
};

const reportNestedModules = () => {
  sub('Nested dependencies (the usual ESM trap)');
  let allGood = true;
  for (const item of CRITICAL_NESTED) {
    const nestedDir = path.join(NODE_MODULES, item.parent, 'node_modules', item.nested);
    const nestedFile = path.join(nestedDir, item.file);
    const dirExists = !!safeStat(nestedDir);
    const fileExists = !!safeStat(nestedFile);
    const pkg = safeReadNestedPkg(item.parent, item.nested);

    if (!dirExists) {
      // The top-level dedup might be sufficient. Note this is fine if the parent
      // doesn't pin a strict nested version. The error here points to malformed install.
      info(`${item.parent}/node_modules/${item.nested}: not nested (deduped to top-level). Fine if package supports it.`);
      continue;
    }
    if (!pkg) {
      fail(`${item.parent}/node_modules/${item.nested}: package.json missing or unreadable`);
      allGood = false;
      continue;
    }
    if (!fileExists) {
      fail(`${item.parent}/node_modules/${item.nested}@${pkg.version}: ${item.file} MISSING`);
      const distDir = path.dirname(nestedFile);
      const what = safeReaddir(distDir);
      if (what && what.length > 0) {
        info(`Files actually present: ${what.join(', ')}`);
        info(`-> Most likely cause: Windows Defender / antivirus quarantined ${path.basename(item.file)}.`);
        info(`-> Fix: Add C:\\spe to Defender exclusions, then reinstall:`);
        info(`     Add-MpPreference -ExclusionPath "${SERVER_ROOT}"      (in admin PowerShell)`);
        info(`     Remove-Item -Recurse -Force node_modules`);
        info(`     npm install`);
      } else {
        info(`Entire ${path.basename(distDir)}/ directory is empty or missing.`);
        info(`-> Reinstall: Remove-Item -Recurse -Force node_modules; npm install`);
      }
      allGood = false;
    } else {
      ok(`${item.parent}/node_modules/${item.nested}@${pkg.version}`);
    }
  }
  return allGood;
};

const reportEnvFile = () => {
  sub('.env / configuration');
  const envFile = path.join(SERVER_ROOT, '.env');
  if (!safeStat(envFile)) {
    warn(`.env not found at ${envFile}`);
    info('App may run but proxy/Steam features will be disabled.');
  } else {
    ok(`.env present`);
    try {
      const content = fs.readFileSync(envFile, 'utf8');
      const lines = content.split('\n').filter((l) => l.trim() && !l.trim().startsWith('#'));
      info(`${lines.length} env entries.`);
      const keysFound = new Set();
      for (const l of lines) {
        const eq = l.indexOf('=');
        if (eq > 0) keysFound.add(l.slice(0, eq).trim());
      }
      const expected = ['STEAM_API_KEY', 'PORT', 'CLIENT_URL', 'SUBORBIT_HOST', 'SUBORBIT_PORT', 'SUBORBIT_USERNAME', 'SUBORBIT_PASSWORD'];
      for (const k of expected) {
        if (keysFound.has(k)) ok(`  ${k} is set`);
        else warn(`  ${k} is NOT set`);
      }
    } catch (_) { /* ignore */ }
  }
};

const reportDb = () => {
  sub('Database');
  const dbDir = path.join(SERVER_ROOT, 'database');
  const dbFile = path.join(dbDir, 'steamprofiles.db');
  if (!safeStat(dbDir)) {
    warn(`database/ directory does not exist yet. Will be created on first run.`);
    return;
  }
  ok(`database/ directory exists`);
  if (safeStat(dbFile)) {
    const sz = fs.statSync(dbFile).size;
    info(`steamprofiles.db: ${(sz / 1024).toFixed(1)} KB`);
  } else {
    info(`steamprofiles.db: not created yet (will be on first migration)`);
  }
};

const tryRequireRoute = (name, requirePath) => {
  sub(`Probing route module: ${requirePath}  ->  /api/${name}`);
  try {
    const start = Date.now();
    const mod = require(requirePath);
    ok(`Loaded in ${Date.now() - start}ms — exported type: ${typeof mod}`);
    return { ok: true, mod };
  } catch (err) {
    fail(`Could not load.`);
    info(`Error: ${err.message}`);
    if (err.code) info(`Code:  ${err.code}`);
    if (err.url) info(`URL:   ${err.url}`);

    if (err.code === 'MODULE_NOT_FOUND' || err.code === 'ERR_MODULE_NOT_FOUND') {
      // Try to extract which dependency failed
      const m = err.message.match(/Cannot find module '([^']+)'/);
      if (m) {
        info(`Missing: ${m[1]}`);
        // If the missing file is INSIDE a known package, suggest specific fix
        const inside = m[1].match(/node_modules[\\/](.+?)[\\/]/);
        if (inside) {
          info(`This file should have been installed by npm under ${inside[1]}.`);
          info(`Fix: rm -rf node_modules + npm install`);
        }
      }
    }

    if (err.stack) {
      info(`Stack (first 6 lines):`);
      err.stack.split('\n').slice(0, 6).forEach((l) => info(`  ${l}`));
    }
    return { ok: false, error: err };
  }
};

const probeAllRoutes = () => {
  banner('Route module load probe');
  const results = {};
  results.profiles = tryRequireRoute('profiles', '../features/profiles/routes');
  results.friends  = tryRequireRoute('friends',  '../features/friends/routes');
  results.cs2      = tryRequireRoute('cs2',      '../features/cs2/routes');
  results.prices   = tryRequireRoute('prices',   '../features/prices/routes');
  results.proxies  = tryRequireRoute('proxies',  '../features/proxies/routes');
  return results;
};

const summarize = (envOk, modulesOk, nestedOk, routeResults) => {
  banner('Summary');
  const routeFailed = Object.entries(routeResults)
    .filter(([, r]) => !r.ok)
    .map(([k]) => k);

  if (routeFailed.length === 0 && modulesOk && nestedOk) {
    ok('All checks passed. Server should work.');
    return;
  }

  console.log('  Issues detected:');
  if (!modulesOk)   console.log('   - One or more npm packages have missing entry files.');
  if (!nestedOk)    console.log('   - One or more nested dependencies are missing required files.');
  if (routeFailed.length > 0) {
    console.log(`   - Route modules failed to load: ${routeFailed.join(', ')}`);
    console.log('     -> All endpoints under /api/<name> will return 404 until fixed.');
  }

  console.log('\n  Most likely fixes (try in order):');
  console.log('   1. Run PowerShell as Administrator, then:');
  console.log(`        Add-MpPreference -ExclusionPath "${SERVER_ROOT}"`);
  console.log('      (excludes the project from Windows Defender real-time scanning)');
  console.log('   2. Clean reinstall:');
  console.log(`        cd "${SERVER_ROOT}"`);
  console.log('        Remove-Item -Recurse -Force node_modules');
  console.log('        Remove-Item -Force package-lock.json -ErrorAction SilentlyContinue');
  console.log('        npm cache clean --force');
  console.log('        npm install');
  console.log('   3. If still failing, move project to a path with NO spaces and reinstall.');
  console.log('   4. If still failing, install Node 20 LTS (uninstall current version first).');
};

const run = () => {
  banner('Startup diagnostics');
  reportEnvironment();
  const nmOk = reportNodeModules();
  if (!nmOk) {
    summarize(false, false, false, {});
    return { proceed: false };
  }
  const modulesOk = reportCriticalModules();
  const nestedOk = reportNestedModules();
  reportEnvFile();
  reportDb();
  const routeResults = probeAllRoutes();
  summarize(true, modulesOk, nestedOk, routeResults);
  console.log('');
  return { proceed: true, routeResults };
};

module.exports = { run, banner, sub, ok, warn, fail, info };
