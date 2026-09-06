// src/components/ZoomableImage.jsx — tap a picture, see the picture.
//
// Every image the admin uploads is content a learner may genuinely want to
// read: the fine print on a partner's voucher, the diagram inside a lesson,
// what the coffee actually looks like. In a card it is 96px tall and the
// answer is not in there. This puts it full-screen, and then lets it be
// pushed further.
//
// The extra zoom step is not a flourish here — index.html sets
// `user-scalable=no`, so the browser's own pinch is off across the whole
// app. Without this the full-screen view would be as far as anyone could
// ever magnify anything.
//
// The Flutter twin is mobile/lib/src/widgets/zoomable_image.dart, which
// gets pinch and pan from InteractiveViewer instead.
import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';
import { useI18n } from '../i18n.jsx';

/// How far the second step magnifies. Enough to read a code printed small
/// on a photo; not so far that a phone-sized picture turns to mush.
const ZOOM = 2.4;

const SPRING = { type: 'spring', stiffness: 320, damping: 32 };

function Viewer({ src, alt, caption, onClose }) {
  const { t } = useI18n();
  const still = useReducedMotion();
  const spring = still ? { duration: 0 } : SPRING;
  const [zoomed, setZoomed] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const imgRef = useRef(null);
  const closeRef = useRef(null);
  const drag = useRef(null);

  // Escape closes, and the page underneath must not scroll away behind the
  // overlay while it is open.
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  // Panning is bounded by how much of the image is actually off-screen, so
  // a drag can never fling the picture out of view and leave a black field.
  const clamp = useCallback((next) => {
    const el = imgRef.current;
    if (!el) return { x: 0, y: 0 };
    const maxX = Math.max(0, (el.clientWidth * ZOOM - el.clientWidth) / 2);
    const maxY = Math.max(0, (el.clientHeight * ZOOM - el.clientHeight) / 2);
    return {
      x: Math.min(maxX, Math.max(-maxX, next.x)),
      y: Math.min(maxY, Math.max(-maxY, next.y)),
    };
  }, []);

  function toggleZoom() {
    setZoomed(z => !z);
    setOffset({ x: 0, y: 0 });
  }

  function onPointerDown(e) {
    if (!zoomed) return;
    drag.current = { x: e.clientX, y: e.clientY, from: offset };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e) {
    const d = drag.current;
    if (!d) return;
    setOffset(clamp({ x: d.from.x + (e.clientX - d.x), y: d.from.y + (e.clientY - d.y) }));
  }

  function onPointerUp() { drag.current = null; }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: still ? 0 : 0.18 }}
      role="dialog"
      aria-modal="true"
      // Distinguishes this overlay from the app's other modals, which are
      // also role=dialog — the onboarding sheet, the redeemed-code dialog.
      data-zoom-viewer=""
      aria-label={alt || caption || t('common.zoomImage')}
      onClick={onClose}
      className="fixed inset-0 z-[120] flex flex-col items-center justify-center"
      style={{ background: 'rgba(2,6,23,0.94)', backdropFilter: 'blur(6px)' }}
    >
      <button
        ref={closeRef}
        type="button"
        onClick={onClose}
        aria-label={t('common.close')}
        className="absolute top-4 right-4 w-11 h-11 rounded-full grid place-items-center text-white/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
        style={{ background: 'rgba(255,255,255,0.12)' }}
      >
        <X size={22} />
      </button>

      <motion.img
        ref={imgRef}
        src={src}
        alt={alt || ''}
        draggable={false}
        initial={{ scale: 0.94, opacity: 0 }}
        animate={{ scale: zoomed ? ZOOM : 1, opacity: 1, x: offset.x, y: offset.y }}
        exit={{ scale: 0.94, opacity: 0 }}
        transition={drag.current ? { duration: 0 } : spring}
        // Stop the backdrop's close handler: a click on the picture is a
        // zoom, only a click on the empty space around it dismisses.
        onClick={(e) => { e.stopPropagation(); toggleZoom(); }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="select-none"
        style={{
          maxWidth: '92vw',
          maxHeight: caption ? '76dvh' : '84dvh',
          objectFit: 'contain',
          borderRadius: 12,
          cursor: zoomed ? 'grab' : 'zoom-in',
          touchAction: 'none',
        }}
      />

      {caption && (
        <p
          onClick={(e) => e.stopPropagation()}
          className="mt-4 px-6 text-sm leading-relaxed text-center max-w-[46rem]"
          style={{ color: 'rgba(255,255,255,0.82)' }}
        >
          {caption}
        </p>
      )}

      {!zoomed && (
        <p className="mt-3 text-[11.5px] font-semibold" style={{ color: 'rgba(255,255,255,0.45)' }}>
          {t('common.zoomHint')}
        </p>
      )}
    </motion.div>
  );
}

export default function ZoomableImage({ src, alt = '', caption, className = '', style, ...rest }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  if (!src) return null;

  return (
    <>
      <img
        {...rest}
        src={src}
        alt={alt}
        role="button"
        tabIndex={0}
        aria-label={alt ? `${alt} — ${t('common.zoomImage')}` : t('common.zoomImage')}
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(true); }
        }}
        className={className}
        style={{ cursor: 'zoom-in', ...style }}
      />
      {createPortal(
        <AnimatePresence>
          {open && (
            <Viewer key="viewer" src={src} alt={alt} caption={caption} onClose={() => setOpen(false)} />
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
}
