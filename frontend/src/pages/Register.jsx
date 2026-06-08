import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Register() {
  const [form, setForm] = useState({ email: '', password: '', displayName: '' });
  const [error, setError] = useState('');
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await register(form.email, form.password, form.displayName);
      navigate('/');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="min-h-screen bg-[#1a1a2e] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <span className="text-6xl">🏀</span>
          <h1 className="text-2xl font-bold text-white mt-4">Join Dynasty League</h1>
        </div>
        <form onSubmit={handleSubmit} className="bg-[#16213e] rounded-xl p-6 space-y-4">
          <h2 className="text-lg font-semibold text-center">Create Account</h2>
          {error && <p className="text-red-400 text-sm text-center">{error}</p>}
          <div>
            <label className="text-sm text-gray-400 block mb-1">Display Name</label>
            <input type="text" value={form.displayName} onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))} className="w-full bg-[#1a1a2e] border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#e94560]" placeholder="Coach name" />
          </div>
          <div>
            <label className="text-sm text-gray-400 block mb-1">Email</label>
            <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="w-full bg-[#1a1a2e] border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#e94560]" placeholder="your@email.com" />
          </div>
          <div>
            <label className="text-sm text-gray-400 block mb-1">Password</label>
            <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} className="w-full bg-[#1a1a2e] border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#e94560]" placeholder="At least 6 characters" />
          </div>
          <button type="submit" className="w-full bg-[#e94560] text-white rounded-lg py-2.5 font-semibold hover:bg-[#d63851] transition">Create Account</button>
          <p className="text-center text-sm text-gray-500">Already have an account? <Link to="/login" className="text-[#e94560]">Sign In</Link></p>
        </form>
      </div>
    </div>
  );
}
