import { refusal } from '../../../lint/kit/catalogue/lesson.js';
import {
    UNCOMPILED_FIX,
    UNCOMPILED_WHY,
    uncompiledFound,
} from '../../drivers/tsc/compile-error.js';

/** What the run says when the TypeScript checker stopped it: the tree it mutates does not compile, at the compiler's first error. */
export const uncompiledRefusal = (diagnostic: string): string =>
    refusal({
        fix: UNCOMPILED_FIX,
        found: uncompiledFound(diagnostic),
        read: 'docs/reference/quality-checks.md#every-mutant-a-test-runs-is-detected',
        why: UNCOMPILED_WHY,
    });
