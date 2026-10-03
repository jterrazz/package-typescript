import { allOn, fragment, off } from '../../kit/compiler/decision.js';

// invariant: JSDoc is never required — TypeScript carries the types — but a block that is written must be well formed.
const BY_TYPESCRIPT = {
    by: 'TypeScript — the signature carries the type, and the types are the API',
    kind: 'covered',
};

export default fragment({
    id: 'jsdoc',
    audience: 'consumer',
    plugins: ['jsdoc'],
    rules: {
        ...allOn(
            [
                'check-access',
                'check-property-names',
                'check-tag-names',
                'empty-tags',
                'implements-on-classes',
                'no-blank-blocks',
                'no-defaults',
                'require-param-description',
                'require-param-name',
                'require-property',
                'require-property-description',
                'require-property-name',
                'require-returns-description',
                'require-throws-description',
                'require-yields',
                'require-yields-description',
            ].map((rule) => `jsdoc/${rule}`),
        ),

        'jsdoc/require-param': off({
            by: 'TypeScript — a parameter is documented by its type, and a description is optional prose',
            kind: 'covered',
        }),
        'jsdoc/require-param-type': off(BY_TYPESCRIPT),
        'jsdoc/require-property-type': off(BY_TYPESCRIPT),
        'jsdoc/require-returns': off({
            by: 'TypeScript — a return is documented by its type, and a description is optional prose',
            kind: 'covered',
        }),
        'jsdoc/require-returns-type': off(BY_TYPESCRIPT),
        'jsdoc/require-throws-type': off(BY_TYPESCRIPT),
        'jsdoc/require-yields-type': off(BY_TYPESCRIPT),
    },
});
