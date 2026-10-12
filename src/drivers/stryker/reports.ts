import { MUTATION_OUTPUT } from '../../../lint/kit/project/build-plan.js';

/** The two runs of a mutation command, each with the report it writes. */
export type StageName = 'modules' | 'suite';

export const REPORT_NAMES: Readonly<Record<StageName, string>> = {
    modules: 'report',
    suite: 'suite-report',
};

/** Where a stage writes its JSON report, from the project's root. */
export const reportPathOf = (stage: StageName): string =>
    `${MUTATION_OUTPUT}/${REPORT_NAMES[stage]}.json`;
