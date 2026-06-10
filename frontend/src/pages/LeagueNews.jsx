import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getDocs, collection, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { teamsCol, leagueNewsCol } from '../lib/firestore';

const STORY_ICONS = {
  trade: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-orange)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>,
  injury: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>,
  freeagency: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>,
  rivalry: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m18 20-6-6-6 6"/><path d="m18 4-6 6-6-6"/></svg>,
  mvp: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
  championship: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 22V2h4v20"/></svg>,
  playoff: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>,
  general: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9h2"/><path d="M18 14h-8"/><path d="M15 18h-5"/><path d="M10 6h8v4h-8V6Z"/></svg>,
};

const STORY_LABELS = {
  trade: 'Trade',
  injury: 'Injury',
  freeagency: 'Free Agency',
  rivalry: 'Rivalry',
  mvp: 'MVP Race',
  championship: 'Championship',
  playoff: 'Playoffs',
  general: 'League News',
};

const MOCK_STORIES = [
  { storyType: 'trade', title: 'Blockbuster Trade: Star Guard on the Move', body: 'A three-team deal sends the all-star guard to Los Angeles in exchange for two first-round picks and a young forward. The trade is expected to reshape the playoff landscape.' },
  { storyType: 'injury', title: 'Star Player Sidelined with Knee Injury', body: 'The team\'s leading scorer is expected to miss 4-6 weeks after suffering an MCL sprain during last night\'s game. The medical staff is optimistic about a full recovery.' },
  { storyType: 'championship', title: 'Huskies Clinch Playoff Berth!', body: 'With an impressive 112-98 victory over the Titans, the Huskies have secured their spot in the postseason for the third consecutive year.' },
  { storyType: 'freeagency', title: 'Free Agent Market Heats Up', body: 'Multiple teams are preparing offers for the league\'s most coveted free agents as the July deadline approaches. Several max contracts are expected.' },
  { storyType: 'rivalry', title: 'Rivalry Game Ends in Dramatic Fashion', body: 'A buzzer-beater three-pointer seals the victory in the latest chapter of this heated rivalry. The crowd erupted as the shot swished through the net at the final horn.' },
  { storyType: 'mvp', title: 'MVP Race: Frontrunner Emerges', body: 'With back-to-back 40-point performances and a string of triple-doubles, the leading candidate has separated from the pack in the MVP race.' },
  { storyType: 'trade', title: 'Trade Deadline: Surprise Deal Shakes Up League', body: 'In a move that caught everyone off guard, a veteran star is headed to a new contender in exchange for a package of young talent and draft capital.' },
  { storyType: 'injury', title: 'Rookie Sensation Out with Ankle Injury', body: 'The promising rookie will miss at least two weeks after rolling his ankle in practice. The team will rely on bench depth to fill the gap.' },
  { storyType: 'playoff', title: 'Playoff Picture Takes Shape', body: 'As the regular season winds down, the playoff matchups are becoming clearer. Four teams have already clinched, while six spots remain up for grabs.' },
  { storyType: 'championship', title: 'Championship Glory: Dynasty in the Making', body: 'After an incredible championship run, questions arise whether this team can sustain their dominance and build a lasting dynasty for years to come.' },
];

export default function LeagueNews() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [leagues, setLeagues] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const [newsCache, setNewsCache] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      try {
        const teamSnap = await getDocs(query(teamsCol(), where('userId', '==', user.id)));
        const leagueIds = new Set(teamSnap.docs.map(d => d.data().leagueId));

        const commishSnap = await getDocs(query(collection(db, 'leagues'), where('commissionerId', '==', user.id)));
        commishSnap.docs.forEach(d => leagueIds.add(d.id));

        const allLeaguesSnap = await getDocs(collection(db, 'leagues'));
        const leagues = allLeaguesSnap.docs
          .filter(d => leagueIds.has(d.id))
          .map(d => ({ id: d.id, ...d.data() }));
        setLeagues(leagues);
      } catch (err) {
        console.error('LeagueNews load error:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user]);

  const loadLeagueNews = async (leagueId) => {
    if (newsCache[leagueId]) return;
    try {
      const nSnap = await getDocs(query(leagueNewsCol(leagueId), orderBy('createdAt', 'desc'), limit(10)));
      const real = nSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const mock = MOCK_STORIES.map((m, i) => ({
        id: `mock-${i}`,
        ...m,
        createdAt: new Date(Date.now() - i * 86400000 * 2).toISOString(),
      }));
      const merged = [...real];
      for (const m of mock) {
        if (!merged.some(item => item.title === m.title)) {
          merged.push(m);
        }
      }
      setNewsCache(prev => ({ ...prev, [leagueId]: merged.slice(0, 8) }));
    } catch (err) {
      console.error('loadLeagueNews error:', err);
      setNewsCache(prev => ({ ...prev, [leagueId]: [] }));
    }
  };

  const toggleExpand = (leagueId) => {
    if (expandedId === leagueId) {
      setExpandedId(null);
    } else {
      setExpandedId(leagueId);
      loadLeagueNews(leagueId);
    }
  };

  if (loading) return (
    <div className="flex justify-center py-12">
      <div className="relative loader-2k" />
    </div>
  );

  return (
    <div className="space-y-4 stagger">
      <div className="flex items-center justify-between animate-fade-up">
        <h2 className="font-display text-3xl tracking-wider">League News</h2>
      </div>

      {leagues.length === 0 ? (
        <div className="glass-card p-8 text-center animate-scale-in">
          <p className="text-[var(--text-secondary)]">No leagues yet. Create or join one!</p>
          <button onClick={() => navigate('/leagues/create')} className="btn-glow mt-4 px-5 py-2.5 text-sm inline-block">Create League</button>
        </div>
      ) : (
        <div className="space-y-2">
          {leagues.map((league, i) => {
            const isOpen = expandedId === league.id;
            const leagueNews = newsCache[league.id];
            return (
              <div key={league.id}
                className="glass-card overflow-hidden transition-all duration-300 animate-fade-up"
                style={{animationDelay: `${i * 0.06}s`}}>
                <button
                  onClick={() => toggleExpand(league.id)}
                  className="w-full p-4 flex items-center justify-between hover:bg-[var(--bg-tertiary)] transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#ff7b35] to-[#e83a4b] flex items-center justify-center text-sm font-bold font-display text-white shadow-sm shrink-0">
                      {league.name?.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm">{league.name}</h3>
                      <p className="text-xs text-[var(--text-tertiary)]">Season {league.currentSeason || 1} &middot; {teamCountText(league)}</p>
                    </div>
                  </div>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                    className={`text-[var(--text-tertiary)] transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </button>

                <div className={`transition-all duration-300 overflow-hidden ${isOpen ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'}`}>
                  <div className="px-4 pb-4 border-t border-[var(--border-subtle)] pt-3">
                    {!leagueNews ? (
                      <div className="flex justify-center py-4">
                        <div className="relative loader-2k" />
                      </div>
                    ) : leagueNews.length === 0 ? (
                      <p className="text-xs text-[var(--text-tertiary)] text-center py-4">No news yet.</p>
                    ) : (
                      <div className="space-y-1">
                        {leagueNews.map((item, ni) => (
                          <div key={item.id || ni}
                            className="flex items-start gap-3 py-2 px-2 rounded-lg hover:bg-[var(--bg-secondary)]/50 transition-colors cursor-default"
                          >
                            <div className="w-8 h-8 rounded-full bg-[var(--bg-secondary)] border border-[var(--border-subtle)] flex items-center justify-center shrink-0 mt-0.5">
                              {STORY_ICONS[item.storyType] || STORY_ICONS.general}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-medium text-white leading-snug">{item.title}</span>
                                <span className="badge bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] text-[10px] px-1.5 py-0.5 shrink-0">
                                  {STORY_LABELS[item.storyType] || 'General'}
                                </span>
                              </div>
                              <p className="text-xs text-[var(--text-tertiary)] mt-0.5 line-clamp-1">{item.body}</p>
                              <p className="text-[10px] text-[var(--text-tertiary)]/50 mt-0.5">
                                {item.createdAt ? new Date(item.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
                              </p>
                            </div>
                          </div>
                        ))}
                        <Link to={`/leagues/${league.id}/news`}
                          className="block text-xs text-[var(--accent-orange)] font-medium text-center pt-2 hover:text-white transition-colors">
                          View all news →
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function teamCountText(league) {
  if (!league.teamCount) return '';
  return `${league.teamCount} teams`;
}
