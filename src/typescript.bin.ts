#!/usr/bin/env node
import process from 'node:process';

import { main } from './command/main.js';

process.exitCode = await main(process.argv.slice(2));
