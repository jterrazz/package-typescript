import { origin } from './server/origin.js';

export const extra = (): string => origin();
