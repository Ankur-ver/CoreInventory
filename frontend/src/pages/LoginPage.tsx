// src/pages/LoginPage.tsx
import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('admin@coreinventory.com');
  const [password, setPassword] = useState('Admin@123');
  const [loading, setLoading] = useState(false);

  if (isAuthenticated) { navigate('/dashboard'); return null; }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      toast.success('Welcome back!');
      navigate('/dashboard');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Login failed';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center p-4">
      {/* Background grid */}
      <div className="absolute inset-0 pointer-events-none"
           style={{ backgroundImage: 'linear-gradient(#2A2E38 1px,transparent 1px),linear-gradient(90deg,#2A2E38 1px,transparent 1px)', backgroundSize: '40px 40px', opacity: 0.3 }} />

      <div className="relative w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
               style={{ background: 'linear-gradient(135deg,#4F8EF7,#7B5CEA)' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
              <path d="M20 7H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2zM4 5h16a1 1 0 011 1v1H3V6a1 1 0 011-1z"/>
            </svg>
          </div>
          <h1 className="font-head font-extrabold text-2xl text-text-primary tracking-tight">CoreInventory</h1>
          <p className="text-text-secondary text-sm mt-1">Inventory Management System</p>
        </div>

        {/* Card */}
        <div className="bg-bg-surface border border-border rounded-xl p-8">
          <h2 className="font-head font-bold text-lg text-text-primary mb-6">Sign in to your account</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Email address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                placeholder="you@company.com"
                required
                autoFocus
              />
            </div>

            <div>
              <label className="label">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
                placeholder="••••••••"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full justify-center mt-2 py-2.5"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
                  </svg>
                  Signing in…
                </span>
              ) : 'Sign in'}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-border">
            <p className="text-[11px] text-text-muted text-center mb-2">Demo credentials</p>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <button
                onClick={() => { setEmail('admin@coreinventory.com'); setPassword('Admin@123'); }}
                className="bg-bg-surface2 border border-border rounded px-2 py-1.5 text-text-secondary hover:text-text-primary hover:border-border-strong transition-colors text-center"
              >
                Admin account
              </button>
              <button
                onClick={() => { setEmail('sarah@coreinventory.com'); setPassword('Staff@123'); }}
                className="bg-bg-surface2 border border-border rounded px-2 py-1.5 text-text-secondary hover:text-text-primary hover:border-border-strong transition-colors text-center"
              >
                Staff account
              </button>
            </div>
          </div>
        </div>

        <p className="text-center text-[11px] text-text-muted mt-6">
          CoreInventory IMS &copy; {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
