export function label(count: number): string {
    return count === 1 ? 'one' : 'many';
}

/** A hook of this tree, so the fixture states hook ORDER and not an import. */
export function useTone(): string {
    return 'muted';
}
