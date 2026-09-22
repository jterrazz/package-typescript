export function setup() {
  return "ready";
}

// Exported for this file's own use only — the A4 idiom's `cleanup`, read
// back by nothing outside this module.
export function cleanup() {
  return "done";
}

cleanup();
