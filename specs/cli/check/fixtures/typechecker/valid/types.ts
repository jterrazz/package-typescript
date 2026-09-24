const message: string = greet('world');
const count: number = message.length;

function greet(name: string): string {
    return `Hello, ${name}!`;
}

export { count, greet, message };
