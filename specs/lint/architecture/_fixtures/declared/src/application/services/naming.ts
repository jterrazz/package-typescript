import type { Row } from '../../infrastructure/outbound/row.js';

export const nameOf = (row: Row): string => row.name;
