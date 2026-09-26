import { isAbsolute, relative, sep } from 'node:path';

import { isPacked } from '../../engine/project/packed-files.js';

const NODE_MODULES = `${sep}node_modules${sep}`;

function installedPackageOf(id) {
    const below = id.slice(id.lastIndexOf(NODE_MODULES) + NODE_MODULES.length).split(sep);

    return below[0]?.startsWith('@') ? `${below[0]}/${below[1]}` : below[0];
}

const READ = "@jterrazz/test's docs/19-linting.md#no-test-code-in-production";

const CUT_THE_EDGE =
    'cut the production edge no-test-code-in-production names, or take the module out of the entry';

function finding(file, found, fix) {
    return {
        message: [
            `found: ${found}`,
            'why: a published build never carries test material',
            `fix: ${fix}`,
            `read: ${READ}`,
        ].join(' · '),
        path: file,
        rule: 'publish/no-test-code-in-production',
    };
}

// An external specifier is judged by `testPackageOf` unless the package declares it to run in production.
export function noTestCodeInProductionFindings({ chunks, manifest, reader, root }) {
    const declared = new Set([
        ...Object.keys(manifest.dependencies ?? {}),
        ...Object.keys(manifest.peerDependencies ?? {}),
    ]);
    const findings = [];

    const shipped = chunks.filter(({ file }) => isPacked(manifest.files ?? [], file));
    for (const { externals, file, moduleIds } of shipped) {
        for (const id of moduleIds.filter((candidate) => isAbsolute(candidate)).toSorted()) {
            if (id.includes(NODE_MODULES)) {
                const name = reader.testPackageOf(installedPackageOf(id));
                if (name !== undefined) {
                    findings.push(
                        finding(
                            file,
                            `${file} is compiled from ${name}, a test package`,
                            CUT_THE_EDGE,
                        ),
                    );
                }
                continue;
            }
            const kind = reader.materialAt(id);
            if (kind !== undefined) {
                findings.push(
                    finding(
                        file,
                        `${file} is compiled from ${relative(root, id)}, ${kind}`,
                        CUT_THE_EDGE,
                    ),
                );
            }
        }
        for (const specifier of externals.toSorted()) {
            const name = reader.testPackageOf(specifier);
            if (name !== undefined && !declared.has(name)) {
                findings.push(
                    finding(
                        file,
                        `${file} imports ${specifier}, a test package`,
                        `cut the import, or declare ${name} in "dependencies" when the product runs it`,
                    ),
                );
            }
        }
    }

    return findings;
}
