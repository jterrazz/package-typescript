const testing = {
    architecture: {
        layers: [
            {
                fix: 'move what both tests read into a module neither of them is',
                from: { path: String.raw`\.test\.ts$` },
                name: 'no-test-to-test-import',
                read: 'docs/testing.md#sharing',
                to: { path: String.raw`\.test\.ts$` },
                why: 'a test importing a test couples two files that each prove one thing',
            },
        ],
    },
    name: '@acme/testing',
    names: [
        {
            fix: 'move it into the facet that reads it',
            ls: { specs: { '.*': 'exists:0', '.specification.ts': 'regex:.+' } },
            name: 'specs-root-holds-facets',
            read: 'docs/testing.md#the-specs-root',
            why: 'the specs root holds its facets and their runners alone',
        },
    ],
};

export default {
    typescript: {
        names: [
            {
                fix: 'rename it in kebab-case',
                ls: { src: { '.ts': 'kebab-case' } },
                name: 'module-in-kebab-case',
                read: 'docs/naming.md#modules',
                why: 'one case for every module keeps a search to one spelling',
            },
        ],
        presets: [testing],
    },
};
