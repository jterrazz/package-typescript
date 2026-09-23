import { remember } from "../domain/user.js";

export function save(name: string): string {
  return remember(name);
}
