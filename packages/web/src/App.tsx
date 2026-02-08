import { Routes, Route, NavLink } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Dashboard from './pages/Dashboard';
import Items from './pages/Items';

const NAV_ITEMS = [
  { path: '/', label: 'Dashboard', icon: '~' },
  { path: '/items', label: 'Items', icon: '#' },
];

export default function App() {
  const { user, loading, loginUrl, logout } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-accent animate-pulse text-2xl font-mono">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-8">
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold text-text-primary">My Service</h1>
            <p className="text-text-muted font-mono text-sm">Hono + Vite + SQLite</p>
          </div>
          <a
            href={loginUrl}
            className="inline-block px-8 py-3 bg-accent hover:bg-accent-light text-white text-sm tracking-wider transition-colors rounded"
          >
            Sign In
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <nav className="w-56 border-r border-border bg-surface-secondary flex flex-col">
        <div className="p-4 border-b border-border">
          <span className="font-semibold text-lg text-text-primary">My Service</span>
        </div>

        <div className="flex-1 py-2">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                  isActive
                    ? 'text-accent bg-accent/10 border-r-2 border-accent'
                    : 'text-text-secondary hover:text-text-primary hover:bg-surface-tertiary'
                }`
              }
            >
              <span className="w-5 text-center font-mono">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </div>

        <div className="p-4 border-t border-border">
          <div className="flex items-center gap-2 mb-2">
            {user.picture && (
              <img src={user.picture} alt="" className="w-6 h-6 rounded-full" />
            )}
            <span className="text-xs text-text-muted truncate">{user.email}</span>
          </div>
          <button
            onClick={logout}
            className="text-xs text-text-muted hover:text-text-secondary transition-colors"
          >
            Sign out
          </button>
        </div>
      </nav>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/items" element={<Items />} />
        </Routes>
      </main>
    </div>
  );
}
