import { greet } from "./src/utils/format.js";
import { fetchRepo } from "./src/gateway/repo-client.js";

export function run(): string {
  return `${greet("world")} ${fetchRepo()}`;
}
