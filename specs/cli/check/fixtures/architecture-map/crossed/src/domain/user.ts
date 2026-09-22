import { save } from "../infrastructure/store.js";

export function remember(name: string): string {
  return save(name);
}
