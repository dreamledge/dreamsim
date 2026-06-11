import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import audioManager from '../engine/audioManager';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await login(email, password);
      audioManager.play();
      navigate('/');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="h-screen w-screen fixed inset-0 flex items-center justify-center px-4 overflow-hidden"
      style={{backgroundImage: 'url(/landing-hero.png)', backgroundSize: 'cover', backgroundPosition: 'center'}}>
      <div className="absolute inset-0 bg-black/65 pointer-events-none" />
      <div className="w-full max-w-sm relative animate-fade-up">
        <div className="text-center mb-8">
          <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-[#ff7b35] to-[#e83a4b] flex items-center justify-center text-base font-bold font-display text-white shadow-xl shadow-[#ff7b35]/30 mb-4 animate-dribble relative overflow-hidden">
  <svg className="absolute inset-0 w-full h-full pointer-events-none z-0" viewBox="0 0 100 100">
    <line x1="50" y1="0" x2="50" y2="100" stroke="rgba(0,0,0,0.35)" strokeWidth="2.5" />
    <line x1="0" y1="50" x2="100" y2="50" stroke="rgba(0,0,0,0.35)" strokeWidth="2.5" />
    <path d="M 15 25 Q 50 40 85 25" fill="none" stroke="rgba(0,0,0,0.35)" strokeWidth="2.5" />
    <path d="M 15 75 Q 50 60 85 75" fill="none" stroke="rgba(0,0,0,0.35)" strokeWidth="2.5" />
    <path d="M 25 15 Q 40 50 25 85" fill="none" stroke="rgba(0,0,0,0.35)" strokeWidth="2.5" />
    <path d="M 75 15 Q 60 50 75 85" fill="none" stroke="rgba(0,0,0,0.35)" strokeWidth="2.5" />
  </svg>
  <div className="absolute inset-0 rounded-full z-0" style={{background: 'radial-gradient(circle at 30% 30%, transparent 30%, rgba(0,0,0,0.12) 80%)'}} />
  <span className="relative z-10">Dreamledge</span>
</div>
          <h1 className="font-display text-4xl tracking-wider text-white">Dynasty Sim</h1>
          <p className="text-[var(--text-secondary)] text-sm mt-1">Build your basketball legacy</p>
        </div>

        <form onSubmit={handleSubmit} className="glass-card p-6 space-y-4 animate-slide-up" style={{animationDelay: '0.15s'}}>
          <h2 className="font-display text-2xl tracking-wider text-center">Sign In</h2>
          {error && <p className="text-[var(--accent-red)] text-sm text-center bg-[var(--accent-red)]/10 rounded-lg py-2">{error}</p>}

          <div>
            <label className="text-xs text-[var(--text-secondary)] block mb-1.5 uppercase tracking-wider font-semibold">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-[var(--accent-orange)] focus:shadow-[0_0_0_3px_rgba(255,107,53,0.1)] transition-all placeholder:text-[var(--text-tertiary)]" placeholder="your@email.com" />
          </div>
          <div>
            <label className="text-xs text-[var(--text-secondary)] block mb-1.5 uppercase tracking-wider font-semibold">Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-[var(--accent-orange)] focus:shadow-[0_0_0_3px_rgba(255,107,53,0.1)] transition-all placeholder:text-[var(--text-tertiary)]" placeholder="Password" />
          </div>

          <button type="submit" className="btn-glow w-full py-2.5 text-sm tracking-wide">Sign In</button>

          <p className="text-center text-sm text-[var(--text-tertiary)]">
            No account? <Link to="/register" className="text-[var(--accent-orange)] hover:text-white transition-colors font-medium">Register</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
