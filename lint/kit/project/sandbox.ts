import { MUTATION_OUTPUT } from './build-plan.js';

const escaped = (text: string): string => text.replaceAll(/[.*+?^${}()|[\]\\]/gu, String.raw`\$&`);

const SANDBOX = new RegExp(
    `^(?<project>.+?)/${escaped(MUTATION_OUTPUT)}/tmp/sandbox-[^/]+(?<rest>/.*)?$`,
    'u',
);

/** The path a mutation run copied into its sandbox, back in the project: a test reading the sources as text reads them as written, never as the run instruments them. */
export function originalOf(path: string): string {
    const groups = SANDBOX.exec(path)?.groups;

    return groups === undefined ? path : `${groups.project ?? ''}${groups.rest ?? ''}`;
}
