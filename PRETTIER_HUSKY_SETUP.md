# Prettier + Husky + Lint-Staged Setup ✅

## What Was Installed

### Root Level Dependencies

```json
{
  "devDependencies": {
    "prettier": "^3.6.2",
    "husky": "^9.1.7",
    "lint-staged": "^16.2.7",
    "eslint": "^9.39.1",
    "@typescript-eslint/eslint-plugin": "^8.47.0",
    "@typescript-eslint/parser": "^8.47.0"
  }
}
```

## Configuration Files Created

### 1. `.prettierrc` - Prettier Configuration

```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": false,
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "arrowParens": "always",
  "endOfLine": "lf"
}
```

### 2. `.prettierignore` - Files to Skip

- node_modules
- dist/build outputs
- .nx cache
- Lock files
- Generated files

### 3. `.husky/pre-commit` - Git Hook

```bash
# Run lint-staged
bunx lint-staged
```

### 4. `package.json` - Lint-Staged Config

```json
{
  "lint-staged": {
    "*.{ts,tsx,js,jsx,json,md,css}": ["prettier --write"]
  }
}
```

## Available Scripts

### Root Level

```bash
# Format all files
bun run format

# Check formatting without changing files
bun run format:check
```

### API Package

```bash
cd api

# Format API files
bun run format

# Check API formatting
bun run format:check
```

### App Package

```bash
cd app

# Format frontend files
bun run format

# Check frontend formatting
bun run format:check
```

## How It Works

### Automatic Formatting on Commit

When you run `git commit`:

1. **Husky** intercepts the commit
2. **Lint-staged** finds all staged files
3. **Prettier** formats only the staged files
4. Formatted files are automatically added to the commit
5. Commit proceeds if successful

### Example Workflow

```bash
# 1. Make changes to files
vim api/domain/services/market-analysis.ts

# 2. Stage your changes
git add api/domain/services/market-analysis.ts

# 3. Commit (Prettier runs automatically)
git commit -m "feat: add new feature"

# Output:
# ✔ Preparing lint-staged...
# ✔ Running tasks for staged files...
#   ✔ prettier --write
# ✔ Applying modifications...
# [main abc1234] feat: add new feature
```

## Manual Formatting

### Format Everything

```bash
# From root
bun run format
```

### Format Specific Package

```bash
# API only
cd api && bun run format

# App only
cd app && bun run format
```

### Format Specific Files

```bash
# Single file
bunx prettier --write api/domain/services/market-analysis.ts

# Multiple files
bunx prettier --write "api/**/*.ts"
```

## Why Only Prettier in Pre-Commit?

We removed ESLint from the pre-commit hook because:

1. **Different configs** - API and App have different ESLint setups
2. **Speed** - Prettier is much faster than ESLint
3. **Simplicity** - Formatting is automatic, linting is manual
4. **Flexibility** - Developers can fix lint errors at their own pace

### Running Lint Manually

```bash
# Lint everything
bun run lint

# Lint API only
cd api && bun run lint

# Lint App only
cd app && bun run lint
```

## Troubleshooting

### Pre-commit Hook Not Running

```bash
# Reinstall Husky
rm -rf .husky
bunx husky init
echo "bunx lint-staged" > .husky/pre-commit
chmod +x .husky/pre-commit
```

### Prettier Not Formatting

```bash
# Check if file is ignored
bunx prettier --check your-file.ts

# Force format
bunx prettier --write your-file.ts
```

### Skip Pre-commit Hook (Emergency)

```bash
# Skip hooks for one commit
git commit --no-verify -m "emergency fix"
```

## IDE Integration

### VS Code

Install the Prettier extension and add to `.vscode/settings.json`:

```json
{
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.formatOnSave": true,
  "[typescript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[typescriptreact]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  }
}
```

### WebStorm/IntelliJ

1. Go to Settings → Languages & Frameworks → JavaScript → Prettier
2. Check "On save"
3. Set Prettier package path to `node_modules/prettier`

## What Gets Formatted

### Included

- ✅ TypeScript files (`.ts`, `.tsx`)
- ✅ JavaScript files (`.js`, `.jsx`)
- ✅ JSON files (`.json`)
- ✅ Markdown files (`.md`)
- ✅ CSS files (`.css`)

### Excluded

- ❌ `node_modules/`
- ❌ `dist/`, `build/`
- ❌ `.nx/` cache
- ❌ Lock files
- ❌ Generated files

## Benefits

### 1. Consistent Code Style

- All code follows the same formatting rules
- No more debates about semicolons, quotes, etc.

### 2. Automatic Formatting

- Format on commit (no manual work)
- Format on save (with IDE integration)

### 3. Cleaner Git Diffs

- No formatting-only changes
- Easier code reviews

### 4. Faster Development

- Don't think about formatting
- Focus on logic, not style

## Testing the Setup

### Test 1: Create Badly Formatted File

```bash
echo "const   x    =     1;" > test.ts
git add test.ts
git commit -m "test"
# Prettier will format it automatically
```

### Test 2: Check Formatting

```bash
# Check all files
bun run format:check

# Should show no errors if everything is formatted
```

### Test 3: Manual Format

```bash
# Format everything
bun run format

# Check git diff to see changes
git diff
```

## Updating Configuration

### Change Prettier Rules

Edit `.prettierrc`:

```json
{
  "semi": false, // Remove semicolons
  "singleQuote": true, // Use single quotes
  "printWidth": 120 // Longer lines
}
```

Then reformat everything:

```bash
bun run format
```

### Add More File Types

Edit `package.json`:

```json
{
  "lint-staged": {
    "*.{ts,tsx,js,jsx,json,md,css,html,yaml}": ["prettier --write"]
  }
}
```

## Disabling for Specific Files

### Ignore Entire File

Add to `.prettierignore`:

```
# Ignore specific file
api/generated/schema.ts

# Ignore directory
api/generated/**
```

### Ignore Code Block

```typescript
// prettier-ignore
const matrix = [
  1, 0, 0,
  0, 1, 0,
  0, 0, 1
];
```

## CI/CD Integration

### GitHub Actions

```yaml
name: Format Check

on: [pull_request]

jobs:
  format:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: oven-sh/setup-bun@v1
      - run: bun install
      - run: bun run format:check
```

### Pre-push Hook (Optional)

```bash
# .husky/pre-push
bun run format:check
bun run lint
```

## Summary

✅ **Prettier** - Automatic code formatting  
✅ **Husky** - Git hooks management  
✅ **Lint-staged** - Run commands on staged files  
✅ **Pre-commit** - Format code before commit  
✅ **Manual scripts** - Format anytime with `bun run format`

Your code will now be automatically formatted on every commit!
