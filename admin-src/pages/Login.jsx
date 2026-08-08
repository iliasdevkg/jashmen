import { useState } from 'react';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Lock } from 'lucide-react';
import { useAdminAuth } from '../store.jsx';

export default function Login() {
  const { login } = useAdminAuth();
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(password);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-6" style={{ background: '#0b1220' }}>
      <motion.div
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 22 }}
        className="flex flex-col items-center gap-3 mb-8"
      >
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(28,176,246,0.15)', border: '1.5px solid rgba(28,176,246,0.35)' }}>
          <Lock size={26} color="#1CB0F6" />
        </div>
        <div className="text-center">
          <h1 className="text-xl font-extrabold text-white">JashMen Админ</h1>
          <p className="text-slate-400 text-xs mt-1">Сабактар · Лигалар · Жетишкендиктер · Өнөктөштөр · Лимиттер · Аналитика</p>
        </div>
      </motion.div>

      <motion.form
        initial={{ y: 16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
        onSubmit={handleSubmit}
        className="w-full max-w-xs flex flex-col gap-3"
      >
        <div className="relative">
          <input
            type={showPw ? 'text' : 'password'}
            autoFocus
            placeholder="Админ сырсөзү"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            className="w-full px-4 py-3.5 pr-12 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-[#1CB0F6]"
            style={{ background: '#1e293b', border: '1.5px solid #334155' }}
          />
          <button
            type="button"
            onClick={() => setShowPw(v => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-500"
            tabIndex={-1}
          >
            {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>

        {error && <p className="text-red-400 text-xs text-center px-2">{error}</p>}

        <motion.button
          whileTap={{ scale: 0.97 }}
          type="submit"
          disabled={loading}
          className="w-full py-3.5 rounded-xl font-bold text-white text-sm disabled:opacity-60"
          style={{ background: '#1CB0F6' }}
        >
          {loading ? '...' : 'Кирүү'}
        </motion.button>
      </motion.form>
    </div>
  );
}
