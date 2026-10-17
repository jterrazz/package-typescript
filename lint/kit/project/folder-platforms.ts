import { isJsonObject } from './json.js';
import { listed, PLATFORMS } from './project-kind.js';
import type { Platform } from './project-kind.js';

export type FolderPlatform = { folder: string; platform: Platform };

export type FolderPlatforms = { folders: FolderPlatform[]; problem: null | string };

// invariant: a folder of the unit, written as a relative path: no glob, no `..`, no leading `./` or `/`.
const FOLDER = /^[a-z\d][\w.-]*(?:\/[a-z\d][\w.-]*)*$/iu;

const isPlatform = (value: unknown): value is Platform =>
    (PLATFORMS as readonly unknown[]).includes(value);

const refused = (problem: string): FolderPlatforms => ({ folders: [], problem });

/** `typescript.platforms`: a folder of the unit judged by another platform than the unit's, such as the React UI an api on bun serves. */
export function folderPlatformsOf(written: unknown): FolderPlatforms {
    if (written === undefined) {
        return { folders: [], problem: null };
    }
    if (!isJsonObject(written)) {
        return refused('holds a `typescript.platforms` that is not an object');
    }
    const folders: FolderPlatform[] = [];
    for (const [folder, declared] of Object.entries(written)) {
        const { platform, reason } = isJsonObject(declared) ? declared : {};
        if (!FOLDER.test(folder)) {
            return refused(
                `names \`${folder}\` under \`typescript.platforms\`, which is no folder of the unit — write its path from the unit, with no glob`,
            );
        }
        if (!isPlatform(platform)) {
            return refused(
                `declares \`${folder}\` on the platform \`${String(platform)}\`, which is none of ${listed(PLATFORMS)}`,
            );
        }
        if (typeof reason !== 'string' || reason.trim() === '') {
            return refused(
                `declares \`${folder}\` on \`${platform}\` with no \`reason\` — say why the folder runs on another platform than the unit`,
            );
        }
        folders.push({ folder, platform });
    }

    return { folders, problem: null };
}
