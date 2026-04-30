/**
 * Groq chat helpers: model fallback + Hebrew user-facing error messages.
 */

function primaryModel() {
  return process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
}

function fallbackModel() {
  return process.env.GROQ_FALLBACK_MODEL || 'llama-3.1-8b-instant';
}

function modelCandidates() {
  const a = primaryModel();
  const b = fallbackModel();
  return a === b ? [a] : [a, b];
}

/** If the first model fails (wrong id, overload, etc.), try the lighter backup model once. */
export function shouldTryFallback(err) {
  const s = err?.status ?? err?.response?.status;
  if (s === 401 || s === 403) return false;
  if (s === 429) return true;
  if (s === 404) return true;
  if (s === 400 || s === 422) {
    const m = `${err?.message || ''} ${err?.error?.message || ''}`.toLowerCase();
    if (/model|invalid|unsupported|deactivat/.test(m)) return true;
  }
  if (s >= 500) return true;
  const name = err?.name || '';
  if (/timeout|connection|network|fetch/i.test(name + (err?.message || ''))) return true;
  return false;
}

/**
 * @param {import('groq-sdk').default} groq
 * @param {Omit<import('groq-sdk').Groq.Chat.ChatCompletionCreateParams, 'model'>} params
 */
export async function chatCompletionWithFallback(groq, params, logTag = 'groq') {
  const models = modelCandidates();
  let lastErr;
  for (let i = 0; i < models.length; i++) {
    const model = models[i];
    try {
      const res = await groq.chat.completions.create({ ...params, model });
      if (i > 0) console.warn(`[${logTag}] used fallback model=${model}`);
      return res;
    } catch (e) {
      lastErr = e;
      console.error(`[${logTag}] model=${model} failed:`, e?.status, e?.message, e?.error);
      if (i < models.length - 1 && shouldTryFallback(e)) continue;
      throw e;
    }
  }
  throw lastErr;
}

/**
 * @param {import('groq-sdk').default} groq
 * @param {Omit<import('groq-sdk').Groq.Chat.ChatCompletionCreateParamsStreaming, 'model'>} params
 */
export async function streamCompletionWithFallback(groq, params, logTag = 'groq') {
  const models = modelCandidates();
  let lastErr;
  for (let i = 0; i < models.length; i++) {
    const model = models[i];
    try {
      const stream = await groq.chat.completions.create({ ...params, model, stream: true });
      if (i > 0) console.warn(`[${logTag}] stream fallback model=${model}`);
      return stream;
    } catch (e) {
      lastErr = e;
      console.error(`[${logTag}] stream model=${model} failed:`, e?.status, e?.message, e?.error);
      if (i < models.length - 1 && shouldTryFallback(e)) continue;
      throw e;
    }
  }
  throw lastErr;
}

/** Readable Hebrew line for API routes; optional `code` for client hints. */
export function groqErrorForClient(err) {
  const status = err?.status ?? err?.response?.status;
  const apiMsg = String(err?.error?.message || err?.message || '').slice(0, 200);

  if (status === 401 || status === 403) {
    return {
      error: 'בעיית הרשאה עם מפתח Groq — צור מפתח חדש ב-console.groq.com והדבק ב-server/.env תחת GROQ_API_KEY.',
      code: 'GROQ_AUTH_FAILED',
    };
  }
  if (status === 429) {
    return {
      error: 'Groq מגביל בקשות לרגע — נסה שוב בעוד דקה.',
      code: 'GROQ_RATE_LIMIT',
    };
  }
  if (status >= 500 || /timeout|ETIMEDOUT|ECONNRESET|network/i.test(apiMsg + (err?.cause?.message || ''))) {
    return {
      error: 'שרת Groq לא ענה בזמן — נסה שוב בעוד רגע.',
      code: 'GROQ_UNAVAILABLE',
    };
  }
  return {
    error: 'לא ניתן לקבל תשובה כרגע. נסה שוב בעוד רגע.',
    code: 'GROQ_ERROR',
    detail: apiMsg || undefined,
  };
}
