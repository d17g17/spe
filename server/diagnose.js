#!/usr/bin/env node
'use strict';

// Standalone diagnostic script. Run with:
//   cd server && node diagnose.js
// or via npm:
//   cd server && npm run diagnose
//
// Prints everything we know about the server install: Node version, path
// sanity, every critical npm package, nested deps, env file, DB, and each
// route module load attempt with full error chains.

const diagnostics = require('./src/utils/diagnostics');
const result = diagnostics.run();
process.exit(result.proceed && Object.values(result.routeResults || {}).every((r) => r.ok) ? 0 : 1);
