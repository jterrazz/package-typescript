import { cents } from "./src/common.js";
import { fetchRepo } from "./src/gateway/repo-client.js";
import { trim } from "./src/helpers.js";
import { noop } from "./src/misc.js";
import { upper } from "./src/shared/text.js";
import { greet } from "./src/utils/format.js";
import { cart } from "./specs/orders/_fixtures/utils/cart.js";

export function run(): string {
  noop();
  return `${greet("world")} ${fetchRepo()} ${cents(1)} ${trim(upper(" a "))} ${cart.length}`;
}
