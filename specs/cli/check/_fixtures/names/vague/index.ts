import { cart } from './specs/orders/_setup/utils/cart.js';
import { cents } from './src/common.js';
import { fetchRepo } from './src/gateway/repo-client.js';
import { trim } from './src/helpers.js';
import { identity } from './src/misc.js';
import { greet } from './src/utils/format.js';

export function run(): string {
    return `${identity(greet('world'))} ${fetchRepo()} ${cents(1)} ${trim(' a ')} ${cart.length}`;
}
