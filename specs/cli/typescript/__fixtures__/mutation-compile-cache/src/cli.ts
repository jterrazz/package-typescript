import { appendFileSync } from 'node:fs';
import { constants, enableCompileCache } from 'node:module';

import { label } from './label.ts';

const { status } = enableCompileCache();
const cached = [constants.compileCacheStatus.ENABLED, constants.compileCacheStatus.ALREADY_ENABLED].includes(status);
const run = process.env.__STRYKER_ACTIVE_MUTANT__ === undefined ? 'dry run' : 'mutant';
appendFileSync(String(process.env.COMPILE_CACHE_LOG), `${run}: ${cached ? 'on' : 'off'}\n`);
process.stdout.write(label());
