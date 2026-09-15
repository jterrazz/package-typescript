module.exports = {
  forbidden: [
    {
      name: "domain-stays-pure",
      severity: "error",
      comment: "A domain module never reaches for infrastructure.",
      from: { path: "^src/domain" },
      to: { path: "^src/infrastructure" },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    tsPreCompilationDeps: true,
  },
};
