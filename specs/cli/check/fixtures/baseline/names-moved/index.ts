import { fetchRepository } from "./src/repo-client.js";
import type { Total } from "./src/types.js";

export function run(total: Total): string {
  return `${fetchRepository()} ${total}`;
}
