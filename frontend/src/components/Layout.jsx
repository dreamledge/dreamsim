import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const navItems = [
  { to: '/', label: 'Home', icon: '🏠' },
  { to: '/leagues', label: 'Leagues', icon: '🏆' },
  { to: '/stats', label: 'Stats', icon: '📊' },
  { to: '/store', label: 'Store', icon: '🛒' },
  { to: '/trades', label: 'Trades', icon: '🤝' },
];

export default function Layout({ children }) {
  const { user, logout } = useAuth();

  return (
    <div className="flex flex-col min-h-screen pb-20">
      <header className="bg-[#16213e] border-b border-gray-800 px-4 py-3 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🏀</span>
          <h1 className="text-lg font-bold text-white">Dynasty League</h1>
        </div>
        <div className="flex items-center gap-3">
          {user?.isPremium ? (
            <span className="text-xs bg-yellow-500 text-black px-2 py-0.5 rounded-full font-bold">PREMIUM</span>
          ) : null}
          <span className="text-sm text-gray-400">{user?.displayName || user?.username}</span>
          <button onClick={logout} className="text-xs text-gray-500 hover:text-white">Exit</button>
        </div>
      </header>

      <main className="flex-1 px-4 py-4 max-w-lg mx-auto w-full">
        {children}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-[#16213e] border-t border-gray-800 z-50">
        <div className="max-w-lg mx-auto flex justify-around py-2">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex flex-col items-center px-3 py-1 text-xs ${isActive ? 'text-[#e94560]' : 'text-gray-500'}`
              }
            >
              <span className="text-lg">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
