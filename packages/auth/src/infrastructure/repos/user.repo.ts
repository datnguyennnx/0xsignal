import { Context, Effect, Layer } from "effect";
import { PostgresConnectionPool } from "../db/postgres";
import { makeUserId } from "../../domain/user";
import type { User, UserId, UserStatus } from "../../domain/user";

type UserRow = {
  readonly id: string;
  readonly status: UserStatus;
  readonly created_at: Date | string;
  readonly updated_at: Date | string;
};

const mapRow = (row: UserRow): User => ({
  id: makeUserId(row.id),
  status: row.status,
  createdAt: new Date(row.created_at),
  updatedAt: new Date(row.updated_at),
});

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

      return UserRepo.of({
        findById: (id) => Effect.sync(() => memoryUsers.get(id) ?? null),

        create: ({ status = "active" }) =>
          Effect.sync(() => {
            const id = makeUserId(crypto.randomUUID());
            const now = new Date();
            const user: User = { id, status, createdAt: now, updatedAt: now };
            memoryUsers.set(id, user);
            return user;
          }),
      });
    }

    return UserRepo.of({
      findById: (id) =>
        Effect.tryPromise(async () => {
          const result = await pg.query<UserRow>("SELECT * FROM users WHERE id = $1", [id]);
          return result.rows.length > 0 ? mapRow(result.rows[0]) : null;
        }).pipe(Effect.orDie),

      create: ({ status = "active" }) =>
        Effect.tryPromise(async () => {
          const result = await pg.query<UserRow>(
            "INSERT INTO users (status) VALUES ($1) RETURNING *",
            [status],
          );
          return mapRow(result.rows[0]);
        }).pipe(Effect.orDie),
    });
  }),
);
