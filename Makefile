.PHONY: install build install-self lint fix test check check-links mutation rehearse

# invariant: the stamp depends on the packed toolchain tarballs as well as the manifest and the lockfile, so an edited manifest or a package packed again under the same name is installed again, never run against yesterday's build.
# invariant: an install replaces the dependencies a running gate reads, so every path that installs (`install`, and any target that depends on `node_modules/.install`) asks the toolchain's `gate-lock` first, which refuses while another gate holds `.artifacts/gate.lock`; a checkout with no install yet holds no gate.
node_modules/.install: package.json package-lock.json $(wildcard .artifacts/packages/*.tgz)
	@if [ -d node_modules ] && [ -f dist/typescript.js ]; then node dist/typescript.js gate-lock; fi
	npm ci
	@touch node_modules/.install

install: node_modules/.install

# invariant: a build is keyed by what it reads: every file git lists outside `specs/` and `.github/`, by its path and its bytes (the tree `git write-tree` writes from a copy of the index once `git add --all` has laid the working tree in it), the install and Node's version; where git writes no tree the key is empty, and an empty key matches no build.
BUILD_KEY = index=.artifacts/build.$$$$.index; cp "$$(git rev-parse --git-path index)" $$index 2> /dev/null && GIT_INDEX_FILE=$$index git add --all -- . && GIT_INDEX_FILE=$$index git rm -r -q --cached --ignore-unmatch -- specs .github && tree=$$(GIT_INDEX_FILE=$$index git write-tree) && echo "$$tree $$(node --version) $$(git hash-object node_modules/.package-lock.json)"; rm -f $$index

# invariant: `dist/` is built again unless the key the last build wrote is this tree's and nothing in `dist/` is newer than that key, so an edited input, a build another gesture wrote and a deleted `dist/` all build, and an unchanged tree never does.
build: node_modules/.install
	@mkdir -p .artifacts; key="$$($(BUILD_KEY))"; \
	if [ -n "$$key" ] && [ "$$key" = "$$(cat .artifacts/build.key 2> /dev/null)" ] && [ -f dist/typescript.js ] && [ -z "$$(find dist -newer .artifacts/build.key -print -quit)" ]; then \
		echo "build: dist/ is this tree's build"; \
	else \
		rm -f .artifacts/build.key && npm run build && echo "$$key" > .artifacts/build.key; \
	fi

# invariant: the repository installs itself (`file:.`) as a copy of its tarball, laid again from this build's, so what the specs and @jterrazz/test load from node_modules is what a consumer installs; the copy is laid again unless it is the one this build's key laid and neither it nor the install moved since.
install-self: build
	@key="$$(cat .artifacts/build.key 2> /dev/null)"; \
	if [ -n "$$key" ] && [ "$$key" = "$$(cat .artifacts/self/key 2> /dev/null)" ] && [ -f node_modules/@jterrazz/typescript/dist/typescript.js ] && [ -z "$$(find node_modules/.install node_modules/@jterrazz/typescript -newer .artifacts/self/key -print -quit)" ]; then \
		:; \
	else \
		rm -rf .artifacts/self node_modules/@jterrazz/typescript && \
		mkdir -p .artifacts/self node_modules/@jterrazz/typescript && \
		npm pack --ignore-scripts --silent --pack-destination .artifacts/self > /dev/null && \
		tar -xzf .artifacts/self/*.tgz --strip-components=1 -C node_modules/@jterrazz/typescript && \
		echo "$$key" > .artifacts/self/key; \
	fi

lint: install-self
	npm run lint

fix: install-self
	npm run lint:fix

test: install-self
	node dist/typescript.js test

# invariant: the three steps are one gate: `TYPESCRIPT_GATE` names this recipe's shell, which `check` and `mutation` hold the checkout in the name of, and whose own builds the lock never refuses.
check: node_modules/.install
	@TYPESCRIPT_GATE=$$$$:$(CURDIR) $(MAKE) --no-print-directory lint test mutation

check-links:
	@command -v lychee > /dev/null || { echo "check-links: lychee is not installed on this machine — brew install lychee"; exit 1; }
	lychee --no-progress README.md docs skills

# value: incremental: only the mutants whose source, covering tests or their ground changed since the report left in .artifacts/stryker/ run again, on every host alike; `MUTATION_ARGS=--cold` starts both runs from no report, as a host that restores none does by itself.
mutation: build
	node dist/typescript.js mutation $(MUTATION_ARGS)

# outside: needs docker and the network; `check` never calls it, and a release runs it on its commit before the tag.
rehearse: build
	node dist/typescript.js rehearse $(REHEARSE_ARGS)
