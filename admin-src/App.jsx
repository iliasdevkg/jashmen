import { AdminAuthProvider, useAdminAuth } from './store.jsx';
import Login from './pages/Login.jsx';
import Shell from './components/Shell.jsx';

function Gate() {
  const { token, loading } = useAdminAuth();
  // Session restore (silent refresh via the httpOnly cookie) is async now
  // — nothing to show until it settles, otherwise a reload would flash
  // the login screen even for an admin with a live session.
  if (loading) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0b1220' }}>
        <img src="/logo.png" alt="" style={{ width: 64, height: 64, borderRadius: 16, objectFit: 'cover' }} className="animate-pulse" />
      </div>
    );
  }
  return token ? <Shell /> : <Login />;
}

export default function App() {
  return (
    <AdminAuthProvider>
      <Gate />
    </AdminAuthProvider>
  );
}
