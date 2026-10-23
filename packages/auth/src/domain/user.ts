import { Brand } from "effect";

export type UserId = string & Brand.Brand<"UserId">;

export const makeUserId = Brand.nominal<UserId>();

export type UserStatus = "active" | "suspended" | "banned";

export interface User {
  readonly id: UserId;
  readonly status: UserStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
