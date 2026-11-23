"use client";
import { useEffect, useState } from 'react';
import { ThemeProvider, useTheme } from 'next-themes';
import { AiConfigProvider } from '@/features/oathkeeper/hooks/use-ai-config';
import { VibeGhostV2DirectoryOwner, VibeGhostV2DirectoryProvider } from '@/features/oathkeeper/hooks/use-vibeghost-v2-directory';
import { VibeGhostView } from '@/features/oathkeeper/components/vibeghost-view';
import { VibeGhostV2SidebarNav } from './_components/vibeghost-sidebar-nav';
import { LightboxHost } from '@/features/oathkeeper/components/lightbox';
import { connection, restoreConnection, setConnection, validateHost, publicRequest, liteFetch, type Hello, type Connection } from '@/lib/lite-connection';
import shell from '@/features/oathkeeper/components/app-shell.module.css';
import sidebarStyles from './_components/oathkeeper-sidebar.module.css';
import './lite.css';
import './light-theme.css';

type Saved = { url: string; name: string };
function Lite() {
  const [ready, setReady] = useState(false);
  const [active, setActive] = useState<Connection | null>(null);
  const [saved, setSaved] = useState<Saved[]>([]);
  const [url, setUrl] = useState('');
  const [hello, setHello] = useState<Hello | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [mobile, setMobile] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();
  useEffect(() => {
    setActive(restoreConnection());
    try { const hosts = JSON.parse(localStorage.getItem('vibeghost-lite-hosts') || '[]'); if (Array.isArray(hosts)) setSaved(hosts.filter(item => item && typeof item.url === 'string' && typeof item.name === 'string')); } catch {}
    setReady(true);
    const expired = () => { setActive(null); setHello(null); setError('Your sign-in expired. Please sign in again.'); };
    window.addEventListener('lite-auth-expired', expired);
    return () => window.removeEventListener('lite-auth-expired', expired);
  }, []);
  if (!ready) return null;
  const theme = <button type="button" className="lite-button" aria-label="Toggle theme" onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}>{resolvedTheme === 'dark' ? 'Light' : 'Dark'}</button>;
  const disconnect = async () => {
    try { await liteFetch('/api/lite/logout', { method: 'POST' }); } catch {}
    setConnection(null); setActive(null); setHello(null); setPassword(''); setMobile(false);
  };
  if (!active) return <main className="lite-connect"><div className="lite-theme">{theme}</div><form className="lite-card" onSubmit={async event => {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const origin = validateHost(url); setUrl(origin);
      if (!hello) {
        const response: Hello = await publicRequest(origin, 'hello');
        if (typeof response.protected !== 'boolean' || typeof response.name !== 'string') throw new Error('This URL is not a compatible VibeGhost.');
        if (!response.protected) throw new Error('This VibeGhost is unprotected. Set a dashboard password on its host before connecting.');
        setHello(response);
      } else {
        const pair = await publicRequest(origin, 'login', { username, password });
        const value = { url: origin, name: hello.name, ...pair }; setConnection(value); setActive(value); setPassword('');
        const hosts = [{ url: origin, name: hello.name }, ...saved.filter(item => item.url !== origin)].slice(0, 12);
        setSaved(hosts); localStorage.setItem('vibeghost-lite-hosts', JSON.stringify(hosts));
      }
    } catch (error) { setError(error instanceof Error ? error.message : 'Could not connect. Check the URL, tailnet connection and VibeGhost Lite origin allowlist.'); }
    finally { setBusy(false); }
  }}><h1>VibeGhost Lite</h1><p>{hello ? `Sign in to ${hello.name}` : 'Your workspaces, sessions and terminals. Direct from your VibeGhost.'}</p>
    <label>VibeGhost URL<input required type="url" autoComplete="url" placeholder="https://mac.tailnet.ts.net" value={url} disabled={busy || !!hello} onChange={event => setUrl(event.target.value)}/></label>
    {hello ? <>{hello.hasUsername ? <label>Username<input required autoComplete="username" autoCapitalize="none" value={username} onChange={event => setUsername(event.target.value)}/></label> : null}<label>Dashboard password<input required autoFocus type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)}/></label></> : null}
    {error ? <p role="alert">{error}</p> : null}<button className="lite-button" type="submit" disabled={busy}>{busy ? 'Connecting…' : hello ? 'Sign in' : 'Connect'}</button>
    {hello ? <button type="button" className="lite-button" onClick={() => { setHello(null); setPassword(''); setError(''); }}>Change URL</button> : <><p className="lite-help">HTTPS required. Your browser must be able to reach the host. Allow this app’s origin ({window.location.origin}) in VibeGhost → Protection → VibeGhost Lite.</p>{saved.length ? <div><h2>Saved VibeGhosts</h2>{saved.map(item => <div key={item.url} className="lite-saved"><button type="button" onClick={() => setUrl(item.url)}>{item.name}<small>{item.url}</small></button><button type="button" aria-label={`Forget ${item.name}`} onClick={() => { const next = saved.filter(host => host.url !== item.url); setSaved(next); localStorage.setItem('vibeghost-lite-hosts', JSON.stringify(next)); }}>×</button></div>)}</div> : null}</>}
  </form></main>;
  return <AiConfigProvider defaultConfig={{ enabled: false, onboarded: true, keyMode: 'local' }}><VibeGhostV2DirectoryOwner key={active.url}><VibeGhostV2DirectoryProvider>
    <div data-oathkeeper-app className={`${shell.app} flex h-dvh overflow-hidden text-ink`}>
      {mobile ? <button className="lite-scrim" aria-label="Close sidebar" onClick={() => setMobile(false)}/> : null}
      <aside id="oathkeeper-sidebar" data-mobile-open={mobile} data-collapsed={collapsed} className={`${sidebarStyles.sidebar} lite-sidebar`}><header><strong>{collapsed ? 'VG' : 'VibeGhost Lite'}</strong>{theme}</header><div className="lite-host"><span title={active.url}>{active.name}</span><button type="button" onClick={() => void disconnect()}>Switch</button></div><VibeGhostV2SidebarNav active collapsed={collapsed} onClose={() => setMobile(false)}/></aside>
      <main data-oathkeeper-main className={`${shell.main} flex min-w-0 flex-1 flex-col`}><section data-oathkeeper-page className={`${shell.page} relative isolate flex min-h-0 flex-1 flex-col overflow-hidden`}><VibeGhostView sidebarCollapsed={collapsed} mobileSidebarOpen={mobile} onSidebarToggle={() => setCollapsed(value => !value)} onOpenSidebar={() => setMobile(true)}/></section></main>
      <LightboxHost/>
    </div>
  </VibeGhostV2DirectoryProvider></VibeGhostV2DirectoryOwner></AiConfigProvider>;
}
export default function Page() { return <ThemeProvider attribute="class" defaultTheme="system" enableSystem><Lite/></ThemeProvider>; }
