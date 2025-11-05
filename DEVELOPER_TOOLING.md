# Developer Tooling Setup

This document describes the comprehensive developer tooling setup for this monorepo project.

## Overview

The project includes the following developer tools:

- **TypeScript**: Centralized configuration with project references
- **ESLint**: Linting with TypeScript support
- **Prettier**: Code formatting
- **Husky**: Git hooks
- **lint-staged**: Run tools on staged files only
- **commitlint**: Enforce commit message conventions

## TypeScript Configuration

### Structure

```
tsconfig.base.json          # Base configuration (all strict rules)
tsconfig.json               # Root config with project references
packages/*/tsconfig.json    # Each package extends base config
services/*/tsconfig.json    # Each service extends base config
```

### Base Configuration (`tsconfig.base.json`)

Contains all the shared compiler options:

- **Target**: ES2022
- **Module**: CommonJS
- **Strict Mode**: Enabled
- **Source Maps**: Enabled
- **Declaration Files**: Enabled
- **Composite**: Enabled for project references
- **Incremental**: Enabled for faster rebuilds

### Per-Package Configuration

Each package extends the base config and adds:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"],
  "references": [{ "path": "../other-package" }]
}
```

### Benefits

- **Consistency**: All packages use the same strict rules
- **Fast Builds**: Project references enable incremental compilation
- **IDE Performance**: Better IntelliSense and type checking
- **Maintainability**: Update base config once, affects all packages

## ESLint

### Configuration (`.eslintrc.json`)

ESLint is configured with TypeScript support:

- **Parser**: `@typescript-eslint/parser`
- **Plugins**: `@typescript-eslint/eslint-plugin`
- **Extends**:
  - `eslint:recommended`
  - `plugin:@typescript-eslint/recommended`

### Custom Rules

```json
{
  "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
  "@typescript-eslint/explicit-function-return-type": "off",
  "@typescript-eslint/explicit-module-boundary-types": "off",
  "@typescript-eslint/no-explicit-any": "warn"
}
```

### Commands

```bash
# Lint all workspaces
pnpm lint

# Lint root-level files
pnpm lint:root

# Auto-fix linting issues
pnpm lint:root --fix
```

## Prettier

### Configuration (`.prettierrc.json`)

Consistent code formatting across the entire codebase:

```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "arrowParens": "always",
  "endOfLine": "lf"
}
```

### Ignored Files (`.prettierignore`)

```
node_modules
dist
build
coverage
*.log
pnpm-lock.yaml
.husky
.git
```

### Commands

```bash
# Format all files
pnpm format

# Check formatting without changes
pnpm format:check
```

## Husky Git Hooks

Husky provides Git hooks to enforce code quality before commits.

### Pre-commit Hook (`.husky/pre-commit`)

Runs `lint-staged` to lint and format only staged files:

```bash
pnpm exec lint-staged
```

**What it does:**

1. Identifies all staged files
2. Runs ESLint with auto-fix on staged TypeScript files
3. Runs Prettier on staged files (TypeScript, JSON, Markdown, YAML)
4. Automatically stages the fixed files

### Commit Message Hook (`.husky/commit-msg`)

Validates commit messages using commitlint:

```bash
pnpm exec commitlint --edit $1
```

**What it does:**

1. Reads the commit message
2. Validates it against Conventional Commits format
3. Rejects the commit if the message doesn't follow the convention

## lint-staged

### Configuration (`.lintstagedrc.json`)

Defines which tools run on which file types:

```json
{
  "*.{ts,tsx}": ["eslint --fix", "prettier --write"],
  "*.{json,md,yml,yaml}": ["prettier --write"]
}
```

### Benefits

- **Fast**: Only processes staged files
- **Automatic**: Fixes issues before commit
- **Consistent**: Everyone runs the same tools

## commitlint

### Configuration (`commitlint.config.js`)

Enforces Conventional Commits format.

### Commit Message Format

```
<type>(<scope>): <subject>

[optional body]

[optional footer]
```

### Valid Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, missing semicolons, etc.)
- `refactor`: Code refactoring (no functional changes)
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `build`: Build system changes
- `ci`: CI/CD changes
- `chore`: Other changes (maintenance, dependencies, etc.)
- `revert`: Revert a previous commit

### Rules

- **Type**: Required, must be from the list above
- **Subject**: Required, must not be empty, must not start with uppercase
- **Header**: Max 100 characters
- **Scope**: Optional, can be anything (e.g., `api`, `bot`, `worker`, `deps`)

### Examples

✅ **Valid commit messages:**

```bash
git commit -m "feat(api): add user authentication endpoint"
git commit -m "fix(bot): resolve memory leak in message handler"
git commit -m "docs: update README with setup instructions"
git commit -m "chore(deps): upgrade typescript to 5.3.2"
git commit -m "refactor(shared): simplify token service logic"
git commit -m "test(worker): add tests for image generation processor"
```

❌ **Invalid commit messages:**

```bash
git commit -m "added new feature"                    # Missing type
git commit -m "Add new feature"                       # Subject starts with uppercase
git commit -m "feat: Add new feature"                 # Subject starts with uppercase
git commit -m "update: fix bug"                       # Invalid type
git commit -m "feat(api):"                            # Empty subject
```

## Workflow

### Making a Commit

1. **Stage your changes:**

   ```bash
   git add .
   ```

2. **Commit with a valid message:**

   ```bash
   git commit -m "feat(api): add health check endpoint"
   ```

3. **What happens:**
   - Pre-commit hook runs:
     - `lint-staged` lints and formats staged files
     - If there are issues, they're automatically fixed
     - Fixed files are re-staged
   - Commit message hook runs:
     - `commitlint` validates the commit message
     - If invalid, commit is rejected with an error message
   - If both pass, commit succeeds

### Bypassing Hooks (NOT RECOMMENDED)

If you absolutely need to bypass hooks:

```bash
git commit --no-verify -m "message"
```

**⚠️ Warning:** Only use this in emergencies. CI checks will still run.

## CI/CD Integration

While this setup runs locally via git hooks, the same checks should run in CI:

```yaml
# Example GitHub Actions workflow
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - run: pnpm install
      - run: pnpm lint
      - run: pnpm format:check

  typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - run: pnpm install
      - run: pnpm typecheck

  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - run: pnpm install
      - run: pnpm test
```

## Troubleshooting

### Hooks not running

If git hooks aren't running:

```bash
# Reinstall Husky
pnpm prepare

# Check hooks are executable
ls -la .husky/
# Should show: -rwxr-xr-x for pre-commit and commit-msg

# Make hooks executable if needed
chmod +x .husky/pre-commit
chmod +x .husky/commit-msg
```

### lint-staged issues

If `lint-staged` fails:

```bash
# Run manually to see errors
pnpm exec lint-staged

# Check configuration
cat .lintstagedrc.json

# Verify staged files
git diff --cached --name-only
```

### commitlint issues

If `commitlint` rejects valid messages:

```bash
# Test commit message manually
echo "feat(api): test message" | pnpm exec commitlint

# Check configuration
cat commitlint.config.js

# View commitlint help
pnpm exec commitlint --help
```

### ESLint/Prettier conflicts

If ESLint and Prettier disagree:

1. Prettier wins for formatting
2. ESLint handles code quality
3. Run `pnpm format` before `pnpm lint`

### TypeScript errors

If TypeScript errors appear after config changes:

```bash
# Clean and rebuild
pnpm clean
pnpm build

# Generate Prisma client
pnpm db:generate

# Check specific package
cd packages/shared
pnpm typecheck
```

## Best Practices

### Commit Messages

- Use present tense ("add feature" not "added feature")
- Use imperative mood ("move cursor to..." not "moves cursor to...")
- Keep subject line under 72 characters
- Reference issues/tickets in the body
- Explain _what_ and _why_, not _how_

### Code Style

- Let Prettier handle formatting (don't fight it)
- Follow ESLint suggestions
- Write meaningful variable names
- Add types for function parameters and return values
- Keep functions small and focused

### Pre-commit

- Review changes before committing
- Fix ESLint warnings, not just errors
- Test your changes locally
- Run `pnpm test` before pushing

## Summary

This developer tooling setup ensures:

- ✅ **Consistent code style** across the entire codebase
- ✅ **Type safety** with strict TypeScript configuration
- ✅ **Code quality** via ESLint rules
- ✅ **Automated fixes** for common issues
- ✅ **Standardized commit messages** for better history
- ✅ **Fast feedback** via git hooks before CI
- ✅ **Better collaboration** with shared conventions

All developers should have these tools installed and running. The git hooks ensure that low-quality code never makes it into the repository.
