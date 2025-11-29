declare const ApiError_base: new <A extends Record<string, any> = {}>(
  args: import("effect/Types").Equals<A, {}> extends true
    ? void
    : { readonly [P in keyof A as P extends "_tag" ? never : P]: A[P] }
) => import("effect/Cause").YieldableError & {
  readonly _tag: "ApiError";
} & Readonly<A>;
export declare class ApiError extends ApiError_base<{
  readonly message: string;
  readonly status?: number;
  readonly statusText?: string;
}> {}
declare const NetworkError_base: new <A extends Record<string, any> = {}>(
  args: import("effect/Types").Equals<A, {}> extends true
    ? void
    : { readonly [P in keyof A as P extends "_tag" ? never : P]: A[P] }
) => import("effect/Cause").YieldableError & {
  readonly _tag: "NetworkError";
} & Readonly<A>;
export declare class NetworkError extends NetworkError_base<{
  readonly message: string;
}> {}
export {};
//# sourceMappingURL=errors.d.ts.map
