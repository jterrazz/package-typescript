import { existsSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

import { fromPresets } from '../../../lint/index.oxlint.js';
import { readSettings } from '../../../lint/index.rules.js';
import { objectOf } from '../../../lint/kit/project/json.js';
import { SETTINGS_FILE } from '../../../lint/kit/project/jterrazz-config.js';

const settingsAt = join(process.cwd(), SETTINGS_FILE);

const { problem } = await readSettings(process.cwd());

const declared: object =
    problem === null && existsSync(settingsAt)
        ? objectOf(objectOf(await import(pathToFileURL(settingsAt).href)).default)
        : {};

export default fromPresets(declared);
