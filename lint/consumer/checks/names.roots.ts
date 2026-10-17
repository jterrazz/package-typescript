import type { Finding } from '../../kit/checker/pass.js';
import { isJsonObject, objectOf } from '../../kit/project/json.js';
import { SETTINGS_FILE } from '../../kit/project/jterrazz-config.js';
import { namesFinding } from './names.lessons.js';

/** Each folder `typescript.roots` declares, mapped to its reason, written bare or as `{ reason, verbatim: true }`. */
export type DeclaredRoots = Readonly<Record<string, unknown>>;

export const NO_DECLARED_ROOTS: DeclaredRoots = Object.freeze({});

/** A section's declared roots, or the problem of a declaration that maps no folder to a reason. */
export function declaredRootsOf(section: Readonly<Record<string, unknown>>): {
    problem: null | string;
    roots: DeclaredRoots;
} {
    return section.roots !== undefined && !isJsonObject(section.roots)
        ? {
              problem:
                  'holds a `typescript.roots` that is not an object mapping each folder to its reason',
              roots: NO_DECLARED_ROOTS,
          }
        : { problem: null, roots: objectOf(section.roots) };
}

export const isDeclaredRoot = (declared: DeclaredRoots, root: string): boolean =>
    Object.hasOwn(declared, root);

// invariant: a root's reason is the declared string itself, or the `reason` of its declaration object.
function reasonOf(declaration: unknown): unknown {
    return isJsonObject(declaration) ? declaration.reason : declaration;
}

/** Each declared root that is no first-level folder, that is a spine folder, that states no reason, or that holds no file. */
export function declaredRootsFindings(
    declared: DeclaredRoots,
    {
        prefix,
        roots,
        spine,
    }: { prefix: string; roots: ReadonlySet<string>; spine: ReadonlySet<string> },
): Finding[] {
    const where = `${prefix}${SETTINGS_FILE}'s \`typescript.roots\``;

    return Object.keys(declared)
        .toSorted()
        .flatMap((root): Finding[] => {
            if (root.includes('/')) {
                return [
                    namesFinding('names/declared-root-is-first-level', `${prefix}${root}/`, {
                        fix: `declare the first-level folder, \`${root.split('/')[0]}\`, or delete the entry`,
                        found: `\`${prefix}${root}/\` is declared in ${where}, and a root is a first-level folder`,
                    }),
                ];
            }
            if (spine.has(root)) {
                return [
                    namesFinding('names/declared-root-is-first-level', `${prefix}${root}/`, {
                        fix: 'delete the entry: a folder of the spine is already codified, and it cannot be a root too',
                        found: `\`${prefix}${root}/\` is declared in ${where}, and it is a folder of the spine`,
                    }),
                ];
            }
            const reason = reasonOf(declared[root]);
            if (typeof reason !== 'string' || reason.trim() === '') {
                return [
                    namesFinding('names/declared-root-states-its-reason', `${prefix}${root}/`, {
                        fix: 'say why the repository keeps it',
                        found: `\`${prefix}${root}/\` is declared in ${where} with no reason`,
                    }),
                ];
            }

            return roots.has(root)
                ? []
                : [
                      namesFinding('names/declared-root-holds-files', `${prefix}${root}/`, {
                          fix: 'delete the entry',
                          found: `\`${prefix}${root}/\` is declared in ${where} and holds no swept file; the sweep drops what git ignores, a Go module's \`testdata/\` and the ground of a test`,
                      }),
                  ];
        });
}
