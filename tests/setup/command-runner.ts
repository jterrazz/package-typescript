import type { CliResult, CommandEnv, SpawnOptions, SpecRunner } from '@jterrazz/test';

/**
 * Command-mode view of the v8 spec builder. `SpecificationBuilder.run()` is
 * typed as a union across all spec modes; a `command()` target only ever
 * produces a `CliResult`, so setups narrow their runner through this type.
 */
interface CommandSpecBuilder {
    env: (env: CommandEnv) => this;
    exec: (args: string | string[]) => this;
    fixture: (file: string) => this;
    project: (name: string) => this;
    run: () => Promise<CliResult>;
    spawn: (args: string, options: SpawnOptions) => this;
}

type CommandSpecRunner = (label: string) => CommandSpecBuilder;

export function asCommandRunner(runner: SpecRunner): CommandSpecRunner {
    return runner as unknown as CommandSpecRunner;
}
