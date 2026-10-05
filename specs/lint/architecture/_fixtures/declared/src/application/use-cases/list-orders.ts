import type { Customer } from '../../domain/customer.js';
import { total } from '../../domain/total.js';
import type { OrdersPort } from '../ports/orders.port.js';

export const listOrders = (orders: OrdersPort, customer: Customer): string =>
    total(orders.of(customer));
