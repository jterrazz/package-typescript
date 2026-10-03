import { invariant } from '../catalogue/lesson.js';

const STOPPED = Symbol('the code a checker run stopped with');

type Stopped = Error & { [STOPPED]: number };

const isStopped = (error: unknown): error is Stopped =>
    error instanceof Error && typeof Reflect.get(error, STOPPED) === 'number';

// Unwinds to `exitCodeOf`, which reads the code; a stop that escapes it is a run wired wrong.
export function stop(code: number): never {
    throw Object.assign(
        invariant(`a checker run stopped with ${String(code)} outside exitCodeOf`),
        {
            [STOPPED]: code,
        },
    );
}

export function exitCodeOf(program: () => void): number {
    try {
        program();

        return 0;
    } catch (error) {
        if (isStopped(error)) {
            return error[STOPPED];
        }
        throw error;
    }
}
