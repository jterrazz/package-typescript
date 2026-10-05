import { defineStandard } from '../../lint/index.config.js';

export const PUBLIC_ROOT =
    'Next.js, Astro and Vite — static files served verbatim at the site root';

export const APP_ROOT = 'Next.js App Router and Expo Router — routes are read off this folder';

export default defineStandard({
    typescript: {
        memberRoots: ['apps', 'packages'],
        sources: { extensions: ['ts'], roots: ['src'] },
        spine: ['docs', 'lint', 'skills', 'specs', 'src'],
        toolRoots: {
            bin: "npm — the files a package's `bin` entry links as commands",
            config: "node-config — the default folder its `require('config')` reads",
            prisma: 'Prisma — the schema and migrations its CLI reads by default',
        },
        tsconfigPreset: 'node',
        words: {
            constructs: ['constants', 'helper', 'interfaces', 'type', 'types', 'util'],
            grabBag: ['base', 'common', 'helpers', 'lib', 'misc', 'stuff', 'tools', 'utils'],
            shortcuts: [
                'auth',
                'cfg',
                'impl',
                'infra',
                'k8s',
                'pkg',
                'repo',
                'repos',
                'svc',
                'tmp',
            ],
        },
    },
});
