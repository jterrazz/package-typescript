import { compose } from '../../../composition/compose.js';
import { save } from '../../../infrastructure/db.js';
import { greet } from '../greet.js';

export const greeted = greet(compose(), save('ada'));
