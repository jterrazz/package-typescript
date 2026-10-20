import { a } from './a.ts';
import { b } from './b.ts';

const commands: Record<string, () => string> = { a, b };
const named = process.argv[2];
const command = named === undefined ? undefined : commands[named];

if (command === undefined) {
    process.stdout.write('usage: cli a|b\n');
    process.exitCode = named === undefined ? 0 : 1;
} else {
    process.stdout.write(command());
}
