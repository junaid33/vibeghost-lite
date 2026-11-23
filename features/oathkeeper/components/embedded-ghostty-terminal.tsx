"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { FitAddon, Terminal, type ITheme } from "ghostty-web";
import { GhosttyTerminal as CanonicalIrohTerminal, type GhosttyTerminalHandle as CanonicalIrohTerminalHandle } from "@/features/oathkeeper/components/canonical-iroh-terminal";
import { ensureGhostty } from "@/features/oathkeeper/lib/ghostty-loader";
import type { SharedWorkspaceClient } from "@/features/oathkeeper/lib/shared-workspace-client";

export type EmbeddedGhosttyTerminalHandle = {
  focus: () => void;
  fit: () => void;
  writeCommand: (command: string) => void;
  sendInput: (text: string) => void;
};

type EmbeddedGhosttyTerminalProps = {
  sessionId: string;
  title: string;
  cwd: string;
  shared?: boolean;
  client?: SharedWorkspaceClient;
  remoteSessionId?: string;
  className?: string;
  active?: boolean;
  mobileInputId?: string;
};

const TERMINAL_THEME: ITheme = {
  background: "#08090a", foreground: "#e8eaee", cursor: "#e8eaee", cursorAccent: "#08090a",
  selectionBackground: "rgba(96, 165, 250, 0.28)", selectionForeground: "#f8fafc",
  black: "#1d2028", red: "#f87171", green: "#4ade80", yellow: "#fbbf24", blue: "#60a5fa",
  magenta: "#c084fc", cyan: "#22d3ee", white: "#e4e4e7", brightBlack: "#71717a",
  brightRed: "#fca5a5", brightGreen: "#86efac", brightYellow: "#fcd34d", brightBlue: "#93c5fd",
  brightMagenta: "#d8b4fe", brightCyan: "#67e8f9", brightWhite: "#fafafa",
};

const IrohGhosttyTerminal = forwardRef<EmbeddedGhosttyTerminalHandle, EmbeddedGhosttyTerminalProps>(function IrohGhosttyTerminal({ client, remoteSessionId, sessionId, className, active = true, mobileInputId = 'vibeghost-direct-terminal-input' }, ref) {
  const terminalRef = useRef<CanonicalIrohTerminalHandle>(null);
  const targetSessionId = remoteSessionId || sessionId;

  useImperativeHandle(ref, () => ({
    focus: () => terminalRef.current?.focus(),
    fit: () => terminalRef.current?.fitTerminal(),
    sendInput: (text) => terminalRef.current?.sendInput(text),
    writeCommand: (command) => terminalRef.current?.sendInput(`${command}\r`),
  }), []);

  if (!client) return null;
  return <CanonicalIrohTerminal
    ref={terminalRef}
    client={client}
    sessionId={targetSessionId}
    active={active}
    autoFocus={false}
    mobileInputId={mobileInputId}
    className={className}
  />;
});

const LocalGhosttyTerminal = forwardRef<EmbeddedGhosttyTerminalHandle, EmbeddedGhosttyTerminalProps>(function LocalGhosttyTerminal({ sessionId, title, cwd, shared = false, className }, ref) {
  const hostRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  useImperativeHandle(ref, () => ({
    focus: () => terminalRef.current?.focus(),
    fit: () => fitAddonRef.current?.fit(),
    sendInput: (text) => terminalRef.current?.write(text),
    writeCommand: (command) => {
      const terminal = terminalRef.current;
      if (!terminal) return;
      terminal.write(`\r\n\x1b[38;5;250m$ ${stripControls(command)}\x1b[0m\r\n`);
      terminal.write("\x1b[38;5;78mMock command accepted.\x1b[0m\r\n");
      terminal.scrollToBottom();
    },
  }), []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;
    let terminal: Terminal | null = null;
    let fitAddon: FitAddon | null = null;
    let observer: ResizeObserver | null = null;
    let frame: number | null = null;

    void ensureGhostty().then((ghostty) => {
      if (disposed || !host.isConnected) return;
      terminal = new Terminal({
        ghostty,
        cursorBlink: true,
        cursorStyle: "bar",
        fontFamily: "JetBrains Mono, SFMono-Regular, Menlo, Monaco, monospace",
        fontSize: terminalFontSize(),
        scrollback: 16 * 1024 * 1024,
        smoothScrollDuration: 100,
        copyOnSelect: false,
        copyMode: "native",
        theme: TERMINAL_THEME,
      });
      fitAddon = new FitAddon();
      terminal.loadAddon(fitAddon);
      terminal.open(host);
      terminalRef.current = terminal;
      fitAddonRef.current = fitAddon;
      const fit = () => {
        if (frame !== null) cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => { frame = null; fitAddon?.fit(); });
      };
      observer = new ResizeObserver(fit);
      observer.observe(host);
      fitAddon.fit();
      terminal.write(`\x1b[38;5;244mVibeGhost ${shared ? "shared " : ""}session attached\x1b[0m\r\n`);
      terminal.write(`\x1b[38;5;244m${stripControls(title)} · ${stripControls(cwd)}\x1b[0m\r\n\r\n$ `);
    });

    return () => {
      disposed = true;
      observer?.disconnect();
      if (frame !== null) cancelAnimationFrame(frame);
      fitAddon?.dispose();
      terminal?.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
      host.replaceChildren();
    };
  }, [cwd, sessionId, shared, title]);

  return <div ref={hostRef} data-ghostty-terminal="true" className={className} style={{ width: "100%", height: "100%", overflow: "hidden", caretColor: "transparent", background: TERMINAL_THEME.background }}/>;
});

export const EmbeddedGhosttyTerminal = forwardRef<EmbeddedGhosttyTerminalHandle, EmbeddedGhosttyTerminalProps>(function EmbeddedGhosttyTerminal(props, ref) {
  return props.client
    ? <IrohGhosttyTerminal {...props} ref={ref}/>
    : <LocalGhosttyTerminal {...props} ref={ref}/>;
});

function terminalFontSize() {
  if (window.innerWidth < 640) return 10;
  if (window.innerWidth < 1024) return 11;
  return 12;
}

function stripControls(value: string) {
  return value.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, "");
}
