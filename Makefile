.PHONY: install build install-self lint fix test check check-links mutation

node_modules/.install: package-lock.json
	npm ci
	@touch node_modules/.install

# invariant: an install replaces the dependencies a running gate reads; `check` holds `.artifacts/gate.lock` with its own pid, and an install while that process lives is refused.
install:
	@if [ -f .artifacts/gate.lock ] && kill -0 "$$(cat .artifacts/gate.lock)" 2> /dev/null; then echo "install: the gate of pid $$(cat .artifacts/gate.lock) holds this checkout - wait for it to end, or install in a worktree of its own"; exit 1; fi
	@$(MAKE) --no-print-directory node_modules/.install

build: node_modules/.install
	npm run build

# invariant: the repository installs itself (`file:.`) as a copy of its tarball, laid again from this build's, so what the specs and @jterrazz/test load from node_modules is what a consumer installs.
install-self: build
	@rm -rf .artifacts/self node_modules/@jterrazz/typescript
	@mkdir -p .artifacts/self node_modules/@jterrazz/typescript
	@npm pack --ignore-scripts --silent --pack-destination .artifacts/self > /dev/null
	@tar -xzf .artifacts/self/*.tgz --strip-components=1 -C node_modules/@jterrazz/typescript

lint: install-self
	npm run lint

fix: build
	npm run lint:fix

test: install-self
	npm test

check:
	@mkdir -p .artifacts && echo $$PPID > .artifacts/gate.lock
	@status=0; $(MAKE) --no-print-directory lint test mutation || status=$$?; rm -f .artifacts/gate.lock; exit $$status

check-links:
	@command -v lychee > /dev/null || { echo "check-links: lychee is not installed on this machine — brew install lychee"; exit 1; }
	lychee --no-progress README.md docs skills

# value: incremental — only the mutants whose source or tests changed since the report left in .artifacts/stryker/ run again.
mutation: build
	node dist/typescript.js mutation
