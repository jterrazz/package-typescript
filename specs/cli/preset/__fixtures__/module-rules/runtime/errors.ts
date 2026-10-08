export class RuntimeError extends Error {
    override name = 'RuntimeError';
}

export class TimeoutError extends RuntimeError {
    override name = 'TimeoutError';
}

export class Ledger {
    readonly entries: number[] = [];
}
