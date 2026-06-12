import { useState } from 'react';

const attrLabels = {
  shooting: 'SHO', playmaking: 'PLM', rebounding: 'RBD', athleticism: 'ATH',
};

export default function ScoutModal({ player, onDraft, onClose }) {
  const [confirming, setConfirming] = useState(false);

  if (!player) return null;

  const attrs = ['shooting', 'playmaking', 'rebounding', 'athleticism'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="relative glass-card max-w-lg w-full max-h-[90vh] overflow-y-auto animate-scale-in" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full bg-[var(--bg-tertiary)] hover:bg-[var(--bg-raised)] transition-colors text-[var(--text-tertiary)] hover:text-white z-10">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>

        <div className="bg-[var(--bg-secondary)] p-5 text-center border-b border-[var(--border-subtle)]">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#ff7b35] to-[#e83a4b] flex items-center justify-center text-2xl font-bold font-display text-white mx-auto mb-3 shadow-lg">
            {player.firstName?.[0]}{player.lastName?.[0]}
          </div>
          <h2 className="font-display text-xl tracking-wider">{player.firstName} {player.lastName}</h2>
          <div className="flex items-center justify-center gap-2 mt-1">
            <span className="text-xs bg-[var(--bg-card)] px-2 py-0.5 rounded text-[var(--text-secondary)]">{player.primaryPosition || player.position}</span>
            <span className="text-xs text-[var(--text-tertiary)]">{player.nbaTeam || player.nbaTeamName || 'Free Agent'}</span>
          </div>
          <div className="flex items-center justify-center gap-4 mt-3">
            <div className="rating-circle" style={{'--pct': `${player.overall || 50}%`}}>
              <span className="text-white text-sm font-bold">{player.overall || '-'}</span>
            </div>
            <div className="text-left text-xs text-[var(--text-tertiary)]">
              <div className="flex gap-2">
                <span>HT: {Math.floor((player.height || 78) / 12)}'{player.height % 12}"</span>
                <span>WT: {player.weight || '-'}lbs</span>
              </div>
              <div className="flex gap-2">
                <span>Age: {player.age}</span>
                <span>WS: {player.wingspan || '-'}in</span>
              </div>
            </div>
          </div>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {['offense', 'defense', ...attrs].map(attr => (
              <div key={attr} className="bg-[var(--bg-secondary)] rounded-xl p-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">{attrLabels[attr] || attr.slice(0, 3).toUpperCase()}</span>
                  <span className="text-xs font-bold font-display">{player[attr] || '-'}</span>
                </div>
                <div className="h-1.5 rounded-full bg-[var(--bg-primary)] overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-[var(--accent-orange)] to-[var(--accent-red)] transition-all duration-700" style={{width: `${player[attr] || 50}%`}} />
                </div>
              </div>
            ))}
          </div>

          <div className="bg-[var(--bg-secondary)] rounded-xl p-4">
            <h3 className="font-display text-xs tracking-wider text-[var(--text-tertiary)] uppercase mb-2">Per-Game Averages</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
              {[
                { label: 'PPG', value: player.statsPpg },
                { label: 'RPG', value: player.statsRpg },
                { label: 'APG', value: player.statsApg },
                { label: 'SPG', value: player.statsSpg },
              ].map(s => (
                <div key={s.label} className="bg-[var(--bg-primary)] rounded-lg py-2">
                  <p className="text-sm font-bold font-display">{s.value != null ? Number(s.value).toFixed(1) : '-'}</p>
                  <p className="text-[10px] text-[var(--text-tertiary)]">{s.label}</p>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2 text-center mt-2">
              {[
                { label: 'BPG', value: player.statsBpg },
                { label: 'FG%', value: player.statsFgPct },
                { label: '3P%', value: player.statsThreePct },
              ].map(s => (
                <div key={s.label} className="bg-[var(--bg-primary)] rounded-lg py-2">
                  <p className="text-sm font-bold font-display">{s.value != null ? (s.label.includes('%') ? (Number(s.value) * 100).toFixed(1) : Number(s.value).toFixed(1)) : '-'}</p>
                  <p className="text-[10px] text-[var(--text-tertiary)]">{s.label}</p>
                </div>
              ))}
            </div>
          </div>

          {player.college || player.country ? (
            <div className="flex gap-3 text-xs text-[var(--text-tertiary)]">
              {player.college && <span>College: {player.college}</span>}
              {player.country && <span>Country: {player.country}</span>}
            </div>
          ) : null}

          {!confirming ? (
            <button onClick={() => setConfirming(true)}
              className="btn-glow w-full py-3 text-sm">
              Draft This Player
            </button>
          ) : (
            <div className="space-y-2 animate-fade-up">
              <p className="text-xs text-center text-[var(--text-tertiary)]">Confirm you want to draft <span className="text-white font-medium">{player.firstName} {player.lastName}</span>?</p>
              <div className="flex gap-2">
                <button onClick={() => setConfirming(false)}
                  className="flex-1 py-2.5 rounded-xl bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors text-sm text-[var(--text-secondary)]">
                  Cancel
                </button>
                <button onClick={() => { onDraft(player); onClose(); }}
                  className="flex-1 py-2.5 rounded-xl bg-[var(--accent-gradient)] text-white text-sm font-medium transition-opacity hover:opacity-90">
                  Confirm Draft
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
