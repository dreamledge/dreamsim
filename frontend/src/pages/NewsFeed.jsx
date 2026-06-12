import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getDocs, query, orderBy, limit, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { leagueDoc, leagueNewsCol } from '../lib/firestore';
import { checkAndGenerateNews, generateLeagueNews } from '../engine/newsEngine';

const TYPE_ACCENTS = {
  news: 'var(--accent-orange)',
  rumor: 'var(--accent-yellow)',
  satire: '#c084fc',
  podcast: 'var(--accent-blue)',
  social: '#22d3ee',
  locker_room: '#4ade80',
};

const TYPE_BADGES = {
  rumor: { label: 'RUMOR', style: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
  satire: { label: 'SATIRE', style: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
  news: null,
  podcast: null,
  social: null,
  locker_room: null,
};

const TYPE_BORDER = {
  news: '',
  rumor: 'border-dashed',
  satire: '',
  podcast: '',
  social: '',
  locker_room: '',
};

function NewsCard({ item, index }) {
  const accent = TYPE_ACCENTS[item.type] || 'var(--accent-orange)';
  const badge = TYPE_BADGES[item.type];
  const borderStyle = TYPE_BORDER[item.type];
  const paragraphs = (item.body || '').split('\n').filter(Boolean);

  if (item.type === 'news') {
    return (
      <div
        className="glass-card p-5 animate-fade-up border-l-4"
        style={{ borderLeftColor: accent, animationDelay: `${index * 0.05}s` }}
      >
        <div className="flex items-center gap-2 text-xs text-[var(--text-tertiary)] uppercase tracking-widest mb-2">
          <span className="font-semibold" style={{ color: accent }}>{item.publication}</span>
          {item.createdAt && <span>{new Date(item.createdAt).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</span>}
        </div>
        <h3 className="font-display text-xl font-bold leading-tight mb-1 text-white">{item.title}</h3>
        {item.subheadline && <p className="text-sm text-[var(--text-secondary)] mb-3 italic">{item.subheadline}</p>}
        <div className="space-y-2 text-sm text-[var(--text-secondary)] leading-relaxed">
          {paragraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
        {item.metadata?.homeScore !== undefined && item.metadata?.awayScore !== undefined && (
          <div className="mt-3 inline-flex items-center gap-3 rounded-lg bg-[var(--bg-secondary)] px-3 py-2 text-sm font-semibold">
            <span>{item.metadata.homeTeam}</span>
            <span className="text-xl tabular-nums" style={{ color: accent }}>{item.metadata.homeScore} &ndash; {item.metadata.awayScore}</span>
            <span>{item.metadata.awayTeam}</span>
          </div>
        )}
      </div>
    );
  }

  if (item.type === 'rumor') {
    return (
      <div
        className={`glass-card p-4 animate-fade-up border-l-4 ${borderStyle}`}
        style={{ borderLeftColor: accent, backgroundColor: 'rgba(250,204,21,0.03)', animationDelay: `${index * 0.05}s` }}
      >
        <div className="flex items-center gap-2 mb-2">
          {badge && <span className={`badge text-[10px] font-bold px-2 py-0.5 border ${badge.style}`}>{badge.label}</span>}
          <span className="text-[11px] text-[var(--text-tertiary)] uppercase tracking-wider">{item.publication}</span>
        </div>
        <h3 className="font-display font-bold text-base mb-1 text-white">{item.title}</h3>
        {item.subheadline && <p className="text-xs text-[var(--text-secondary)] mb-2">{item.subheadline}</p>}
        <div className="space-y-1 text-xs text-[var(--text-secondary)] leading-relaxed">
          {paragraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      </div>
    );
  }

  if (item.type === 'satire') {
    return (
      <div
        className="glass-card p-4 animate-fade-up border-l-4"
        style={{ borderLeftColor: accent, animationDelay: `${index * 0.05}s` }}
      >
        <div className="flex items-center gap-2 mb-2">
          {badge && <span className={`badge text-[10px] font-bold px-2 py-0.5 border ${badge.style}`}>{badge.label}</span>}
          <span className="text-[11px] text-[var(--text-tertiary)] uppercase tracking-wider">{item.publication}</span>
        </div>
        <h3 className="font-display font-bold text-base mb-1 text-white">{item.title}</h3>
        <div className="space-y-1 text-xs text-[var(--text-secondary)] leading-relaxed">
          {paragraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      </div>
    );
  }

  if (item.type === 'podcast') {
    return (
      <div
        className="glass-card p-4 animate-fade-up border-l-4"
        style={{ borderLeftColor: accent, animationDelay: `${index * 0.05}s` }}
      >
        <div className="flex items-center gap-2 mb-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/>
          </svg>
          <span className="text-[11px] text-[var(--text-tertiary)] uppercase tracking-wider">Hardwood Hot Takes</span>
          {item.createdAt && <span className="text-[10px] text-[var(--text-tertiary)]">{new Date(item.createdAt).toLocaleDateString()}</span>}
        </div>
        <h3 className="font-display font-bold text-base mb-1 text-white">{item.title}</h3>
        {item.subheadline && <p className="text-xs text-[var(--text-secondary)] mb-2">{item.subheadline}</p>}
        <div className="space-y-2 text-xs text-[var(--text-secondary)] leading-relaxed border-l-2 pl-3" style={{ borderLeftColor: accent }}>
          {paragraphs.map((p, i) => (
            <p key={i} className={p.startsWith('Host:') || p.startsWith('Analyst:') ? 'font-medium' : ''}>{p}</p>
          ))}
        </div>
      </div>
    );
  }

  if (item.type === 'social') {
    return (
      <div
        className="glass-card p-3 animate-fade-up border-l-4"
        style={{ borderLeftColor: accent, animationDelay: `${index * 0.05}s` }}
      >
        <div className="flex items-center gap-2 mb-1">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 3a10.9 10.9 0 0 1-3.14 1.53 4.48 4.48 0 0 0-7.86 3v1A10.66 10.66 0 0 1 3 4s-4 9 5 13a11.64 11.64 0 0 1-7 2c9 5 20 0 20-11.5a4.5 4.5 0 0 0-.08-.83A7.72 7.72 0 0 0 23 3z"/>
          </svg>
          <span className="text-[11px] text-[var(--text-tertiary)] uppercase tracking-wider">{item.publication}</span>
        </div>
        <p className="text-sm text-white leading-relaxed italic mb-1">&ldquo;{item.body}&rdquo;</p>
        {item.metadata?.author && <p className="text-[10px] text-[var(--text-tertiary)]">&mdash; {item.metadata.author}</p>}
      </div>
    );
  }

  if (item.type === 'locker_room') {
    return (
      <div
        className="glass-card p-4 animate-fade-up border-l-4"
        style={{ borderLeftColor: accent, animationDelay: `${index * 0.05}s` }}
      >
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[11px] text-[var(--text-tertiary)] uppercase tracking-wider">{item.publication}</span>
        </div>
        <h3 className="font-display font-bold text-base mb-1 text-white">{item.title}</h3>
        {item.subheadline && <p className="text-xs text-[var(--text-secondary)] mb-2">{item.subheadline}</p>}
        <div className="space-y-1 text-xs text-[var(--text-secondary)] italic leading-relaxed">
          {paragraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card p-4 animate-fade-up" style={{ animationDelay: `${index * 0.05}s` }}>
      <h3 className="font-semibold text-sm text-white">{item.title}</h3>
      <p className="text-sm text-[var(--text-secondary)] mt-1">{item.body}</p>
    </div>
  );
}

export default function NewsFeed() {
  const { leagueId } = useParams();
  const [news, setNews] = useState([]);
  const [leagueName, setLeagueName] = useState('');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const loadNews = async () => {
    const nSnap = await getDocs(query(leagueNewsCol(leagueId), orderBy('createdAt', 'desc'), limit(50)));
    setNews(nSnap.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  useEffect(() => {
    const init = async () => {
      const lSnap = await getDoc(leagueDoc(leagueId));
      if (lSnap.exists()) setLeagueName(lSnap.data().name);

      await checkAndGenerateNews(leagueId);
      await loadNews();
      setLoading(false);
    };
    init();
  }, [leagueId]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await generateLeagueNews(leagueId);
      await loadNews();
    } catch (e) {
      console.error('generate error:', e);
    } finally {
      setGenerating(false);
    }
  };

  const groupedByCycle = news.reduce((acc, item) => {
    const cycle = item.cycle || 0;
    if (!acc[cycle]) acc[cycle] = [];
    acc[cycle].push(item);
    return acc;
  }, {});

  const cycles = Object.keys(groupedByCycle).sort((a, b) => Number(b) - Number(a));

  if (loading) return (
    <div className="flex justify-center py-12">
      <div className="relative loader-2k" />
    </div>
  );

  return (
    <div className="space-y-4 stagger">
      <div className="flex items-center justify-between animate-fade-up">
        <div>
          <h2 className="font-display text-3xl tracking-wider">League News</h2>
          {leagueName && <p className="text-sm text-[var(--text-secondary)]">{leagueName}</p>}
        </div>
        <div className="flex items-center gap-3">
          <Link to={`/leagues/${leagueId}`} className="text-xs text-[var(--accent-orange)] font-medium hover:text-white transition-colors">← Back</Link>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="btn-glow text-xs px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {generating ? 'Generating...' : 'Generate News'}
          </button>
        </div>
      </div>

      {news.length === 0 ? (
        <div className="glass-card p-8 text-center animate-scale-in">
          <p className="text-[var(--text-secondary)]">No news yet. Click "Generate News" to create some.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {cycles.map((cycle) => (
            <div key={cycle}>
              <div className="flex items-center gap-3 mb-3">
                <div className="h-px flex-1 bg-[var(--border-subtle)]" />
                <span className="text-[10px] uppercase tracking-widest text-[var(--text-tertiary)] font-semibold">Cycle {cycle}</span>
                <div className="h-px flex-1 bg-[var(--border-subtle)]" />
              </div>
              <div className="space-y-3">
                {groupedByCycle[cycle].map((item, i) => (
                  <NewsCard key={item.id || `${cycle}-${i}`} item={item} index={i} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
