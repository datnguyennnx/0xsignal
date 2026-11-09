export function isAborted(signal?: AbortSignal): boolean {
  return signal?.aborted === true;
}
