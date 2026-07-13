import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight, Check, ChevronDown, Sparkles, Menu, X,
  ListChecks, Tags, ShoppingBag, Plane, LayoutTemplate, Brain,
  Feather, Zap, MonitorSmartphone, Layers,
  ShoppingCart, GraduationCap, Briefcase, Home as HomeIcon, Gift,
  Users, CalendarDays, UtensilsCrossed, Wallet, TrendingUp,
  Sun, Moon,
} from 'lucide-react'
import { useAuthStore } from '../store/useAuthStore'
import { useThemeStore, effectiveTheme } from '../store/useThemeStore'
import { openYft } from '../lib/yft'
import './landing.css'

/* Landing-only webfonts (Plus Jakarta Sans + Inter — same as JishRaa Labs).
   Injected on mount so the app shell never pays for them. */
function useLandingFonts() {
  useEffect(() => {
    if (document.getElementById('lp-fonts')) return
    const mk = (rel: string, href: string, crossOrigin?: string) => {
      const l = document.createElement('link')
      l.rel = rel
      l.href = href
      if (crossOrigin !== undefined) l.crossOrigin = crossOrigin
      return l
    }
    const css = mk(
      'stylesheet',
      'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap'
    )
    css.id = 'lp-fonts'
    document.head.append(
      mk('preconnect', 'https://fonts.googleapis.com'),
      mk('preconnect', 'https://fonts.gstatic.com', ''),
      css
    )
  }, [])
}

/* Reveal-on-scroll wrapper. Content is visible by default under
   prefers-reduced-motion (handled in CSS); otherwise it fades/rises in once. */
function Reveal({ children, className = '', as: Tag = 'div', style, id }: {
  children: ReactNode; className?: string; as?: 'div' | 'section' | 'header'; style?: React.CSSProperties; id?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) { el.classList.add('in'); io.unobserve(el) }
      }
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return (
    <Tag ref={ref as never} id={id} className={`lp-reveal ${className}`} style={style}>
      {children}
    </Tag>
  )
}

/* Uppercase gradient badge (labs Eyebrow) */
function Eyebrow({ icon, children }: { icon?: ReactNode; children: ReactNode }) {
  return (
    <span className="lp-eyebrow">
      {icon}
      <span className="lp-eyebrow-label">{children}</span>
    </span>
  )
}

function SectionHead({ eyebrow, icon, title, children }: {
  eyebrow: string; icon?: ReactNode; title: ReactNode; children?: ReactNode
}) {
  return (
    <Reveal className="lp-section-head">
      <Eyebrow icon={icon}>{eyebrow}</Eyebrow>
      <h2 className="lp-h2">{title}</h2>
      {children && <p className="lp-lead">{children}</p>}
    </Reveal>
  )
}

export default function Landing() {
  const navigate = useNavigate()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const shotsRef = useRef<HTMLDivElement>(null)
  const shotsUserDrove = useRef(false)
  const [activeShot, setActiveShot] = useState(0)
  const { user } = useAuthStore()
  const isAuthed = !!user
  const { pref, setPref } = useThemeStore()
  const theme = effectiveTheme(pref)
  const toggleTheme = () => setPref(theme === 'dark' ? 'light' : 'dark')

  useLandingFonts()

  // Marketing page owns the document title / SEO signal while mounted.
  useEffect(() => {
    const prev = document.title
    document.title = 'Listo – Organize Everything That Matters'
    return () => { document.title = prev }
  }, [])

  useEffect(() => {
    const node = scrollRef.current
    if (!node) return
    const onScroll = () => setScrolled(node.scrollTop > 8)
    node.addEventListener('scroll', onScroll, { passive: true })
    return () => node.removeEventListener('scroll', onScroll)
  }, [])

  // Lock the page scroll while the full-screen mobile menu is open.
  useEffect(() => {
    const node = scrollRef.current
    if (!node) return
    node.style.overflowY = menuOpen ? 'hidden' : ''
    return () => { node.style.overflowY = '' }
  }, [menuOpen])

  // Escape closes the mobile menu.
  useEffect(() => {
    if (!menuOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [menuOpen])

  const scrollTo = (id: string) => {
    setMenuOpen(false)
    scrollRef.current?.querySelector(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // Carousel: track the centered slide, auto-advance on desktop until the
  // visitor takes over. Auto-play skips reduced-motion users entirely.
  const centeredShot = (wrap: HTMLDivElement) => {
    const mid = wrap.scrollLeft + wrap.clientWidth / 2
    let best = 0
    let bestDist = Infinity
    Array.from(wrap.children).forEach((child, i) => {
      const el = child as HTMLElement
      const dist = Math.abs(el.offsetLeft + el.offsetWidth / 2 - mid)
      if (dist < bestDist) { bestDist = dist; best = i }
    })
    return best
  }

  const goToShot = (i: number, manual = true) => {
    const wrap = shotsRef.current
    const el = wrap?.children[i] as HTMLElement | undefined
    if (!wrap || !el) return
    if (manual) shotsUserDrove.current = true
    wrap.scrollTo({ left: el.offsetLeft - (wrap.clientWidth - el.offsetWidth) / 2, behavior: 'smooth' })
  }

  useEffect(() => {
    const wrap = shotsRef.current
    if (!wrap) return
    const onScroll = () => setActiveShot(centeredShot(wrap))
    const takeOver = () => { shotsUserDrove.current = true }
    wrap.addEventListener('scroll', onScroll, { passive: true })
    wrap.addEventListener('pointerdown', takeOver, { passive: true })
    wrap.addEventListener('wheel', takeOver, { passive: true })
    wrap.addEventListener('touchstart', takeOver, { passive: true })

    const autoOk =
      window.matchMedia('(pointer: fine)').matches &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let hovered = false
    const onEnter = () => { hovered = true }
    const onLeave = () => { hovered = false }
    let timer: number | undefined
    if (autoOk) {
      wrap.addEventListener('mouseenter', onEnter)
      wrap.addEventListener('mouseleave', onLeave)
      timer = window.setInterval(() => {
        if (shotsUserDrove.current || hovered || document.hidden) return
        goToShot((centeredShot(wrap) + 1) % wrap.children.length, false)
      }, 4000)
    }
    return () => {
      wrap.removeEventListener('scroll', onScroll)
      wrap.removeEventListener('pointerdown', takeOver)
      wrap.removeEventListener('wheel', takeOver)
      wrap.removeEventListener('touchstart', takeOver)
      wrap.removeEventListener('mouseenter', onEnter)
      wrap.removeEventListener('mouseleave', onLeave)
      if (timer) window.clearInterval(timer)
    }
  }, [])

  const openApp = () => navigate('/')
  const getStarted = () => (isAuthed ? navigate('/') : navigate('/login?mode=register'))
  const signIn = () => navigate('/login')

  const NAV_LINKS: [string, string][] = [
    ['Features', '#features'],
    ['App Preview', '#screens'],
    ['Why Listo', '#why'],
    ['FAQ', '#faq'],
  ]

  return (
    <div className="lp" ref={scrollRef}>
      {/* ── Navigation ────────────────────────────────────────── */}
      <nav className={`lp-nav ${scrolled ? 'scrolled' : ''}`} aria-label="Primary">
        <div className="lp-container lp-nav-inner">
          <button className="lp-brand" onClick={() => scrollTo('#top')} aria-label="Listo — back to top">
            <img src="/brand.png" alt="" aria-hidden />
            <img src="/wordmark.png" alt="Listo" className="lp-wordmark" />
          </button>
          <div className="lp-nav-links">
            {NAV_LINKS.map(([label, id]) => (
              <button key={id} className="lp-nav-link" onClick={() => scrollTo(id)}>{label}</button>
            ))}
            {!isAuthed && <button className="lp-nav-link" onClick={signIn}>Sign In</button>}
          </div>
          <div className="lp-nav-actions">
            <button
              className="lp-nav-iconbtn"
              onClick={toggleTheme}
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button className="lp-btn lp-btn-primary lp-btn-sm lp-nav-cta" onClick={isAuthed ? openApp : getStarted}>
              {isAuthed ? 'Open Listo' : 'Get Started'}
            </button>
            <button
              className="lp-nav-burger"
              onClick={() => setMenuOpen(o => !o)}
              aria-label="Toggle menu"
              aria-expanded={menuOpen}
            >
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </nav>

      {/* Full-screen mobile menu */}
      {menuOpen && (
        <div className="lp-menu">
          <div>
            {NAV_LINKS.map(([label, id], i) => (
              <button key={id} className="lp-menu-link" style={{ animationDelay: `${i * 40}ms` }} onClick={() => scrollTo(id)}>
                {label}
              </button>
            ))}
            {!isAuthed && (
              <button className="lp-menu-link" style={{ animationDelay: `${NAV_LINKS.length * 40}ms` }} onClick={signIn}>
                Sign In
              </button>
            )}
          </div>
          <div className="lp-menu-foot">
            <button className="lp-btn lp-btn-secondary" onClick={toggleTheme}>
              {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
              {theme === 'dark' ? 'Light mode' : 'Dark mode'}
            </button>
            <button className="lp-btn lp-btn-primary" onClick={isAuthed ? openApp : getStarted}>
              {isAuthed ? 'Open Listo' : 'Get Started Free'} <span className="lp-btn-arrow"><ArrowRight size={17} /></span>
            </button>
          </div>
        </div>
      )}

      {/* ── Hero ──────────────────────────────────────────────── */}
      <header className="lp-hero" id="top">
        <HeroArt />
        <div className="lp-container">
          <Reveal>
            <Eyebrow icon={<Sparkles size={15} />}>Smart Productivity</Eyebrow>
            <h1 className="lp-h1">
              Stay Organized.<br />
              <span className="lp-gradient">Stay Productive.</span><br />
              Every Day.
            </h1>
            <p className="lp-hero-desc">
              Organize shopping, tasks, travel, packing, routines, and everything in between.
            </p>
            <div className="lp-hero-cta">
              <button className="lp-btn lp-btn-primary" onClick={isAuthed ? openApp : getStarted}>
                {isAuthed ? 'Open Listo' : 'Get Started Free'} <span className="lp-btn-arrow"><ArrowRight size={18} /></span>
              </button>
              <button className="lp-btn lp-btn-secondary" onClick={() => scrollTo('#features')}>
                View Features
              </button>
            </div>
            <button className="lp-scroll-cue" onClick={() => scrollTo('#features')} aria-label="Scroll to features">
              <ChevronDown size={20} />
            </button>
          </Reveal>
        </div>
      </header>

      {/* ── Features ──────────────────────────────────────────── */}
      <section className="lp-section" id="features">
        <div className="lp-container">
          <SectionHead eyebrow="Features" title={<>Everything You Need to <span className="lp-gradient">Stay Organized</span></>}>
            More than a checklist — Listo understands what you type, keeps things tidy, and
            gets smarter every time you use it.
          </SectionHead>
          <Reveal className="lp-grid lp-grid-3">
            {FEATURES.map(f => (
              <div className="lp-card lp-card-lift" key={f.title}>
                <div className="lp-card-row">
                  <div className="lp-card-icon"><f.Icon size={22} /></div>
                  <h3 className="lp-h3">{f.title}</h3>
                </div>
                <p>{f.desc}</p>
              </div>
            ))}
          </Reveal>
        </div>
      </section>

      {/* ── App screenshots ───────────────────────────────────── */}
      <section className="lp-section" id="screens">
        <div className="lp-container">
          <SectionHead eyebrow="App Preview" title="A Look Inside Listo">
            Swipe through the experience — from your lists to shopping, travel, templates, and insights.
          </SectionHead>
        </div>
        <Reveal>
          <div className="lp-shots" role="group" aria-label="App screens" ref={shotsRef}>
            {SHOTS.map(s => (
              <Shot key={s.label} label={s.label} cap={s.cap}><s.Screen /></Shot>
            ))}
          </div>
          <div className="lp-dots" role="group" aria-label="Choose app screen">
            {SHOTS.map((s, i) => (
              <button
                key={s.label}
                className="lp-dot"
                aria-label={`Show ${s.label} screen`}
                aria-current={i === activeShot}
                onClick={() => goToShot(i)}
              >
                <span />
              </button>
            ))}
          </div>
        </Reveal>
      </section>

      {/* ── Why Listo ─────────────────────────────────────────── */}
      <section className="lp-section" id="why">
        <div className="lp-container">
          <SectionHead eyebrow="Why Listo" title="Built For Everyday Life">
            Designed for students, professionals, families, and travelers — anyone with things to do.
          </SectionHead>
          <Reveal className="lp-grid lp-grid-4">
            {WHY.map(w => (
              <div className="lp-card" key={w.title}>
                <div className="lp-card-row">
                  <div className="lp-card-icon"><w.Icon size={22} /></div>
                  <h3 className="lp-h3">{w.title}</h3>
                </div>
                <p>{w.desc}</p>
              </div>
            ))}
          </Reveal>
        </div>
      </section>

      {/* ── Use cases ─────────────────────────────────────────── */}
      <section className="lp-section" id="use-cases">
        <div className="lp-container">
          <SectionHead eyebrow="Use Cases" title="One Listo. Every Kind of List.">
            Simple enough for everyday tasks. Flexible enough for almost anything.
          </SectionHead>
          <Reveal className="lp-grid lp-grid-3">
            {USE_CASES.map(u => (
              <div className={`lp-card lp-card-lift ${u.desktopOnly ? 'lp-hide-mobile' : ''}`} key={u.title}>
                <div className="lp-card-row">
                  <div className="lp-card-icon"><u.Icon size={22} /></div>
                  <h3 className="lp-h3">{u.title}</h3>
                </div>
                <p>{u.desc}</p>
              </div>
            ))}
          </Reveal>
        </div>
      </section>

      {/* ── Listo + YFT ───────────────────────────────────────── */}
      <section className="lp-section lp-center" id="yft">
        <div className="lp-container">
          <SectionHead eyebrow="Listo + YFT" title="Plan with Listo. Track spending with YFT.">
            Plan what you need in Listo, then see what it actually cost in YFT — two apps, one routine.
          </SectionHead>
          <Reveal>
            <div className="lp-flow">
              {YFT_FLOW.map((s, i) => (
                <div style={{ display: 'contents' }} key={s.t}>
                  {i > 0 && <ArrowRight className="lp-flow-arrow" size={20} aria-hidden />}
                  <div className="lp-flow-step">
                    <div className="lp-card-icon"><s.Icon size={20} /></div>
                    <span className="t">{s.t}</span>
                    <span className="d">{s.d}</span>
                  </div>
                </div>
              ))}
            </div>
            <button className="lp-btn lp-btn-secondary" onClick={() => openYft('/about')}>
              Learn about YFT <span className="lp-btn-arrow"><ArrowRight size={16} /></span>
            </button>
          </Reveal>
        </div>
      </section>

      {/* Testimonials intentionally omitted until there are real reviews —
          restore the "Loved by Early Users" section from git history
          (commit c6238ab) when genuine quotes exist. */}

      {/* ── FAQ ───────────────────────────────────────────────── */}
      <section className="lp-section" id="faq">
        <div className="lp-container">
          <SectionHead eyebrow="FAQ" title="Frequently Asked Questions" />
          <Reveal className="lp-faq">
            {FAQ.map(f => (
              <details className="lp-faq-item" key={f.q}>
                <summary className="lp-faq-q">{f.q}<ChevronDown size={18} /></summary>
                <p className="lp-faq-a">{f.a}</p>
              </details>
            ))}
          </Reveal>
        </div>
      </section>

      {/* ── Final CTA ─────────────────────────────────────────── */}
      <section className="lp-section">
        <div className="lp-container">
          <Reveal className="lp-cta-band">
            {/* Oversized brand check, ~4% opacity */}
            <svg className="lp-cta-mark" viewBox="0 0 64 64" aria-hidden="true">
              <rect x="6" y="6" width="52" height="52" rx="14" fill="none" stroke="currentColor" strokeWidth="3" />
              <path d="M20 33l8 8 16-18" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <Eyebrow icon={<Sparkles size={15} />}>Get Started</Eyebrow>
            <h2 className="lp-h2">Ready to Organize <span className="lp-gradient">Everything?</span></h2>
            <p className="lp-lead">
              Start free — your lists sync on every device, online or off.
            </p>
            <div className="lp-cta-actions">
              <button className="lp-btn lp-btn-primary" onClick={isAuthed ? openApp : getStarted}>
                {isAuthed ? 'Open Listo' : 'Get Listo Free'} <span className="lp-btn-arrow"><ArrowRight size={18} /></span>
              </button>
            </div>
            {!isAuthed && (
              <span className="lp-cta-signin">
                Already have an account? <a href="/login" onClick={(e) => { e.preventDefault(); signIn() }}>Sign In</a>
              </span>
            )}
          </Reveal>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────── */}
      <footer className="lp-footer">
        <div className="lp-container">
          <div className="lp-footer-grid">
            <div>
              <span className="lp-brand">
                <img src="/brand.png" alt="" aria-hidden />
                <img src="/wordmark.png" alt="Listo" className="lp-wordmark" />
              </span>
              <p className="lp-footer-tag">
                Organize everything that matters — beautifully simple lists for everyday life.
              </p>
            </div>
            <div className="lp-footer-col">
              <h5>Navigation</h5>
              <button onClick={() => scrollTo('#features')}>Features</button>
              <button onClick={() => scrollTo('#screens')}>App Preview</button>
              <button onClick={() => scrollTo('#use-cases')}>Use Cases</button>
              <button onClick={() => scrollTo('#faq')}>FAQ</button>
            </div>
            <div className="lp-footer-col">
              <h5>Support</h5>
              <a href="/profile/support" onClick={(e) => { e.preventDefault(); navigate('/profile/support') }}>Contact</a>
              <a href="/profile/help" onClick={(e) => { e.preventDefault(); navigate('/profile/help') }}>Help Center</a>
            </div>
            <div className="lp-footer-col">
              <h5>Legal</h5>
              <a href="/privacy" onClick={(e) => { e.preventDefault(); navigate('/privacy') }}>Privacy Policy</a>
              <a href="/terms" onClick={(e) => { e.preventDefault(); navigate('/terms') }}>Terms of Service</a>
            </div>
            <div className="lp-footer-col">
              <h5>Apps</h5>
              <button onClick={() => scrollTo('#top')}>Listo</button>
              <button onClick={() => openYft('')}>YFT</button>
            </div>
          </div>
          <div className="lp-footer-bottom">
            <span>© {new Date().getFullYear()} Listo · A JishRaa Labs product</span>
            <span>Made in India 🇮🇳</span>
          </div>
        </div>
      </footer>
    </div>
  )
}

/* ── Hero decorations — floating productivity motifs ─────────────
   Density: mobile keeps orb + checklist · tablet adds nodes, ring,
   note · desktop adds calendar and target. */
function HeroArt() {
  return (
    <div className="lp-hero-art" aria-hidden="true">
      <div className="lp-orb lp-orb-1 lp-float" style={{ '--dur': '14s' } as React.CSSProperties} />
      <div className="lp-orb lp-orb-2 lp-float-rev" style={{ '--dur': '18s' } as React.CSSProperties} />

      {/* node constellation — left */}
      <svg className="lp-art lp-art-nodes-l lp-float" style={{ '--dur': '11s' } as React.CSSProperties} viewBox="0 0 220 220" fill="none">
        <g stroke="currentColor" strokeWidth="1.2" opacity="0.4">
          <line x1="30" y1="40" x2="120" y2="80" />
          <line x1="120" y1="80" x2="82" y2="170" />
          <line x1="120" y1="80" x2="195" y2="52" />
          <line x1="82" y1="170" x2="30" y2="40" />
        </g>
        <circle className="lp-node" cx="30" cy="40" r="5" fill="#4ADE80" />
        <circle className="lp-node lp-node-2" cx="120" cy="80" r="6" fill="#2DD4BF" />
        <circle className="lp-node lp-node-3" cx="195" cy="52" r="4.5" fill="#22D3EE" />
        <circle className="lp-node lp-node-4" cx="82" cy="170" r="5" fill="#2DD4BF" />
      </svg>

      {/* node constellation — right */}
      <svg className="lp-art lp-art-nodes-r lp-float-rev" style={{ '--dur': '13s' } as React.CSSProperties} viewBox="0 0 220 220" fill="none">
        <g stroke="currentColor" strokeWidth="1.2" opacity="0.4">
          <line x1="190" y1="30" x2="110" y2="90" />
          <line x1="110" y1="90" x2="160" y2="180" />
          <line x1="110" y1="90" x2="25" y2="60" />
        </g>
        <circle className="lp-node" cx="190" cy="30" r="5" fill="#4ADE80" />
        <circle className="lp-node lp-node-2" cx="110" cy="90" r="6" fill="#22D3EE" />
        <circle className="lp-node lp-node-3" cx="25" cy="60" r="4.5" fill="#2DD4BF" />
        <circle className="lp-node lp-node-4" cx="160" cy="180" r="5" fill="#2DD4BF" />
      </svg>

      {/* checklist card */}
      <svg className="lp-art lp-art-check lp-float" style={{ '--dur': '9s' } as React.CSSProperties} viewBox="0 0 56 52" fill="none">
        <defs>
          <linearGradient id="lpArtG" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#4ADE80" />
            <stop offset="0.5" stopColor="#2DD4BF" />
            <stop offset="1" stopColor="#22D3EE" />
          </linearGradient>
        </defs>
        <rect x="1.5" y="1.5" width="53" height="49" rx="11" stroke="url(#lpArtG)" strokeWidth="1.4" fill="rgba(74,222,128,0.08)" />
        <circle cx="14" cy="17" r="4" stroke="url(#lpArtG)" strokeWidth="1.4" />
        <path d="M12.3 17l1.3 1.3 2.2-2.6" stroke="url(#lpArtG)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M24 17h20" stroke="url(#lpArtG)" strokeWidth="1.4" strokeLinecap="round" opacity="0.7" />
        <circle cx="14" cy="34" r="4" stroke="url(#lpArtG)" strokeWidth="1.4" />
        <path d="M24 34h14" stroke="url(#lpArtG)" strokeWidth="1.4" strokeLinecap="round" opacity="0.5" />
      </svg>

      {/* sticky note */}
      <svg className="lp-art lp-art-note lp-float-rev" style={{ '--dur': '12s' } as React.CSSProperties} viewBox="0 0 44 44" fill="none">
        <path d="M6 10a4 4 0 0 1 4-4h24a4 4 0 0 1 4 4v18l-10 10H10a4 4 0 0 1-4-4V10Z" stroke="url(#lpArtG)" strokeWidth="1.4" fill="rgba(34,211,238,0.06)" />
        <path d="M28 38V28h10" stroke="url(#lpArtG)" strokeWidth="1.4" />
        <path d="M13 16h18M13 23h12" stroke="url(#lpArtG)" strokeWidth="1.4" strokeLinecap="round" opacity="0.6" />
      </svg>

      {/* calendar */}
      <svg className="lp-art lp-art-cal lp-float" style={{ '--dur': '13s' } as React.CSSProperties} viewBox="0 0 48 48" fill="none">
        <rect x="4" y="8" width="40" height="36" rx="9" stroke="url(#lpArtG)" strokeWidth="1.4" fill="rgba(45,212,191,0.07)" />
        <path d="M4 19h40" stroke="url(#lpArtG)" strokeWidth="1.4" />
        <path d="M15 4v8M33 4v8" stroke="url(#lpArtG)" strokeWidth="1.4" strokeLinecap="round" />
        <circle cx="16" cy="28" r="2.4" fill="#4ADE80" opacity="0.8" />
        <circle cx="24" cy="28" r="2.4" fill="#2DD4BF" opacity="0.8" />
        <circle cx="32" cy="36" r="2.4" fill="#22D3EE" opacity="0.8" />
      </svg>

      {/* target */}
      <svg className="lp-art lp-art-target lp-float-rev" style={{ '--dur': '10s' } as React.CSSProperties} viewBox="0 0 48 48" fill="none">
        <circle cx="24" cy="24" r="20" stroke="url(#lpArtG)" strokeWidth="1.4" opacity="0.8" />
        <circle cx="24" cy="24" r="12" stroke="url(#lpArtG)" strokeWidth="1.4" opacity="0.6" />
        <circle cx="24" cy="24" r="4.5" fill="url(#lpArtG)" opacity="0.85" />
      </svg>

      {/* glowing ring */}
      <span className="lp-art lp-art-ring lp-float-rev" style={{ '--dur': '12s' } as React.CSSProperties} />
    </div>
  )
}

/* ── Phone mockups (stylized screens; swap for real captures later) ── */

function Shot({ label, cap, children }: { label: string; cap: string; children: ReactNode }) {
  return (
    <div className="lp-shot">
      <div className="lp-phone">
        <span className="lp-phone-notch" />
        <div className="lp-screen">{children}</div>
      </div>
      <span className="lp-shot-label">{label}</span>
      <span className="lp-shot-cap">{cap}</span>
    </div>
  )
}

function MkRow({ emoji, name, meta, pct }: { emoji: string; name: string; meta: string; pct?: number }) {
  return (
    <div className="mk-row">
      <span className="mk-row-emoji" aria-hidden>{emoji}</span>
      <div className="mk-row-body">
        <div className="mk-row-name">{name}</div>
        <div className="mk-row-meta">{meta}</div>
        {pct != null && <div className="mk-prog"><div style={{ width: `${pct}%` }} /></div>}
      </div>
    </div>
  )
}

function MkCheck({ label, done, who }: { label: string; done?: boolean; who?: string }) {
  return (
    <div className={`mk-check ${done ? 'done' : ''}`}>
      <span className="mk-check-box">{done && <Check size={11} strokeWidth={3.5} />}</span>
      <span className="mk-check-label">{label}</span>
      {who && <span className="mk-check-who">{who}</span>}
    </div>
  )
}

function ScreenLists() {
  return (
    <>
      <div className="mk-title">Lists</div>
      <div className="mk-sub">4 lists</div>
      <div className="mk-chips">
        <span className="mk-chip on">Active</span>
        <span className="mk-chip">Shared</span>
        <span className="mk-chip">Done</span>
      </div>
      <MkRow emoji="🛒" name="July Groceries" meta="3 items left" pct={62} />
      <MkRow emoji="✈️" name="Travel Checklist" meta="4 items left" pct={60} />
      <MkRow emoji="🏠" name="Home Chores" meta="4 items" />
      <MkRow emoji="💼" name="Office Tasks" meta="2 items left" pct={78} />
    </>
  )
}

function ScreenShopping() {
  return (
    <>
      <div className="mk-title">July Groceries</div>
      <div className="mk-sub">8 of 11 done</div>
      <div className="mk-cat">PRODUCE</div>
      <MkCheck label="Bananas ×6" done />
      <MkCheck label="Spinach" done />
      <MkCheck label="Tomatoes 1kg" />
      <div className="mk-cat">DAIRY</div>
      <MkCheck label="Milk 2L" done />
      <MkCheck label="Yogurt ×4" />
      <div className="mk-cat">PANTRY</div>
      <MkCheck label="Rice 5kg" />
    </>
  )
}

function ScreenTravel() {
  return (
    <>
      <div className="mk-title">Weekend Trip</div>
      <div className="mk-avatars" aria-hidden>
        <span className="mk-avatar" style={{ background: '#16A34A' }}>Y</span>
        <span className="mk-avatar" style={{ background: '#0D9488' }}>A</span>
        <span className="mk-avatar" style={{ background: '#0891B2' }}>R</span>
      </div>
      <MkCheck label="Book Hotel" done who="Anjana" />
      <MkCheck label="Pack Clothes" done who="You" />
      <MkCheck label="Charge Camera" />
      <MkCheck label="Passport" />
      <MkCheck label="Buy Snacks" />
      <MkCheck label="Travel Adapter" />
    </>
  )
}

function ScreenTemplates() {
  return (
    <>
      <div className="mk-title">Templates</div>
      <div className="mk-sub">Start faster</div>
      <div style={{ height: 10 }} />
      <MkRow emoji="🛒" name="Weekly Groceries" meta="18 items" />
      <span className="mk-badge">Template</span>
      <div style={{ height: 8 }} />
      <MkRow emoji="🧳" name="Packing Essentials" meta="12 items" />
      <span className="mk-badge">Template</span>
      <div style={{ height: 8 }} />
      <MkRow emoji="🎉" name="Party Prep" meta="9 items" />
      <span className="mk-badge">Template</span>
    </>
  )
}

function ScreenInsights() {
  return (
    <>
      <div className="mk-title">Insights</div>
      <div className="mk-sub">July Groceries</div>
      <div className="mk-stats">
        <div className="mk-stat"><div className="mk-stat-val grad">88</div><div className="mk-stat-label">Planner Score</div></div>
        <div className="mk-stat"><div className="mk-stat-val">84%</div><div className="mk-stat-label">Completion</div></div>
        <div className="mk-stat"><div className="mk-stat-val">0</div><div className="mk-stat-label">Duplicates</div></div>
        <div className="mk-stat"><div className="mk-stat-val">Sat</div><div className="mk-stat-label">Most Active</div></div>
      </div>
      <div className="mk-cat">TOP SUGGESTIONS</div>
      <MkCheck label="Prepare your next list" />
      <MkCheck label="Save as a template" />
    </>
  )
}

function ScreenFocus() {
  return (
    <>
      <div className="mk-title">Focus Mode</div>
      <div className="mk-sub">3 of 12 remaining</div>
      <div className="mk-cat">IMPORTANT</div>
      <MkCheck label="Book Hotel" />
      <MkCheck label="Charge Camera" />
      <div className="mk-cat">PACKING</div>
      <MkCheck label="Passport" />
      <div className="mk-cat">DONE</div>
      <MkCheck label="Pack Clothes" done />
      <MkCheck label="Print Tickets" done />
    </>
  )
}

/* ── Content data ────────────────────────────────────────────── */

const YFT_FLOW = [
  { Icon: ListChecks, t: 'Plan groceries', d: 'Build the list in Listo' },
  { Icon: ShoppingCart, t: 'Go shopping', d: 'Check items off as you go' },
  { Icon: Wallet, t: 'Track spending', d: 'Log what you spent in YFT' },
  { Icon: TrendingUp, t: 'See insights', d: 'Understand monthly patterns' },
]

const SHOTS = [
  { label: 'My Lists', cap: 'Everything in one place', Screen: ScreenLists },
  { label: 'Shopping', cap: 'Auto-categorized aisles', Screen: ScreenShopping },
  { label: 'Travel', cap: 'Shared packing lists', Screen: ScreenTravel },
  { label: 'Templates', cap: 'Reusable in one tap', Screen: ScreenTemplates },
  { label: 'Insights', cap: 'Understand your habits', Screen: ScreenInsights },
  { label: 'Focus Mode', cap: "Just what's left", Screen: ScreenFocus },
]

const FEATURES = [
  { Icon: ListChecks, title: 'Smart Lists', desc: 'Skip the forms — type "Milk 2L" and the item, quantity, and unit fill themselves in.' },
  { Icon: Tags, title: 'Task Categories', desc: 'Shopping, work, and personal items sort themselves into categories, so you never file anything by hand.' },
  { Icon: ShoppingBag, title: 'Shopping Lists', desc: 'Never buy the same thing twice — duplicates get caught, aisles stay grouped, and you always see what’s left.' },
  { Icon: Plane, title: 'Travel Planning', desc: 'Pack with confidence. Share the checklist and watch it get done together in real time.' },
  { Icon: LayoutTemplate, title: 'Templates', desc: 'Set up once, reuse forever — start your weekly shop or packing list in one tap.' },
  { Icon: Brain, title: 'Smart Suggestions', desc: 'Listo learns your regulars and reminds you what you might be forgetting before you head out.' },
]

const WHY = [
  { Icon: Feather, title: 'Beautiful Simplicity', desc: 'No clutter. Only what matters — a calm, focused space for your lists.' },
  { Icon: Zap, title: 'Fast', desc: 'Capture ideas instantly. Add a full list in seconds, not minutes.' },
  { Icon: MonitorSmartphone, title: 'Sync Everywhere', desc: 'Access your lists on every device — changes sync in real time, even after going offline.' },
  { Icon: Layers, title: 'Smart Organization', desc: 'Categories, progress, and duplicate detection keep everything neatly organized.' },
]

const USE_CASES: { Icon: typeof Gift; title: string; desc: string; desktopOnly?: boolean }[] = [
  { Icon: ShoppingCart, title: 'Shopping', desc: 'Plan purchases, avoid duplicates, and breeze through the store.' },
  { Icon: Plane, title: 'Travel', desc: 'Keep packing, bookings, and plans organized in one place.' },
  { Icon: Users, title: 'Family', desc: 'One shared list for the household — everyone sees what’s needed and what’s done.' },
  { Icon: UtensilsCrossed, title: 'Meal Planning', desc: 'Plan the week’s meals and turn them into a shopping list in minutes.' },
  { Icon: CalendarDays, title: 'Events', desc: 'Coordinate everything a birthday, party, or gathering needs to happen.' },
  { Icon: GraduationCap, title: 'Study', desc: 'Track assignments, readings, and revision — one topic at a time.' },
  { Icon: Briefcase, title: 'Work', desc: 'Track tasks and collaborate on shared responsibilities.' },
  { Icon: HomeIcon, title: 'Home', desc: 'Share chores and household responsibilities with the family.' },
  // Rounds out the 3×3 desktop grid; hidden on mobile to keep the column short.
  { Icon: Gift, title: 'Gift Planning', desc: 'Plan presents for every occasion — without spoiling the surprise.', desktopOnly: true },
]

const FAQ = [
  { q: 'Is Listo free?', a: 'Yes — Listo is free to use. Create an account and start organizing in seconds.' },
  { q: 'Which devices are supported?', a: 'Any modern browser, and you can install Listo as an app on iOS, Android, and desktop. Sign in anywhere and your lists stay in sync in real time.' },
  { q: 'Does it work offline?', a: 'Yes. Changes you make offline are saved on your device and sync automatically the moment you’re back online.' },
  { q: 'Can I collaborate with family?', a: 'Yes. Share a private invite link and everyone sees updates instantly — you control who can edit, and guests can join without creating an account.' },
  { q: 'Is my data private?', a: 'Yes. Your lists are visible only to you and the people you invite, and you can delete your account and all its data at any time.' },
  { q: 'Can I import existing lists?', a: 'Not yet — though smart type-ahead and templates make rebuilding a list fast. Import is on the roadmap.' },
  { q: 'Are reminders supported?', a: 'Listo’s "Before You Go" check flags frequently used items that might be missing from your list. Time-based reminders are on the roadmap.' },
]
