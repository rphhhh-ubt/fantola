# Contributing Guide

Thank you for your interest in contributing to this project! This guide will help you get started.

## Development Setup

### Prerequisites

- Node.js >= 18.0.0
- pnpm >= 8.0.0

### Installation

1. Clone the repository:

   ```bash
   git clone <repository-url>
   cd monorepo
   ```

2. Install dependencies:

   ```bash
   pnpm install
   ```

3. Build all packages and services:
   ```bash
   pnpm build
   ```

## Development Workflow

### Running Services

Run all services in development mode:

```bash
pnpm dev
```

Run a specific service:

```bash
pnpm api:dev      # API service
pnpm bot:dev      # Bot service
pnpm worker:dev   # Worker service
```

### Code Quality

Before submitting changes, ensure your code passes all checks:

```bash
pnpm lint          # Run linting
pnpm typecheck     # Run type checking
pnpm build         # Build all packages
pnpm test          # Run tests
```

### Code Style

This project uses Prettier and ESLint for code formatting and linting:

- **Quotes:** Single quotes for strings
- **Semicolons:** Required
- **Indentation:** 2 spaces
- **Line Width:** 100 characters
- **Trailing Commas:** ES5 style
- **Arrow Functions:** Always use parentheses
- **Line Endings:** LF (Unix-style)

### Commit Messages

Follow conventional commits format:

- `feat:` - New features
- `fix:` - Bug fixes
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting, etc.)
- `refactor:` - Code refactoring
- `test:` - Test changes
- `chore:` - Build process or auxiliary tool changes

Examples:

```bash
git commit -m "feat: add user authentication"
git commit -m "fix: resolve memory leak in worker service"
git commit -m "docs: update API documentation"
```

## Project Structure

### Workspaces

- **services/** - Application services (api, bot, worker)
- **packages/** - Shared packages (config, shared)

### Adding Dependencies

Add a dependency to a specific workspace:

```bash
pnpm --filter <workspace-name> add <package-name>
```

Add a dev dependency to root:

```bash
pnpm add -w -D <package-name>
```

### Creating New Workspaces

1. Create a new directory in `services/` or `packages/`
2. Add a `package.json` with necessary scripts
3. Add a `tsconfig.json` extending root configuration
4. Create a `src/` directory with an `index.ts` file
5. If it depends on other workspaces, use `workspace:*` protocol

## Pull Request Process

1. Create a feature branch from `main`
2. Make your changes
3. Ensure all tests and checks pass
4. Update documentation if needed
5. Submit a pull request with a clear description
6. Wait for code review and address any feedback

## Questions?

If you have questions or need help, please open an issue or contact the maintainers.
