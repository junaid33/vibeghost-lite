type Draft = Readonly<{ text: string; revision: number }>;
const empty: Draft = Object.freeze({ text: "", revision: 0 });
const drafts = new Map<string, Draft>();
const listeners = new Set<() => void>();
const storageKey = (id: string) => `oathkeeper:terminal-draft:${id}`;
export function readTerminalDraft(id: string): Draft {
  if (!id) return empty;
  if (!drafts.has(id)) {
    let text = "";
    try { text = sessionStorage.getItem(storageKey(id)) || ""; } catch {}
    drafts.set(id, { text, revision: 0 });
  }
  return drafts.get(id)!;
}
export function writeTerminalDraft(id: string, value: string | ((text: string) => string)) {
  if (!id) return;
  const current = readTerminalDraft(id);
  const text = typeof value === "function" ? value(current.text) : value;
  if (text === current.text) return;
  drafts.set(id, { text, revision: current.revision + 1 });
  try {
    if (text) sessionStorage.setItem(storageKey(id), text);
    else sessionStorage.removeItem(storageKey(id));
  } catch {}
  for (const listener of listeners) listener();
}
// Identity, not text equality: typing an identical NEW draft is still an edit.
export function completeTerminalDraft(id: string, submitted: Draft) {
  if (readTerminalDraft(id) === submitted) writeTerminalDraft(id, "");
}
export function subscribeTerminalDraft(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export const emptyTerminalDraft = () => empty;

export type TerminalSubmission = Readonly<{ text: string; cleared: Draft; state: 'sending' | 'unconfirmed' }>;
const submissions = new Map<string, TerminalSubmission | null>();
const submissionKey = (id: string) => `oathkeeper:terminal-submission:${id}`;
export const emptyTerminalSubmission = () => null;
export function readTerminalSubmission(id: string): TerminalSubmission | null {
  if (!id) return null;
  if (!submissions.has(id)) {
    let recovered: TerminalSubmission | null = null;
    try {
      const saved = sessionStorage.getItem(submissionKey(id));
      if (saved) {
        const value = JSON.parse(saved);
        if (typeof value.text === 'string') recovered = { text: value.text, cleared: readTerminalDraft(id), state: 'unconfirmed' };
      }
    } catch {}
    submissions.set(id, recovered);
  }
  return submissions.get(id)!;
}

/** Move submitted text out of the editor, but keep it recoverable until acknowledgement. */
export function beginTerminalSubmission(id: string): TerminalSubmission | null {
  if (!id || readTerminalSubmission(id)?.state === 'sending') return null;
  const draft = readTerminalDraft(id);
  if (!draft.text.trim()) return null;
  const cleared = { text: '', revision: draft.revision + 1 };
  const submission: TerminalSubmission = { text: draft.text, cleared, state: 'sending' };
  // Publish both snapshots together. Subscribers must never see an empty editor without its receipt.
  submissions.set(id, submission);
  drafts.set(id, cleared);
  try { sessionStorage.setItem(submissionKey(id), JSON.stringify({ text: submission.text })); sessionStorage.removeItem(storageKey(id)); } catch {}
  for (const listener of listeners) listener();
  return submission;
}

export function finishTerminalSubmission(id: string, submission: TerminalSubmission) {
  if (readTerminalSubmission(id) !== submission) return;
  // Completion never touches the editor, even if the user retyped the identical message.
  dismissTerminalSubmission(id);
}

export function failTerminalSubmission(id: string, submission: TerminalSubmission, restore = true) {
  if (readTerminalSubmission(id) !== submission) return;
  submissions.set(id, { ...submission, state: 'unconfirmed' });
  if (restore && readTerminalDraft(id) === submission.cleared) writeTerminalDraft(id, submission.text);
  for (const listener of listeners) listener();
}

export function dismissTerminalSubmission(id: string) {
  submissions.set(id, null);
  try { sessionStorage.removeItem(submissionKey(id)); } catch {}
  for (const listener of listeners) listener();
}
