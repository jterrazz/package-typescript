/** The `docs/` tree of one repository, as a rule engine needs to see it. */
export interface DocsTree {
    /** The root `AGENTS.md`, its whole text, or `null` when the repository has none. */
    readonly agents: null | string;
    /**
     * Every path under `docs/`, repository-relative, sorted, directories carrying
     * a trailing slash — `docs/` itself included, whose absence IS `docs-absent`.
     */
    readonly files: readonly string[];
    /**
     * The opening lines of each file a rule reads — a decision record's head, a
     * reference page's generation stamp. The reader supplies the first
     * `HEAD_LINES` of every markdown file under `docs/`; no rule looks further
     * down a page, so a `**Status:**` below that line is a status the manual
     * does not declare.
     */
    readonly heads: Readonly<Record<string, readonly string[]>>;
    /** Every markdown link target of each file under `docs/`, in the order the page carries them. */
    readonly links: Readonly<Record<string, readonly string[]>>;
    /** The three facts the `04-operating.md` presence test is derived from. */
    readonly ships: {
        /** A `Dockerfile` at the repository root or at a workspace member's. */
        readonly dockerfile: boolean;
        /** An `.infrastructure/` directory at either. */
        readonly infrastructure: boolean;
        /** A `package.json` at either that is not `"private": true`. */
        readonly publishable: boolean;
    };
}

/** One broken rule, naming the path it is about and the sentence the gate prints. */
export interface DocsViolation {
    readonly message: string;
    readonly path: string;
    readonly rule: string;
}

/** How many opening lines of a file a rule may read. */
export declare const HEAD_LINES: number;

/** What breaks the shape of `docs/`, in rule order. An empty array is a compliant manual. */
export declare function auditDocs(tree: DocsTree): readonly DocsViolation[];
