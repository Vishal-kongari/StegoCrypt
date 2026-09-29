import { type ChangeEvent, type ReactNode, useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Link, Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import {
  ArrowDownToLine, ArrowRight, ArrowUpRight, Binary, BookOpen, Check, ChevronDown, Clipboard,
  Copy, Download, FileImage, Gauge, Github, HardDrive, ImagePlus, Info, KeyRound, Layers3,
  LockKeyhole, Menu, MessageSquareLock, Network, Play, ScanLine, Shield,
  ShieldCheck, Sparkles, Terminal, Upload, X, Zap,
} from 'lucide-react';
import { decryptMessage, encryptMessage } from '@/crypto';
import { downloadBlob, fileToImageData, formatBytes, imageDataToPng } from '@/image';
import { calculatePsnr, capacityFor, embedPayload, extractPayload } from '@/steganography';

const queryClient = new QueryClient();

const navItems = [
  { href: '/', label: 'Overview', icon: Network },
  { href: '/encode', label: 'Encode', icon: ArrowUpRight },
  { href: '/decode', label: 'Decode', icon: ArrowDownToLine },
  { href: '/how-it-works', label: 'How it works', icon: BookOpen },
  { href: '/security', label: 'Security lab', icon: ShieldCheck },
  { href: '/about', label: 'About', icon: Info },
];

function cn(...classes: Array<string | false | undefined>) { return classes.filter(Boolean).join(' '); }

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-3" data-testid="link-logo">
      <span className="relative grid h-9 w-9 place-items-center rounded-xl bg-accent text-primary shadow-[0_0_0_4px_hsl(var(--accent)/.15)]">
        <LockKeyhole size={18} strokeWidth={2.5} />
        <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-[#ff7e5f] pulse-dot" />
      </span>
      <span className="font-[var(--font-serif)] text-lg font-bold tracking-[-.04em]">Stego<span className="text-[#76921b]">Crypt</span></span>
    </Link>
  );
}

function Button({ children, variant = 'primary', className, ...props }: { children: ReactNode; variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; className?: string } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const variants = {
    primary: 'bg-primary text-primary-foreground hover:-translate-y-0.5 hover:shadow-lg',
    secondary: 'border border-border bg-card text-foreground hover:border-accent hover:bg-accent/20',
    ghost: 'text-muted-foreground hover:bg-muted hover:text-foreground',
    danger: 'border border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/15',
  };
  return <button className={cn('inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-45', variants[variant], className)} {...props}>{children}</button>;
}

function Badge({ children, tone = 'muted' }: { children: ReactNode; tone?: 'muted' | 'lime' | 'orange' }) {
  return <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[10px] font-medium uppercase tracking-[.13em]', tone === 'lime' && 'bg-accent text-primary', tone === 'orange' && 'bg-[#ff7e5f]/12 text-[#ba5037]', tone === 'muted' && 'bg-muted text-muted-foreground')}>{children}</span>;
}

function Sidebar({ mobileOpen, onClose }: { mobileOpen: boolean; onClose: () => void }) {
  const [location] = useLocation();
  return (
    <>
      {mobileOpen && <button aria-label="Close navigation" data-testid="button-close-navigation" onClick={onClose} className="fixed inset-0 z-40 bg-primary/35 md:hidden" />}
      <aside className={cn('fixed inset-y-0 left-0 z-50 flex w-[250px] flex-col bg-sidebar px-5 py-6 text-sidebar-foreground transition-transform md:translate-x-0', mobileOpen ? 'translate-x-0' : '-translate-x-full')}>
        <div className="flex items-center justify-between">
          <Logo />
          <button onClick={onClose} aria-label="Close menu" data-testid="button-close-menu" className="rounded-lg p-1 text-sidebar-foreground/60 hover:bg-sidebar-accent md:hidden"><X size={18} /></button>
        </div>
        <div className="mt-12 font-mono text-[9px] uppercase tracking-[.24em] text-sidebar-foreground/40">Workspace</div>
        <nav className="mt-3 space-y-1">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = location === href;
            return <Link key={href} href={href} onClick={onClose} data-testid={`link-nav-${label.toLowerCase().replaceAll(' ', '-')}`} className={cn('group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold', active ? 'bg-sidebar-accent text-sidebar-foreground' : 'text-sidebar-foreground/60 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground')}>
              <Icon size={17} className={cn(active && 'text-sidebar-primary')} /><span>{label}</span>{active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-sidebar-primary" />}
            </Link>;
          })}
        </nav>
        <div className="mt-auto rounded-2xl border border-sidebar-border bg-sidebar-accent/50 p-4">
          <div className="flex items-center gap-2 text-xs font-bold"><span className="h-2 w-2 rounded-full bg-accent pulse-dot" />Browser-local</div>
          <p className="mt-2 text-[11px] leading-5 text-sidebar-foreground/55">No server. No account. Your payload stays in this tab.</p>
          <Link href="/about" onClick={onClose} className="mt-3 inline-flex items-center gap-1 text-[11px] font-bold text-sidebar-primary">Read the privacy note <ArrowRight size={12} /></Link>
        </div>
        <div className="mt-5 flex items-center justify-between font-mono text-[9px] text-sidebar-foreground/35"><span>SC / v1.0.0</span><span>LOCAL ONLY</span></div>
      </aside>
    </>
  );
}

function Shell({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  return <div className="noise min-h-[100dvh] bg-background text-foreground">
    <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border/70 bg-background/90 px-5 backdrop-blur md:hidden">
      <button onClick={() => setMobileOpen(true)} aria-label="Open navigation" data-testid="button-open-navigation" className="rounded-xl p-2 hover:bg-muted"><Menu size={19} /></button><Logo /><span className="w-8" />
    </header>
    <main className="min-h-[100dvh] md:pl-[250px]">{children}</main>
  </div>;
}

function PageIntro({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return <div className="reveal flex flex-col justify-between gap-5 border-b border-border/70 pb-7 sm:flex-row sm:items-end">
    <div><div className="font-mono text-[10px] uppercase tracking-[.24em] text-[#688018]">{eyebrow}</div><h1 className="mt-3 max-w-3xl font-[var(--font-serif)] text-3xl font-bold tracking-[-.055em] sm:text-5xl">{title}</h1><p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p></div>
    {action}
  </div>;
}

function SectionLabel({ children }: { children: ReactNode }) { return <div className="font-mono text-[10px] uppercase tracking-[.24em] text-muted-foreground">{children}</div>; }

function Pipeline({ compact = false }: { compact?: boolean }) {
  const stages = [
    { number: '01', title: 'Message', sub: 'Plaintext stays local', icon: MessageSquareLock, color: 'text-[#688018]' },
    { number: '02', title: 'Encrypt', sub: 'AES-256-GCM + PBKDF2', icon: KeyRound, color: 'text-[#16879c]' },
    { number: '03', title: 'Embed', sub: '1 bit per RGB channel', icon: Binary, color: 'text-[#ba5037]' },
    { number: '04', title: 'PNG out', sub: 'Ready to send', icon: FileImage, color: 'text-[#688018]' },
  ];
  return <div className={cn('grid gap-2 md:grid-cols-4', compact && 'md:grid-cols-4')}>
    {stages.map((stage, index) => <div key={stage.number} className="relative rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between"><span className="font-mono text-[10px] text-muted-foreground">{stage.number}</span><stage.icon size={18} className={stage.color} /></div>
      <div className="mt-5 font-[var(--font-serif)] font-bold">{stage.title}</div><p className="mt-1 text-[11px] leading-4 text-muted-foreground">{stage.sub}</p>
      {index < stages.length - 1 && <ArrowRight className="absolute -right-3 top-1/2 z-10 hidden rounded-full bg-background p-1 text-muted-foreground md:block" size={20} />}
    </div>)}
  </div>;
}

function Dashboard() {
  return <div className="lab-grid min-h-[100dvh] px-5 py-8 sm:px-8 lg:px-12 lg:py-12">
    <div className="mx-auto max-w-[1160px]">
      <div className="reveal flex items-center justify-between"><div><Badge tone="lime"><span className="h-1.5 w-1.5 rounded-full bg-primary" /> local session active</Badge></div><Link href="/security" className="hidden items-center gap-2 text-xs font-bold text-muted-foreground hover:text-foreground sm:flex" data-testid="link-dashboard-security">Inspect the security model <ArrowUpRight size={14} /></Link></div>
      <section className="reveal relative grid gap-10 pb-16 pt-14 lg:grid-cols-[1.1fr_.9fr] lg:items-end lg:pt-20">
        <div><p className="font-mono text-[11px] uppercase tracking-[.27em] text-[#688018]">quiet security lab / 01</p><h1 className="mt-5 max-w-3xl font-[var(--font-serif)] text-5xl font-bold leading-[.93] tracking-[-.07em] sm:text-7xl">Move a secret.<br /><span className="text-[#16879c]">Leave no trace.</span></h1><p className="mt-7 max-w-xl text-base leading-7 text-muted-foreground">StegoCrypt turns a private message into a normal-looking PNG — encrypted, embedded, and processed entirely in your browser.</p><div className="mt-8 flex flex-wrap gap-3"><Link href="/encode" className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground hover:-translate-y-0.5 hover:shadow-lg" data-testid="link-start-encode">Start encoding <ArrowUpRight size={16} /></Link><Link href="/decode" className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-5 py-3 text-sm font-bold hover:border-accent" data-testid="link-start-decode">Decode a PNG <ArrowDownToLine size={16} /></Link></div></div>
        <div className="relative min-h-[270px] overflow-hidden rounded-3xl border border-border bg-primary p-6 text-primary-foreground shadow-xl">
          <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full border border-accent/20" /><div className="absolute -right-8 -top-12 h-48 w-48 rounded-full border border-accent/20" />
          <div className="relative flex h-full flex-col justify-between"><div className="flex items-center justify-between"><span className="font-mono text-[10px] uppercase tracking-[.2em] text-primary-foreground/50">pipeline monitor</span><span className="flex items-center gap-2 font-mono text-[10px] text-accent"><span className="h-1.5 w-1.5 rounded-full bg-accent pulse-dot" />READY</span></div><div className="py-8"><div className="font-mono text-4xl font-medium tracking-[-.08em] text-accent">0.00%</div><p className="mt-2 text-xs text-primary-foreground/60">content exposed to a network</p></div><div className="grid grid-cols-3 gap-3 border-t border-primary-foreground/15 pt-4 font-mono text-[10px]"><div><span className="block text-primary-foreground/40">CIPHER</span><span>AES-GCM</span></div><div><span className="block text-primary-foreground/40">KDF</span><span>PBKDF2</span></div><div><span className="block text-primary-foreground/40">MEDIUM</span><span>LSB / PNG</span></div></div></div>
        </div>
      </section>
      <section className="border-t border-border/70 py-10"><div className="mb-5 flex items-end justify-between"><div><SectionLabel>Visible pipeline</SectionLabel><h2 className="mt-2 font-[var(--font-serif)] text-2xl font-bold tracking-[-.04em]">Four steps. One clear handoff.</h2></div><Link href="/how-it-works" className="hidden items-center gap-1 text-xs font-bold text-muted-foreground hover:text-foreground sm:flex" data-testid="link-learn-pipeline">Learn the details <ArrowRight size={14} /></Link></div><Pipeline /></section>
      <section className="grid gap-4 border-t border-border/70 py-10 md:grid-cols-[1.3fr_.7fr]"><div><SectionLabel>Why this workspace</SectionLabel><h2 className="mt-2 max-w-xl font-[var(--font-serif)] text-3xl font-bold tracking-[-.05em]">Security you can point at, not just trust.</h2><p className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground">Every stage is inspectable. See capacity before you commit, inspect the image quality after embedding, and learn what the browser did with your data.</p></div><div className="grid grid-cols-2 gap-2"><div className="rounded-2xl border border-border bg-card p-4"><Shield size={18} className="text-[#16879c]" /><div className="mt-8 font-[var(--font-serif)] font-bold">Private by default</div><p className="mt-1 text-xs leading-5 text-muted-foreground">No uploads. No telemetry.</p></div><div className="rounded-2xl border border-border bg-card p-4"><Gauge size={18} className="text-[#ba5037]" /><div className="mt-8 font-[var(--font-serif)] font-bold">Measured output</div><p className="mt-1 text-xs leading-5 text-muted-foreground">Capacity and PSNR included.</p></div></div></section>
      <section className="rounded-3xl bg-[#dce9a6] p-6 sm:p-8"><div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center"><div><Badge>system test</Badge><h2 className="mt-3 font-[var(--font-serif)] text-2xl font-bold tracking-[-.04em]">See the whole loop in under a minute.</h2><p className="mt-2 max-w-xl text-sm text-primary/70">Use the guided demo to encode and decode a local sample without leaving this tab.</p></div><Link href="/encode?demo=1" className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground" data-testid="link-run-system-test"><Play size={15} /> Run system test</Link></div></section>
    </div>
  </div>;
}

function FileDrop({ file, onFile, preview }: { file: File | null; onFile: (file: File) => void; preview?: string }) {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => { const next = event.target.files?.[0]; if (next) onFile(next); };
  return <label className="group block cursor-pointer rounded-2xl border border-dashed border-input bg-card p-5 hover:border-accent hover:bg-accent/10" data-testid="dropzone-image"><input className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" onChange={handleChange} data-testid="input-cover-image" />{file ? <div className="flex items-center gap-4"><div className="h-16 w-16 overflow-hidden rounded-xl bg-muted">{preview && <img src={preview} alt="Selected cover preview" className="h-full w-full object-cover" data-testid="img-cover-preview" />}</div><div className="min-w-0 flex-1"><div className="truncate text-sm font-bold">{file.name}</div><div className="mt-1 font-mono text-[10px] text-muted-foreground">{formatBytes(file.size)} · ready to inspect</div></div><Check size={18} className="text-[#688018]" /></div> : <div className="flex items-center gap-4"><div className="grid h-12 w-12 place-items-center rounded-xl bg-muted text-muted-foreground group-hover:bg-accent group-hover:text-primary"><ImagePlus size={21} /></div><div><div className="text-sm font-bold">Choose a cover image</div><div className="mt-1 text-xs text-muted-foreground">PNG, JPG, or WebP · larger images hold more</div></div><Upload size={17} className="ml-auto text-muted-foreground" /></div>}</label>;
}

function Meter({ value, label }: { value: number; label: string }) {
  return <div><div className="mb-2 flex justify-between font-mono text-[10px] uppercase tracking-[.15em] text-muted-foreground"><span>{label}</span><span>{Math.round(value)}%</span></div><div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-accent transition-all duration-500" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} /></div></div>;
}

function EncodePage() {
  const [location] = useLocation();
  const demoMode = location.includes('demo=1');
  const [message, setMessage] = useState(demoMode ? 'Meet at the north entrance after the final demo.' : '');
  const [password, setPassword] = useState(demoMode ? 'local-lab-2025' : '');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [capacity, setCapacity] = useState(0);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ blob: Blob; psnr: number; used: number } | null>(null);
  const [error, setError] = useState('');
  const onFile = (next: File) => { setFile(next); setResult(null); setError(''); const reader = new FileReader(); reader.onload = () => setPreview(String(reader.result)); reader.readAsDataURL(next); fileToImageData(next).then((image) => setCapacity(capacityFor(image).bytes)).catch(() => setCapacity(0)); };
  useEffect(() => {
    if (!demoMode || file) return;
    const canvas = document.createElement('canvas');
    canvas.width = 900; canvas.height = 560;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.fillStyle = '#dce9a6'; context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = '#20283b'; context.fillRect(44, 44, 812, 472);
    context.fillStyle = '#16879c'; context.fillRect(75, 90, 260, 250);
    context.fillStyle = '#688018'; context.fillRect(390, 90, 400, 18);
    context.fillStyle = '#dce9a6'; context.fillRect(390, 135, 270, 12);
    context.fillRect(390, 170, 330, 12);
    context.fillStyle = '#ff7e5f'; context.fillRect(390, 235, 140, 100);
    canvas.toBlob((blob) => { if (blob) onFile(new File([blob], 'stegocrypt-system-test.png', { type: 'image/png' })); }, 'image/png');
  }, [demoMode, file]);
  const encode = async () => { if (!file || !message || password.length < 8) { setError('Add a cover image, a message, and a password with at least 8 characters.'); return; } setBusy(true); setError(''); setResult(null); try { const original = await fileToImageData(file); const encrypted = await encryptMessage(message, password); const encoded = embedPayload(original, encrypted); const blob = await imageDataToPng(encoded); const psnr = calculatePsnr(original, encoded); setResult({ blob, psnr, used: encrypted.length + 8 }); } catch (caught) { setError(caught instanceof Error ? caught.message : 'Encoding failed.'); } finally { setBusy(false); } };
  return <div className="min-h-[100dvh] px-5 py-8 sm:px-8 lg:px-12 lg:py-12"><div className="mx-auto max-w-[1080px]"><PageIntro eyebrow="sender workflow / 02" title="Hide a message in plain sight." description="Encrypt locally, then fold the ciphertext into the least significant bits of a cover image. The output is an ordinary PNG with a measurable footprint." action={<Badge tone="lime"><span className="h-1.5 w-1.5 rounded-full bg-primary" /> all local</Badge>} /><div className="mt-8 grid gap-5 lg:grid-cols-[1fr_.72fr]"><section className="rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-7"><div className="flex items-center justify-between"><SectionLabel>01 / compose payload</SectionLabel><span className="font-mono text-[10px] text-muted-foreground">{message.length.toLocaleString()} chars</span></div><label className="mt-5 block text-xs font-bold">Secret message<textarea value={message} onChange={(event) => setMessage(event.target.value)} rows={7} placeholder="Write the message you want to move…" className="mt-2 w-full resize-y rounded-xl border border-input bg-background p-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20" data-testid="textarea-secret-message" /></label><label className="mt-5 block text-xs font-bold">Shared password<div className="relative mt-2"><KeyRound size={16} className="absolute left-3 top-3 text-muted-foreground" /><input value={password} onChange={(event) => setPassword(event.target.value)} type="password" placeholder="Minimum 8 characters" className="w-full rounded-xl border border-input bg-background py-2.5 pl-10 pr-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20" data-testid="input-encode-password" /></div></label><div className="mt-6"><label className="text-xs font-bold">Cover image</label><div className="mt-2"><FileDrop file={file} onFile={onFile} preview={preview} /></div></div>{error && <div className="mt-5 rounded-xl border border-destructive/25 bg-destructive/10 p-3 text-xs leading-5 text-destructive" data-testid="status-encode-error">{error}</div>}<Button onClick={encode} disabled={busy} className="mt-6 w-full" data-testid="button-encode">{busy ? <><Sparkles size={16} className="animate-pulse" /> Encrypting and embedding…</> : <><LockKeyhole size={16} /> Encrypt & embed</>}</Button></section><aside className="space-y-4"><div className="rounded-3xl border border-border bg-primary p-5 text-primary-foreground shadow-lg sm:p-6"><div className="flex items-center justify-between"><SectionLabel>Live capacity</SectionLabel><Gauge size={17} className="text-accent" /></div><div className="mt-7 font-mono text-4xl tracking-[-.08em] text-accent">{capacity ? formatBytes(capacity) : '—'}</div><p className="mt-2 text-xs leading-5 text-primary-foreground/60">estimated encrypted payload capacity</p><div className="mt-7"><Meter value={capacity ? (message.length / capacity) * 100 : 0} label="message fit" /></div></div>{result ? <div className="reveal rounded-3xl border border-[#688018]/35 bg-[#dce9a6]/40 p-5 sm:p-6"><div className="flex items-center gap-2 text-sm font-bold"><Check size={17} className="text-[#688018]" /> Stego image ready</div><p className="mt-2 text-xs leading-5 text-muted-foreground">Your message is encrypted and embedded. Download the PNG, then share it through your usual channel.</p><div className="mt-5 grid grid-cols-2 gap-2"><div className="rounded-xl bg-card/70 p-3"><div className="font-mono text-lg font-medium">{Number.isFinite(result.psnr) ? `${result.psnr.toFixed(1)} dB` : '∞'}</div><div className="mt-1 text-[10px] text-muted-foreground">PSNR quality</div></div><div className="rounded-xl bg-card/70 p-3"><div className="font-mono text-lg font-medium">{formatBytes(result.used)}</div><div className="mt-1 text-[10px] text-muted-foreground">payload size</div></div></div><Button onClick={() => downloadBlob(result.blob, 'stegocrypt-message.png')} className="mt-4 w-full" data-testid="button-download-stego"><Download size={16} /> Download PNG</Button></div> : <div className="rounded-3xl border border-border bg-card p-5 sm:p-6"><SectionLabel>Before you commit</SectionLabel><ul className="mt-4 space-y-4 text-xs leading-5 text-muted-foreground"><li className="flex gap-3"><ShieldCheck size={16} className="shrink-0 text-[#16879c]" /> AES-GCM authenticates the ciphertext so tampering fails closed.</li><li className="flex gap-3"><Binary size={16} className="shrink-0 text-[#ba5037]" /> LSB changes are intentionally tiny and measured after encoding.</li><li className="flex gap-3"><HardDrive size={16} className="shrink-0 text-[#688018]" /> Keep the exact PNG bytes. Re-compression can destroy the hidden payload.</li></ul></div>}</aside></div></div></div>;
}

function DecodePage() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const onFile = (next: File) => { setFile(next); setMessage(''); setError(''); const reader = new FileReader(); reader.onload = () => setPreview(String(reader.result)); reader.readAsDataURL(next); };
  const decode = async () => { if (!file || !password) { setError('Choose a stego image and enter the shared password.'); return; } setBusy(true); setError(''); try { const image = await fileToImageData(file); const payload = extractPayload(image); const clear = await decryptMessage(payload, password); setMessage(clear); } catch (caught) { setError('Could not recover the message. Check the PNG and password, then try again.'); } finally { setBusy(false); } };
  const copy = async () => { await navigator.clipboard.writeText(message); setCopied(true); window.setTimeout(() => setCopied(false), 1600); };
  return <div className="min-h-[100dvh] px-5 py-8 sm:px-8 lg:px-12 lg:py-12"><div className="mx-auto max-w-[1080px]"><PageIntro eyebrow="receiver workflow / 03" title="Read what was hidden." description="Drop the original StegoCrypt PNG here, use the shared password, and recover the authenticated message locally." action={<Badge tone="lime"><span className="h-1.5 w-1.5 rounded-full bg-primary" /> zero uploads</Badge>} /><div className="mt-8 grid gap-5 lg:grid-cols-[.85fr_1.15fr]"><section className="rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-7"><SectionLabel>01 / provide the artifact</SectionLabel><div className="mt-5"><FileDrop file={file} onFile={onFile} preview={preview} /></div><label className="mt-6 block text-xs font-bold">Shared password<div className="relative mt-2"><KeyRound size={16} className="absolute left-3 top-3 text-muted-foreground" /><input value={password} onChange={(event) => setPassword(event.target.value)} type="password" placeholder="The password used during encoding" className="w-full rounded-xl border border-input bg-background py-2.5 pl-10 pr-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20" data-testid="input-decode-password" /></div></label>{error && <div className="mt-5 rounded-xl border border-destructive/25 bg-destructive/10 p-3 text-xs leading-5 text-destructive" data-testid="status-decode-error">{error}</div>}<Button onClick={decode} disabled={busy} className="mt-6 w-full" data-testid="button-decode">{busy ? <><ScanLine size={16} className="animate-pulse" /> Inspecting pixels…</> : <><ScanLine size={16} /> Extract & decrypt</>}</Button></section><section className="rounded-3xl border border-border bg-primary p-5 text-primary-foreground shadow-lg sm:p-7"><div className="flex items-center justify-between"><SectionLabel>02 / recovered message</SectionLabel><Badge tone="lime">{message ? 'authenticated' : 'waiting'}</Badge></div>{message ? <div className="reveal mt-7"><div className="rounded-2xl border border-primary-foreground/15 bg-primary-foreground/10 p-5 text-sm leading-7 text-primary-foreground" data-testid="text-recovered-message">{message}</div><div className="mt-4 flex flex-wrap gap-2"><Button onClick={copy} variant="secondary" className="border-primary-foreground/20 bg-primary-foreground/10 text-primary-foreground hover:bg-primary-foreground/20" data-testid="button-copy-message">{copied ? <Check size={15} /> : <Copy size={15} />} {copied ? 'Copied' : 'Copy message'}</Button><Button onClick={() => downloadBlob(new Blob([message], { type: 'text/plain' }), 'stegocrypt-message.txt')} variant="secondary" className="border-primary-foreground/20 bg-primary-foreground/10 text-primary-foreground hover:bg-primary-foreground/20" data-testid="button-download-message"><Download size={15} /> Download .txt</Button></div></div> : <div className="flex min-h-[275px] flex-col items-center justify-center text-center"><div className="grid h-16 w-16 place-items-center rounded-2xl border border-primary-foreground/15 bg-primary-foreground/10 text-accent"><Clipboard size={25} /></div><h2 className="mt-5 font-[var(--font-serif)] text-xl font-bold">Your message appears here.</h2><p className="mt-2 max-w-xs text-xs leading-5 text-primary-foreground/60">The message is only rendered after the image passes its integrity check and the password unlocks it.</p></div>}</section></div></div></div>;
}

function HowItWorks() {
  const [active, setActive] = useState(1);
  const stages = [
    { title: 'Start with plaintext', icon: MessageSquareLock, copy: 'Your message exists only in the page memory while you work. It is never sent to an endpoint or written to storage.', detail: 'The UI hands a UTF-8 byte sequence to the local crypto helper.' },
    { title: 'Derive a key', icon: KeyRound, copy: 'PBKDF2-SHA-256 turns your password and a fresh random salt into a 256-bit AES key. The salt is stored inside the encrypted envelope, never the password.', detail: '120,000 iterations · 16-byte salt · browser Web Crypto API' },
    { title: 'Authenticate + encrypt', icon: ShieldCheck, copy: 'AES-256-GCM encrypts the message and adds an authentication tag. Changing even one bit makes decryption fail.', detail: 'Random 12-byte IV · authenticated ciphertext · fail-closed decryption' },
    { title: 'Hide in pixels', icon: Binary, copy: 'The encrypted bytes are packed with a small header and written into the least significant bit of RGB channels. Alpha stays untouched.', detail: '1 bit per RGB channel · lossless PNG required' },
  ];
  return <div className="min-h-[100dvh] px-5 py-8 sm:px-8 lg:px-12 lg:py-12"><div className="mx-auto max-w-[1080px]"><PageIntro eyebrow="field notes / 04" title="A secret is a pipeline, not a promise." description="StegoCrypt makes each transformation legible. Select a stage to see the exact contract between your message, the cipher, and the image." action={<Link href="/encode" className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground" data-testid="link-how-encode">Try it now <ArrowRight size={15} /></Link>} /><div className="mt-8 grid gap-5 lg:grid-cols-[.7fr_1.3fr]"><div className="space-y-2">{stages.map((stage, index) => <button key={stage.title} onClick={() => setActive(index)} className={cn('flex w-full items-center gap-4 rounded-2xl border p-4 text-left', active === index ? 'border-primary bg-primary text-primary-foreground shadow-lg' : 'border-border bg-card hover:border-accent')} data-testid={`button-stage-${index}`}><span className={cn('grid h-10 w-10 place-items-center rounded-xl', active === index ? 'bg-accent text-primary' : 'bg-muted text-muted-foreground')}><stage.icon size={18} /></span><span className="flex-1"><span className="block font-[var(--font-serif)] font-bold">{stage.title}</span><span className={cn('mt-1 block font-mono text-[10px]', active === index ? 'text-primary-foreground/55' : 'text-muted-foreground')}>stage 0{index + 1}</span></span><ArrowRight size={16} className={active === index ? 'text-accent' : 'text-muted-foreground'} /></button>)}</div><div className="rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-9"><div className="flex items-center justify-between"><Badge tone="lime">stage 0{active + 1}</Badge><span className="font-mono text-[10px] text-muted-foreground">{active + 1} / 04</span></div><div className="mt-12 grid min-h-[300px] place-items-center rounded-2xl border border-border bg-background lab-grid p-8 text-center"><div><div className="mx-auto grid h-20 w-20 place-items-center rounded-3xl bg-accent text-primary shadow-[0_0_0_10px_hsl(var(--accent)/.18)]"><span>{(() => { const Icon = stages[active].icon; return <Icon size={32} />; })()}</span></div><h2 className="mt-7 font-[var(--font-serif)] text-2xl font-bold tracking-[-.04em]">{stages[active].title}</h2><p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-muted-foreground">{stages[active].copy}</p><div className="mt-6 inline-flex items-center gap-2 rounded-xl bg-muted px-3 py-2 font-mono text-[10px] text-muted-foreground"><Terminal size={13} className="text-[#16879c]" /> {stages[active].detail}</div></div></div></div></div><div className="mt-5 rounded-3xl border border-border bg-[#dce9a6]/45 p-6"><div className="flex items-center gap-2"><Layers3 size={17} className="text-[#688018]" /><span className="font-[var(--font-serif)] font-bold">Decode reverses the arrow</span></div><p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">The receiver extracts the header and encrypted bytes, derives the same AES key from their password, then lets GCM verify and reveal the original UTF-8 text. A wrong password never produces plausible output.</p></div></div></div>;
}

function SecurityPage() {
  const [bit, setBit] = useState(0);
  const [width, setWidth] = useState(1280);
  const [height, setHeight] = useState(720);
  const [open, setOpen] = useState<number | null>(0);
  const capacity = Math.floor(width * height * 3 / 8);
  const bytes = [1, 0, 1, 1, 0, 0, 1, 0];
  return <div className="min-h-[100dvh] px-5 py-8 sm:px-8 lg:px-12 lg:py-12"><div className="mx-auto max-w-[1080px]"><PageIntro eyebrow="inspection deck / 05" title="Understand the attack surface." description="Security is a set of explicit choices. This page shows what StegoCrypt protects, what it cannot, and how much a cover image can carry." action={<Badge tone="orange"><Shield size={13} /> honest boundaries</Badge>} /><div className="mt-8 grid gap-5 md:grid-cols-3"><div className="rounded-3xl border border-border bg-card p-5"><ShieldCheck className="text-[#688018]" /><h2 className="mt-8 font-[var(--font-serif)] text-lg font-bold">Protected</h2><p className="mt-2 text-xs leading-5 text-muted-foreground">Message confidentiality and tamper detection when your password is strong and the PNG stays lossless.</p></div><div className="rounded-3xl border border-border bg-card p-5"><Network className="text-[#16879c]" /><h2 className="mt-8 font-[var(--font-serif)] text-lg font-bold">Visible</h2><p className="mt-2 text-xs leading-5 text-muted-foreground">The image is still a carrier. Observers can suspect steganography and analyze its pixels.</p></div><div className="rounded-3xl border border-border bg-card p-5"><Zap className="text-[#ba5037]" /><h2 className="mt-8 font-[var(--font-serif)] text-lg font-bold">Not a magic cloak</h2><p className="mt-2 text-xs leading-5 text-muted-foreground">It does not protect a weak password, endpoint compromise, screenshots, or re-compressed files.</p></div></div><div className="mt-5 grid gap-5 lg:grid-cols-[1.05fr_.95fr]"><section className="rounded-3xl border border-border bg-card p-6 sm:p-8"><SectionLabel>LSB visualizer</SectionLabel><h2 className="mt-3 font-[var(--font-serif)] text-2xl font-bold tracking-[-.04em]">One pixel. Three quiet edits.</h2><p className="mt-3 text-sm leading-6 text-muted-foreground">Each RGB channel contributes one bit. The alpha channel is left untouched. Click a bit to inspect the byte boundary.</p><div className="mt-8 rounded-2xl bg-primary p-5 text-primary-foreground"><div className="flex justify-between font-mono text-[10px] text-primary-foreground/45"><span>PIXEL 0412</span><span>RGB / 8-bit channels</span></div><div className="mt-5 grid grid-cols-8 gap-1.5">{bytes.map((value, index) => <button key={index} onClick={() => setBit(index)} className={cn('grid aspect-square place-items-center rounded-md font-mono text-sm font-medium', bit === index ? 'bg-accent text-primary' : value ? 'bg-primary-foreground/20 text-accent' : 'bg-primary-foreground/10 text-primary-foreground/60')} data-testid={`button-bit-${index}`}>{value}</button>)}</div><div className="mt-5 flex items-center justify-between border-t border-primary-foreground/15 pt-4 font-mono text-[10px]"><span>selected bit: {bit + 1} / 8</span><span className="text-accent">{bit % 3 === 2 ? 'payload channel' : 'cover channel'}</span></div></div></section><section className="rounded-3xl border border-border bg-primary p-6 text-primary-foreground shadow-lg sm:p-8"><SectionLabel>Capacity calculator</SectionLabel><h2 className="mt-3 font-[var(--font-serif)] text-2xl font-bold tracking-[-.04em]">How much can your image hold?</h2><div className="mt-7 grid grid-cols-2 gap-3"><label className="text-xs font-bold">Width<input value={width} onChange={(event) => setWidth(Number(event.target.value) || 0)} type="number" className="mt-2 w-full rounded-xl border border-primary-foreground/15 bg-primary-foreground/10 p-3 font-mono text-sm text-primary-foreground outline-none focus:border-accent" data-testid="input-capacity-width" /></label><label className="text-xs font-bold">Height<input value={height} onChange={(event) => setHeight(Number(event.target.value) || 0)} type="number" className="mt-2 w-full rounded-xl border border-primary-foreground/15 bg-primary-foreground/10 p-3 font-mono text-sm text-primary-foreground outline-none focus:border-accent" data-testid="input-capacity-height" /></label></div><div className="mt-8 border-t border-primary-foreground/15 pt-6"><div className="font-mono text-4xl tracking-[-.08em] text-accent">{formatBytes(capacity)}</div><p className="mt-2 text-xs text-primary-foreground/55">raw payload space before envelope overhead</p></div></section></div><section className="mt-5 rounded-3xl border border-border bg-card p-6 sm:p-8"><SectionLabel>Threat notes</SectionLabel><div className="mt-4 divide-y divide-border">{['Can someone detect that an image contains a message?', 'What happens when someone edits the PNG?', 'Why does the password matter so much?'].map((question, index) => <div key={question}><button onClick={() => setOpen(open === index ? null : index)} className="flex w-full items-center justify-between py-4 text-left font-[var(--font-serif)] font-bold" data-testid={`button-threat-${index}`}>{question}<ChevronDown size={17} className={cn('text-muted-foreground transition-transform', open === index && 'rotate-180')} /></button>{open === index && <p className="max-w-3xl pb-5 text-sm leading-6 text-muted-foreground">{index === 0 ? 'Yes. LSB steganography is concealment, not invisibility. A capable analyst can use statistical tests or compare the carrier with its original.' : index === 1 ? 'JPEG compression, resizing, filters, and many social platforms can destroy or alter the hidden bits. Share the generated PNG bytes exactly.' : 'The password is the gate to AES-GCM. PBKDF2 slows offline guesses, but it cannot make a short or reused password safe.'}</p>}</div>)}</div></section></div></div>;
}

function AboutPage() {
  const [open, setOpen] = useState<number | null>(0);
  const notes = [
    ['Browser-native by design', 'StegoCrypt uses Web Crypto, Canvas, and File APIs that ship with modern browsers. There is no service worker, database, analytics SDK, or upload endpoint hiding behind the interface.'],
    ['A learning instrument', 'The project is built for students, hackathon teams, and curious builders who want to see a complete applied-cryptography pipeline without a black box.'],
    ['Limitations we name out loud', 'This is not a replacement for Signal, age-old operational security, or a professional steganalysis-resistant system. Preserve the PNG, use a strong password, and understand your threat model.'],
  ];
  return <div className="min-h-[100dvh] px-5 py-8 sm:px-8 lg:px-12 lg:py-12"><div className="mx-auto max-w-[1000px]"><PageIntro eyebrow="project notes / 06" title="A small lab for moving private things." description="StegoCrypt is an intentionally inspectable browser project: a useful tool, a teaching surface, and a reminder that privacy begins with knowing where data goes." action={<a href="https://github.com" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-bold hover:border-accent" data-testid="link-github"><Github size={16} /> source context</a>} /><div className="mt-8 grid gap-5 lg:grid-cols-[1.1fr_.9fr]"><section className="rounded-3xl bg-primary p-6 text-primary-foreground shadow-xl sm:p-9"><Badge tone="lime">privacy notice</Badge><h2 className="mt-8 max-w-lg font-[var(--font-serif)] text-3xl font-bold leading-tight tracking-[-.055em]">Your message, password, and image stay in the browser tab.</h2><p className="mt-5 max-w-lg text-sm leading-6 text-primary-foreground/65">StegoCrypt does not know who you are and cannot retrieve what you process. Closing or refreshing the page clears the working state.</p><div className="mt-9 grid grid-cols-2 gap-3 border-t border-primary-foreground/15 pt-5 font-mono text-[10px]"><span>NO AUTH</span><span>NO ANALYTICS</span><span>NO REMOTE CRYPTO</span><span>NO PERSISTENCE</span></div></section><section className="rounded-3xl border border-border bg-card p-6 sm:p-9"><SectionLabel>Implementation map</SectionLabel><div className="mt-5 space-y-3">{[['/src/crypto', 'AES-GCM + PBKDF2 envelope'], ['/src/steganography', 'LSB embed, extract, metrics'], ['/src/image', 'Canvas decode + PNG export'], ['/src/pages', 'Focused workflows and labs']].map(([path, label]) => <div key={path} className="flex items-center justify-between rounded-xl bg-muted px-3 py-3"><span className="font-mono text-[10px] text-[#16879c]">{path}</span><span className="text-right text-[11px] font-bold">{label}</span></div>)}</div></section></div><section className="mt-5 rounded-3xl border border-border bg-card p-6 sm:p-8"><SectionLabel>Read the fine print</SectionLabel><div className="mt-3 divide-y divide-border">{notes.map(([title, copy], index) => <div key={title}><button onClick={() => setOpen(open === index ? null : index)} className="flex w-full items-center justify-between py-5 text-left font-[var(--font-serif)] text-lg font-bold" data-testid={`button-about-${index}`}>{title}<ChevronDown size={18} className={cn('text-muted-foreground transition-transform', open === index && 'rotate-180')} /></button>{open === index && <p className="max-w-3xl pb-5 text-sm leading-6 text-muted-foreground">{copy}</p>}</div>)}</div></section><div className="mt-8 flex flex-col justify-between gap-4 border-t border-border/70 pt-6 text-xs text-muted-foreground sm:flex-row"><span>Built for the curious, not the careless.</span><Link href="/" className="inline-flex items-center gap-1 font-bold text-foreground" data-testid="link-about-home">Back to overview <ArrowRight size={14} /></Link></div></div></div>;
}

function NotFoundPage() { return <div className="grid min-h-[100dvh] place-items-center px-6 text-center"><div><Badge tone="orange">404 / not found</Badge><h1 className="mt-5 font-[var(--font-serif)] text-4xl font-bold">This route is not in the lab.</h1><Link href="/" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground" data-testid="link-not-found-home">Return to overview <ArrowRight size={15} /></Link></div></div>; }

function Router() {
  return <RoutedErrorBoundary><Shell><Switch><Route path="/" component={Dashboard} /><Route path="/encode" component={EncodePage} /><Route path="/decode" component={DecodePage} /><Route path="/how-it-works" component={HowItWorks} /><Route path="/security" component={SecurityPage} /><Route path="/about" component={AboutPage} /><Route component={NotFoundPage} /></Switch></Shell></RoutedErrorBoundary>;
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Router /></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>;
}

export default App;