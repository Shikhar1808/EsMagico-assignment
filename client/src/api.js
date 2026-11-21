// fetch wrapper: always resolves to parsed JSON or throws an Error with a human message.
export async function api(path, options) {
  let res;
  try {
    res = await fetch(path, options);
  } catch (e) {
    if (e.name === 'AbortError') throw e;
    throw new Error('Could not reach the server. Check your connection and try again.');
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const err = new Error(body?.error || `The server returned an error (${res.status}).`);
    err.status = res.status;
    err.code = body?.code;
    throw err;
  }
  return body;
}
