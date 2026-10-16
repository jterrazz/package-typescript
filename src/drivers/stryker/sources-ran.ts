// invariant: a script with a source map is read through it — the copy of the package a spec installs carries none, so it is read through the map of the sandbox's own build when its text is that build's; a script of the sandbox with no map is a source run as it is; one of the package that no map reads makes the test read as one that may have run any source; any other script is a dependency, which the install stands for.
// invariant: a script with no map whose every line imports or re-exports, and that git does not list — a facade the bundler leaves for an entry, which it writes no map for — runs no code of its own: the modules it names are scripts of their own, each read for itself, so it names no source and blinds no test. A listed one is a source whose change may re-route what loads, and where git cannot list the tree every facade is read as listed.
export const SOURCES_RAN_SOURCE = `const scripts = new Map();

const FACADE_LINE = /^(?:import\\s[^;]*\\bfrom\\s*(["'])[^"']+\\1|import\\s*(["'])[^"']+\\2|export\\s*\\{[^}]*\\}(?:\\s*from\\s*(["'])[^"']+\\3)?|export\\s*\\*(?:\\s+as\\s+[\\w$]+)?\\s*from\\s*(["'])[^"']+\\4);$/u;

const isFacade = (text) => text.split('\\n').every((line) => line.trim() === '' || FACADE_LINE.test(line.trim()));

const listedIn = new Map();

function isListed(root, file) {
    if (!listedIn.has(root)) {
        try {
            listedIn.set(root, new Set(execFileSync('git', ['ls-files', '-z'], { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).toString().split('\\0')));
        } catch {
            listedIn.set(root, null);
        }
    }
    const listed = listedIn.get(root);
    return listed === null || listed.has(file);
}

function scriptAt(path, root, own) {
    const inside = path.startsWith(root + sep) && !path.slice(root.length + 1).split(sep).includes('node_modules');
    const marker = own === undefined ? undefined : \`\${sep}node_modules\${sep}\${own.split('/').join(sep)}\${sep}\`;
    const ownAt = marker === undefined ? -1 : path.lastIndexOf(marker);
    if (!inside && ownAt === -1) {
        return { kind: 'dependency' };
    }
    let text;
    try {
        text = readFileSync(path, 'utf8');
    } catch {
        return { kind: 'blind' };
    }
    let mapPath = \`\${path}.map\`;
    if (!existsSync(mapPath) && ownAt !== -1) {
        const built = join(root, path.slice(ownAt + marker.length));
        if (existsSync(built) && readFileSync(built, 'utf8') === text) {
            mapPath = \`\${built}.map\`;
        }
    }
    if (!existsSync(mapPath)) {
        const file = inside ? relative(root, path) : path.slice(ownAt + marker.length).split(sep).join('/');
        if (isFacade(text) && !isListed(root, file)) {
            return { kind: 'dependency' };
        }
        return inside ? { file: relative(root, path), kind: 'source' } : { kind: 'blind' };
    }
    const payload = JSON.parse(readFileSync(mapPath, 'utf8'));
    const base = resolve(dirname(mapPath), payload.sourceRoot ?? '');
    const sourceOf = (source) => relative(root, source.startsWith('file:') ? fileURLToPath(source) : resolve(base, source));
    const lineStarts = [0];
    for (let at = text.indexOf('\\n'); at !== -1; at = text.indexOf('\\n', at + 1)) {
        lineStarts.push(at + 1);
    }
    return { kind: 'mapped', lineStarts, map: new SourceMap(payload), sourceOf, sources: payload.sources.map(sourceOf) };
}

function sourceAt(script, offset) {
    let low = 0;
    let high = script.lineStarts.length - 1;
    while (low < high) {
        const middle = (low + high + 1) >> 1;
        if (script.lineStarts[middle] <= offset) {
            low = middle;
        } else {
            high = middle - 1;
        }
    }
    const { originalSource } = script.map.findEntry(low, offset - script.lineStarts[low]);
    return originalSource === undefined ? undefined : script.sourceOf(originalSource);
}

function sourcesRan(functions, root, own) {
    const ran = new Set();
    const loaded = new Set();
    for (const [url, offsets] of functions) {
        const path = fileURLToPath(url);
        if (!scripts.has(path)) {
            scripts.set(path, scriptAt(path, root, own));
        }
        const script = scripts.get(path);
        if (script.kind === 'blind') {
            return undefined;
        }
        if (script.kind === 'source') {
            loaded.add(script.file);
            if ([...offsets].length > 0) {
                ran.add(script.file);
            }
        }
        if (script.kind === 'mapped') {
            for (const source of script.sources) {
                loaded.add(source);
            }
            for (const offset of offsets) {
                const source = sourceAt(script, offset);
                if (source !== undefined) {
                    ran.add(source);
                }
            }
        }
    }
    return { loaded: [...loaded].sort(), ran: [...ran].sort() };
}`;
