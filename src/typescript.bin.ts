#!/usr/bin/env node
import { enableCompileCache } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';

// invariant: the variable hands the cache to every node process the command starts, which `enableCompileCache()` alone does not; only a module loaded after the cache is enabled compiles through it, so the command loads by `import()` once it is.
// Stryker disable next-line AssignmentOperator,StringLiteral: the cache only saves time, so no output tells where it sits or whether a child reads it
process.env.NODE_COMPILE_CACHE ??= join(tmpdir(), 'node-compile-cache');
// Stryker disable next-line CallExpression: the cache only saves time, so no output tells whether this process compiles through it
enableCompileCache();

const { main } = await import('./commands/main.js');

process.exitCode = await main(process.argv.slice(2));
