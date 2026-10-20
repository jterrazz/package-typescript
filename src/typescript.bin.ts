#!/usr/bin/env node
import { enableCompileCache } from 'node:module';
import process from 'node:process';

// invariant: only a module loaded after the cache is enabled compiles through it, so the command loads by `import()` once it is.
enableCompileCache();

const { main } = await import('./commands/main.js');

process.exitCode = await main(process.argv.slice(2));
