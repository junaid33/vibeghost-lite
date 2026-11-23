"use client";
import { Fragment, useEffect, useState, type MouseEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, ClipboardList, Cpu, IconBookmarksFillDuo18, Progress, ShieldAlert, Sun, Target } from "@/components/icons/duo";
import { WorkspaceViewShell, type WorkspaceViewChromeProps } from "./workspace-view-shell";
import { useVibeGhostDirectory } from "../hooks/use-vibeghost-directory";
import { HOME_AGENTS, homeAgentHref } from "../lib/home-agents";
import { vibeGhostActiveHref } from "../lib/vibeghost-navigation";
import { characters, Scrambled, useScramble } from "./thinking-text";
import { AgentOrb } from "./agent-orb";
import styles from "./home-brief.module.css";

/* Home: centred, the two agents' orbs (Oathkeeper orange, VibeGhost blue) over a one-sentence rundown
   across the apps (Calendar, Kanban, Curator, VibeGhost agents). No input until you choose an agent:
   its orb lifts the brief away and opens that agent's chat page (/agents/<agent>). Each part of the
   rundown has its own icon and the app's own word for what it counts. The counts wait for every
   source (the VibeGhost directory included) and appear together. Until then the sentence shown last
   time stays, its own words plain and its counts shimmering as Beautiful UI's thinking text; then
   each count scrambles into the new one, left to right. */

type Counts = { events: number; needsYou: number; doing: number; todo: number; saves: number };
const localDate = () => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`; };
/** How long the sentence waits for a slow VibeGhost host before showing without its agents. */
const DIRECTORY_WAIT_MS = 3000;
/** The last counts read, so coming back to Home shows the sentence at once while it refreshes. */
let lastCounts: Counts | null = null;
type Part = { key: string; pre?: string; lead: string; rest: string; href?: string };
/** The parts of the last sentence shown, which the next load shows (counts shimmering) until it has its own. */
const SHAPE_KEY = "oathkeeper.home.brief-shape.v1";
/** Before any sentence has been shown. */
const FIRST_SHAPE: Part[] = [{ key: "waiting", lead: "3 tasks", rest: " waiting on you" }, { key: "doing", lead: "2 tasks", rest: " in progress" }, { key: "clear", pre: "a ", lead: "clear", rest: " calendar" }];
/** The rundown with no parts, and the key its count is remembered by. */
const NOTHING = "nothing waiting", NOTHING_KEY = "nothing";
const readShape = (): Part[] => {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(SHAPE_KEY) ?? "null");
    if (Array.isArray(value) && value.length <= 12 && value.every(part => typeof part?.key === "string" && typeof part.lead === "string" && typeof part.rest === "string" && (part.pre === undefined || typeof part.pre === "string"))) return value;
  } catch { /* No saved shape: use the first one. */ }
  return FIRST_SHAPE;
};
const ICONS: Record<string, ReactNode> = { events: <CalendarDays/>, blocked: <ShieldAlert/>, waiting: <Target/>, doing: <Progress/>, todo: <ClipboardList/>, curator: <IconBookmarksFillDuo18/>, agents: <Cpu/>, clear: <Sun/> };
const counted = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;
const json = (url: string, signal: AbortSignal) => fetch(url, { signal, cache: "no-store" }).then(response => response.ok ? response.json() : null).catch(() => null);
/** Saves added to Curator in the last seven days, across every collection (newest first, so stop at the first older page). */
async function curatorSavesThisWeek(signal: AbortSignal) {
  const since = Date.now() - 7 * 86_400_000;
  let count = 0, cursor: string | null = null;
  for (let page = 0; page < 10; page++) {
    const result = await json(`/api/curator/items?collectionId=curator_all&limit=200${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`, signal);
    const items: { createdAt?: string }[] = Array.isArray(result?.items) ? result.items : [];
    const recent = items.filter(item => Date.parse(item.createdAt ?? "") >= since).length;
    count += recent;
    cursor = typeof result?.nextCursor === "string" ? result.nextCursor : null;
    if (!cursor || recent < items.length) break;
  }
  return count;
}

function useBriefCounts() {
  const [counts, setCounts] = useState<Counts | null>(() => lastCounts);
  useEffect(() => {
    const controller = new AbortController(), today = localDate();
    void Promise.all([
      json(`/api/calendar/events?startDate=${today}&endDate=${today}`, controller.signal),
      json("/api/kanban/board", controller.signal),
      curatorSavesThisWeek(controller.signal),
    ]).then(([calendar, board, saves]) => {
      if (controller.signal.aborted) return;
      const events: { eventDate?: string }[] = Array.isArray(calendar?.events) ? calendar.events : [];
      const cards: { columnId?: string }[] = Array.isArray(board?.cards) ? board.cards : [];
      const column = (id: string) => cards.filter(card => card.columnId === id).length;
      lastCounts = { events: events.filter(event => event.eventDate === today).length, needsYou: column("waiting"), doing: column("doing"), todo: column("todo"), saves };
      setCounts(lastCounts);
    });
    return () => controller.abort();
  }, []);
  return counts;
}

const joint = (index: number, count: number) => index ? index === count - 1 ? " and " : ", " : "";
const sentenceText = (parts: Part[]) => `You have ${parts.map((part, index) => `${joint(index, parts.length)}${part.pre ?? ""}${part.lead}${part.rest}`).join("") || NOTHING}.`;
/** Where each count starts when the counts are read in order as one string, so the scramble sweeps them left to right. */
const countOffsets = (parts: Part[]) => { let at = 0; return parts.map(part => { const offset = at; at += characters(part.lead).length; return offset; }); };
/** How far the scramble runs: past the end of every count and of whatever it said before. */
function scrambleLength(parts: Part[], before: Record<string, string>) {
  if (!parts.length) return Math.max(characters(NOTHING).length, characters(before[NOTHING_KEY] ?? "").length);
  const offsets = countOffsets(parts);
  return Math.max(...parts.map((part, index) => offsets[index] + Math.max(characters(part.lead).length, characters(before[part.key] ?? "").length)));
}

/** The rundown. Its own words are plain; each count shimmers what it said before (`before`, by part)
    while `progress` is -1, then scrambles into its own. Parts link once the counts have settled. */
function Sentence({ parts, progress, before }: { parts: Part[]; progress: number; before: Record<string, string> }) {
  const offsets = countOffsets(parts);
  return <>You have {parts.map((part, index) => {
    const body = <><span className={styles.lead}>{ICONS[part.key]}<Scrambled text={part.lead} offset={offsets[index]} progress={progress} from={before[part.key] ?? ""}/></span>{part.rest}</>;
    return <Fragment key={part.key}>
      {joint(index, parts.length)}{part.pre}
      {part.href && progress === Infinity ? <Link href={part.href} className={styles.chip} data-tone={part.key}>{body}</Link> : <span className={styles.chip} data-tone={part.key}>{body}</span>}
    </Fragment>;
  })}{parts.length ? null : <Scrambled text={NOTHING} progress={progress} from={before[NOTHING_KEY] ?? ""}/>}.</>;
}

export function HomeBrief(chrome: WorkspaceViewChromeProps) {
  const router = useRouter();
  const counts = useBriefCounts();
  const { directory, directoryReady, ensureDirectoryFresh } = useVibeGhostDirectory();
  useEffect(() => { void ensureDirectoryFresh(); }, [ensureDirectoryFresh]);
  const [waited, setWaited] = useState(false);
  useEffect(() => { const timer = window.setTimeout(() => setWaited(true), DIRECTORY_WAIT_MS); return () => window.clearTimeout(timer); }, []);
  const agentsKnown = directoryReady || waited;
  const ready = Boolean(counts) && agentsKnown;
  const [shape] = useState(readShape);
  const before: Record<string, string> = shape.length ? Object.fromEntries(shape.map(part => [part.key, part.lead])) : { [NOTHING_KEY]: NOTHING };
  // The chosen agent's page, opened once the brief has lifted away.
  const [leaving, setLeaving] = useState<string | null>(null);

  const live = directory.sessions.filter(session => session.status?.toLowerCase() !== "exited");
  // Blocked agents are waiting on a permission or an answer from you; the rest of the busy ones are at work.
  const blocked = live.filter(session => session.agentPhase === "blocked").length;
  const working = live.filter(session => session.agentStatus === "working" && session.agentPhase !== "blocked").length;
  // Each part: its icon and count stay on one line ("lead"); the rest may wrap.
  const items: Part[] = [];
  if (counts?.events) items.push({ key: "events", href: "/calendar", lead: counted(counts.events, "event"), rest: " today" });
  if (blocked) items.push({ key: "blocked", href: vibeGhostActiveHref(), lead: counted(blocked, "agent"), rest: blocked === 1 ? " that needs you" : " that need you" });
  if (counts?.needsYou) items.push({ key: "waiting", href: "/kanban", lead: counted(counts.needsYou, "task"), rest: " waiting on you" });
  if (counts?.doing) items.push({ key: "doing", href: "/kanban", lead: counted(counts.doing, "task"), rest: " in progress" });
  if (counts?.todo) items.push({ key: "todo", href: "/kanban", lead: counts.doing ? `${counts.todo} more` : counted(counts.todo, "task"), rest: " to do" });
  if (counts?.saves) items.push({ key: "curator", href: "/curator", lead: counted(counts.saves, "save"), rest: " in Curator this week" });
  if (working) items.push({ key: "agents", href: vibeGhostActiveHref(), lead: counted(working, "agent"), rest: " at work" });
  if (counts && !counts.events) items.push({ key: "clear", pre: "a ", lead: "clear", rest: " calendar" });
  const shown = JSON.stringify(items.map(({ key, pre, lead, rest }) => ({ key, pre, lead, rest })));
  useEffect(() => { if (ready) try { localStorage.setItem(SHAPE_KEY, shown); } catch { /* Only the room the next load keeps. */ } }, [ready, shown]);
  const progress = useScramble(ready, scrambleLength(items, before));
  const settled = progress === Infinity;

  const open = (href: string) => (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    setLeaving(current => current ?? href);
  };

  return <WorkspaceViewShell title="Home" breadcrumbs={[]} wide scrollable={false} compactInset {...chrome}>
    <main className={styles.page}>
      <section className={styles.brief} aria-label="Today" data-leaving={leaving ? "" : undefined} onAnimationEnd={event => { if (leaving && event.target === event.currentTarget) router.push(leaving); }}>
        <div className={styles.scroll}><div className={styles.copy}>
          <nav className={styles.agents} aria-label="Agents">{HOME_AGENTS.map(agent => <Link key={agent.id} href={homeAgentHref(agent.id)} className={styles.agent} aria-label={agent.label} title={agent.label} onClick={open(homeAgentHref(agent.id))}>
            <AgentOrb agent={agent.id} size={64}/>
          </Link>)}</nav>
          <h1 className={styles.rundown} aria-busy={!ready}>
            <span aria-hidden={settled ? undefined : true}><Sentence parts={ready ? items : shape} progress={progress} before={before}/></span>
            {settled ? null : <span className="sr-only">{ready ? sentenceText(items) : "Loading your brief"}</span>}
          </h1>
        </div></div>
      </section>
    </main>
  </WorkspaceViewShell>;
}
