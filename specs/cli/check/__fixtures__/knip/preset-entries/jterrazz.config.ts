const framing = {
  entries: (section: Record<string, unknown>) =>
    typeof section.wrap === "string" ? [section.wrap] : [],
  name: "framing",
  package: "@acme/framing",
  settings: { wrap: "src/frame.ts" },
};

export default { presets: [framing] };
