import { defineStandard } from '../../../lint/index.config.js';

export default defineStandard({
    typescript: {
        mutation: {
            mutate: {
                'lint/*.ts': 'the entries of the lint rules a library ships',
                'lint/consumer/**/*.ts':
                    'the lint rules and checks a library ships to its consumers',
                'lint/kit/**/*.ts': 'the rules kit those rules and checks run on',
            },
        },
    },
});
