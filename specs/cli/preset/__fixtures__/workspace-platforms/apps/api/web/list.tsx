import { label } from './label';

export const list = (items: readonly string[]) => items.map((item) => <li>{label(item)}</li>);
