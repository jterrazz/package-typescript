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

/** Each declared root that states no reason, or that holds no file. */
export function declaredRootsFindings(
    declared: DeclaredRoots,
    { prefix, roots }: { prefix: string; roots: ReadonlySet<string> },
): Finding[] {
    const where = `${prefix}${SETTINGS_FILE}'s \`typescript.roots\``;

    return Object.keys(declared)
        .toSorted()
        .flatMap((root): Finding[] => {
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
                          found: `\`${prefix}${root}/\` is declared in ${where} and holds no file`,
                      }),
                  ];
        });
}
