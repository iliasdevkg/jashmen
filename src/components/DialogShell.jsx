// Shared modal shell — extracted from UniLeague.jsx once a third and fourth
// dialog (password change, the university-league support sheets) needed the
// exact same behaviour. The content blurs back behind a scrim and the panel
// scales in: blur rather than a plain dim because what's underneath stays
// recognisable, so you can see you haven't left the screen.
import { useEffect } from 'react';
import { motion } from 'framer-motion';

export const SPRING = { type: 'spring', stiffness: 300, damping: 30 };

export default function DialogShell({ onDismiss, bright, children, labelledBy, maxWidth = 380 }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onDismiss(); };
    window.addEventListener('keydown', onKey);
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [onDismiss]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      onClick={onDismiss}
      className="fixed inset-0 z-50 flex items-center justify-center px-5"
      style={{
        background: bright ? 'rgba(51,65,85,0.55)' : 'rgba(5,8,16,0.68)',
        backdropFilter: 'blur(9px)',
        WebkitBackdropFilter: 'blur(9px)',
      }}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={SPRING}
        onClick={(e) => e.stopPropagation()}
        className="w-full rounded-[18px] overflow-hidden"
        style={{
          maxWidth,
          maxHeight: '82vh',
          background: bright
            ? 'linear-gradient(180deg,#f5f9ff 0%,#eaf2fe 100%)'
            : 'linear-gradient(180deg,#0e1b33 0%,#0a1223 100%)',
          border: `1px solid ${bright ? '#bfdbfe' : '#1d3358'}`,
          boxShadow: bright
            ? '0 18px 40px rgba(15,23,42,0.18)'
            : '0 18px 40px rgba(0,0,0,0.5)',
        }}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

// Bottom-sheet variant — same scrim, but the panel rises from the bottom
// edge with a grab handle. Used where the dialog is about one row you just
// tapped in a list (the university league's support sheet): rising from
// under the list keeps the connection to what you touched, which a centred
// panel loses.
export function BottomSheet({ onDismiss, bright, children, labelledBy }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onDismiss(); };
    window.addEventListener('keydown', onKey);
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [onDismiss]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      onClick={onDismiss}
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{
        background: bright ? 'rgba(51,65,85,0.5)' : 'rgba(5,8,16,0.66)',
        backdropFilter: 'blur(7px)',
        WebkitBackdropFilter: 'blur(7px)',
      }}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 340, damping: 34 }}
        onClick={(e) => e.stopPropagation()}
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.4 }}
        onDragEnd={(_, info) => { if (info.offset.y > 90) onDismiss(); }}
        className="w-full rounded-t-[22px] overflow-hidden"
        style={{
          maxWidth: 480,
          maxHeight: '80vh',
          background: bright
            ? 'linear-gradient(180deg,#f8fbff 0%,#eef4fd 100%)'
            : 'linear-gradient(180deg,#111f3a 0%,#0a1224 100%)',
          borderTop: `1px solid ${bright ? '#cbd5e1' : '#1d3358'}`,
          boxShadow: bright ? '0 -14px 40px rgba(15,23,42,0.2)' : '0 -14px 40px rgba(0,0,0,0.6)',
        }}
      >
        <div className="flex justify-center pt-2.5 pb-1">
          <div
            className="h-1 w-10 rounded-full"
            style={{ background: bright ? '#cbd5e1' : '#33415580' }}
          />
        </div>
        {children}
      </motion.div>
    </motion.div>
  );
}
