/**
 * Browser alias target for `node:worker_threads`.
 *
 * ox's tempo `virtualMasterPool` module imports the Node builtin, and the resolver
 * still walks that path even though the code is tree-shaken out of the browser
 * bundle. Aliasing the specifier here silences the externalization warning; any
 * genuine use throws loudly instead of degrading into a browser TypeError.
 */
function unavailable(): never {
  throw new Error(
    "node:worker_threads is unavailable in the browser build (aliased in vite.config.ts for ox tempo's virtualMasterPool import)",
  );
}

export const Worker = unavailable;
export const isMainThread = unavailable;
export default { unavailable };
