import type { Ghostty } from "ghostty-web";

type LoadGhostty = () => Promise<Ghostty>;

export function createGhosttyLoader(loadGhostty: LoadGhostty): () => Promise<Ghostty> {
  let pending: Promise<Ghostty> | null = null;

  return () => {
    if (pending) return pending;
    const attempt = Promise.resolve().then(loadGhostty);
    pending = attempt;
    void attempt.catch(() => {
      if (pending === attempt) pending = null;
    });
    return attempt;
  };
}

export const ensureGhostty = createGhosttyLoader(async () => {
  const { Ghostty } = await import("ghostty-web");
  return Ghostty.load("/ghostty-vt.wasm");
});
