.PHONY: install build lint fix test check

install:
	npm install

build:
	npx typescript build

lint:
	npx typescript check

fix:
	npx typescript fix

test:
	npx vitest --run

check: build lint test
