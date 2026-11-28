const DEFAULT_URL = "http://127.0.0.1:9006/api/health";
const DEFAULT_TIMEOUT_MS = 120_000;
const POLL_MS = 250;
const PROBE_TIMEOUT_MS = 1_000;

const [url = DEFAULT_URL] = process.argv.slice(2);
const timeoutMs = Number(process.env.WAIT_FOR_HTTP_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS);
const deadline = Date.now() + timeoutMs;

async function reachable() {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(PROBE_TIMEOUT_MS) });
    await response.body?.cancel();
    return response.status;
  } catch {
    return null;
  }
}

for (;;) {
  const status = await reachable();
  if (status !== null) {
    console.log(`wait-for-http: ${url} responded ${status}`);
    process.exit(0);
  }
  if (Date.now() >= deadline) {
    console.error(`wait-for-http: ${url} unreachable after ${timeoutMs}ms`);
    process.exit(1);
  }
  await new Promise((resolve) => {
    setTimeout(resolve, POLL_MS);
  });
}
