import type { Finding } from '../../kit/checker/pass.js';
import { isJsonObject, objectOf } from '../../kit/project/json.js';
import { SETTINGS_FILE } from '../../kit/project/jterrazz-config.js';
import { namesFinding } from './names.lessons.js';

// invariant: each setting maps a folder to its reason; `generated` is a root a script writes, which the formatter leaves alone.
const ROOTS_DECLARATIONS = ['roots', 'generated'] as const;

export type DeclaredRoots = Readonly<
    Record<(typeof ROOTS_DECLARATIONS)[number], Readonly<Record<string, unknown>>>
>;

export const NO_DECLARED_ROOTS: DeclaredRoots = Object.freeze({ generated: {}, roots: {} });

/** A section's declared roots, or the problem of the first declaration that maps no folder to a reason. */
export function declaredRootsOf(section: Readonly<Record<string, unknown>>): {
    problem: null | string;
    roots: DeclaredRoots;
} {
    const refused = ROOTS_DECLARATIONS.find(
        (key) => section[key] !== undefined && !isJsonObject(section[key]),
    );

    return refused === undefined
        ? {
              problem: null,
              roots: { generated: objectOf(section.generated), roots: objectOf(section.roots) },
          }
        : {
              problem: `holds a \`typescript.${refused}\` that is not an object mapping each folder to its reason`,
              roots: NO_DECLARED_ROOTS,
          };
}

export const isDeclaredRoot = (declared: DeclaredRoots, root: string): boolean =>
    ROOTS_DECLARATIONS.some((key) => Object.hasOwn(declared[key], root));

/** Each declared root that states no reason, or that holds no file. */
export function declaredRootsFindings(
    declared: DeclaredRoots,
    { prefix, roots }: { prefix: string; roots: ReadonlySet<string> },
): Finding[] {
    return ROOTS_DECLARATIONS.flatMap((key) =>
        Object.keys(declared[key])
            .toSorted()
            .flatMap((root): Finding[] => {
                const reason = declared[key][root];
                const where = `${prefix}${SETTINGS_FILE}'s \`typescript.${key}\``;
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
            }),
    );
}
