import Anthropic from "@anthropic-ai/sdk";
import { MAX_RETRIES, RETRY_DELAYS } from "../constants.js";
import { apiRateLimited, VectisError } from "../types/errors.js";
import type { Logger } from "../utils/logger.js";

function isRetryable(err: unknown): boolean {
  if (err instanceof Anthropic.RateLimitError) return true;
  if (err instanceof Anthropic.APIConnectionError) return true;
  if (err instanceof Anthropic.InternalServerError) return true;
  return false;
}

function isAuthError(err: unknown): boolean {
  if (err instanceof Anthropic.AuthenticationError) return true;
  if (err instanceof Anthropic.PermissionDeniedError) return true;
  return false;
}

export async function withRetry<T>(fn: () => Promise<T>, logger: Logger): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      if (isAuthError(err)) {
        throw new VectisError(
          "Authentication failed",
          "API_KEY_INVALID",
          "Your Anthropic API key is invalid or lacks permissions.",
          "Check your key at console.anthropic.com and update with /init.",
        );
      }

      if (!isRetryable(err) || attempt === MAX_RETRIES) {
        break;
      }

      const delay = RETRY_DELAYS[attempt] ?? 4000;
      logger.debug(
        `Retryable error (attempt ${attempt + 1}/${MAX_RETRIES}), waiting ${delay}ms...`,
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  if (lastError instanceof Anthropic.RateLimitError) {
    throw apiRateLimited();
  }

  throw lastError;
}
