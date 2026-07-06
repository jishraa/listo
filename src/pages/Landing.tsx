import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Check, ArrowRight, Sparkles, Users, Layers,
  Brain, PlusCircle, ShoppingBag, Plane, Home as HomeIcon,
  Briefcase, CalendarDays, User as UserIcon, Share2, EyeOff,
  ShieldCheck, Zap,
} from 'lucide-react'
import { useAuthStore } from '../store/useAuthStore'
import { openYft } from '../lib/yft'
import './landing.css'

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

export default function Landing() {
  const navigate = useNavigate()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [scrolled, setScrolled] = useState(false)
  const { user } = useAuthStore()
  const isAuthed = !!user

  // Marketing page owns the document title / SEO signal while mounted.
  useEffect(() => {
    const prev = document.title
    document.title = 'Listo – Smart Lists for Everyday Life'
    return () => { document.title = prev }
  }, [])

  useEffect(() => {
    const node = scrollRef.current
    if (!node) return
    const onScroll = () => setScrolled(node.scrollTop > 8)
    node.addEventListener('scroll', onScroll, { passive: true })
    return () => node.removeEventListener('scroll', onScroll)
  }, [])

  const scrollTo = (id: string) => {
    scrollRef.current?.querySelector(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const openApp = () => navigate('/')
  const getStarted = () => (isAuthed ? navigate('/') : navigate('/login?mode=register'))
  const signIn = () => navigate('/login')

  return (
    <div className="lp" ref={scrollRef}>
      {/* ── 1. Navigation ─────────────────────────────────────── */}
      <nav className={`lp-nav ${scrolled ? 'scrolled' : ''}`} aria-label="Primary">
        <div className="lp-container lp-nav-inner">
          <a className="lp-brand" href="#top" onClick={(e) => { e.preventDefault(); scrollTo('#top') }}>
            <img src="/brand.png" alt="" aria-hidden />
            <img src="/wordmark.png" alt="Listo" className="lp-wordmark" />
          </a>
          <div className="lp-nav-links">
            <a className="lp-nav-link" href="#features" onClick={(e) => { e.preventDefault(); scrollTo('#features') }}>Features</a>
            <a className="lp-nav-link" href="#how-it-works" onClick={(e) => { e.preventDefault(); scrollTo('#how-it-works') }}>How It Works</a>
            <a className="lp-nav-link" href="#use-cases" onClick={(e) => { e.preventDefault(); scrollTo('#use-cases') }}>Use Cases</a>
            <a className="lp-nav-link" href="#about" onClick={(e) => { e.preventDefault(); scrollTo('#about') }}>About</a>
            {!isAuthed && (
              <button className="lp-nav-link lp-hide-mobile" onClick={signIn}>Sign In</button>
            )}
          </div>
          <button className="lp-btn lp-btn-primary lp-btn-sm lp-nav-cta" onClick={isAuthed ? openApp : getStarted}>
            {isAuthed ? 'Open Listo' : 'Get Started'}
          </button>
        </div>
      </nav>

      {/* ── 2. Hero ───────────────────────────────────────────── */}
      <header className="lp-hero" id="top">
        <div className="lp-container">
          <div className="lp-hero-grid">
            <Reveal>
              <h1 className="lp-h1">
                Lists that get <span className="lp-accent">smarter</span> every time you use them.
              </h1>
              <p className="lp-hero-desc">
                Create, organize, collaborate, and track progress with a smarter list experience built for everyday life.
              </p>
              <div className="lp-hero-cta">
                <button className="lp-btn lp-btn-primary" onClick={isAuthed ? openApp : getStarted}>
                  {isAuthed ? 'Open Listo' : 'Get Started Free'} <ArrowRight size={18} />
                </button>
                <button className="lp-btn lp-btn-secondary" onClick={() => scrollTo('#how-it-works')}>
                  See How It Works
                </button>
              </div>
              <span className="lp-hero-support">
                <Sparkles size={16} /> Simple to start. Smarter over time.
              </span>
            </Reveal>

            {/* ── 3. Product Preview ── */}
            <Reveal className="lp-preview-wrap" style={{ transitionDelay: '80ms' }}>
              <div className="lp-toast lp-toast-1"><Check size={15} strokeWidth={3} /> Milk ×2 added</div>
              <div className="lp-toast lp-toast-2"><Check size={15} strokeWidth={3} /> Anjana completed Book Hotel</div>
              <div className="lp-toast lp-toast-3"><Check size={15} strokeWidth={3} /> List completed · 100%</div>
              <div className="lp-phone lp-float">
                <div className="lp-phone-head">
                  <span className="lp-phone-title">Lists</span>
                  <span className="lp-phone-sub">4 lists</span>
                </div>
                <div className="lp-chips">
                  <span className="lp-chip active">Active</span>
                  <span className="lp-chip">Shared</span>
                  <span className="lp-chip">Completed</span>
                </div>
                <PreviewList emoji="🛒" name="July Groceries" meta="3 items left" pct={62} />
                <PreviewList emoji="✈️" name="Travel Checklist" meta="4 items left" pct={60} />
                <PreviewList emoji="🏠" name="Home Chores" meta="4 items" />
                <PreviewList emoji="💼" name="Office Tasks" meta="2 items left" pct={78} />
              </div>
            </Reveal>
          </div>
        </div>
      </header>

      {/* ── 4. Value Strip ────────────────────────────────────── */}
      <div className="lp-strip">
        <div className="lp-container">
          <div className="lp-strip-inner">
            {['Natural Input', 'Smart Organization', 'Real-Time Collaboration', 'Progress Tracking', 'Useful Insights'].map((v, i) => (
              <span key={v} style={{ display: 'inline-flex', alignItems: 'center', gap: 20 }}>
                {i > 0 && <span className="lp-strip-dot" aria-hidden />}
                <span className="lp-strip-item">{v}</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── 5. Core Capabilities ──────────────────────────────── */}
      <section className="lp-section" id="features">
        <div className="lp-container">
          <Reveal className="lp-center">
            <h2 className="lp-h2">More than a checklist.</h2>
            <p className="lp-lead">
              Listo helps you organize what matters, work together, track progress, and prepare for what comes next.
            </p>
          </Reveal>
          <Reveal className="lp-grid lp-grid-2" style={{ marginTop: 40 }}>
            <Capability icon={<PlusCircle size={22} />} title="Create naturally"
              desc="Add items the way you think." extra={
                <div className="lp-transform" style={{ marginTop: 14 }}>
                  <span className="lp-type-in">Milk 2L</span>
                  <ArrowRight size={16} />
                  <span className="lp-type-out">Milk · <span className="u">2 L</span></span>
                </div>
              } />
            <Capability icon={<Layers size={22} />} title="Stay organized"
              desc="Categories, progress tracking, smart filters, and duplicate detection keep every list clear." />
            <Capability icon={<Users size={22} />} title="Work together"
              desc="Share lists, collaborate in real time, and always know what has already been completed." />
            <Capability icon={<Brain size={22} />} title="Learn and improve"
              desc="Listo uses your list history to surface useful insights, suggestions, and smarter ways to prepare your next list." />
          </Reveal>
        </div>
      </section>

      {/* ── 6. How Listo Works ────────────────────────────────── */}
      <section className="lp-section" id="how-it-works">
        <div className="lp-container">
          <Reveal className="lp-center">
            <h2 className="lp-h2">From idea to done.</h2>
            <p className="lp-lead">Listo keeps every step simple.</p>
          </Reveal>
          <Reveal className="lp-steps" style={{ marginTop: 40 }}>
            {LIFECYCLE.map((s, i) => (
              <div className="lp-step" key={s.title}>
                <div className="lp-step-num">{i + 1}</div>
                <h4>{s.title}</h4>
                <p>{s.desc}</p>
              </div>
            ))}
          </Reveal>
        </div>
      </section>

      {/* ── 7. Natural Add ────────────────────────────────────── */}
      <section className="lp-section">
        <div className="lp-container">
          <div className="lp-feature">
            <Reveal>
              <span className="lp-eyebrow">Natural Input</span>
              <h2 className="lp-h2">Just type. Listo understands.</h2>
              <p className="lp-lead">Skip complicated forms and add items naturally.</p>
              <p className="lp-hero-support" style={{ marginTop: 22 }}>
                <Zap size={16} /> Less typing. Less editing. Faster lists.
              </p>
            </Reveal>
            <Reveal className="lp-feature-media" style={{ transitionDelay: '80ms' }}>
              <div className="lp-panel">
                <div className="lp-panel-label">Add item</div>
                <Transform inp="Milk 2" out={<>Milk <span className="u">×2</span></>} />
                <Transform inp="Rice 5kg" out={<>Rice · <span className="u">5 kg</span></>} />
                <Transform inp="Chicken 500g" out={<>Chicken · <span className="u">500 g</span></>} />
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── 8. Smart Organization ─────────────────────────────── */}
      <section className="lp-section">
        <div className="lp-container">
          <div className="lp-feature reverse">
            <Reveal className="lp-feature-media">
              <div className="lp-panel">
                <div className="lp-lrow"><span className="lp-lrow-emoji" aria-hidden>🥛</span>
                  <div className="lp-lrow-body"><div className="lp-lrow-name">Milk <span style={{ color: 'var(--text-3)' }}>×2</span></div></div>
                </div>
                <div className="lp-lrow"><span className="lp-lrow-emoji" aria-hidden>🥛</span>
                  <div className="lp-lrow-body"><div className="lp-lrow-name">Milk <span style={{ color: 'var(--text-3)' }}>×3</span></div></div>
                </div>
                <div className="lp-dupe-note"><Sparkles size={15} /> Similar item found</div>
                <div className="lp-dupe-actions">
                  <button className="lp-btn lp-btn-secondary lp-btn-sm" type="button" tabIndex={-1}>Keep Both</button>
                  <button className="lp-btn lp-btn-primary lp-btn-sm" type="button" tabIndex={-1}>Merge to Milk ×5</button>
                </div>
              </div>
            </Reveal>
            <Reveal style={{ transitionDelay: '80ms' }}>
              <span className="lp-eyebrow">Smart Organization</span>
              <h2 className="lp-h2">Stay organized without the cleanup.</h2>
              <p className="lp-lead">
                Listo helps keep your lists clean by understanding similar items and preventing accidental duplicates.
              </p>
              <p className="lp-lead" style={{ marginTop: 16, fontWeight: 600, color: 'var(--text-2)' }}>
                Already completed an item? Add it again whenever you need it. Listo understands the difference
                between a duplicate and a repeat.
              </p>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── 9. Collaboration ──────────────────────────────────── */}
      <section className="lp-section">
        <div className="lp-container">
          <div className="lp-feature">
            <Reveal>
              <span className="lp-eyebrow">Collaboration</span>
              <h2 className="lp-h2">Better lists, together.</h2>
              <p className="lp-lead">Share a list and keep everyone in sync.</p>
              <ul style={{ listStyle: 'none', margin: '22px 0 0', display: 'grid', gap: 10 }}>
                {['Real-time updates', 'Shared progress', 'Member activity', 'Clear ownership'].map(t => (
                  <li key={t} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 15, fontWeight: 600, color: 'var(--text-2)' }}>
                    <Check size={17} color="var(--accent)" strokeWidth={3} /> {t}
                  </li>
                ))}
              </ul>
              <p className="lp-lead" style={{ marginTop: 20, fontWeight: 700, color: 'var(--text)' }}>
                No more asking, “Did someone already do this?”
              </p>
            </Reveal>
            <Reveal className="lp-feature-media" style={{ transitionDelay: '80ms' }}>
              <div className="lp-panel">
                <div className="lp-panel-label">Weekend Trip</div>
                <div className="lp-avatars" aria-hidden>
                  <span className="lp-avatar" style={{ background: '#16A34A' }}>Y</span>
                  <span className="lp-avatar" style={{ background: '#38bdf8' }}>A</span>
                  <span className="lp-avatar" style={{ background: '#a78bfa' }}>R</span>
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--text-3)', fontWeight: 600, margin: '4px 0 12px' }}>You · Anjana · Rishvika</div>
                <div className="lp-check done"><span className="lp-check-box"><Check size={13} strokeWidth={3.5} /></span><span className="lp-check-label">Book Hotel</span><span className="lp-check-who">Anjana</span></div>
                <div className="lp-check done"><span className="lp-check-box"><Check size={13} strokeWidth={3.5} /></span><span className="lp-check-label">Pack Clothes</span><span className="lp-check-who">You</span></div>
                <div className="lp-check"><span className="lp-check-box" /><span className="lp-check-label">Buy Snacks</span></div>
                <div className="lp-check"><span className="lp-check-box" /><span className="lp-check-label">Charge Camera</span></div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── 10. Progress Tracking ─────────────────────────────── */}
      <section className="lp-section">
        <div className="lp-container">
          <div className="lp-feature reverse">
            <Reveal className="lp-feature-media">
              <div className="lp-panel">
                <div className="lp-panel-label">Travel Checklist</div>
                <div className="flex items-center justify-between">
                  <span style={{ fontSize: 17, fontWeight: 800 }}>Almost there</span>
                  <span className="badge badge-green">80%</span>
                </div>
                <div className="lp-progress-track" style={{ marginTop: 14 }}><div style={{ width: '80%' }} /></div>
                <div className="flex items-center justify-between" style={{ fontSize: 13, color: 'var(--text-2)', fontWeight: 600 }}>
                  <span>8 of 10 completed</span>
                  <span>2 items left</span>
                </div>
              </div>
            </Reveal>
            <Reveal style={{ transitionDelay: '80ms' }}>
              <span className="lp-eyebrow">Progress Tracking</span>
              <h2 className="lp-h2">Always know what's left.</h2>
              <p className="lp-lead">Simple progress tracking helps you focus on what still needs attention.</p>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── 11. Listo Intelligence (memory · before-you-go · next list) ── */}
      <section className="lp-section">
        <div className="lp-container lp-center">
          <Reveal>
            <span className="lp-eyebrow">Listo Intelligence</span>
            <h2 className="lp-h2">The more you use Listo, the more useful it becomes.</h2>
            <p className="lp-lead">
              Listo learns from your list history to help you prepare faster, remember important items, and make
              better use of every list.
            </p>
          </Reveal>
          <Reveal className="lp-flow-row" style={{ marginTop: 32 }}>
            {['You create lists', 'Listo remembers', 'Finds patterns', 'Suggests', 'You save time'].map((n, i, a) => (
              <span className="lp-flow-chip-wrap" key={n}>
                <span className="lp-flow-chip">{n}</span>
                {i < a.length - 1 && <ArrowRight className="lp-flow-sep" size={16} aria-hidden />}
              </span>
            ))}
          </Reveal>
          <Reveal className="lp-grid lp-grid-3" style={{ marginTop: 36, textAlign: 'left' }}>
            <div className="lp-card">
              <div className="lp-card-icon"><Brain size={22} /></div>
              <h3>Lists that remember</h3>
              <p>Frequently added items, typical quantities, and recurring patterns power better suggestions over time — every list makes the next one easier.</p>
              <div className="lp-pills" style={{ marginTop: 14 }}>
                <span className="lp-pill"><PlusCircle size={15} /> Milk ×2</span>
                <span className="lp-pill"><PlusCircle size={15} /> Eggs ×12</span>
                <span className="lp-pill"><PlusCircle size={15} /> Rice 5kg</span>
              </div>
            </div>
            <div className="lp-card">
              <div className="lp-card-icon"><Sparkles size={22} /></div>
              <h3>Forget less</h3>
              <p>Before you start, Listo flags frequently used items that may be missing — a small reminder before forgotten items become a problem.</p>
              <div className="lp-pills" style={{ marginTop: 14 }}>
                <span className="lp-pill">Milk</span>
                <span className="lp-pill">Eggs</span>
                <span className="lp-pill">Bread</span>
              </div>
            </div>
            <div className="lp-card">
              <div className="lp-card-icon"><PlusCircle size={22} /></div>
              <h3>Done doesn't mean starting over</h3>
              <p>Completed lists help Listo prepare what comes next, so every finished list gives you a faster head start on the next one.</p>
              <div className="lp-pills" style={{ marginTop: 14 }}>
                <span className="lp-pill">Rice 5kg</span>
                <span className="lp-pill">Bananas</span>
                <span className="lp-pill">Bread</span>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── 14. Insights ──────────────────────────────────────── */}
      <section className="lp-section">
        <div className="lp-container">
          <div className="lp-feature">
            <Reveal>
              <span className="lp-eyebrow">Insights</span>
              <h2 className="lp-h2">Insights that lead somewhere.</h2>
              <p className="lp-lead">
                Listo doesn't show data just for the sake of showing data. Insights help you understand progress,
                patterns, and what to do next.
              </p>
              <p className="lp-lead" style={{ marginTop: 18, fontWeight: 700, color: 'var(--text)' }}>
                Understand what happened. Improve what comes next.
              </p>
            </Reveal>
            <Reveal className="lp-feature-media" style={{ transitionDelay: '80ms' }}>
              <div className="lp-panel">
                <div className="lp-stats">
                  <div className="lp-stat"><div className="lp-stat-val accent">88 / 100</div><div className="lp-stat-label">Good Planner</div></div>
                  <div className="lp-stat"><div className="lp-stat-val">84%</div><div className="lp-stat-label">Completion</div></div>
                  <div className="lp-stat"><div className="lp-stat-val">0</div><div className="lp-stat-label">Duplicates</div></div>
                  <div className="lp-stat"><div className="lp-stat-val">Saturday</div><div className="lp-stat-label">Most Active Day</div></div>
                </div>
                <div className="lp-panel-label" style={{ marginBottom: 6 }}>Top recommendations</div>
                <div className="lp-rec"><span className="num">1</span> Categorize remaining items</div>
                <div className="lp-rec"><span className="num">2</span> Prepare your next list</div>
                <div className="lp-rec"><span className="num">3</span> Create a reusable template</div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── 15. Use Cases ─────────────────────────────────────── */}
      <section className="lp-section" id="use-cases">
        <div className="lp-container">
          <Reveal className="lp-center">
            <h2 className="lp-h2">One Listo. Every kind of list.</h2>
            <p className="lp-lead">Simple enough for everyday tasks. Flexible enough for almost anything.</p>
          </Reveal>
          <Reveal className="lp-grid lp-grid-3" style={{ marginTop: 40 }}>
            {USE_CASES.map(u => (
              <div className="lp-card" key={u.title}>
                <div className="lp-card-icon">{u.icon}</div>
                <h3>{u.title}</h3>
                <p>{u.desc}</p>
              </div>
            ))}
          </Reveal>
        </div>
      </section>

      {/* ── 16. Focus Mode ────────────────────────────────────── */}
      <section className="lp-section">
        <div className="lp-container">
          <div className="lp-feature reverse">
            <Reveal className="lp-feature-media">
              <div className="lp-panel">
                <div className="flex items-center justify-between" style={{ marginBottom: 14 }}>
                  <span className="lp-panel-label" style={{ margin: 0 }}>Focus Mode</span>
                  <span className="badge badge-green">3 of 12 remaining</span>
                </div>
                <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', color: 'var(--text-3)', margin: '4px 0 6px' }}>IMPORTANT</div>
                <div className="lp-check"><span className="lp-check-box" /><span className="lp-check-label">Book Hotel</span></div>
                <div className="lp-check"><span className="lp-check-box" /><span className="lp-check-label">Charge Camera</span></div>
                <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', color: 'var(--text-3)', margin: '12px 0 6px' }}>PACKING</div>
                <div className="lp-check"><span className="lp-check-box" /><span className="lp-check-label">Passport</span></div>
              </div>
            </Reveal>
            <Reveal style={{ transitionDelay: '80ms' }}>
              <span className="lp-eyebrow">Focus Mode</span>
              <h2 className="lp-h2">Focus on what matters now.</h2>
              <p className="lp-lead">
                When it's time to get things done, Listo simplifies the experience so you can focus on what's left.
              </p>
              <p className="lp-lead" style={{ marginTop: 16, color: 'var(--text-2)' }}>
                For shopping lists, Focus Mode can group what's left by aisle so a single trip stays effortless.
              </p>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── Listo + YFT ───────────────────────────────────────── */}
      <section className="lp-section-sm">
        <div className="lp-container lp-center">
          <Reveal>
            <span className="lp-eyebrow">Listo + YFT</span>
            <h2 className="lp-h2">Plan with Listo. Track spending with YFT.</h2>
            <p className="lp-lead">Use Listo to organize what you need and YFT to understand how much you spend.</p>
          </Reveal>
          <Reveal style={{ marginTop: 32 }}>
            <div className="lp-eco">
              <div className="lp-eco-card"><div className="name">Listo</div><div className="desc">What you need</div></div>
              <div className="lp-eco-arrow"><ArrowRight size={22} /></div>
              <div className="lp-eco-card"><div className="name">YFT</div><div className="desc">What you spend</div></div>
            </div>
            <button className="lp-btn lp-btn-secondary" onClick={() => openYft('/about')}>
              Learn about YFT <ArrowRight size={16} />
            </button>
          </Reveal>
        </div>
      </section>

      {/* ── 19. Privacy and Trust ─────────────────────────────── */}
      <section className="lp-section" id="about">
        <div className="lp-container">
          <Reveal className="lp-center">
            <h2 className="lp-h2">Your lists are yours.</h2>
            <p className="lp-lead">
              Listo is designed to keep your personal and shared lists secure while giving you control over what you
              share and with whom.
            </p>
          </Reveal>
          <Reveal className="lp-trust" style={{ marginTop: 36 }}>
            <div className="lp-trust-item"><ShieldCheck size={20} /><span>Secure Accounts</span></div>
            <div className="lp-trust-item"><Share2 size={20} /><span>Controlled Sharing</span></div>
            <div className="lp-trust-item"><EyeOff size={20} /><span>Private Personal Lists</span></div>
            <div className="lp-trust-item"><Users size={20} /><span>Clear Collaboration</span></div>
          </Reveal>
        </div>
      </section>

      {/* ── 20. Final CTA ─────────────────────────────────────── */}
      <section className="lp-section">
        <div className="lp-container">
          <Reveal className="lp-final">
            <h2 className="lp-h2">Ready to make your lists smarter?</h2>
            <p className="lp-lead">Create, collaborate, track progress, and get more from every list.</p>
            <div className="lp-final-cta">
              <button className="lp-btn lp-btn-primary" onClick={isAuthed ? openApp : getStarted} style={{ minWidth: 220 }}>
                {isAuthed ? 'Open Listo' : 'Get Started Free'} <ArrowRight size={18} />
              </button>
              {!isAuthed && (
                <span className="lp-final-sign">
                  Already have an account? <a href="/login" onClick={(e) => { e.preventDefault(); signIn() }}>Sign In</a>
                </span>
              )}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── 21. Footer ────────────────────────────────────────── */}
      <footer className="lp-footer">
        <div className="lp-container">
          <div className="lp-footer-grid">
            <div className="lp-footer-brand lp-footer-col">
              <div className="lp-brand"><img src="/brand.png" alt="" aria-hidden /><img src="/wordmark.png" alt="Listo" className="lp-wordmark" /></div>
              <p className="lp-footer-tag">Type less. Forget less. Get more done.</p>
            </div>
            <div className="lp-footer-col">
              <h5>Product</h5>
              <button onClick={() => scrollTo('#features')}>Features</button>
              <button onClick={() => scrollTo('#how-it-works')}>How It Works</button>
              <button onClick={() => scrollTo('#use-cases')}>Use Cases</button>
            </div>
            <div className="lp-footer-col">
              <h5>Company</h5>
              <button onClick={() => scrollTo('#about')}>About</button>
              <a href="/profile/support" onClick={(e) => { e.preventDefault(); navigate('/profile/support') }}>Contact</a>
            </div>
            <div className="lp-footer-col">
              <h5>Legal</h5>
              <a href="/privacy" onClick={(e) => { e.preventDefault(); navigate('/privacy') }}>Privacy Policy</a>
              <a href="/terms" onClick={(e) => { e.preventDefault(); navigate('/terms') }}>Terms of Service</a>
            </div>
          </div>
          <div className="lp-footer-bottom">
            <span>© 2026 Listo</span>
            <span>Made with care.</span>
          </div>
        </div>
      </footer>
    </div>
  )
}

/* ── Small presentational helpers ────────────────────────────── */

function PreviewList({ emoji, name, meta, pct }: { emoji: string; name: string; meta: string; pct?: number }) {
  return (
    <div className="lp-lrow">
      <span className="lp-lrow-emoji" aria-hidden>{emoji}</span>
      <div className="lp-lrow-body">
        <div className="lp-lrow-name">{name}</div>
        <div className="lp-lrow-meta">{meta}</div>
        {pct != null && <div className="lp-lrow-prog"><div style={{ width: `${pct}%` }} /></div>}
      </div>
    </div>
  )
}

function Capability({ icon, title, desc, extra }: { icon: ReactNode; title: string; desc: string; extra?: ReactNode }) {
  return (
    <div className="lp-card">
      <div className="lp-card-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{desc}</p>
      {extra}
    </div>
  )
}

function Transform({ inp, out }: { inp: string; out: ReactNode }) {
  return (
    <div className="lp-transform">
      <span className="lp-type-in">{inp}</span>
      <ArrowRight size={16} />
      <span className="lp-type-out">{out}</span>
    </div>
  )
}

const LIFECYCLE = [
  { title: 'Create', desc: 'Start any list.' },
  { title: 'Organize', desc: 'Add items naturally and let Listo keep things structured.' },
  { title: 'Collaborate', desc: 'Invite others and stay updated in real time.' },
  { title: 'Track', desc: 'See progress and know exactly what remains.' },
  { title: 'Complete', desc: 'Finish your list and understand how you did.' },
  { title: 'Repeat Smarter', desc: 'Use your history to prepare future lists faster.' },
]

const USE_CASES = [
  { icon: <ShoppingBag size={22} />, title: 'Shopping', desc: 'Plan purchases, avoid duplicates, and prepare future lists faster.' },
  { icon: <Plane size={22} />, title: 'Travel', desc: 'Keep packing, bookings, and plans organized.' },
  { icon: <HomeIcon size={22} />, title: 'Home', desc: 'Share chores and household responsibilities.' },
  { icon: <Briefcase size={22} />, title: 'Work', desc: 'Track tasks and collaborate on shared responsibilities.' },
  { icon: <CalendarDays size={22} />, title: 'Events', desc: 'Coordinate everything that needs to happen.' },
  { icon: <UserIcon size={22} />, title: 'Personal', desc: 'Keep everyday tasks simple and organized.' },
]
