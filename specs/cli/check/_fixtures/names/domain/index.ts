import { describeOrder, openWizard } from "./src/index.js";

export function run(): string {
  return `${describeOrder({ id: "1" })} ${openWizard()}`;
}
