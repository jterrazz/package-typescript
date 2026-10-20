const logger = console;

export function priced(cents: number): string {
    console.warn(`pricing ${cents} cents`);
    logger.info('priced');

    return cents > 100 ? 'dear' : 'cheap';
}
