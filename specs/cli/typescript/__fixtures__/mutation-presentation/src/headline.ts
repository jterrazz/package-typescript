export function headline(cents: number): string {
    const dear = cents > 100;

    return dear ? 'Too dear' : `A bargain`;
}
