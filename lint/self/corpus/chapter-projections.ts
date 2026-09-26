import { resolve } from 'node:path';

import FAMILIES from '../../consumer/catalogue/families.json' with { type: 'json' };
import FINDINGS from '../../consumer/catalogue/findings.json' with { type: 'json' };
import { PROFILES } from '../../consumer/rulebook/profiles.js';
import { decisions, unsafeFixers } from '../../engine/catalogue/decisions.js';
import {
    renderDecisions,
    renderFindings,
    renderFixers,
    renderSelfRows,
} from '../../engine/catalogue/projections.js';
import SELF_ROWS from '../catalogue/manifest.json' with { type: 'json' };

const DOCS = resolve(import.meta.dirname, '../../../docs');

const QUALITY_CHECKS = resolve(DOCS, '06-quality-checks.md');

const LINT_PRESETS = resolve(DOCS, '07-lint-presets.md');

const FIXER_MARKERS = { end: '<!-- /GENERATED:fixers -->', start: '<!-- GENERATED:fixers -->' };

export const PROJECTIONS = {
    ...Object.fromEntries(
        FAMILIES.map((family) => [
            `${family} table`,
            {
                markers: {
                    end: `<!-- /GENERATED:findings ${family} -->`,
                    start: `<!-- GENERATED:findings ${family} -->`,
                },
                page: QUALITY_CHECKS,
                render: () => renderFindings(FINDINGS.filter((row) => row.family === family)),
            },
        ]),
    ),
    chapter: {
        markers: { end: '<!-- /GENERATED -->', start: '<!-- GENERATED -->' },
        page: LINT_PRESETS,
        render: () =>
            renderDecisions(decisions(PROFILES).filter((entry) => entry.audience === 'consumer')),
    },
    'fixer list': {
        markers: FIXER_MARKERS,
        page: LINT_PRESETS,
        render: () => renderFixers(unsafeFixers(PROFILES)),
    },
    'self rules': {
        markers: { end: '<!-- /GENERATED:self -->', start: '<!-- GENERATED:self -->' },
        page: resolve(DOCS, '03-testing.md'),
        render: () => renderSelfRows(SELF_ROWS),
    },
};
