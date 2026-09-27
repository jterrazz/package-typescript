import { defineConfig } from '@jterrazz/typescript/config';

const READ = 'docs/01-architecture.md#the-judging-layer';

export default defineConfig({
    typescript: {
        architecture: {
            layers: [
                {
                    fix: 'hand the declaration to engine/ from an index, never import it from engine/',
                    from: { path: '^lint/engine/' },
                    name: 'engine-knows-no-declaration',
                    read: READ,
                    to: { path: '^(lint/consumer|lint/self|src)/' },
                    why: 'lint/engine/ runs declarations and knows none — it receives them from an index',
                },
                {
                    fix: 'move what both folders need into the catalogue or into engine/',
                    from: { path: '^lint/consumer/(rulebook|rules|checks)/' },
                    name: 'consumer-folders-apart',
                    read: READ,
                    to: {
                        path: '^lint/consumer/(rulebook|rules|checks)/',
                        pathNot: '^lint/consumer/$1/',
                    },
                    why: 'a consumer declaration reads the catalogue and engine/, never a sibling folder',
                },
                {
                    fix: 'move what both folders need into the catalogue or into engine/',
                    from: { path: '^lint/self/(rules|checks|corpus)/' },
                    name: 'self-folders-apart',
                    read: READ,
                    to: { path: '^lint/self/(rules|checks|corpus)/', pathNot: '^lint/self/$1/' },
                    why: 'a self declaration reads its catalogue, consumer/, engine/ and src/, never a sibling folder',
                },
                {
                    fix: 'move what the catalogue needs into engine/',
                    from: { path: '^lint/(consumer|self)/catalogue/' },
                    name: 'catalogue-at-the-bottom',
                    read: READ,
                    to: { path: '^(lint/consumer|lint/self|src)/', pathNot: '^lint/$1/catalogue/' },
                    why: 'a catalogue is data at the bottom of the arrow — it reads engine/ alone',
                },
                {
                    fix: 'move what the shipped code needs out of self/ and src/ into engine/',
                    from: { path: '^lint/(consumer/|index)' },
                    name: 'shipped-lint-reads-no-self',
                    read: READ,
                    to: { path: '^(lint/self|src)/' },
                    why: 'the shipped lint/ never reads self/ (never shipped) nor src/ (the command)',
                },
                {
                    fix: 'move what src/ needs from self/ into engine/, or out of self/ into consumer/',
                    from: { path: '^src/' },
                    name: 'src-reads-no-self',
                    read: READ,
                    to: { path: '^lint/self/' },
                    why: 'src/ runs what lint/ declares, never self/',
                },
            ],
        },
    },
});
