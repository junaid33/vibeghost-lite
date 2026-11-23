export type TerminalCheckpointReconciliation =
  | { kind: "append"; delta: Uint8Array }
  | {
      kind: "reset"
      reason:
        | "no-checkpoint"
        | "truncated-snapshot"
        | "snapshot-shorter"
        | "prefix-mismatch"
    }

/**
 * Reconcile an authoritative stdout snapshot with the raw checkpoint already
 * represented by the mounted terminal. An exact prefix proves that rebuilding
 * WASM is unnecessary: only bytes emitted during the transport gap are missing.
 */
export function reconcileTerminalCheckpoint(options: {
  checkpoint: Uint8Array | null
  snapshot: Uint8Array
  snapshotTruncated: boolean
}): TerminalCheckpointReconciliation {
  const { checkpoint, snapshot, snapshotTruncated } = options
  if (!checkpoint) return { kind: "reset", reason: "no-checkpoint" }
  if (snapshotTruncated) {
    return { kind: "reset", reason: "truncated-snapshot" }
  }
  if (snapshot.byteLength < checkpoint.byteLength) {
    return { kind: "reset", reason: "snapshot-shorter" }
  }

  for (let index = 0; index < checkpoint.byteLength; index += 1) {
    if (checkpoint[index] !== snapshot[index]) {
      return { kind: "reset", reason: "prefix-mismatch" }
    }
  }

  return {
    kind: "append",
    delta: snapshot.subarray(checkpoint.byteLength),
  }
}
