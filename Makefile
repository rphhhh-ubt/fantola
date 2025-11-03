.PHONY: help install build dev clean lint typecheck test

help:
	@echo "Available commands:"
	@echo "  make install    - Install all dependencies"
	@echo "  make build      - Build all packages and services"
	@echo "  make dev        - Run all services in development mode"
	@echo "  make clean      - Clean build artifacts"
	@echo "  make lint       - Run linting"
	@echo "  make typecheck  - Run TypeScript type checking"
	@echo "  make test       - Run tests"

install:
	pnpm install

build:
	pnpm build

dev:
	pnpm dev

clean:
	pnpm clean

lint:
	pnpm lint

typecheck:
	pnpm typecheck

test:
	pnpm test
