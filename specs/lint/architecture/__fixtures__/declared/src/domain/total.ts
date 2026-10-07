import { placed } from './order.js';

export const total = (ids: string[]): string => ids.map((id) => placed(id)).join('');
