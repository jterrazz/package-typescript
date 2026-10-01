import { existsSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

import { BASE_PRESETS } from '../../../lint/base-presets.js';
import { objectOf } from '../../../lint/engine/project/json.js';
import { readConfig, SETTINGS_FILE } from '../../../lint/engine/project/jterrazz-config.js';
import { fromPresets } from '../../../lint/index.oxlint.js';

const settingsAt = join(process.cwd(), SETTINGS_FILE);

const { problem } = await readConfig(process.cwd(), BASE_PRESETS);

const declared: object =
    problem === null && existsSync(settingsAt)
        ? objectOf(objectOf(await import(pathToFileURL(settingsAt).href)).default)
        : {};

export default fromPresets(declared);
