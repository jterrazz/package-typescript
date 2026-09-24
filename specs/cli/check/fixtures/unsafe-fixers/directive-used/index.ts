export function take(value: string | undefined): string {
    return value ?? 'none';
}

// oxlint-disable-next-line unicorn/no-useless-undefined -- the callee requires it
export const taken = take(undefined);
