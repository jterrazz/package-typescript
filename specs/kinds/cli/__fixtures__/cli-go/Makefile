.PHONY: install build lint fix test check

install:
	npm install

build:
	go build -o .artifacts/go/greet ./src/cmd/greet

lint:
	npx typescript check

fix:
	npx typescript fix

test:
	npx vitest --run

check: build lint test
