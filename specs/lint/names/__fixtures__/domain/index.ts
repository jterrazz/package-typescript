import { prepare } from './specs/setup.js';
import { describeOrder, openWizard, start, upper } from './src/index.js';

export function run(): string {
    return `${prepare()} ${start()} ${describeOrder({ id: '1' })} ${openWizard()} ${upper('a')}`;
}
