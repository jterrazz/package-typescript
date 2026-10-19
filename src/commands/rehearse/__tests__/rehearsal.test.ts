import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, onTestFinished, test } from 'vitest';

import {
    branchOf,
    bunOf,
    drivesBrowser,
    gitDirectoryOf,
    installerOf,
    rehearsalOf,
    tracksGo,
} from '../rehearsal.js';
import type { Facts } from '../rehearsal.js';

function folder(files: Readonly<Record<string, string>> = {}): string {
    const made = mkdtempSync(join(tmpdir(), 'rehearsal-'));
    const root = realpathSync(made);
    onTestFinished(() => {
        rmSync(root, { force: true, recursive: true });
    });
    for (const [file, text] of Object.entries(files)) {
        mkdirSync(dirname(join(root, file)), { recursive: true });
        writeFileSync(join(root, file), text);
    }

    return root;
}

const git = (cwd: string, ...args: string[]): void => {
    execFileSync(
        'git',
        ['-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'init.defaultBranch=main', ...args],
        { cwd, stdio: 'ignore' },
    );
};

function repository(files: Readonly<Record<string, string>>): string {
    const root = folder(files);
    git(root, 'init', '--quiet');
    git(root, 'add', '.');
    git(root, 'commit', '--quiet', '--allow-empty', '-m', 'first');

    return root;
}

const NPM: Facts = {
    branch: 'fix/after',
    browser: false,
    bun: undefined,
    gitDirectory: '/code/repo/.git',
    go: false,
    installer: 'npm',
    root: '/code/repo',
    targets: 'build lint test',
};

const scriptOf = (facts: Facts): string[] => (rehearsalOf(facts).at(-1) ?? '').split('\n');

describe('rehearsal', () => {
    test('rehearsalOf — an npm repository runs its targets as the runner does, in a fresh clone as the node user, its checkout read-only', () => {
        // Given - an npm repository on its own .git, its branch and the default targets
        const facts = NPM;

        // Then - the whole docker run, the script the container runs last
        expect(rehearsalOf(facts)).toStrictEqual([
            '--rm',
            '--init',
            '-e',
            'CI=true',
            '-e',
            'GITHUB_ACTIONS=true',
            '-e',
            'REHEARSED_BRANCH=fix/after',
            '-e',
            'REHEARSED_TARGETS=build lint test',
            '-v',
            '/code/repo:/repo:ro',
            '-v',
            '/var/run/docker.sock:/var/run/docker.sock',
            'node:24',
            'bash',
            '-c',
            [
                'set -e',
                'curl -fsSL "https://download.docker.com/linux/static/stable/$(uname -m)/docker-27.5.1.tgz" | tar -C /usr/local/bin --strip-components=1 -xz docker/docker',
                'chmod 666 /var/run/docker.sock || true',
                'mkdir /work && chown node:node /work',
                "cat > /tmp/gate.sh <<'GATE'",
                'set -e',
                'export PATH="/usr/local/go/bin:$HOME/.bun/bin:$PATH"',
                "git config --global --add safe.directory '*'",
                'git clone -q --no-local --branch "$REHEARSED_BRANCH" /repo /work',
                'cd /work',
                'git log -1 --oneline',
                'npm ci',
                'make $REHEARSED_TARGETS',
                'GATE',
                'su node -s /bin/bash /tmp/gate.sh',
            ].join('\n'),
        ]);
    });

    test('rehearsalOf — a worktree mounts the git directory its `.git` file names, read-only at its own path', () => {
        // Given - a worktree of a checkout elsewhere
        const worktree = { ...NPM, gitDirectory: '/code/main/.git', root: '/code/wt' };

        // Then - the main checkout's git directory beside the worktree
        expect(rehearsalOf(worktree).slice(10, 14)).toStrictEqual([
            '-v',
            '/code/wt:/repo:ro',
            '-v',
            '/code/main/.git:/code/main/.git:ro',
        ]);
    });

    test('rehearsalOf — Go, a browser and a pinned bun are provisioned where the repository needs them', () => {
        // Given - a bun repository tracking a go.mod and driving a browser
        const facts: Facts = { ...NPM, browser: true, bun: '1.2.9', go: true, installer: 'bun' };

        // Then - Go first as root, the browser's system libraries, then bun and chromium as the node user
        expect(scriptOf(facts)).toStrictEqual([
            'set -e',
            'case "$(uname -m)" in aarch64) arch=arm64 ;; *) arch=amd64 ;; esac',
            `version=$(curl -fsSL 'https://go.dev/dl/?mode=json' | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).find(r=>r.stable).version))")`,
            'curl -fsSL "https://go.dev/dl/$version.linux-$arch.tar.gz" | tar -C /usr/local -xz',
            'curl -fsSL "https://download.docker.com/linux/static/stable/$(uname -m)/docker-27.5.1.tgz" | tar -C /usr/local/bin --strip-components=1 -xz docker/docker',
            'chmod 666 /var/run/docker.sock || true',
            'npx -y playwright install-deps chromium',
            'mkdir /work && chown node:node /work',
            "cat > /tmp/gate.sh <<'GATE'",
            'set -e',
            'export PATH="/usr/local/go/bin:$HOME/.bun/bin:$PATH"',
            "git config --global --add safe.directory '*'",
            'git clone -q --no-local --branch "$REHEARSED_BRANCH" /repo /work',
            'cd /work',
            'git log -1 --oneline',
            'curl -fsSL https://bun.sh/install | bash -s bun-v1.2.9',
            'bun install --frozen-lockfile',
            'npx playwright install chromium',
            'make $REHEARSED_TARGETS',
            'GATE',
            'su node -s /bin/bash /tmp/gate.sh',
        ]);
    });

    test('rehearsalOf — an unpinned bun takes the latest, and pnpm is enabled by corepack before it installs', () => {
        // Given - a bun repository pinning none, and a pnpm one
        const bun = scriptOf({ ...NPM, installer: 'bun' });
        const pnpm = scriptOf({ ...NPM, installer: 'pnpm' });

        // Then - the installer's lines alone differ from npm's
        expect([
            bun.filter((line) => !scriptOf(NPM).includes(line)),
            pnpm.filter((line) => !scriptOf(NPM).includes(line)),
        ]).toStrictEqual([
            ['curl -fsSL https://bun.sh/install | bash', 'bun install --frozen-lockfile'],
            ['corepack enable', 'pnpm install --frozen-lockfile'],
        ]);
        expect(pnpm.indexOf('corepack enable')).toBeLessThan(
            pnpm.indexOf("cat > /tmp/gate.sh <<'GATE'"),
        );
    });

    test('installerOf — the lockfile names the installer, npm first, and none names nothing', () => {
        // Given - one folder per lockfile, one holding two, and one holding none
        const roots = [
            folder({ 'package-lock.json': '{}' }),
            folder({ 'bun.lock': '' }),
            folder({ 'pnpm-lock.yaml': '' }),
            folder({ 'bun.lock': '', 'package-lock.json': '{}' }),
            folder(),
        ];

        // Then - each installer, then nothing
        expect(roots.map((root) => installerOf(root))).toStrictEqual([
            'npm',
            'bun',
            'pnpm',
            'npm',
            undefined,
        ]);
    });

    test('bunOf — the version a manifest pins bun at, its hash dropped, and none for another manager or no pin', () => {
        // Given - bun pinned with a hash, bun pinned bare, npm pinned, and no pin
        const manifests = [
            { packageManager: 'bun@1.2.9+sha512.abc' },
            { packageManager: 'bun@1.3.0' },
            { packageManager: 'npm@10.0.0' },
            {},
        ];

        // Then - the two bun versions, then nothing
        expect(
            manifests.map((manifest) =>
                bunOf(folder({ 'package.json': JSON.stringify(manifest) })),
            ),
        ).toStrictEqual(['1.2.9', '1.3.0', undefined, undefined]);
    });

    test('gitDirectoryOf and branchOf — a checkout keeps its own .git, a worktree reads the one of its main checkout, a detached one stands on no branch, and a plain folder is no repository', () => {
        // Given - a checkout on main, a worktree of it on its own branch, the checkout detached, and a folder
        const main = repository({ 'a.txt': 'a' });
        const worktree = join(folder(), 'wt');
        git(main, 'worktree', 'add', '--quiet', '-b', 'side', worktree);
        const detached = repository({ 'a.txt': 'a' });
        git(detached, 'checkout', '--quiet', '--detach');
        const plain = folder();

        // Then - each git directory by its absolute path, and each branch
        expect([
            [gitDirectoryOf(main), branchOf(main)],
            [gitDirectoryOf(worktree), branchOf(worktree)],
            [gitDirectoryOf(detached), branchOf(detached)],
            [gitDirectoryOf(plain), branchOf(plain)],
        ]).toStrictEqual([
            [join(main, '.git'), 'main'],
            [join(main, '.git'), 'side'],
            [join(detached, '.git'), undefined],
            [undefined, undefined],
        ]);
    });

    test('tracksGo and drivesBrowser — a go.mod git tracks at any depth asks for Go, and a declared playwright for a browser', () => {
        // Given - a nested tracked go.mod, an untracked one, and manifests declaring playwright as a dependency, @playwright/test as a devDependency, and neither
        const tracked = repository({ 'tools/go.mod': 'module x\n' });
        const untracked = repository({});
        writeFileSync(join(untracked, 'go.mod'), 'module x\n');
        const manifests = [
            { dependencies: { playwright: '1' } },
            { devDependencies: { '@playwright/test': '1' } },
            { devDependencies: { vitest: '1' } },
        ];

        // Then - Go for the tracked one alone, a browser for the two drivers
        expect([tracksGo(tracked), tracksGo(untracked)]).toStrictEqual([true, false]);
        expect(
            manifests.map((manifest) =>
                drivesBrowser(folder({ 'package.json': JSON.stringify(manifest) })),
            ),
        ).toStrictEqual([true, true, false]);
    });
});
