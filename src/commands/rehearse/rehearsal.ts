import { existsSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';

import { manifestAt } from '../../../lint/kit/project/build-steps.js';
import { git } from '../../../lint/kit/project/git.js';
import { declaredDependencies } from '../../../lint/kit/project/manifest.js';

export type Installer = 'bun' | 'npm' | 'pnpm';

export type Facts = {
    branch: string;
    browser: boolean;
    bun: string | undefined;
    gitDirectory: string;
    go: boolean;
    installer: Installer;
    root: string;
    targets: string;
};

export const IMAGE = 'node:24';

export const TARGETS = 'build lint test';

const REPOSITORY = '/repo';

const DOCKER_SOCKET = '/var/run/docker.sock';

const DOCKER_CLI = '27.5.1';

const LOCKFILES: readonly [string, Installer][] = [
    ['package-lock.json', 'npm'],
    ['bun.lock', 'bun'],
    ['pnpm-lock.yaml', 'pnpm'],
];

const BROWSER_DRIVERS = ['playwright', '@playwright/test'];

const BUN_PINNED = /^bun@(?<version>[^+]+)/u;

export const installerOf = (root: string): Installer | undefined =>
    LOCKFILES.find(([lockfile]) => existsSync(join(root, lockfile)))?.[1];

/** The bun release a manifest's `packageManager` pins, or `undefined` where it pins none. */
export function bunOf(root: string): string | undefined {
    const pinned = manifestAt(root).packageManager;

    return typeof pinned === 'string' ? BUN_PINNED.exec(pinned)?.groups?.version : undefined;
}

/** Where git keeps the objects and refs of the checkout at `root`: its own `.git`, or the main checkout's when `root` is a worktree. */
export function gitDirectoryOf(root: string): string | undefined {
    const common = git(root, ['rev-parse', '--git-common-dir'])?.trim();

    return common === undefined ? undefined : isAbsolute(common) ? common : resolve(root, common);
}

export const branchOf = (root: string): string | undefined =>
    git(root, ['symbolic-ref', '--quiet', '--short', 'HEAD'])?.trim();

export const tracksGo = (root: string): boolean =>
    (git(root, ['ls-files', '--', 'go.mod', '**/go.mod']) ?? '').trim() !== '';

export const drivesBrowser = (root: string): boolean => {
    const declared = declaredDependencies(root);

    return BROWSER_DRIVERS.some((name) => declared.has(name));
};

const GO = [
    `case "$(uname -m)" in aarch64) arch=arm64 ;; *) arch=amd64 ;; esac`,
    `version=$(curl -fsSL 'https://go.dev/dl/?mode=json' | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).find(r=>r.stable).version))")`,
    `curl -fsSL "https://go.dev/dl/$version.linux-$arch.tar.gz" | tar -C /usr/local -xz`,
];

const INSTALLS: Readonly<Record<Installer, string>> = {
    bun: 'bun install --frozen-lockfile',
    npm: 'npm ci',
    pnpm: 'pnpm install --frozen-lockfile',
};

function provisioned({ browser, go, installer }: Facts): string[] {
    return [
        ...(go ? GO : []),
        `curl -fsSL "https://download.docker.com/linux/static/stable/$(uname -m)/docker-${DOCKER_CLI}.tgz" | tar -C /usr/local/bin --strip-components=1 -xz docker/docker`,
        `chmod 666 ${DOCKER_SOCKET} || true`,
        ...(browser ? ['npx -y playwright install-deps chromium'] : []),
        ...(installer === 'pnpm' ? ['corepack enable'] : []),
        'mkdir /work && chown node:node /work',
    ];
}

function gate({ browser, bun, installer }: Facts): string[] {
    return [
        'set -e',
        'export PATH="/usr/local/go/bin:$HOME/.bun/bin:$PATH"',
        "git config --global --add safe.directory '*'",
        `git clone -q --no-local --branch "$REHEARSED_BRANCH" ${REPOSITORY} /work`,
        'cd /work',
        'git log -1 --oneline',
        ...(installer === 'bun'
            ? [
                  `curl -fsSL https://bun.sh/install | bash${bun === undefined ? '' : ` -s bun-v${bun}`}`,
              ]
            : []),
        INSTALLS[installer],
        ...(browser ? ['npx playwright install chromium'] : []),
        'make $REHEARSED_TARGETS',
    ];
}

// invariant: the tools install as root and the gate runs as the image's `node` user, as the runner's gate runs as `runner`: a root run reads the chmod-000 fixtures a runner cannot.
const scriptOf = (facts: Facts): string =>
    [
        'set -e',
        ...provisioned(facts),
        "cat > /tmp/gate.sh <<'GATE'",
        ...gate(facts),
        'GATE',
        'su node -s /bin/bash /tmp/gate.sh',
    ].join('\n');

/** The arguments of the `docker run` that rehearses the release gate on Linux: a fresh clone of the branch, as a GitHub runner runs it. */
export function rehearsalOf(facts: Facts): string[] {
    const { branch, gitDirectory, root, targets } = facts;
    // invariant: a worktree's `.git` is a file naming its main checkout's git directory by absolute path, so that directory is mounted where the file says it is.
    const linked =
        gitDirectory === join(root, '.git') ? [] : ['-v', `${gitDirectory}:${gitDirectory}:ro`];

    return [
        '--rm',
        '--init',
        '-e',
        'CI=true',
        '-e',
        'GITHUB_ACTIONS=true',
        '-e',
        `REHEARSED_BRANCH=${branch}`,
        '-e',
        `REHEARSED_TARGETS=${targets}`,
        '-v',
        `${root}:${REPOSITORY}:ro`,
        ...linked,
        '-v',
        `${DOCKER_SOCKET}:${DOCKER_SOCKET}`,
        IMAGE,
        'bash',
        '-c',
        scriptOf(facts),
    ];
}
