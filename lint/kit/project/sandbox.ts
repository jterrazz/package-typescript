import { MUTATION_OUTPUT } from './build-plan.js';

const escaped = (text: string): string => text.replaceAll(/[.*+?^${}()|[\]\\]/gu, String.raw`\$&`);

/** The path a mutation run copied into its sandbox, back in the project: a test reading the sources as text reads them as written, never as the run instruments them. */
export function originalOf(path: string): string {
    const sandbox = new RegExp(
        `^(?<project>.+?)/${escaped(MUTATION_OUTPUT)}/tmp/sandbox-[^/]+(?<rest>/.*)?$`,
        'u',
    );
    const groups = sandbox.exec(path)?.groups;

    return groups === undefined ? path : `${groups.project ?? ''}${groups.rest ?? ''}`;
}
