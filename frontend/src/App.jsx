import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import LeagueList from './pages/LeagueList';
import LeagueDetail from './pages/LeagueDetail';
import CreateLeague from './pages/CreateLeague';
import TeamDetail from './pages/TeamDetail';
import CreateTeam from './pages/CreateTeam';
import Draft from './pages/Draft';
import SeasonView from './pages/SeasonView';
import Trades from './pages/Trades';
import TradeCenter from './pages/TradeCenter';
import Stats from './pages/Stats';
import Store from './pages/Store';
import NewsFeed from './pages/NewsFeed';
import LeagueNews from './pages/LeagueNews';
import LeagueDraft from './pages/LeagueDraft';
import Standings from './pages/Standings';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center min-h-screen bg-[#1a1a2e]"><div className="animate-spin h-8 w-8 border-4 border-[#e94560] border-t-transparent rounded-full" /></div>;
  if (!user) return <Navigate to="/login" />;
  return children;
}

export default function App() {
  return (
    <div className="min-h-screen bg-[#1a1a2e] text-white">
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/" element={<ProtectedRoute><Layout><Home /></Layout></ProtectedRoute>} />
        <Route path="/leagues" element={<ProtectedRoute><Layout><LeagueList /></Layout></ProtectedRoute>} />
        <Route path="/leagues/create" element={<ProtectedRoute><Layout><CreateLeague /></Layout></ProtectedRoute>} />
        <Route path="/leagues/:id" element={<ProtectedRoute><Layout><LeagueDetail /></Layout></ProtectedRoute>} />
        <Route path="/leagues/:id/standings" element={<ProtectedRoute><Layout><Standings /></Layout></ProtectedRoute>} />
        <Route path="/leagues/:leagueId/season/:seasonId" element={<ProtectedRoute><Layout><SeasonView /></Layout></ProtectedRoute>} />
        <Route path="/leagues/:leagueId/news" element={<ProtectedRoute><Layout><NewsFeed /></Layout></ProtectedRoute>} />
        <Route path="/leagues/:leagueId/draft" element={<ProtectedRoute><Layout><LeagueDraft /></Layout></ProtectedRoute>} />
        <Route path="/teams/create" element={<ProtectedRoute><Layout><CreateTeam /></Layout></ProtectedRoute>} />
        <Route path="/teams/:id" element={<ProtectedRoute><Layout><TeamDetail /></Layout></ProtectedRoute>} />
        <Route path="/draft" element={<ProtectedRoute><Layout><Draft /></Layout></ProtectedRoute>} />
        <Route path="/news" element={<ProtectedRoute><Layout><LeagueNews /></Layout></ProtectedRoute>} />
        <Route path="/trades" element={<ProtectedRoute><Layout><Trades /></Layout></ProtectedRoute>} />
        <Route path="/trades/:leagueId" element={<ProtectedRoute><Layout><TradeCenter /></Layout></ProtectedRoute>} />
        <Route path="/stats" element={<ProtectedRoute><Layout><Stats /></Layout></ProtectedRoute>} />
        <Route path="/store" element={<ProtectedRoute><Layout><Store /></Layout></ProtectedRoute>} />
      </Routes>
    </div>
  );
}
