export type UserId = string & { readonly UserId: unique symbol };
export const UserId = (id: string) => id as UserId;

export type UserStatus = "active" | "suspended" | "banned";

export interface User {
  readonly id: UserId;
  readonly status: UserStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
