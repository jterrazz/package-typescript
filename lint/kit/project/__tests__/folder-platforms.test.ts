import { describe, expect, test } from 'vitest';

import { folderPlatformsOf } from '../folder-platforms.js';

describe('folderPlatformsOf', () => {
    test('reads each folder on its platform, and nothing when none is written', () => {
        // Given - a unit with two folders on other platforms, and one that writes none
        const unwritten: { platforms?: unknown } = {};
        const read = [
            folderPlatformsOf({
                'web/admin': { platform: 'next', reason: 'the admin pages' },
                'web/3d': { platform: 'browser', reason: 'the canvas, plain DOM' },
                web: { platform: 'react', reason: 'the UI the api serves' },
            }),
            folderPlatformsOf(unwritten.platforms),
        ];

        // Then - each folder keeps its platform, in the order written
        expect(read).toStrictEqual([
            {
                folders: [
                    { folder: 'web/admin', platform: 'next' },
                    { folder: 'web/3d', platform: 'browser' },
                    { folder: 'web', platform: 'react' },
                ],
                problem: null,
            },
            { folders: [], problem: null },
        ]);
    });

    test('refuses a section that is no object, a glob, a platform outside the list and a folder with a blank reason or none', () => {
        // Given - the declarations the setting refuses
        const refused = [
            folderPlatformsOf(['web']),
            folderPlatformsOf({ 'web/**': { platform: 'react', reason: 'the UI' } }),
            folderPlatformsOf({ '../web': { platform: 'react', reason: 'the UI' } }),
            folderPlatformsOf({ web: { platform: 'vue', reason: 'the UI' } }),
            folderPlatformsOf({ web: { platform: 'react', reason: ' ' } }),
            folderPlatformsOf({ web: { platform: 'react' } }),
            folderPlatformsOf({ web: 'react' }),
        ];

        // Then - each names what it wrote and what the setting asks
        expect(refused).toStrictEqual([
            { folders: [], problem: 'holds a `typescript.platforms` that is not an object' },
            {
                folders: [],
                problem:
                    'names `web/**` under `typescript.platforms`, which is no folder of the unit; write its path from the unit, with no glob',
            },
            {
                folders: [],
                problem:
                    'names `../web` under `typescript.platforms`, which is no folder of the unit; write its path from the unit, with no glob',
            },
            {
                folders: [],
                problem:
                    'declares `web` on the platform `vue`, which is none of `node`, `bun`, `react`, `next`, `astro`, `expo`, `browser`',
            },
            {
                folders: [],
                problem:
                    'declares `web` on `react` with no `reason`; say why the folder runs on another platform than the unit',
            },
            {
                folders: [],
                problem:
                    'declares `web` on `react` with no `reason`; say why the folder runs on another platform than the unit',
            },
            {
                folders: [],
                problem:
                    'declares `web` on the platform `undefined`, which is none of `node`, `bun`, `react`, `next`, `astro`, `expo`, `browser`',
            },
        ]);
    });
});
