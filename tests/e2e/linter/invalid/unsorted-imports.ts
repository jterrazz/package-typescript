import path from "path";
import fs from "fs";

import { something } from "./local.js";

export function greet(name: string): string {
  const fullPath = path.join(fs.realpathSync("."), name);
  return `Hello ${fullPath} - ${something}`;
}
