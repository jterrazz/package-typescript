import { appendFileSync } from 'node:fs';
import { env } from 'node:process';

if (env.RUNS_LOG !== undefined) {
    appendFileSync(env.RUNS_LOG, process.argv.slice(2).join(' ') + '\n');
}

export default { meta: { name: 'counting' }, rules: {} };
