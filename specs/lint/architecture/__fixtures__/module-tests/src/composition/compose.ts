import type { Store } from '../application/ports/store.js';
import { save } from '../infrastructure/db.js';

export const compose = (): Store => ({ save });
