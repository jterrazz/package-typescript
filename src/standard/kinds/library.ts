import { defineStandard } from '../../../lint/index.config.js';

const READ = 'docs/concepts/architecture.md#the-judging-layer';

const TEST_MATERIAL = String.raw`\.(?:test|spec|test-d|spec-d|fixtures)\.[cm]?[jt]sx?$`;

export default defineStandard({
    laws: {
        layers: [
            {
                fix: 'hand the declaration to kit/ from a module at the root of lint/, never import it from kit/',
                from: { path: '^lint/kit/' },
                name: 'kit-knows-no-declaration',
                read: READ,
                to: { path: '^(lint/consumer/|lint/self/|lint/[^/]+$|src/)' },
                why: 'lint/kit/ runs declarations and knows none: it receives them from a module at the root of lint/, which it never imports',
            },
            {
                fix: 'move what both folders need into the catalogue or into kit/',
                from: { path: '^lint/consumer/(rulebook|rules|checks)/' },
                name: 'consumer-folders-apart',
                read: READ,
                to: {
                    path: '^lint/consumer/(rulebook|rules|checks)/',
                    pathNot: '^lint/consumer/$1/',
                },
                why: 'a consumer declaration reads the catalogue and kit/, never a sibling folder',
            },
            {
                fix: 'move what both folders need into the catalogue or into kit/',
                from: { path: '^lint/self/(rules|checks|corpus)/' },
                name: 'self-folders-apart',
                read: READ,
                to: { path: '^lint/self/(rules|checks|corpus)/', pathNot: '^lint/self/$1/' },
                why: 'a self declaration reads its catalogue, consumer/, kit/ and src/, never a sibling folder',
            },
            {
                fix: 'move what the catalogue needs into kit/',
                from: { path: '^lint/(consumer|self)/catalogue/', pathNot: TEST_MATERIAL },
                name: 'catalogue-at-the-bottom',
                read: READ,
                to: {
                    path: '^(lint/consumer|lint/self|src)/',
                    pathNot: '^(lint/($1|consumer)/catalogue|src/standard)/',
                },
                why: "a catalogue is data at the bottom of the arrow: it reads kit/, the package's standard and, for the self catalogue, the consumer catalogue it extends; its tests audit what it catalogues",
            },
            {
                fix: 'move what the shipped code needs out of self/ and src/ into kit/, or into src/standard/ when it is a default the package holds projects to',
                from: { path: '^lint/(consumer/|[^/]+$)', pathNot: TEST_MATERIAL },
                name: 'shipped-lint-reads-no-self',
                read: READ,
                to: { path: '^(lint/self|src)/', pathNot: '^src/standard/' },
                why: 'the shipped lint/ never reads self/ (never shipped) nor src/ (the command), only src/standard/, the data both apply; its tests are not shipped, and may run a rule through the package that ships it',
            },
            {
                fix: 'move what src/ needs into kit/, or compose it in a module at the root of `lint/`, and import it from there',
                from: { path: '^src/' },
                name: 'src-reads-no-declaration',
                read: READ,
                to: { path: '^lint/(consumer|self)/' },
                why: 'src/ runs what lint/ declares through the modules at the root of lint/ and kit/, never a declaration of consumer/ or self/',
            },
        ],
    },
    typescript: {
        lint: {
            consumer: ['catalogue', 'rulebook', 'rules', 'checks'],
            kit: ['project', 'baseline', 'checker', 'catalogue', 'compiler', 'testing'],
            self: ['catalogue', 'rules', 'checks', 'corpus'],
        },
        mutation: {
            ignore: {
                'src/standard/**/*.ts':
                    'a standard is data the Config pass keeps free of logic: a mutant rewrites a stated value, which the specs of what it configures read, never a decision a test of the module could hold',
            },
            mutate: {
                'lint/*.ts': 'the entries of the lint rules a library ships',
                'lint/consumer/**/*.ts':
                    'the lint rules and checks a library ships to its consumers',
                'lint/kit/**/*.ts': 'the rules kit those rules and checks run on',
            },
        },
    },
});
