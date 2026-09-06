// src/pages/BusinessPage.jsx — https://jashmenstudio.com/
//
// The front door, and it talks to business. A student who wants the product
// goes straight to /start or /login; everybody who lands on the bare domain
// is, in practice, someone deciding whether to work with us, and this page
// is built to turn that into an enquiry in the panel's inbox.
//
// EVERY WORD AND EVERY PICTURE COMES FROM THE CONTENT STORE — the panel's
// "Бизнес бет" tab (admin-api/business.seed.js is only the starting text).
// Nothing here is hardcoded copy, so a price, a promise or a photograph
// changes without a deploy.
//
// Two things are deliberately NOT editable, because they are facts rather
// than copy:
//
//   · the counters under "Продукт работает сегодня" are read from
//     GET /public/stats as the page loads
//   · the logos under "нам доверяют" are the real partners and campuses
//     from the same store — a logo typed in by hand under that heading
//     would be a claim, not a decoration
//
// Every section carries `enabled`; switching one off removes it from the
// page. An empty field removes what it fills — a blank heading, a blank
// videoUrl (no play button), a blank apkUrl (no download link) — rather
// than leaving a control that does nothing.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useContent } from '../store.jsx';
import { localizedText } from '../i18n.jsx';
import * as api from '../api.js';
import { lessonIconFor } from '../../shared/lessonIconComponents.jsx';
import '../components/business/business.css';
import BusinessSprite, { Ico } from '../components/business/sprite.jsx';
import SolutionScene from '../components/business/scenes.jsx';

const LANGS = ['ru', 'ky', 'en'];
const LANG_KEY = 'jashmen.businessLocale';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/// Flattens a stored section into plain strings for the reader's language,
/// so nothing below has to know that content is trilingual.
///
/// It decides by SHAPE, never by field name. An earlier version kept a list
/// of keys to pass through untouched and it was wrong within the hour:
/// `footer.email` is a plain address while `form.email` is the trilingual
/// label of the email field, and one list cannot be right about both. A
/// value is translated iff it is an object carrying a language key;
/// everything else — urls, raw strings, '', booleans, null — passes through.
function resolve(node, locale) {
  if (Array.isArray(node)) return node.map(item => resolve(item, locale));
  if (node && typeof node === 'object') {
    if ('ky' in node || 'ru' in node || 'en' in node) return localizedText(node, locale);
    const out = {};
    for (const [key, value] of Object.entries(node)) out[key] = resolve(value, locale);
    return out;
  }
  return node;
}

/// An admin-picked glyph (shared/lessonIcons.js), falling back to the page's
/// own sprite so a row whose icon was cleared still draws something.
function SlugIcon({ slug, fallback, size = 20 }) {
  const Picked = lessonIconFor(slug);
  if (Picked) return <Picked size={size} strokeWidth={2} />;
  return <Ico id={fallback} />;
}

// ── Hooks ──────────────────────────────────────────────────────────────────

/// Adds `is-in` the first time an element scrolls into view. One observer per
/// element rather than a page-level orchestrator, so a card never waits on
/// its slowest sibling, and it disconnects on first hit.
function useReveal() {
  const [el, setEl] = useState(null);
  useEffect(() => {
    if (!el) return undefined;
    if (typeof IntersectionObserver === 'undefined') {
      el.classList.add('is-in');
      return undefined;
    }
    const io = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) {
        el.classList.add('is-in');
        io.disconnect();
      }
    }, { rootMargin: '-40px' });
    io.observe(el);
    return () => io.disconnect();
  }, [el]);
  return setEl;
}

function Reveal({ as: Tag = 'div', className = '', children, ...rest }) {
  const ref = useReveal();
  return (
    <Tag ref={ref} className={`jb-reveal ${className}`} {...rest}>{children}</Tag>
  );
}

/// Counts to `value` once active. rAF rather than an interval so a slow
/// frame cannot make it tear; snaps straight to the target under
/// prefers-reduced-motion.
function useCountUp(value, active) {
  const [shown, setShown] = useState(0);
  const reduced = typeof matchMedia === 'function'
    && matchMedia('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    const target = Number(value) || 0;
    if (!active || !target || reduced) { setShown(target); return undefined; }
    let raf = 0;
    let start = 0;
    const step = now => {
      if (!start) start = now;
      const p = Math.min(1, (now - start) / 1100);
      setShown(Math.round(target * (1 - (1 - p) ** 3)));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, active, reduced]);

  return shown;
}

// ── Video ──────────────────────────────────────────────────────────────────

/// Works out how to play whatever the admin pasted. Returns null for an
/// empty field, which is what removes the play button from the hero.
///
/// Three shapes, because all three are what people actually have: a YouTube
/// link (what a marketing team owns), a Vimeo link, and a file uploaded
/// through the panel (uploads.js accepts mp4/webm/mov).
export function resolveVideo(url) {
  const raw = String(url || '').trim();
  if (!raw) return null;

  const yt = raw.match(
    /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{6,})/i,
  );
  if (yt) {
    return {
      kind: 'embed',
      src: `https://www.youtube-nocookie.com/embed/${yt[1]}?autoplay=1&rel=0&modestbranding=1`,
    };
  }
  const vimeo = raw.match(/vimeo\.com\/(?:video\/)?(\d+)/i);
  if (vimeo) return { kind: 'embed', src: `https://player.vimeo.com/video/${vimeo[1]}?autoplay=1` };
  return { kind: 'file', src: raw };
}

function VideoLightbox({ video, poster, onClose }) {
  // Escape closes, and the body must not scroll behind the overlay — a
  // lightbox you can scroll past is how a video ends up playing under the
  // footer.
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <div
      className="jb-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label="JashMen"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="jb-lightbox__frame">
        <button type="button" className="jb-lightbox__close" onClick={onClose} aria-label="✕">
          <Ico id="close" />
        </button>
        {video.kind === 'embed' ? (
          <iframe
            src={video.src}
            title="JashMen"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
            allowFullScreen
          />
        ) : (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <video src={video.src} poster={poster || undefined} controls autoPlay playsInline />
        )}
      </div>
    </div>
  );
}

// ── Nav ────────────────────────────────────────────────────────────────────

function LangToggle({ lang, setLang }) {
  return (
    <div
      role="group"
      aria-label="Language"
      style={{
        display: 'inline-flex', alignItems: 'center', padding: 3, height: 38,
        borderRadius: 999, background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.13)',
      }}
    >
      {LANGS.map(code => {
        const on = code === lang;
        return (
          <button
            key={code}
            type="button"
            onClick={() => setLang(code)}
            aria-pressed={on}
            style={{
              height: 30, padding: '0 10px', borderRadius: 999,
              fontSize: 12, fontWeight: 600, letterSpacing: '0.02em',
              color: on ? '#0a1128' : 'rgba(255,255,255,0.66)',
              background: on ? '#fff' : 'transparent',
              transition: 'background-color .2s, color .2s',
            }}
          >
            {code.toUpperCase()}
          </button>
        );
      })}
    </div>
  );
}

function Nav({ nav, tabs, lang, setLang, onGoto }) {
  const [open, setOpen] = useState(false);
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    const onScroll = () => setStuck(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const links = [
    { href: '#partners', label: nav.partners },
    { href: '#integration', label: nav.integration },
    { href: '#impact', label: nav.impact },
    { href: '#product', label: nav.product },
  ].filter(l => l.label);

  return (
    <>
      <nav className={`jb-nav${stuck ? ' is-stuck' : ''}`}>
        <a className="jb-brand" href="#top" aria-label="JashMen">
          <span className="jb-brand__mark"><img src="/logo1.png" alt="" /></span>
          <img className="jb-brand__word" src="/jashmen_text_white.png" alt="Jashmen" />
        </a>

        <div className="jb-nav__links">
          {nav.solutions && (
            <div className="jb-nav__item">
              <a className="jb-nav__link" href="#solutions">
                {nav.solutions} <Ico id="chevron" />
              </a>
              <div className="jb-nav__drop">
                {tabs.map(t => (
                  <button key={t.id} type="button" onClick={() => onGoto(t.id)}>{t.tab}</button>
                ))}
              </div>
            </div>
          )}
          {links.map(l => (
            <a key={l.href} className="jb-nav__link" href={l.href}>{l.label}</a>
          ))}
          {nav.forStudents && (
            <Link className="jb-nav__link" to="/start">{nav.forStudents}</Link>
          )}
        </div>

        {/* No inline `display` here: business.css hides this whole cluster
            below 900px in favour of the burger, and an inline style would
            outrank that media query and push the bar off the screen. */}
        <div className="jb-nav__cta">
          <LangToggle lang={lang} setLang={setLang} />
          {nav.cta && (
            <a className="jb-btn jb-btn--primary" href="#apply">
              {nav.cta}
              <span className="ico"><Ico id="arrow" /></span>
            </a>
          )}
        </div>

        <button
          className="jb-nav__burger"
          type="button"
          aria-label="Menu"
          aria-expanded={open}
          aria-controls="jb-mobile-menu"
          onClick={() => setOpen(v => !v)}
        >
          <Ico id="menu" />
        </button>
      </nav>

      <div className={`jb-mobile${open ? ' is-open' : ''}`} id="jb-mobile-menu">
        {nav.solutions && <a href="#solutions" onClick={() => setOpen(false)}>{nav.solutions}</a>}
        {links.map(l => (
          <a key={l.href} href={l.href} onClick={() => setOpen(false)}>{l.label}</a>
        ))}
        {nav.forStudents && (
          <Link to="/start" onClick={() => setOpen(false)}>{nav.forStudents}</Link>
        )}
        <div style={{ padding: '10px 14px 4px' }}>
          <LangToggle lang={lang} setLang={setLang} />
        </div>
        {nav.cta && (
          <a className="jb-btn jb-btn--primary" href="#apply" onClick={() => setOpen(false)}>
            {nav.cta}
            <span className="ico"><Ico id="arrow" /></span>
          </a>
        )}
      </div>
    </>
  );
}

// ── Hero ───────────────────────────────────────────────────────────────────

function Fluid({ variant = '' }) {
  return (
    <div className={`jb-fluid-wrap ${variant}`} aria-hidden="true">
      <svg className="jb-fluid" viewBox="0 0 620 520"><use href="#jb-fluid-art" /></svg>
    </div>
  );
}

function Hero({ hero }) {
  const [playing, setPlaying] = useState(false);
  const video = useMemo(() => resolveVideo(hero.videoUrl), [hero.videoUrl]);
  // The last two lines wear the gradient; a blank line is simply not drawn.
  const lines = [hero.line1, hero.line2, hero.line3, hero.line4];

  return (
    <header className="jb-hero" id="top">
      <div>
        <h1 className="jb-hero__title">
          {lines.map((line, i) => (line ? (
            <span key={`${i}-${line}`} className={i >= 2 ? 'jb-grad' : undefined}>{line}</span>
          ) : null))}
        </h1>
        {hero.lead && <p className="jb-hero__lead">{hero.lead}</p>}
        <div className="jb-hero__actions">
          {hero.primaryCta && (
            <a className="jb-btn jb-btn--primary jb-btn--lg" href="#apply">
              {hero.primaryCta}
              <span className="ico"><Ico id="arrow" /></span>
            </a>
          )}
          {hero.secondaryCta && (
            <a className="jb-btn jb-btn--ghost jb-btn--lg" href="#solutions">
              {hero.secondaryCta}
              <span className="ico"><Ico id="chevron" /></span>
            </a>
          )}
        </div>
      </div>

      <div className="jb-hero__visual">
        {/* An uploaded picture replaces the animated artwork; without one the
            artwork carries the hero on its own. */}
        {hero.imageUrl ? (
          <img
            src={hero.imageUrl}
            alt=""
            style={{
              position: 'relative', zIndex: 2, maxHeight: 430,
              width: '100%', objectFit: 'contain',
            }}
          />
        ) : (
          <>
            <Fluid variant="jb-fluid-wrap--glow" />
            <Fluid />
          </>
        )}

        {/* No video configured means no control. A play button that opens
            nothing is worse than an empty hero. */}
        {video && (
          <div className="jb-play">
            <button
              className="jb-play__btn"
              type="button"
              onClick={() => setPlaying(true)}
              aria-label={hero.videoLabel || 'Play'}
            >
              <Ico id="play" />
            </button>
            {hero.videoLabel && <span className="jb-play__label">{hero.videoLabel}</span>}
          </div>
        )}
      </div>

      {playing && video && (
        <VideoLightbox video={video} poster={hero.videoPoster} onClose={() => setPlaying(false)} />
      )}
    </header>
  );
}

// ── Trust ──────────────────────────────────────────────────────────────────

function Trust({ trust, marks }) {
  const [track, setTrack] = useState(null);

  const scroll = () => {
    if (!track) return;
    const end = track.scrollWidth - track.clientWidth;
    track.scrollTo({ left: track.scrollLeft >= end - 8 ? 0 : track.scrollLeft + track.clientWidth * 0.8 });
  };

  return (
    <Reveal as="section" className="jb-trust jb-card" id="partners" aria-label={trust.label}>
      {trust.label && <span className="jb-trust__label">{trust.label}</span>}
      {marks.length === 0 ? (
        <span className="jb-trust__label" style={{ opacity: 0.7 }}>{trust.empty}</span>
      ) : (
        <>
          <div className="jb-trust__track" ref={setTrack}>
            {marks.map(m => (
              <span className="jb-logo" key={m.key} title={m.name}>
                {m.logoUrl
                  ? <img src={m.logoUrl} alt={m.name} loading="lazy" />
                  : <Ico id={m.kind === 'uni' ? 'cap' : 'building'} />}
                {/* A logo image already carries the name; repeating it beside
                    the artwork is what makes a trust strip look like a list. */}
                {!m.logoUrl && m.name}
              </span>
            ))}
          </div>
          <button className="jb-round-btn" type="button" onClick={scroll} aria-label="→">
            <Ico id="arrow" />
          </button>
        </>
      )}
    </Reveal>
  );
}

// ── Solutions ──────────────────────────────────────────────────────────────

function Solutions({ solutions, activeId, setActiveId }) {
  const tabs = solutions.items || [];
  const active = tabs.find(t => t.id === activeId) || tabs[0];
  if (!active) return null;

  const bullets = [active.p1, active.p2, active.p3].filter(Boolean);

  return (
    <section className="jb-section" id="solutions">
      <Reveal className="jb-section__head">
        <h2 className="jb-h2">{solutions.title}</h2>
        <p className="jb-section__note">{solutions.note}</p>
      </Reveal>

      <Reveal>
        <div className="jb-tabs" role="tablist" aria-label={solutions.title}>
          {tabs.map(t => (
            <button
              key={t.id}
              className="jb-tab"
              role="tab"
              id={`jb-tab-${t.id}`}
              aria-selected={t.id === active.id}
              aria-controls="jb-solution-panel"
              type="button"
              onClick={() => setActiveId(t.id)}
            >
              {t.tab}
            </button>
          ))}
        </div>

        <div
          className="jb-solution jb-card"
          id="jb-solution-panel"
          role="tabpanel"
          aria-labelledby={`jb-tab-${active.id}`}
        >
          <div className="jb-solution__body jb-fade-in" key={active.id}>
            <h3>{active.title}</h3>
            <p>{active.text}</p>
            {bullets.length > 0 && (
              <ul className="jb-checks">
                {bullets.map(c => (
                  <li key={c}><span><Ico id="check" /></span>{c}</li>
                ))}
              </ul>
            )}
            {solutions.cta && (
              <a className="jb-btn jb-btn--ghost" href="#apply">
                {solutions.cta}
                <span className="ico"><Ico id="arrow" /></span>
              </a>
            )}
          </div>
          <div className="jb-solution__media">
            {/* An uploaded picture replaces the drawn scene. */}
            {active.imageUrl ? (
              <img
                key={active.id}
                className="jb-scene jb-fade-in"
                src={active.imageUrl}
                alt=""
                style={{ objectFit: 'cover' }}
              />
            ) : (
              <SolutionScene id={active.id} />
            )}
          </div>
        </div>
      </Reveal>
    </section>
  );
}

// ── Stats ──────────────────────────────────────────────────────────────────

function StatCell({ icon, label, value, loading }) {
  const [el, setEl] = useState(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    if (!el || seen) return undefined;
    el.classList.add('is-in');
    const io = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) { setSeen(true); io.disconnect(); }
    }, { rootMargin: '-40px' });
    io.observe(el);
    return () => io.disconnect();
  }, [el, seen]);

  const shown = useCountUp(value, seen && !loading);

  return (
    <article ref={setEl} className="jb-stat jb-card jb-reveal">
      <div className="jb-stat__top">
        <span className="jb-tile"><Ico id={icon} /></span>
        {loading
          ? <span className="jb-stat__skeleton" />
          : <span className="jb-stat__num">{shown.toLocaleString('ru-RU')}</span>}
      </div>
      <p>{label}</p>
    </article>
  );
}

// ── Application form ───────────────────────────────────────────────────────

const EMPTY_FORM = {
  organization: '', contact: '', email: '', phone: '', interest: 'league', message: '',
};

/// The one thing on this page that has to work. Built so an enquiry is never
/// lost: nothing is required that we could live without, a failure keeps
/// every word the person typed, and the failure state prints the address so
/// somebody who has already written 200 words always has somewhere to put
/// them. Real validation lives on the server — a second copy here would
/// eventually disagree, and the one that would be wrong is the one that can
/// silently refuse a bank.
function ApplyForm({ form, contactEmail }) {
  const [values, setValues] = useState(EMPTY_FORM);
  const [state, setState] = useState('idle');
  const [error, setError] = useState('');

  const set = key => e => setValues(v => ({ ...v, [key]: e.target.value }));
  const ready = values.organization.trim() && values.contact.trim()
    && EMAIL_RE.test(values.email.trim());

  async function submit(e) {
    e.preventDefault();
    if (!ready || state === 'sending') return;
    setState('sending');
    setError('');
    try {
      await api.submitEnquiry({ kind: 'partner', ...values });
      setState('sent');
      setValues(EMPTY_FORM);
    } catch (err) {
      setState('failed');
      setError(err?.message || '');
    }
  }

  if (state === 'sent') {
    return (
      <div className="jb-card jb-done jb-fade-in">
        <span className="jb-done__mark"><Ico id="check" /></span>
        <h3>{form.okTitle}</h3>
        <p>{form.okBody}</p>
        <button
          type="button"
          className="jb-btn jb-btn--ghost"
          style={{ marginTop: 22 }}
          onClick={() => setState('idle')}
        >
          {form.okAgain}
        </button>
      </div>
    );
  }

  const field = (key, label, extra = {}) => (
    <label className="jb-field">
      <span className="jb-field__label">
        {label}
        {extra.optional && <span className="jb-field__hint">{form.optional}</span>}
      </span>
      <input
        className="jb-input"
        value={values[key]}
        onChange={set(key)}
        placeholder={extra.placeholder}
        type={extra.type || 'text'}
        inputMode={extra.inputMode}
        autoComplete={extra.autoComplete}
        maxLength={extra.maxLength || 200}
      />
    </label>
  );

  const interests = [
    ['league', form.iLeague], ['module', form.iModule],
    ['rewards', form.iRewards], ['integration', form.iIntegration],
  ].filter(([, label]) => label);

  return (
    <form className="jb-card jb-form" onSubmit={submit} noValidate>
      <div className="jb-form__grid">
        {field('organization', form.organization, { placeholder: form.organizationPh, autoComplete: 'organization' })}
        {field('contact', form.contact, { placeholder: form.contactPh, autoComplete: 'name' })}
        {field('email', form.email, { placeholder: form.emailPh, type: 'email', inputMode: 'email', autoComplete: 'email' })}
        {field('phone', form.phone, { placeholder: form.phonePh, type: 'tel', inputMode: 'tel', autoComplete: 'tel', optional: true, maxLength: 60 })}
      </div>

      {interests.length > 0 && (
        <fieldset style={{ border: 0, padding: 0, margin: '18px 0 0' }}>
          <legend className="jb-field__label" style={{ marginBottom: 9 }}>{form.interest}</legend>
          <div className="jb-pills">
            {interests.map(([key, label]) => (
              <label key={key} className={`jb-pill${values.interest === key ? ' is-on' : ''}`}>
                <input
                  type="radio"
                  name="jb-interest"
                  value={key}
                  checked={values.interest === key}
                  onChange={set('interest')}
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <label className="jb-field" style={{ marginTop: 18 }}>
        <span className="jb-field__label">
          {form.message}
          <span className="jb-field__hint">{form.optional}</span>
        </span>
        <textarea
          className="jb-input"
          rows={4}
          value={values.message}
          onChange={set('message')}
          placeholder={form.messagePh}
          maxLength={4000}
        />
      </label>

      {state === 'failed' && (
        <div className="jb-alert" role="alert">
          <Ico id="alert" />
          <span>
            {error || form.failBody}{' '}
            {contactEmail && <a href={`mailto:${contactEmail}`}>{contactEmail}</a>}
          </span>
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 18, marginTop: 22 }}>
        <button
          type="submit"
          className="jb-btn jb-btn--primary jb-btn--lg"
          disabled={!ready || state === 'sending'}
        >
          {state === 'sending' ? form.sending : state === 'failed' ? form.retry : form.submit}
          <span className="ico"><Ico id="arrow" /></span>
        </button>
        <p className="jb-note" style={{ flex: '1 1 240px' }}>{form.privacy}</p>
      </div>
    </form>
  );
}

// ── Footer ─────────────────────────────────────────────────────────────────

function Subscribe({ footer }) {
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    const value = email.trim();
    if (!EMAIL_RE.test(value)) { setMsg({ text: footer.newsBad, error: true }); return; }
    setBusy(true);
    try {
      await api.submitEnquiry({ kind: 'subscribe', email: value, source: 'business-footer' });
      setMsg({ text: footer.newsOk, error: false });
      setEmail('');
    } catch {
      setMsg({ text: footer.newsFail, error: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <div className="jb-subscribe">
        <input
          type="email"
          inputMode="email"
          value={email}
          onChange={e => { setEmail(e.target.value); setMsg(null); }}
          placeholder={footer.newsPlaceholder}
          aria-label={footer.newsTitle}
          maxLength={200}
        />
        <button type="submit" disabled={busy} aria-label={footer.newsTitle}>
          <Ico id={busy ? 'mail' : 'arrow'} />
        </button>
      </div>
      <p
        className={`jb-form-msg${msg ? ' is-shown' : ''}${msg?.error ? ' is-error' : ''}`}
        role="status"
      >
        {msg?.text || ''}
      </p>
    </form>
  );
}

/// One footer link. `#tab:<id>` selects a solutions tab and scrolls to it,
/// `#anchor` scrolls, a bare path is an app route, and a path with a file
/// extension is a real document rather than a client-side route.
function FooterLink({ link, onGoto }) {
  const href = String(link.href || '');
  if (href.startsWith('#tab:')) {
    return <button type="button" onClick={() => onGoto(href.slice(5))}>{link.label}</button>;
  }
  if (href.startsWith('/') && !/\.[a-z0-9]{2,5}$/i.test(href)) {
    return <Link to={href}>{link.label}</Link>;
  }
  return <a href={href}>{link.label}</a>;
}

function Footer({ footer, onGoto }) {
  const columns = ['1', '2', '3'].map((col, i) => ({
    title: [footer.col1, footer.col2, footer.col3][i],
    links: (footer.links || []).filter(l => String(l.col || '1') === col),
  })).filter(c => c.title || c.links.length);

  return (
    <footer className="jb-footer">
      <div className="jb-footer__grid">
        <div className="jb-footer__brand">
          <span className="jb-brand">
            <span className="jb-brand__mark"><img src="/logo1.png" alt="" /></span>
            <img className="jb-brand__word" src="/jashmen_text_white.png" alt="Jashmen" />
          </span>
          {footer.tagline && <p>{footer.tagline}</p>}
          <div className="jb-socials">
            {footer.instagram && (
              <a href={footer.instagram} target="_blank" rel="noreferrer noopener" aria-label="Instagram">
                <Ico id="ig" />
              </a>
            )}
            {footer.email && (
              <a href={`mailto:${footer.email}`} aria-label={footer.email}><Ico id="mail" /></a>
            )}
            {/* The Android build. No url means no link, rather than one that
                404s on the person who trusted it. */}
            {footer.apkUrl && (
              <a href={footer.apkUrl} download aria-label={footer.apkLabel} title={footer.apkLabel}>
                <Ico id="arrow" style={{ transform: 'rotate(90deg)' }} />
              </a>
            )}
          </div>
        </div>

        {columns.map(col => (
          <div key={col.title}>
            <h4>{col.title}</h4>
            <ul>
              {col.links.map(l => (
                <li key={l.id}><FooterLink link={l} onGoto={onGoto} /></li>
              ))}
            </ul>
          </div>
        ))}

        <div className="jb-footer__news">
          <h4>{footer.newsTitle}</h4>
          {footer.newsNote && <p className="jb-footer__note">{footer.newsNote}</p>}
          <Subscribe footer={footer} />
          {footer.apkUrl && (
            <a
              className="jb-btn jb-btn--ghost"
              href={footer.apkUrl}
              download
              style={{ marginTop: 14, height: 40, fontSize: 13 }}
            >
              {footer.apkLabel}
              <span className="ico"><Ico id="arrow" style={{ transform: 'rotate(90deg)' }} /></span>
            </a>
          )}
        </div>
      </div>

      <div className="jb-footer__bottom">
        <span>{footer.rights}</span>
      </div>
    </footer>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

function Splash() {
  return (
    <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', background: '#050a18' }}>
      <img src="/logo1.png" alt="JashMen" style={{ width: 72, height: 72, objectFit: 'contain' }} className="animate-pulse" />
    </div>
  );
}

export default function BusinessPage() {
  const content = useContent();

  const [lang, setLangState] = useState(() => {
    try {
      const saved = localStorage.getItem(LANG_KEY);
      if (LANGS.includes(saved)) return saved;
    } catch { /* private mode */ }
    // Russian for everyone until they say otherwise, and deliberately NOT
    // read from navigator.language: Chrome ships en-US on a great many
    // machines in Bishkek that belong to Russian-speaking people, so
    // sniffing the browser hands the English page to most of the audience
    // this one was written for.
    return 'ru';
  });
  const setLang = code => {
    setLangState(code);
    try { localStorage.setItem(LANG_KEY, code); } catch { /* private mode */ }
  };

  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [activeSolution, setActiveSolution] = useState(null);

  // The app shell caps #root at 480px below 1024px — right for a
  // phone-shaped product, wrong for a marketing page, which would otherwise
  // render as a narrow column on a laptop (src/index.css .landing).
  useEffect(() => {
    const root = document.getElementById('root');
    root?.classList.add('landing');
    const html = document.documentElement;
    const prev = html.style.scrollBehavior;
    // In-page anchors are the whole navigation here.
    html.style.scrollBehavior = 'smooth';
    return () => {
      root?.classList.remove('landing');
      html.style.scrollBehavior = prev;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    api.fetchPublicStats()
      .then(s => { if (alive) setStats(s); })
      // A failed counter is not a failed page: the cells keep their skeleton
      // rather than claiming five zeros under a heading that promises real
      // numbers.
      .catch(() => {})
      .finally(() => { if (alive) setStatsLoading(false); });
    return () => { alive = false; };
  }, []);

  const biz = useMemo(() => {
    const src = content?.business;
    if (!src) return null;
    return Object.fromEntries(
      Object.entries(src).map(([key, section]) => [key, resolve(section, lang)]),
    );
  }, [content, lang]);

  useEffect(() => {
    if (!biz) return;
    const line = [biz.hero?.line1, biz.hero?.line2, biz.hero?.line3, biz.hero?.line4]
      .filter(Boolean).join(' ');
    document.title = line ? `Jashmen — ${line}` : 'Jashmen';
  }, [biz]);

  // Jumping to one audience from the nav dropdown or the footer: select the
  // tab first, then bring the panel into view.
  const goto = useCallback(id => {
    setActiveSolution(id);
    document.getElementById('solutions')?.scrollIntoView({ block: 'start' });
  }, []);

  // Real logos, in the order that reads best: sponsors first (they have
  // artwork), then campuses with an uploaded logo, then the rest by name.
  const marks = useMemo(() => {
    const partners = (content?.partners || []).map(p => ({
      key: `p-${p.id}`, kind: 'partner',
      name: localizedText(p.name, lang) || '', logoUrl: p.logoUrl || '',
    }));
    const unis = (content?.universities || []).map(u => ({
      key: `u-${u.id}`, kind: 'uni',
      name: u.listName || localizedText(u.name, lang) || '', logoUrl: u.logoUrl || '',
    }));
    return [...partners, ...unis]
      .filter(m => m.name || m.logoUrl)
      .sort((a, b) => Number(!!b.logoUrl) - Number(!!a.logoUrl));
  }, [content, lang]);

  if (!biz) return <Splash />;

  const on = key => biz[key]?.enabled !== false;
  const tabs = biz.solutions?.items || [];
  const activeId = activeSolution || tabs[0]?.id;

  const STAT_CELLS = [
    { key: 'learners', icon: 'users', label: biz.stats?.learnersLabel },
    { key: 'lessons', icon: 'book', label: biz.stats?.lessonsLabel },
    { key: 'modules', icon: 'blocks', label: biz.stats?.modulesLabel },
    { key: 'universities', icon: 'cap', label: biz.stats?.universitiesLabel },
    { key: 'xp', icon: 'chart', label: biz.stats?.xpLabel },
  ];

  return (
    <div className="jb" lang={lang}>
      <BusinessSprite />

      <div className="jb-page">
        <Nav nav={biz.nav || {}} tabs={tabs} lang={lang} setLang={setLang} onGoto={goto} />

        <main>
          {on('hero') && <Hero hero={biz.hero} />}

          {on('strip') && (biz.strip.items || []).length > 0 && (
            <Reveal as="section" className="jb-strip jb-card" id="integration">
              {biz.strip.items.map(f => (
                <div className="jb-strip__item" key={f.id}>
                  <span className="jb-tile"><SlugIcon slug={f.icon} fallback="blocks" /></span>
                  {f.label}
                </div>
              ))}
            </Reveal>
          )}

          {on('trust') && <Trust trust={biz.trust} marks={marks} />}

          {on('why') && (
            <section className="jb-section" id="impact">
              <Reveal className="jb-section__head">
                <h2 className="jb-h2">{biz.why.title}</h2>
                <p className="jb-section__note">{biz.why.note}</p>
              </Reveal>
              <div className="jb-why">
                {(biz.why.items || []).map(c => (
                  <Reveal as="article" className="jb-why__card jb-card" key={c.id}>
                    <span className="jb-why__icon"><SlugIcon slug={c.icon} fallback="check" size={22} /></span>
                    <h3>{c.title}</h3>
                    <p>{c.text}</p>
                  </Reveal>
                ))}
              </div>
            </section>
          )}

          {on('solutions') && tabs.length > 0 && (
            <Solutions
              solutions={biz.solutions}
              activeId={activeId}
              setActiveId={setActiveSolution}
            />
          )}

          {on('stats') && (
            <section className="jb-section" id="product">
              <Reveal className="jb-section__head">
                <h2 className="jb-h2">{biz.stats.title}</h2>
                <p className="jb-section__note">{biz.stats.note}</p>
              </Reveal>
              <div className="jb-stats">
                {STAT_CELLS.map(cell => (
                  <StatCell
                    key={cell.key}
                    icon={cell.icon}
                    label={cell.label}
                    value={stats?.[cell.key]}
                    loading={statsLoading}
                  />
                ))}
              </div>
            </section>
          )}

          {on('cta') && (
            <Reveal as="section" className="jb-cta">
              <div className="jb-cta__content">
                <h2>
                  {biz.cta.line1 && <span>{biz.cta.line1}</span>}
                  {biz.cta.line2 && <span>{biz.cta.line2}</span>}
                </h2>
                <p>{biz.cta.text}</p>
              </div>
              <Fluid variant="jb-fluid-wrap--glow" />
              <img className="jb-cta__eagle" src={biz.cta.imageUrl || '/logo1.png'} alt="" aria-hidden="true" />
              <div className="jb-cta__action">
                <a className="jb-btn jb-btn--primary jb-btn--lg" href="#apply">
                  {biz.cta.button}
                  <span className="ico"><Ico id="arrow" /></span>
                </a>
              </div>
            </Reveal>
          )}

          {on('form') && (
            <section className="jb-section" id="apply">
              <Reveal className="jb-section__head">
                <h2 className="jb-h2">{biz.form.title}</h2>
                <p className="jb-section__note">{biz.form.note}</p>
              </Reveal>
              <Reveal>
                <ApplyForm form={biz.form} contactEmail={biz.footer?.email} />
              </Reveal>
            </section>
          )}
        </main>

        {on('footer') && <Footer footer={biz.footer} onGoto={goto} />}
      </div>
    </div>
  );
}
