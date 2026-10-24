import { enabled } from 'astro:middleware';

let label = 'on';

export const isEnabled = (): boolean => enabled === true;

export const labelled = (): string => label;
