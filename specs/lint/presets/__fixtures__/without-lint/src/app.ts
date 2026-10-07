import { total } from './order.js';

export const receipt = (prices: number[]): string => `Total: ${total(prices)}`;
