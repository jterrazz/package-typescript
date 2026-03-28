import { cli } from "@jterrazz/test";
import { resolve } from "node:path";

const CLI_BIN = resolve(import.meta.dirname, "../../bin/typescript.sh");

export const spec = await cli({
  command: CLI_BIN,
  root: "../fixtures",
});
