/**
 * Central API In-Flight Request Guard & Deduplication Utility
 * 
 * Guarantees:
 * 1. For all GET requests: Deduplicates concurrent identical requests by returning the active in-flight Promise.
 * 2. For all API endpoints: Serializes identical overlapping calls so that if the same endpoint is triggered repeatedly,
 *    the subsequent request strictly waits until the previous request to that endpoint has finished/responded.
 * 3. Prevents runaway API loops, uncoordinated interval spam, and race conditions.
 */

type InFlightEntry = {
  promise: Promise<Response>;
  timestamp: number;
};

const inFlightGetRequests = new Map<string, InFlightEntry>();
const endpointLocks = new Map<string, Promise<any>>();

function extractAuthHeader(headers?: HeadersInit): string {
  if (!headers) return '';
  if (headers instanceof Headers) {
    return headers.get('Authorization') || headers.get('authorization') || '';
  }
  if (Array.isArray(headers)) {
    const found = headers.find(([k]) => k.toLowerCase() === 'authorization');
    return found ? found[1] : '';
  }
  if (typeof headers === 'object') {
    const record = headers as Record<string, string>;
    return record['Authorization'] || record['authorization'] || '';
  }
  return '';
}

function normalizeRequestKey(input: RequestInfo | URL, init?: RequestInit): string {
  const isReq = typeof Request !== 'undefined' && input instanceof Request;
  const method = (init?.method || (isReq ? input.method : 'GET')).toUpperCase();
  const url = typeof input === 'string' ? input : (input instanceof URL ? input.toString() : input.url);
  let auth = extractAuthHeader(init?.headers);
  if (!auth && isReq) {
    auth = input.headers.get('Authorization') || input.headers.get('authorization') || '';
  }
  const authSuffix = auth ? `|auth:${auth.slice(-16)}` : '';
  return `${method}:${url}${authSuffix}`;
}

/**
 * Executes a network fetch with in-flight deduplication and serialized concurrency protection.
 */
export async function guardedFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const method = (init?.method || 'GET').toUpperCase();
  const requestKey = normalizeRequestKey(input, init);

  // 1. GET Requests: In-Flight Deduplication
  if (method === 'GET') {
    const existing = inFlightGetRequests.get(requestKey);
    if (existing) {
      // Return a cloned response from the in-flight promise to avoid body stream locking
      try {
        const res = await existing.promise;
        return res.clone();
      } catch (err) {
        // If previous failed, remove and let new attempt run
        inFlightGetRequests.delete(requestKey);
      }
    }

    const fetchPromise = (async () => {
      try {
        const response = await fetch(input, init);
        return response;
      } finally {
        inFlightGetRequests.delete(requestKey);
      }
    })();

    inFlightGetRequests.set(requestKey, {
      promise: fetchPromise,
      timestamp: Date.now()
    });

    const res = await fetchPromise;
    return res.clone();
  }

  // 2. Non-GET / Mutating Requests: Sequential Serialized Execution per exact key
  // Ensures the previous call to the same endpoint/body completes before the next one runs
  const currentLock = endpointLocks.get(requestKey) || Promise.resolve();

  const nextExecution = (async () => {
    // Wait strictly for previous call on this key to finish
    await currentLock.catch(() => {});
    return await fetch(input, init);
  })();

  endpointLocks.set(
    requestKey,
    nextExecution.finally(() => {
      if (endpointLocks.get(requestKey) === nextExecution) {
        endpointLocks.delete(requestKey);
      }
    })
  );

  return await nextExecution;
}

/**
 * Creates a serialized caller instance for specific UI workflows (e.g. polling loops, auto-save).
 * Guarantees that only one request can be in-flight at a time, rejecting or ignoring overlapping invocations.
 */
export function createSingleInFlightRunner<T>() {
  let isExecuting = false;
  let currentPromise: Promise<T> | null = null;

  return {
    async run(fn: () => Promise<T>): Promise<T | null> {
      if (isExecuting && currentPromise) {
        // Return active promise instead of spawning duplicate run
        return await currentPromise;
      }

      isExecuting = true;
      try {
        currentPromise = fn();
        return await currentPromise;
      } finally {
        isExecuting = false;
        currentPromise = null;
      }
    },
    isRunning() {
      return isExecuting;
    }
  };
}
