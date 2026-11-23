"use client";
// affectUI Agent Lanes (Pro, owner-licensed), copied unchanged from
// ~/.oathkeeper/custom-apps/source-archives/agents/affectui-agent-lanes/AgentLanes.tsx.
// Only this header was added. Do not edit; Oathkeeper adapts it from vibeghost-timeline.tsx.
/* Recovered faithfully from affectUI public preview bundle demo-DjN2XUBS.js. Not the unavailable code-tab source. */
import * as React from "react";
import * as jsxRuntime from "react/jsx-runtime";
export interface LaneAgent {
  id: string;
  name: string;
  model?: string;
  avatar?: React.ReactNode;
}
export type LaneStatus = "done" | "running" | "waiting" | "failed";
export interface LaneTask {
  id: string;
  agentId: string;
  title: string;
  status: LaneStatus;
  start: number | Date;
  end?: number | Date;
  handoffTo?: string;
  ask?: string;
  summary?: string[];
  tools?: React.ReactNode[];
}
export interface AgentLanesProps {
  agents: LaneAgent[];
  tasks: LaneTask[];
  span?: number;
  now?: number;
  onApprove?: (task: LaneTask) => void;
  onReject?: (task: LaneTask) => void;
  onOpen?: (task: LaneTask) => void;
  title?: string;
  className?: string;
}
/* empty css             */ var toTime = (e: number | Date) =>
    typeof e == `number` ? e : e.getTime(),
  MINUTE = 6e4,
  formatDuration = (e: number) => {
    let t = Math.max(0, Math.round(e / MINUTE));
    return t < 60 ? `${t}m` : `${Math.floor(t / 60)}h ${t % 60}m`;
  },
  initials = (e: string) =>
    e
      .split(/\s+/)
      .map((e) => e[0])
      .join(``)
      .slice(0, 2)
      .toUpperCase(),
  statusLabels = {
    done: `Done`,
    running: `Running`,
    waiting: `Needs you`,
    failed: `Failed`,
  },
  ROW_HEIGHT = 48,
  SparkIcon = () => (
    <svg width={`14`} height={`14`} viewBox={`0 0 14 14`} aria-hidden={`true`}>
      <path
        d={`M7 1.2c.4 2.9 1.9 4.4 4.8 4.8-2.9.4-4.4 1.9-4.8 4.8C6.6 7.9 5.1 6.4 2.2 6 5.1 5.6 6.6 4.1 7 1.2Z`}
        fill={`currentColor`}
      />
      <circle
        cx={`11.6`}
        cy={`11.4`}
        r={`1.1`}
        fill={`currentColor`}
        opacity={`0.55`}
      />
    </svg>
  ),
  WarningIcon = () => (
    <svg width={`12`} height={`12`} viewBox={`0 0 12 12`} aria-hidden={`true`}>
      <path d={`M6 1.8 10.8 10H1.2L6 1.8Z`} fill={`currentColor`} />
    </svg>
  );
function AgentLanes({
  agents: e,
  tasks: t,
  span: f = 30 * MINUTE,
  now: m,
  onApprove: h,
  onReject: g,
  onOpen: _,
  title: v = `Agents`,
  className: y,
}: AgentLanesProps) {
  let b = (0, React.useId)(),
    [x, S] = (0, React.useState)(() => Date.now()),
    [C, w] = (0, React.useState)<string | null>(null),
    [T, E] = (0, React.useState)<Record<string, Partial<LaneTask>>>({}),
    D = (0, React.useRef)<HTMLDivElement | null>(null);
  (0, React.useEffect)(() => {
    if (m !== void 0) return;
    let e = window.setInterval(() => S(Date.now()), 250);
    return () => window.clearInterval(e);
  }, [m]);
  let O = m ?? x,
    k = O - f,
    A = t.map((e) =>
      T[e.id]
        ? {
            ...e,
            ...T[e.id],
          }
        : e,
    ),
    j = (e: LaneTask, t: boolean) => {
      w(null);
      let n = t ? h : g;
      if (n) return n(e);
      E((n) => ({
        ...n,
        [e.id]: t
          ? {
              status: `running`,
            }
          : {
              status: `failed`,
              end: O,
            },
      }));
    },
    M = (e: number) => Math.min(100, ((e - k) / f) * 100),
    N = (0, React.useRef)(O).current,
    P = (e: number) => ((e - N) / f) * 100 + 100,
    F = ((O - N) / f) * 100,
    I = A.filter((e) => (e.end === void 0 ? O : toTime(e.end)) > k),
    L = (0, React.useMemo)(() => {
      let e =
          f > 60 * MINUTE ? 15 * MINUTE : f > 20 * MINUTE ? 5 * MINUTE : MINUTE,
        t: number[] = [];
      for (let n = f - e; n > 0; n -= e) t.push(n);
      return {
        step: e,
        ago: t,
      };
    }, [f]),
    R = (t: string) => e.findIndex((e) => e.id === t),
    z = I.flatMap((e) => {
      let t = e.handoffTo ? A.find((t) => t.id === e.handoffTo) : void 0;
      if (!t) return [];
      let n = P(e.end === void 0 ? O : toTime(e.end)) * 10,
        r = P(toTime(t.start)) * 10,
        a = R(e.agentId) * ROW_HEIGHT + ROW_HEIGHT / 2,
        o = R(t.agentId) * ROW_HEIGHT + ROW_HEIGHT / 2;
      if (a < 0 || o < 0) return [];
      let s = Math.max(24, Math.abs(r - n) / 2);
      return [
        {
          id: `${e.id}>${t.id}`,
          d: `M ${n} ${a} C ${n + s} ${a}, ${r - s} ${o}, ${r} ${o}`,
          live: t.status === `running`,
        },
      ];
    });
  (0, React.useEffect)(() => {
    if (!C) return;
    let e = (e: PointerEvent) => {
      (e.target as Element).closest?.(`[data-task="${C}"], .ui-al__pop`) ||
        w(null);
    };
    return (
      document.addEventListener(`pointerdown`, e),
      () => document.removeEventListener(`pointerdown`, e)
    );
  }, [C]);
  let B = I.find((e) => e.id === C),
    V = (0, React.useRef)<Record<string, string>>({});
  for (let t of e) {
    let e = A.find(
      (e) =>
        e.agentId === t.id &&
        (e.status === `running` || e.status === `waiting`),
    );
    e?.status === `waiting`
      ? (V.current[t.id] = `Needs you`)
      : e || (V.current[t.id] = `Idle`);
  }
  let H = A.filter((e) => e.status === `waiting`).length,
    U = A.filter((e) => e.status === `running`).length;
  return (
    <div
      ref={D}
      className={[`ui-al`, y].filter(Boolean).join(` `)}
      onKeyDown={(e) => {
        e.key === `Escape` &&
          C &&
          (e.stopPropagation(),
          D.current?.querySelector<HTMLElement>(`[data-task="${C}"]`)?.focus(),
          w(null));
      }}
    >
      <style href={`ui-agent-lanes`} precedence={`default`}>
        {agentLanesStyles}
      </style>
      <header className={`ui-al__bar`}>
        <span className={`ui-al__spark`}>
          <SparkIcon />
        </span>
        <span className={`ui-al__title`}>{v}</span>
        <span className={`ui-al__summary`}>
          <span data-kind={`running`}>
            {U}
            {` running`}
          </span>
          {H > 0 && (
            <span data-kind={`needs`}>
              {H}
              {` need you`}
            </span>
          )}
        </span>
        <span className={`ui-al__window`}>
          {`Last `}
          {formatDuration(f)}
        </span>
      </header>
      <div className={`ui-al__card`}>
        <div
          className={`ui-al__body`}
          style={
            {
              "--rows": e.length,
            } as React.CSSProperties
          }
        >
          <ul className={`ui-al__agents`}>
            {e.map((e) => {
              let t = A.find(
                (t) =>
                  t.agentId === e.id &&
                  (t.status === `running` || t.status === `waiting`),
              );
              return (
                <li className={`ui-al__agent`} key={e.id}>
                  <span
                    className={`ui-al__avatar`}
                    data-logo={e.avatar ? `` : void 0}
                  >
                    {e.avatar ?? initials(e.name)}
                  </span>
                  <span
                    className={`ui-al__who`}
                    data-state={t?.status ?? `idle`}
                  >
                    <span className={`ui-al__name-line`}>
                      <span className={`ui-al__name`}>{e.name}</span>
                      <span
                        className={`ui-al__state`}
                        data-show={t?.status === `running` ? void 0 : ``}
                        aria-hidden={t?.status === `running`}
                      >
                        <span>
                          {t?.status === `waiting`
                            ? `Needs you`
                            : t
                              ? (V.current[e.id] ?? `Idle`)
                              : `Idle`}
                        </span>
                      </span>
                    </span>
                    <span className={`ui-al__model`}>
                      {e.model && (
                        <span className={`ui-al__model-name`}>{e.model}</span>
                      )}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
          <div className={`ui-al__track`}>
            <div className={`ui-al__grid`} aria-hidden={`true`}>
              {L.ago.map((e) => (
                <span
                  className={`ui-al__tick`}
                  style={{
                    left: `${100 - (e / f) * 100}%`,
                  }}
                  key={e}
                >
                  <span>
                    {`−`}
                    {formatDuration(e)}
                  </span>
                </span>
              ))}
            </div>
            <div className={`ui-al__clip`}>
              <div
                className={`ui-al__layer`}
                style={{
                  transform: `translateX(${-F}%)`,
                }}
              >
                <svg
                  className={`ui-al__curves`}
                  viewBox={`0 0 1000 ${e.length * ROW_HEIGHT}`}
                  preserveAspectRatio={`none`}
                  aria-hidden={`true`}
                >
                  {z.map((e) => (
                    <path
                      d={e.d}
                      data-live={e.live ? `` : void 0}
                      vectorEffect={`non-scaling-stroke`}
                      key={e.id}
                    />
                  ))}
                </svg>
                {e.map((e, t) => (
                  <ul
                    className={`ui-al__lane`}
                    style={{
                      top: t * ROW_HEIGHT,
                    }}
                    aria-label={`${e.name}'s tasks`}
                    key={e.id}
                  >
                    {I.filter((t) => t.agentId === e.id).map((t) => {
                      let n = t.end === void 0 ? O : toTime(t.end),
                        a = ((n - toTime(t.start)) / f) * 100,
                        s = formatDuration(n - toTime(t.start)),
                        l = C === t.id;
                      return (
                        <li
                          className={`ui-al__slot`}
                          data-status={t.status}
                          style={{
                            left: `${P(toTime(t.start))}%`,
                            width: `${a}%`,
                          }}
                          key={t.id}
                        >
                          <button
                            type={`button`}
                            data-task={t.id}
                            className={`ui-al__block`}
                            data-status={t.status}
                            data-open={l ? `` : void 0}
                            aria-expanded={l}
                            aria-controls={`${b}-${t.id}`}
                            aria-label={`${e.name}: ${t.title} – ${statusLabels[t.status]}${t.status === `done` ? `, took ${s}` : `, ${s}`}`}
                            onClick={() => w(l ? null : t.id)}
                          >
                            {t.tools && t.tools.length > 0 && (
                              <span
                                className={`ui-al__tools`}
                                aria-hidden={`true`}
                              >
                                {t.tools.slice(0, 3).map((e, t) => (
                                  <span className={`ui-al__tool`} key={t}>
                                    {e}
                                  </span>
                                ))}
                              </span>
                            )}
                            <span className={`ui-al__label`}>{t.title}</span>
                          </button>
                          {t.status === `waiting` && (
                            <span
                              className={`ui-al__flag`}
                              aria-hidden={`true`}
                            >
                              <WarningIcon />
                              {`Needs you`}
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                ))}
              </div>
            </div>
            {B &&
              (() => {
                let t = R(B.agentId),
                  n = t >= e.length / 2,
                  a = B.end === void 0 ? O : toTime(B.end),
                  s = e[t];
                if (B.status === `waiting`)
                  return (
                    <div
                      className={`ui-al__pop ui-al__ask`}
                      id={`${b}-${B.id}`}
                      role={`dialog`}
                      aria-label={`Decide: ${B.title}`}
                      data-up={n ? `` : void 0}
                      style={{
                        top: n ? t * ROW_HEIGHT + 6 : (t + 1) * ROW_HEIGHT - 6,
                        right: `${100 - M(a)}%`,
                      }}
                    >
                      <span className={`ui-al__ask-title`}>{B.title}</span>
                      {B.ask && (
                        <span className={`ui-al__ask-text`}>{B.ask}</span>
                      )}
                      <span className={`ui-al__ask-actions`}>
                        <button
                          type={`button`}
                          className={`ui-al__btn`}
                          onClick={() => j(B, !1)}
                        >{`Reject`}</button>
                        <button
                          type={`button`}
                          className={`ui-al__btn ui-al__btn--primary`}
                          autoFocus={!0}
                          onClick={() => j(B, !0)}
                        >{`Approve`}</button>
                      </span>
                    </div>
                  );
                let u = (Math.max(0, M(toTime(B.start))) + M(a)) / 2;
                return (
                  <div
                    className={`ui-al__pop ui-al__tip`}
                    id={`${b}-${B.id}`}
                    role={`tooltip`}
                    data-up={n ? `` : void 0}
                    style={{
                      top: n ? t * ROW_HEIGHT + 6 : (t + 1) * ROW_HEIGHT - 6,
                      left: `${Math.max(14, Math.min(86, u))}%`,
                    }}
                  >
                    <span className={`ui-al__tip-head`}>
                      {s?.name}
                      {` · `}
                      {statusLabels[B.status]}
                      {` · `}
                      {formatDuration(a - toTime(B.start))}
                    </span>
                    {B.summary?.length ? (
                      <ul className={`ui-al__tip-list`}>
                        {B.summary.map((e) => (
                          <li key={e}>{e}</li>
                        ))}
                      </ul>
                    ) : (
                      <span className={`ui-al__tip-title`}>{B.title}</span>
                    )}
                    {_ && (
                      <button
                        type={`button`}
                        className={`ui-al__tip-open`}
                        onClick={() => _(B)}
                      >{`Open`}</button>
                    )}
                  </div>
                );
              })()}
            <span className={`ui-al__now`} aria-hidden={`true`}>
              <span>{`now`}</span>
            </span>
          </div>
        </div>
      </div>
      <span className={`ui-al__sr`} aria-live={`polite`}>
        {H > 0 ? `${H} task${H === 1 ? `` : `s`} need you` : `${U} running`}
      </span>
    </div>
  );
}
var agentLanesStyles = `
/* Colors and motion as variables – override them on .ui-al */
.ui-al {
  --ui-al-tray: #f0f0f0;
  --ui-al-card: #ffffff;
  --ui-al-strong: #171717;
  --ui-al-ink: #171717;
  --ui-al-text: #6b6b6b;
  --ui-al-muted: #8a8a8a;
  --ui-al-faint: #b8b8b8;
  --ui-al-line: #ececec;
  --ui-al-rail: #c4c4c8;
  --ui-al-wash: #f6f6f6;
  --ui-al-fill: #ececec;
  --ui-al-done: #f2f2f3;
  --ui-al-solid: #171717;
  --ui-al-on-solid: #ffffff;
  --ui-al-run-bg: rgba(47, 107, 255, 0.1);
  --ui-al-run-fg: #2f6bff;
  --ui-al-run-edge: rgba(47, 107, 255, 0.55);
  --ui-al-warn-bg: #fff3e0;
  --ui-al-warn-fg: #b85c00;
  --ui-al-danger-bg: #fdecea;
  --ui-al-danger-fg: #c2331f;
  --ui-al-focus: rgba(23, 23, 23, 0.22);
  --ui-al-shadow: 0 0 0 1px #ececec, 0 1px 2px rgba(0, 0, 0, 0.04);
  --ui-al-pop: 0 0 0 1px #ececec, 0 16px 36px -12px rgba(0, 0, 0, 0.22);
  --ui-al-row: ${ROW_HEIGHT}px;
  position: relative;
  box-sizing: border-box;
  width: 100%;
  max-width: 760px;
  padding: 4px;
  border-radius: 20px;
  background: var(--ui-al-tray);
  container-type: inline-size;
  font-family: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  font-size: 14px;
  font-weight: 400;
  line-height: 20px;
  letter-spacing: -0.006em;
  color: var(--ui-al-text);
  text-align: left;
  -webkit-font-smoothing: antialiased;
}
.ui-al *, .ui-al *::before, .ui-al *::after { box-sizing: border-box; }
:where(.ui-al) button { margin: 0; padding: 0; border: 0; background: none; font: inherit; color: inherit; text-align: inherit; cursor: pointer; -webkit-tap-highlight-color: transparent; }
.ui-al button:focus-visible { outline: 2px solid var(--ui-al-focus); outline-offset: 1px; }
.ui-al ul { margin: 0; padding: 0; list-style: none; }
.ui-al svg { display: block; flex: none; }
.ui-al__sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }

/* The white card holds the lanes */
.ui-al__card { border-radius: 16px; background: var(--ui-al-card); box-shadow: var(--ui-al-shadow); }

/* ----- Bar ----- */
/* ----- On the tray: what is going on ----- */
.ui-al__bar { display: flex; align-items: center; gap: 10px; min-width: 0; padding: 10px 10px 12px 14px; }
.ui-al__spark { display: grid; flex: none; place-items: center; width: 16px; color: rgba(0, 96, 226, 0.765); }
.ui-al__title { font-weight: 600; color: var(--ui-al-strong); white-space: nowrap; }
.ui-al__summary { display: flex; flex: 1; gap: 12px; min-width: 0; overflow: hidden; font-size: 12px; line-height: 16px; color: var(--ui-al-muted); white-space: nowrap; }
.ui-al__summary span { display: inline-flex; align-items: center; gap: 6px; }
.ui-al__summary span::before { content: ""; width: 6px; height: 6px; border-radius: 50%; background: var(--ui-al-run-fg); }
.ui-al__summary [data-kind="needs"] { color: var(--ui-al-warn-fg); }
.ui-al__summary [data-kind="needs"]::before { background: var(--ui-al-warn-fg); animation: ui-al-pulse 1600ms ease-in-out infinite; }
.ui-al__window { flex: none; font-family: var(--font-geist-mono), monospace; font-size: 12px; font-weight: 500; line-height: 16px; color: var(--ui-al-muted); }

/* ----- Lanes ----- */
.ui-al__body { display: grid; grid-template-columns: 168px minmax(0, 1fr); padding: 26px 16px 12px 0; }
.ui-al__agents { display: grid; grid-auto-rows: var(--ui-al-row); }
.ui-al__agent { display: flex; align-items: center; gap: 10px; min-width: 0; padding: 0 12px 0 16px; }
.ui-al__avatar { display: grid; flex: none; place-items: center; width: 26px; height: 26px; overflow: hidden; border-radius: 50%; background: var(--ui-al-fill); font-size: 12px; font-weight: 500; letter-spacing: 0.3px; color: var(--ui-al-text); }
/* A logo sits on a small white tile */
.ui-al__avatar[data-logo] { background: var(--ui-al-card); box-shadow: var(--ui-al-shadow); }
.ui-al__avatar > svg { width: 14px; height: 14px; }
.ui-al__who { display: grid; min-width: 0; }
.ui-al__name { min-width: 0; overflow: hidden; font-weight: 500; color: var(--ui-al-ink); white-space: nowrap; text-overflow: ellipsis; }
.ui-al__name-line { display: flex; align-items: center; min-width: 0; }
.ui-al__model { display: flex; align-items: center; min-width: 0; font-size: 12px; line-height: 16px; color: var(--ui-al-muted); white-space: nowrap; }
.ui-al__model-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
/* The state tag: collapses to nothing while the agent works, fades in when it is free or waits */
.ui-al__state { display: inline-grid; flex: none; grid-template-columns: 0fr; margin-left: 0; opacity: 0; transition: grid-template-columns 320ms ease, margin-left 320ms ease, opacity 220ms ease; }
.ui-al__state[data-show] { grid-template-columns: 1fr; margin-left: 6px; opacity: 1; transition: grid-template-columns 320ms ease, margin-left 320ms ease, opacity 260ms ease 80ms; }
.ui-al__state > span { min-width: 0; overflow: hidden; color: var(--ui-al-muted); font-size: 12px; font-weight: 500; line-height: 16px; white-space: nowrap; }
.ui-al__who[data-state="waiting"] .ui-al__state > span { color: var(--ui-al-warn-fg); }

.ui-al__track { position: relative; height: calc(var(--rows) * var(--ui-al-row)); }
/* Quiet lane separators and time ticks */
.ui-al__track::before { content: ""; position: absolute; inset: 0; background: repeating-linear-gradient(to bottom, transparent 0, transparent calc(var(--ui-al-row) - 0.5px), var(--ui-al-line) calc(var(--ui-al-row) - 0.5px), var(--ui-al-line) var(--ui-al-row)); pointer-events: none; }
.ui-al__grid { position: absolute; inset: 0; pointer-events: none; }
.ui-al__tick { position: absolute; top: 0; bottom: 0; width: 0; border-left: 0.5px dashed var(--ui-al-line); }
.ui-al__tick > span { position: absolute; bottom: 100%; left: 0; margin-bottom: 6px; font-size: 12px; line-height: 14px; color: var(--ui-al-faint); white-space: nowrap; transform: translateX(-50%); font-variant-numeric: tabular-nums; }

.ui-al__clip { position: absolute; inset: 0; overflow: hidden; -webkit-mask-image: linear-gradient(to right, transparent 0, #000 40px); mask-image: linear-gradient(to right, transparent 0, #000 40px); }
.ui-al__layer { position: absolute; inset: 0; will-change: transform; }
.ui-al__curves { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; pointer-events: none; }
.ui-al__curves path { fill: none; stroke: var(--ui-al-rail); stroke-width: 1; stroke-dasharray: 3 3; }
.ui-al__curves path[data-live] { stroke: var(--ui-al-run-edge); animation: ui-al-flow 900ms linear infinite; }

.ui-al__lane { position: absolute; left: 0; right: 0; height: var(--ui-al-row); }
.ui-al__slot { position: absolute; top: 10px; bottom: 10px; min-width: 6px; }
/* Running and waiting blocks grow out of "now" from nothing, so they never poke past it */
.ui-al__slot:is([data-status="running"], [data-status="waiting"]), .ui-al__slot:is([data-status="running"], [data-status="waiting"]) .ui-al__block { min-width: 0; }
.ui-al__block { display: flex; align-items: center; width: 100%; height: 100%; min-width: 6px; padding: 0 10px; overflow: hidden; border-radius: 8px; background: var(--ui-al-done); font-size: 12px; font-weight: 500; line-height: 16px; color: var(--ui-al-text); white-space: nowrap; transition: background-color 300ms ease, color 300ms ease; }
.ui-al__label { min-width: 0; overflow: hidden; text-overflow: clip; }
/* Tools: the plain logos side by side, before the title */
.ui-al__tools { display: flex; flex: none; gap: 4px; margin-right: 6px; }
.ui-al__tool { display: grid; place-items: center; width: 12px; height: 12px; }
.ui-al__tool > svg { width: 12px; height: 12px; }
.ui-al__block:hover { background: var(--ui-al-fill); }
.ui-al__block[data-status="running"] { position: relative; background: var(--ui-al-run-bg); color: var(--ui-al-run-fg); box-shadow: inset -2px 0 0 var(--ui-al-run-edge); }
.ui-al__block[data-status="running"]::after { content: ""; position: absolute; inset: 0; background: linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.55) 50%, transparent 100%) 0 0 / 50% 100% no-repeat; animation: ui-al-shimmer 2200ms ease-in-out infinite; }
.ui-al__block[data-status="waiting"] { background: var(--ui-al-warn-bg); color: var(--ui-al-warn-fg); }
.ui-al__block[data-status="failed"] { background: var(--ui-al-danger-bg); color: var(--ui-al-danger-fg); }
.ui-al__block[data-open] { filter: brightness(0.97); }

/* Needs you: a small flag inside the block's end, where it meets "now" */
.ui-al__flag { position: absolute; top: 50%; right: 4px; display: inline-flex; align-items: center; gap: 4px; padding: 0 6px; border-radius: 4px; background: var(--ui-al-card); box-shadow: var(--ui-al-shadow); font-size: 12px; font-weight: 500; line-height: 18px; color: var(--ui-al-warn-fg); white-space: nowrap; transform: translateY(-50%); pointer-events: none; animation: ui-al-pulse 1600ms ease-in-out infinite; }
.ui-al__slot:has(.ui-al__block[data-status="waiting"]) { z-index: 2; }

.ui-al__pop { position: absolute; z-index: 5; animation: ui-al-in 180ms ease both; }
.ui-al__pop[data-up] { transform: translateY(-100%); animation-name: ui-al-in-up; }
/* Decide in place */
.ui-al__ask { display: grid; gap: 2px; width: 290px; padding: 14px; border-radius: 14px; background: var(--ui-al-card); box-shadow: var(--ui-al-pop); }
/* What got done: a small dark tooltip */
.ui-al__tip { display: grid; gap: 4px; width: max-content; max-width: 230px; padding: 10px 12px; border-radius: 12px; background: rgba(23, 23, 23, 0.92); -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px); box-shadow: 0 10px 28px -8px rgba(0, 0, 0, 0.35); font-size: 12.5px; line-height: 17px; color: rgba(255, 255, 255, 0.86); translate: -50% 0; }
.ui-al__tip-head { font-size: 12px; color: rgba(255, 255, 255, 0.55); white-space: nowrap; }
.ui-al__tip-title { color: #fff; }
.ui-al__tip-list { display: grid; gap: 2px; }
.ui-al__tip-list li { position: relative; padding-left: 10px; }
.ui-al__tip-list li::before { content: ""; position: absolute; top: 8px; left: 1px; width: 3px; height: 3px; border-radius: 50%; background: rgba(255, 255, 255, 0.5); }
.ui-al__tip-open { justify-self: start; margin-top: 2px; font-size: 12.5px; font-weight: 500; color: #fff; text-decoration: underline; text-decoration-color: rgba(255, 255, 255, 0.35); text-underline-offset: 2px; }
.ui-al__ask-title { font-weight: 500; color: var(--ui-al-strong); }
.ui-al__ask-text { font-size: 12px; line-height: 16px; color: var(--ui-al-text); }
.ui-al__ask-actions { display: flex; justify-content: flex-end; gap: 6px; margin-top: 8px; }
.ui-al__btn { display: inline-flex; align-items: center; height: 30px; padding: 0 12px; border-radius: 9px; background: var(--ui-al-card); box-shadow: var(--ui-al-shadow); font-size: 13px; font-weight: 500; color: var(--ui-al-strong); }
.ui-al__btn:hover { background: var(--ui-al-wash); }
.ui-al__btn--primary { background: var(--ui-al-solid); box-shadow: none; color: var(--ui-al-on-solid); }
.ui-al__btn--primary:hover { background: #33333a; }

/* Now: a small label over the right edge, where running work meets the clock */
.ui-al__now { position: absolute; top: -6px; right: 0; width: 0; pointer-events: none; }
.ui-al__now > span { position: absolute; bottom: 100%; right: 0; font-size: 12px; font-weight: 500; line-height: 14px; color: var(--ui-al-run-fg); }

@keyframes ui-al-pulse { 50% { opacity: 0.55; } }
@keyframes ui-al-shimmer { from { background-position: -100% 0; } to { background-position: 200% 0; } }
@keyframes ui-al-flow { to { stroke-dashoffset: -6; } }
@keyframes ui-al-in { from { opacity: 0; transform: translateY(-3px); } }
@keyframes ui-al-in-up { from { opacity: 0; transform: translateY(calc(-100% + 3px)); } to { transform: translateY(-100%); } }

/* Narrow containers: the names column shrinks to the avatars */
@container (min-width: 640px) {
  .ui-al__body { grid-template-columns: 260px minmax(0, 1fr); }
}
@container (max-width: 520px) {
  .ui-al__body { grid-template-columns: 48px minmax(0, 1fr); }
  .ui-al__who { display: none; }
  .ui-al__summary [data-kind="running"] { display: none; }
}
@media (prefers-reduced-motion: reduce) {
  .ui-al *, .ui-al *::before, .ui-al *::after { animation: none !important; transition: none !important; }
}

/* Dark mode: follows a .dark class or data-theme="dark" on any ancestor, e.g. <html> */
:where(.dark, [data-theme="dark"]) .ui-al {
  --ui-al-tray: #111113;
  --ui-al-card: #19191b;
  --ui-al-strong: #ffffff;
  --ui-al-ink: rgba(255, 255, 255, 0.9);
  --ui-al-text: rgba(255, 255, 255, 0.62);
  --ui-al-muted: rgba(255, 255, 255, 0.45);
  --ui-al-faint: rgba(255, 255, 255, 0.28);
  --ui-al-line: rgba(255, 255, 255, 0.08);
  --ui-al-rail: rgba(255, 255, 255, 0.2);
  --ui-al-wash: rgba(255, 255, 255, 0.04);
  --ui-al-fill: rgba(255, 255, 255, 0.08);
  --ui-al-done: rgba(255, 255, 255, 0.06);
  --ui-al-solid: rgba(255, 255, 255, 0.92);
  --ui-al-on-solid: #141416;
  --ui-al-run-bg: #0077ff3a;
  --ui-al-run-fg: #70b8ff;
  --ui-al-run-edge: rgba(112, 184, 255, 0.6);
  --ui-al-warn-bg: #fb6a0025;
  --ui-al-warn-fg: #ffa057;
  --ui-al-danger-bg: #ff35232b;
  --ui-al-danger-fg: #ff977d;
  --ui-al-focus: rgba(91, 154, 255, 0.45);
  --ui-al-shadow: 0 0 0 1px #2a2a2e, 0 1px 2px rgba(0, 0, 0, 0.3);
  --ui-al-pop: 0 0 0 1px #2a2a2e, 0 16px 36px -12px rgba(0, 0, 0, 0.6);
}
:where(.dark, [data-theme="dark"]) .ui-al__btn--primary:hover { background: #d6d6da; }
:where(.dark, [data-theme="dark"]) .ui-al__block[data-status="running"]::after { background-image: linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.12) 50%, transparent 100%); }
/* Dark mode: the tooltip turns light, so it stands out from the dark card */
:where(.dark, [data-theme="dark"]) .ui-al__tip { background: rgba(250, 250, 250, 0.94); box-shadow: 0 8px 24px -8px rgba(0, 0, 0, 0.6); color: rgba(0, 0, 0, 0.82); }
:where(.dark, [data-theme="dark"]) .ui-al__tip-head { color: rgba(0, 0, 0, 0.5); }
:where(.dark, [data-theme="dark"]) .ui-al__tip-title, :where(.dark, [data-theme="dark"]) .ui-al__tip-open { color: #000; }
:where(.dark, [data-theme="dark"]) .ui-al__tip-open { text-decoration-color: rgba(0, 0, 0, 0.3); }
:where(.dark, [data-theme="dark"]) .ui-al__tip-list li::before { background: rgba(0, 0, 0, 0.4); }
`;
export { AgentLanes, agentLanesStyles };
export default AgentLanes;
