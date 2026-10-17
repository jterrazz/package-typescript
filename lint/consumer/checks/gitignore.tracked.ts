import { ARTIFACTS } from '../../kit/project/build-plan.js';
import { trackedFiles } from '../../kit/project/project-files.js';

// hazard: narrower than ARTEFACT_DIRECTORIES: a tracked file under `bin/` or `build/` may be source.
const TRACKED_ARTEFACT_DIRECTORIES: ReadonlySet<string> = new Set([
    ARTIFACTS,
    '.cache',
    '.next',
    '.turbo',
    '.vite',
    'coverage',
    'playwright-report',
    'test-results',
]);

const TRACKED_ARTEFACT_EXTENSION = '.tsbuildinfo';

export function trackedArtefacts(root: string): string[] {
    return trackedFiles(root).filter((path) => {
        const segments = path.split('/');

        return (
            segments.slice(0, -1).some((segment) => TRACKED_ARTEFACT_DIRECTORIES.has(segment)) ||
            path.endsWith(TRACKED_ARTEFACT_EXTENSION)
        );
    });
}

export const committedLines = (tracked: readonly string[]): string[] =>
    tracked.length === 0
        ? []
        : [
              'Artefacts must never be committed:',
              ...tracked.map((path) => `  ✗ ${path} is tracked: git rm --cached ${path}`),
          ];
