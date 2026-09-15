function compute() {
    return 41 + 1;
}

// No annotation: the declaration cannot be written without inferring the type,
// which is what `isolatedDeclarations` refuses.
export const answer = compute();
