import { isAxiosError } from 'axios';

function extractPayloadMessage(payload: unknown): string | null {
  if (typeof payload === 'string' && payload.trim()) {
    return payload.trim();
  }

  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const record = payload as Record<string, unknown>;
  const candidates = [record.message, record.error, record.detail];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }

    if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
      const detailRecord = candidate as Record<string, unknown>;
      const detailMessage =
        typeof detailRecord.message === 'string' && detailRecord.message.trim()
          ? detailRecord.message.trim()
          : null;
      const detailCode =
        typeof detailRecord.code === 'string' && detailRecord.code.trim()
          ? detailRecord.code.trim()
          : null;

      if (detailMessage && detailCode) {
        return `${detailMessage} (${detailCode})`;
      }

      if (detailMessage) {
        return detailMessage;
      }
    }

    if (Array.isArray(candidate) && candidate.length > 0) {
      const firstIssue = candidate.find((entry) => entry && typeof entry === 'object') as
        | Record<string, unknown>
        | undefined;

      if (firstIssue) {
        const loc = Array.isArray(firstIssue.loc)
          ? firstIssue.loc.filter((part) => typeof part === 'string').join('.')
          : null;
        const msg =
          typeof firstIssue.msg === 'string' && firstIssue.msg.trim()
            ? firstIssue.msg.trim()
            : null;

        if (loc && msg) {
          return `${loc}: ${msg}`;
        }

        if (msg) {
          return msg;
        }
      }
    }
  }

  return null;
}

export function extractHostRequestErrorMessage(error: unknown, fallback: string): string {
  if (isAxiosError(error)) {
    const payloadMessage = extractPayloadMessage(error.response?.data);
    if (payloadMessage) {
      return payloadMessage;
    }
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  return fallback;
}

export function mapHostErrorCode(code: string | null | undefined): string | null {
  switch (code) {
    case 'NOT_FOUND':
      return 'That record no longer exists.';
    case 'VALIDATION_ERROR':
      return 'Check the required fields and try again.';
    case 'PERMISSION_DENIED':
      return 'Your account does not have permission for this action.';
    case 'INVALID_STATUS':
      return 'That item is not in a valid state for this action.';
    case 'OPTED_OUT':
      return 'This guest has opted out of SMS messages.';
    case 'PROVIDER_REJECTED':
      return 'The message provider rejected this SMS.';
    case 'RATE_LIMITED':
      return 'Too many requests. Try again shortly.';
    default:
      return null;
  }
}
