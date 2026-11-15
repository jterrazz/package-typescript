import { save } from '../../infrastructure/db.js';
import { remember } from '../user.js';

export const remembered = remember(save('ada'));
