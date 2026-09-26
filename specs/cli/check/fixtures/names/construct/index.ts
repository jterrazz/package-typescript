import { RULES } from './lint/checks/constants.js';
import { ORDER_LIMIT } from './specs/orders/constants.js';
import { half } from './src/helper.js';
import type { Order } from './src/interfaces/order.js';
import type { Receipt } from './src/order.types.js';
import type { Count } from './src/type.js';
import type { Total } from './src/types.js';
import { double } from './src/util.js';

export function run(order: Order, receipt: Receipt, total: Total, count: Count): string {
    return `${RULES.length} ${order.id} ${receipt.id} ${total} ${double(count)} ${half(ORDER_LIMIT)}`;
}
