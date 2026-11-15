import { quizOf } from '../features/quiz/sheet.js';

export const stamp = (id: string): string => `#${quizOf(id)}`;
