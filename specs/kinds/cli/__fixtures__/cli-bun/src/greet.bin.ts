#!/usr/bin/env node
import process from 'node:process';

const [name = 'world'] = process.argv.slice(2);
process.stdout.write(`Hello, ${name}.\n`);
