import { invariant } from '../catalogue/lesson.js';

/**
 * The named groups of a match, each one present.
 * A group a pattern always fills is typed `string | undefined` under `noUncheckedIndexedAccess`, and a default written for the type is a branch no input reaches — a mutant no test can kill. This throws on a group that is missing instead, which a pattern that always fills it never does.
 *
 * @example
 * const { name, version } = groupsOf(/^(?<name>[^@]+)@(?<version>.+)$/u.exec(spec), ['name', 'version']);
 */
export function groupsOf<Name extends string>(
    match: null | Pick<RegExpMatchArray, 'groups'>,
    names: readonly Name[],
): Record<Name, string> {
    const groups = match?.groups;
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the loop below fills every name or throws, which the empty record cannot say
    const found = {} as Record<Name, string>;
    for (const name of names) {
        const value = groups?.[name];
        if (value === undefined) {
            throw invariant(`the match holds no group named ${name}`);
        }
        found[name] = value;
    }

    return found;
}
