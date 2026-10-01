import { compose, node } from '@jterrazz/typescript/oxlint';

export default compose(node, {
    rules: {
        'no-debugger': 'off', // reason: the debugger IS the product here
    },
});
