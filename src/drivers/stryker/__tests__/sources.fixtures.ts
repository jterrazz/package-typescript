import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const WIDE = 'export declare const kind: string;\n';

export const EXACT = "export declare const kind: 'api';\n";

/** Lays each file under the root, its folders made first. */
export function laid(root: string, files: Readonly<Record<string, string>>): void {
    for (const [path, text] of Object.entries(files)) {
        mkdirSync(join(root, path, '..'), { recursive: true });
        writeFileSync(join(root, path), text);
    }
}

/** The plugins a generated Vitest config lists. */
export const pluginsOf = (source: string): string | undefined =>
    /plugins: \[[^\]]*\]/u.exec(source)?.[0];

export type Spec = { moduleId: string; project: { name: string } };

/** A test file of a Vitest project, as a sequencer is handed it. */
export const specOf = (root: string, project: string, path: string): Spec => ({
    moduleId: join(root, path),
    project: { name: project },
});
