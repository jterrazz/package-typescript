import { label } from './label.ts';

process.stdout.write(`${label(String(process.argv[2]))}\n`);
