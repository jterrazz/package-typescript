import { describe, expect, test } from 'vitest';

import { objectOf } from '../../../../lint/kit/project/json.js';
import { dryRunWorkersPluginSource } from '../dry-run-workers.js';

type Plugin = { configureVitest: (context: unknown) => void };

const isPlugin = (value: unknown): value is Plugin =>
    typeof value === 'object' && value !== null && 'configureVitest' in value;

describe('dry-run workers', () => {
    test('dryRunWorkersPluginSource — the dry run’s workers go to the parallel projects and a project that declares fileParallelism false keeps its files in turn', async () => {
        // Given - the dry-run plugin of a suite config, loaded as a module
        const declaration = dryRunWorkersPluginSource(4);
        const loaded: unknown = await import(
            `data:text/javascript,${encodeURIComponent(`${declaration}\nexport { dryRunWorkers };`)}`
        );
        const { dryRunWorkers } = objectOf(loaded);
        const workersOf = (fileParallelism: boolean | undefined, mode: string): unknown => {
            const config: Record<string, unknown> = { fileParallelism, maxWorkers: 1 };
            if (isPlugin(dryRunWorkers)) {
                dryRunWorkers.configureVitest({
                    project: { config },
                    vitest: { getRootProject: () => ({ getProvidedContext: () => ({ mode }) }) },
                });
            }

            return config.maxWorkers;
        };

        // Then - only the parallel project is widened, and only in the dry run
        expect({
            parallelDry: workersOf(undefined, 'dry-run'),
            parallelMutant: workersOf(undefined, 'mutant'),
            serialDry: workersOf(false, 'dry-run'),
        }).toStrictEqual({ parallelDry: 4, parallelMutant: 1, serialDry: 1 });
    });
});
