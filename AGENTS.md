# Agent Instructions for 0xSignal

## Build Commands

```bash
# Development
bun run dev              # Start all packages
bun run dev:api          # API only
bun run dev:app          # Frontend only

# Building
bun run build            # Build all
bun run build:api        # Build API
bun run build:app        # Build frontend

# Code Quality
bun run lint             # Lint all packages
bun run format           # Format with Prettier
bun run format:check     # Check formatting

# Testing (API package only)
cd packages/api && bun test              # Run all tests
cd packages/api && bun test:watch        # Watch mode
cd packages/api && bun test --testNamePattern="analyzeAsset"  # Single test
cd packages/api && bun test --reporter=verbose                 # Verbose output
```

## Code Style Guidelines

### General

- **Runtime**: Bun (not Node.js)
- **Style**: Functional programming with Effect-TS
- **Imports**: Use `import type` for type-only imports
- **Strict TypeScript**: Enabled with strict mode

### Naming Conventions

- **Services**: `XxxService` interface + `XxxServiceTag` class + `XxxServiceLive` layer
- **Errors**: `XxxError extends Data.TaggedError("XxxError")`
- **Files**: kebab-case for files, camelCase for variables/functions
- **Types**: PascalCase, interfaces preferred over type aliases
- **Constants**: UPPER_SNAKE_CASE for true constants

### Effect-TS Patterns

```typescript
// Service definition
interface UserService {
  readonly getUser: (id: string) => Effect.Effect<User, UserError, never>;
}
class UserServiceTag extends Context.Tag("UserService")<UserServiceTag, UserService>() {}

// Service implementation
const UserServiceLive = Layer.effect(
  UserServiceTag,
  Effect.gen(function* () {
    const db = yield* DatabaseService;
    return {
      getUser: (id) => db.query(`SELECT * FROM users WHERE id = ?`, [id]),
    };
  })
);

// Error handling
class UserError extends Data.TaggedError("UserError")<{ message: string }>() {}
```

### Error Handling

- Use `Effect.Effect<A, ErrorType, never>` for typed errors
- Create specific error types with `Data.TaggedError`
- Handle errors with `.pipe(Effect.catchTag("ErrorName", handler))`
- Never use `any` or `unknown` for errors

### Testing

- Use `@effect/vitest` for testing Effect programs
- Mock services with `Layer.succeed(ServiceTag, mockImplementation)`
- Tests co-located in `__tests__/` directories
- Run single test: `bun test --testNamePattern="test name"`

### Project Structure

```
packages/
  api/                      # Backend
    src/
      domain/               # Pure business logic
      application/          # Use cases
      infrastructure/       # External integrations
      services/             # Effect services
      presentation/         # HTTP routes
  app/                      # Frontend
    src/
      features/             # Feature modules
      core/                 # Runtime, cache
      services/             # Service interfaces
```

### Import Order

1. External dependencies (effect, react)
2. Internal packages (@0xsignal/shared)
3. Relative imports (../services/...)
4. Type-only imports last

### Formatting

- Prettier with default config
- 2 spaces indentation
- Single quotes
- Trailing commas
- Max line length: 80 (soft limit)

## Quick Reference

**Run a single test:**

```bash
cd packages/api && bun test --testNamePattern="analyzeAsset"
```

**Effect program structure:**

```typescript
const program = Effect.gen(function* () {
  const service = yield* ServiceTag;
  const result = yield* service.method();
  return result;
});
```

**Layer composition:**

```typescript
const AppLayer = Layer.mergeAll(Service1Live, Service2Live.pipe(Layer.provide(Service1Live)));
```
