import { sleep } from "./site_utils.js";

export async function retryAsync(
  action,
  {
    retries = 3,
    baseDelayMs = 1500,
    maxDelayMs = 10000,
    onRetry = null,
  } = {},
) {
  let attempt = 0;
  let lastError = null;

  while (attempt <= retries) {
    try {
      return await action(attempt);
    } catch (error) {
      lastError = error;
      if (attempt >= retries) {
        break;
      }

      const delayMs = Math.min(baseDelayMs * Math.pow(2, attempt), maxDelayMs);
      if (onRetry) {
        onRetry({
          error,
          attempt: attempt + 1,
          retries,
          delayMs,
        });
      }
      await sleep(delayMs);
    }

    attempt++;
  }

  throw lastError;
}
