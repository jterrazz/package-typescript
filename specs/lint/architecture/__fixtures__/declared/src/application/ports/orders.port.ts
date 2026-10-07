import type { Customer } from '../../domain/customer.js';

export type OrdersPort = { of: (customer: Customer) => string[] };
