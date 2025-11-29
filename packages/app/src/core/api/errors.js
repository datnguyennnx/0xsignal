import { Data } from "effect";
export class ApiError extends Data.TaggedError("ApiError") {}
export class NetworkError extends Data.TaggedError("NetworkError") {}
//# sourceMappingURL=errors.js.map
