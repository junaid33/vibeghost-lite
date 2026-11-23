export type ConnectionPhase = 'loading module' | 'connecting to gateway' | 'loading workspace' | 'saving invite';

/** Bound UI waits without freeing a WASM object while an operation still owns it. */
export function workspaceDeadline<T>(operation: Promise<T>, phase: ConnectionPhase, timeoutMs: number, releaseLate?: (value:T)=>void): Promise<T> {
  return new Promise((resolve,reject)=>{
    let expired=false;
    const timer=setTimeout(()=>{expired=true;reject(new Error(`Timed out ${phase}. Check that the VibeGhost share is online and try again.`));},timeoutMs);
    operation.then(value=>{clearTimeout(timer);if(expired){releaseLate?.(value);return;}resolve(value);},()=>{clearTimeout(timer);if(!expired)reject(new Error(`Failed ${phase}. Check the invite and VibeGhost gateway logs, then retry.`));});
  });
}

export function workspaceDiagnostic(attempt:string,phase:ConnectionPhase,result:'started'|'completed'|'failed',elapsedMs:number) {
  // Deliberately excludes invite IDs, tokens, URLs, terminal output and raw errors.
  console.info('[workspace-connect]',{attempt,phase,result,elapsedMs:Math.round(elapsedMs)});
}
