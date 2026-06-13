import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';

const Home = lazy(() => import('./pages/Home'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const LeagueList = lazy(() => import('./pages/LeagueList'));
const LeagueDetail = lazy(() => import('./pages/LeagueDetail'));
const CreateLeague = lazy(() => import('./pages/CreateLeague'));
const TeamDetail = lazy(() => import('./pages/TeamDetail'));
const CreateTeam = lazy(() => import('./pages/CreateTeam'));
const Draft = lazy(() => import('./pages/Draft'));
const SeasonView = lazy(() => import('./pages/SeasonView'));
const Trades = lazy(() => import('./pages/Trades'));
const TradeCenter = lazy(() => import('./pages/TradeCenter'));
const Stats = lazy(() => import('./pages/Stats'));
const Store = lazy(() => import('./pages/Store'));
const NewsFeed = lazy(() => import('./pages/NewsFeed'));
const LeagueNews = lazy(() => import('./pages/LeagueNews'));
const LeagueDraft = lazy(() => import('./pages/LeagueDraft'));
const Standings = lazy(() => import('./pages/Standings'));
const FreeAgents = lazy(() => import('./pages/FreeAgents'));

const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen bg-[#1a1a2e]">
    <div className="animate-spin h-8 w-8 border-4 border-[#e94560] border-t-transparent rounded-full" />
  </div>
);

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/login" />;
  return children;
}

export default function App() {
  return (
    <div className="min-h-screen bg-[#1a1a2e] text-white">
      <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/" element={<ProtectedRoute><Layout><Home /></Layout></ProtectedRoute>} />
        <Route path="/leagues" element={<ProtectedRoute><Layout><LeagueList /></Layout></ProtectedRoute>} />
        <Route path="/leagues/create" element={<ProtectedRoute><Layout><CreateLeague /></Layout></ProtectedRoute>} />
        <Route path="/leagues/:id" element={<ProtectedRoute><Layout><LeagueDetail /></Layout></ProtectedRoute>} />
        <Route path="/leagues/:id/freeagents" element={<ProtectedRoute><Layout><FreeAgents /></Layout></ProtectedRoute>} />
        <Route path="/leagues/:id/standings" element={<ProtectedRoute><Layout><Standings /></Layout></ProtectedRoute>} />
        <Route path="/leagues/:leagueId/season/:seasonId" element={<ProtectedRoute><Layout><SeasonView /></Layout></ProtectedRoute>} />
        <Route path="/leagues/:leagueId/news" element={<ProtectedRoute><Layout><NewsFeed /></Layout></ProtectedRoute>} />
        <Route path="/leagues/:id/draft" element={<ProtectedRoute><Layout><LeagueDraft /></Layout></ProtectedRoute>} />
        <Route path="/teams/create" element={<ProtectedRoute><Layout><CreateTeam /></Layout></ProtectedRoute>} />
        <Route path="/teams/:id" element={<ProtectedRoute><Layout><TeamDetail /></Layout></ProtectedRoute>} />
        <Route path="/draft" element={<ProtectedRoute><Layout><Draft /></Layout></ProtectedRoute>} />
        <Route path="/news" element={<ProtectedRoute><Layout><LeagueNews /></Layout></ProtectedRoute>} />
        <Route path="/trades" element={<ProtectedRoute><Layout><Trades /></Layout></ProtectedRoute>} />
        <Route path="/trades/:leagueId" element={<ProtectedRoute><Layout><TradeCenter /></Layout></ProtectedRoute>} />
        <Route path="/stats" element={<ProtectedRoute><Layout><Stats /></Layout></ProtectedRoute>} />
        <Route path="/store" element={<ProtectedRoute><Layout><Store /></Layout></ProtectedRoute>} />
      </Routes>
      </Suspense>
    </div>
  );
}
