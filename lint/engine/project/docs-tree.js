// The Dockerfile and `.infrastructure/` clauses are read at every member's root too; the publishable
// clause stays on the root manifest.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { workspaceMembers } from './workspace-members.js';

const LINK = /!?\[[^\]]*\]\(\s*(?<target>[^\s)]+)/gu;

const INFRASTRUCTURE = '.infrastructure';

// `docs/` itself is the first entry when it exists — its absence is the whole verdict.
function listDocs(root) {
    const paths = [];

    function walk(relativePath) {
        paths.push(`${relativePath}/`);

        const entries = readdirSync(join(root, relativePath), { withFileTypes: true });
        for (const entry of entries.toSorted((a, b) => (a.name < b.name ? -1 : 1))) {
            const child = `${relativePath}/${entry.name}`;
            if (entry.isDirectory()) {
                walk(child);
            } else {
                paths.push(child);
            }
        }
    }

    if (existsSync(join(root, 'docs'))) {
        walk('docs');
    }

    return paths;
}

// An unreadable file is an absent one.
function read(path) {
    try {
        return readFileSync(path, 'utf8');
    } catch {
        return null;
    }
}

function readPages(root, files, headLines) {
    const heads = {};
    const links = {};

    for (const path of files) {
        if (!path.endsWith('.md')) {
            continue;
        }

        const text = read(join(root, path)) ?? '';
        heads[path] = text.split('\n').slice(0, headLines);
        links[path] = [...text.matchAll(LINK)].map((match) => match.groups.target);
    }

    return { heads, links };
}

function hasDockerfile(dir) {
    try {
        return readdirSync(dir).some(
            (name) => name === 'Dockerfile' || name.startsWith('Dockerfile.'),
        );
    } catch {
        return false;
    }
}

function isPublishable(dir) {
    const manifest = read(join(dir, 'package.json'));
    if (manifest === null) {
        return false;
    }

    try {
        return JSON.parse(manifest).private !== true;
    } catch {
        return false;
    }
}

function readShips(root) {
    const roots = [root, ...workspaceMembers(root).map((member) => join(root, member))];

    return {
        dockerfile: roots.some((dir) => hasDockerfile(dir)),
        infrastructure: roots.some((dir) => existsSync(join(dir, INFRASTRUCTURE))),
        publishable: isPublishable(root),
    };
}

export function readDocsTree(root, headLines) {
    const files = listDocs(root);

    return {
        agents: read(join(root, 'AGENTS.md')),
        files,
        ...readPages(root, files, headLines),
        ships: readShips(root),
    };
}
