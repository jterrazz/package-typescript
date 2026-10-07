import { join } from "node:path"
import { readFileSync } from "node:fs"
import { clsx } from "clsx"
import { greet } from "./greet.js"

export const card = clsx("p-4 flex text-sm bg-white")
export const message = greet(readFileSync(join("data", "name.txt"), "utf8"), { punctuation: "!", uppercase: false })
export function shout(text: string) {
  return text.toUpperCase()
}
