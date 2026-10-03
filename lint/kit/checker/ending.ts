import process from 'node:process';

const ENDING: readonly NodeJS.Signals[] = ['SIGHUP', 'SIGINT', 'SIGTERM'];

// A signal skips `finally`: the clean-up runs on it too, then the signal is raised again so the process still ends by it.
export async function cleanedUpOnEnding<T>(
    cleanUp: () => void,
    work: () => Promise<T>,
): Promise<T> {
    let cleaned = false;
    const once = (): void => {
        if (!cleaned) {
            cleaned = true;
            cleanUp();
        }
    };
    const ended = (signal: NodeJS.Signals): void => {
        for (const ending of ENDING) {
            process.off(ending, ended);
        }
        once();
        process.kill(process.pid, signal);
    };
    for (const signal of ENDING) {
        process.on(signal, ended);
    }
    try {
        return await work();
    } finally {
        for (const signal of ENDING) {
            process.off(signal, ended);
        }
        once();
    }
}
