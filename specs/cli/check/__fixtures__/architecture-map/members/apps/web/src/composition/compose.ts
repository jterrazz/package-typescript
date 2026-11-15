import { save } from '../infrastructure/store.js';

export const compose = (): { save: typeof save } => ({ save });
