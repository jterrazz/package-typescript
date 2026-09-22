export interface Order {
  id: string;
}

export function describeOrder(order: Order): string {
  return `order ${order.id}`;
}
