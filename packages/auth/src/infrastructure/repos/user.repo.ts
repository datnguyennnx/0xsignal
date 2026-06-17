import { Context, Effect, Layer } from "effect";
import { PostgresConnectionPool } from "../db/postgres";
import type { User, UserId, UserStatus } from "../../domain/user";

export interface UserRepoPort {
  readonly findById: (id: UserId) => Effect.Effect<User | null>;
  readonly create: (params: { status?: UserStatus }) => Effect.Effect<User>;
}

export class UserRepo extends Context.Service<UserRepo, UserRepoPort>()("UserRepo") {}

export const UserRepoLayer: Layer.Layer<UserRepo, never, PostgresConnectionPool> = Layer.effect(
  UserRepo,
  Effect.gen(function* () {
    const pg = yield* PostgresConnectionPool;
    if (pg === null) {
      yield* Effect.logWarning("Postgres not available — using in-memory user repo (dev only)");

      const memoryUsers = new Map<UserId, User>();

      const UserId = (id: string) => id as UserId;

      return UserRepo.of({
        findById: (id) => Effect.sync(() => memoryUsers.get(id) ?? null),

        create: ({ status = "active" }) =>
          Effect.sync(() => {
            const id = UserId(crypto.randomUUID());
            const now = new Date();
            const user: User = { id, status, createdAt: now, updatedAt: now };
            memoryUsers.set(id, user);
            return user;
          }),
      });
    }

    const mapRow = (row: any): User => ({
      id: row.id as UserId,
      status: row.status as UserStatus,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    });

    return UserRepo.of({
      findById: (id) =>
        Effect.tryPromise(async () => {
          const result = await pg!.query("SELECT * FROM users WHERE id = $1", [id]);
          return result.rows.length > 0 ? mapRow(result.rows[0]) : null;
        }).pipe(Effect.orDie),

      create: ({ status = "active" }) =>
        Effect.tryPromise(async () => {
          const result = await pg!.query("INSERT INTO users (status) VALUES ($1) RETURNING *", [
            status,
          ]);
          return mapRow(result.rows[0]);
        }).pipe(Effect.orDie),
    });
  }),
);
