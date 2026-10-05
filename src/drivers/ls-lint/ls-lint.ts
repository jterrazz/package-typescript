import { binaryIn, HOISTED_BESIDE_PACKAGE } from '../../../lint/kit/project/package-root.js';

export const lsLintBinary = (): string => binaryIn('ls-lint', HOISTED_BESIDE_PACKAGE);
