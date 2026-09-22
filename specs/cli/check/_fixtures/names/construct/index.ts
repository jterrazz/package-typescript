import { RULES } from "./lint/constants.js";
import { prepare } from "./specs/setup.js";
import type { Order } from "./src/interfaces/order.js";
import type { Receipt } from "./src/order.types.js";
import type { Total } from "./src/types.js";

export function run(order: Order, receipt: Receipt, total: Total): string {
  return `${RULES.length} ${prepare()} ${order.id} ${receipt.id} ${total}`;
}
