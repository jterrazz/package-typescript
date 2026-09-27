export type Span = { length: number; offset: number };

export type Diagnostic = {
    code?: string | undefined;
    filename?: string | undefined;
    help?: string | undefined;
    labels?: { label?: string | undefined; span: Span }[];
    message: string;
    note?: string | undefined;
    severity: string;
};

export type Report = {
    diagnostics?: Diagnostic[];
    number_of_files?: number;
    number_of_rules?: null | number;
    start_time?: number;
    threads_count?: number;
};
