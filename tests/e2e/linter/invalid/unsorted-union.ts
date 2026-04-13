type Status = 'pending' | 'active' | 'error' | 'completed';

export function getStatus(): Status {
    return 'active';
}
