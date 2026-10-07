import { defineStandard } from '../../../lint/index.config.js';

export default defineStandard({
    typescript: {
        mutation: {
            exclude: {
                'specs/mobile/**':
                    'the mobile specs drive a real simulator through Appium and WebDriverAgent: a mutation run would open a device session for every mutant, minutes each, and leave the machine its processes and windows — the module tests and every other spec measure the code',
            },
        },
    },
});
