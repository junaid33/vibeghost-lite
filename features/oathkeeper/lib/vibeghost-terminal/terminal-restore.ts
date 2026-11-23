type DrainPendingTerminalOutputOptions = {
  hasPending: () => boolean
  flush: () => Uint8Array
  nextPaint: () => Promise<void>
}

/**
 * Drain the output that is pending at entry, then yield for its paint once.
 * Output arriving during that paint is intentionally left for the caller's
 * bounded settle loop instead of allowing an inner loop to run forever.
 */
export async function drainPendingTerminalOutputOnce({
  hasPending,
  flush,
  nextPaint,
}: DrainPendingTerminalOutputOptions): Promise<Uint8Array> {
  if (!hasPending()) return new Uint8Array()

  const flushed = flush()
  if (flushed.byteLength > 0) await nextPaint()
  return flushed
}
