import { headline } from './headline.js';
import { shared } from '../common/shared.js';
import { quizOf } from '../quiz/sheet.js';

export function card(id: string): string {
    return `${headline(id)}${shared}${quizOf(id)}`;
}
