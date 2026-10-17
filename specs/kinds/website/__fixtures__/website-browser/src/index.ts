export function mount(root: { textContent: null | string }, name: string): void {
    root.textContent = `Hello, ${name}.`;
}
