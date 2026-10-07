/**
 * fetch for the smoke test, with one retry for a connection the server has already closed.
 *
 * The harness drives Docker with spawnSync, which blocks this process's event loop for seconds at a
 * time. Apache closes an idle keep-alive connection after 5 seconds, and while the loop is blocked
 * undici cannot notice, so the next request is written to a dead socket and fails with "other side
 * closed". The failed socket is dropped, so asking again goes out on a fresh connection.
 */
export async function request(input, init) {
  try {
    return await fetch(input, init);
  } catch (error) {
    if (error?.cause?.code !== 'UND_ERR_SOCKET') throw error;
    return fetch(input, init);
  }
}
