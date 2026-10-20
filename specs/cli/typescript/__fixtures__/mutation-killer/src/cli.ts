import { price } from './price.ts';

process.stdout.write(`${String(price(Number(process.argv[2])))}\n`);
