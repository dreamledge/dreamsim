import { useState, useEffect, useRef } from 'react';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const HOURS = Array.from({length: 12}, (_, i) => i + 1);
const MINUTES = Array.from({length: 60}, (_, i) => String(i).padStart(2, '0'));

export default function DraftDatePicker({ onSchedule }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [day, setDay] = useState(null);
  const [hour, setHour] = useState(12);
  const [minute, setMinute] = useState('00');
  const [ampm, setAmPm] = useState('PM');
  const [showTime, setShowTime] = useState(false);
  const panelRef = useRef(null);

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevDays = new Date(year, month, 0).getDate();

  const calendar = [];
  for (let i = firstDay - 1; i >= 0; i--) calendar.push({ day: prevDays - i, muted: true });
  for (let i = 1; i <= daysInMonth; i++) calendar.push({ day: i, muted: false });
  while (calendar.length % 7 !== 0) calendar.push({ day: calendar.length - daysInMonth - firstDay + 1, muted: true });

  const prevMonth = () => { if (month === 0) { setYear(y => y - 1); setMonth(11); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 11) { setYear(y => y + 1); setMonth(0); } else setMonth(m => m + 1); };

  const selectedDate = day ? new Date(year, month, day,
    ampm === 'PM' && hour !== 12 ? hour + 12 : ampm === 'AM' && hour === 12 ? 0 : hour,
    parseInt(minute)
  ) : null;

  const canSchedule = day !== null && selectedDate > new Date();

  const handleSchedule = () => {
    if (!canSchedule) return;
    onSchedule(selectedDate);
  };

  const today = new Date();
  const isToday = (d, m) => {
    const check = new Date(year, month, d);
    return check.toDateString() === today.toDateString();
  };
  const isPast = (d, m) => {
    const check = new Date(year, m !== undefined ? m : month, d);
    return check < new Date(today.getFullYear(), today.getMonth(), today.getDate());
  };

  return (
    <div className="glass-card overflow-hidden" ref={panelRef}>
      <div className="bg-[var(--bg-secondary)] px-4 pt-4 pb-3 border-b border-[var(--border-subtle)]">
        <h3 className="font-display text-sm tracking-wider text-center">Select Draft Date</h3>
      </div>

      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <button onClick={prevMonth} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors text-[var(--text-secondary)]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <div className="font-display text-base tracking-wider">{MONTHS[month]} {year}</div>
          <button onClick={nextMonth} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors text-[var(--text-secondary)]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>

        <div className="grid grid-cols-7 gap-0.5">
          {DAYS.map(d => (
            <div key={d} className="text-[10px] text-[var(--text-tertiary)] text-center font-semibold uppercase tracking-wider py-1">{d}</div>
          ))}
          {calendar.map((c, i) => (
            <button key={i}
              onClick={() => !c.muted && !isPast(c.day) && setDay(c.day)}
              disabled={c.muted || isPast(c.day)}
              className={`h-9 rounded-lg text-xs font-medium transition-all duration-150 ${
                c.muted ? 'text-[var(--text-tertiary)]/30' : 'text-[var(--text-secondary)]'
              } ${
                !c.muted && !isPast(c.day) ? 'hover:bg-[var(--bg-tertiary)] hover:text-white cursor-pointer' : 'cursor-default'
              } ${
                day === c.day && !c.muted ? 'bg-[var(--accent-gradient)] text-white shadow-lg shadow-[var(--accent-orange)]/20' : ''
              } ${
                isToday(c.day) && day !== c.day && !c.muted ? 'ring-1 ring-[var(--accent-orange)]/40' : ''
              }`}
            >
              {c.day}
            </button>
          ))}
        </div>
      </div>

      <div className="border-t border-[var(--border-subtle)]" />

      <button
        onClick={() => setShowTime(!showTime)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-[var(--bg-secondary)] transition-colors text-sm"
      >
        <span className="text-[var(--text-secondary)]">
          {selectedDate && day
            ? selectedDate.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
            : 'Select date first'
          }
        </span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          className={`text-[var(--text-tertiary)] transition-transform ${showTime ? 'rotate-180' : ''}`}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {showTime && (
        <div className="px-4 pb-4 flex items-center gap-2 animate-fade-up">
          <div className="flex-1 relative">
            <select value={hour} onChange={e => setHour(Number(e.target.value))}
              className="w-full bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-lg px-3 py-2 text-white text-sm appearance-none cursor-pointer focus:outline-none focus:border-[var(--accent-orange)] transition-colors">
              {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
            </select>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] pointer-events-none"><polyline points="6 9 12 15 18 9"/></svg>
          </div>
          <span className="text-[var(--text-tertiary)] text-sm font-medium">:</span>
          <div className="flex-1 relative">
            <select value={minute} onChange={e => setMinute(e.target.value)}
              className="w-full bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-lg px-3 py-2 text-white text-sm appearance-none cursor-pointer focus:outline-none focus:border-[var(--accent-orange)] transition-colors">
              {MINUTES.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] pointer-events-none"><polyline points="6 9 12 15 18 9"/></svg>
          </div>
          <div className="flex-[0.8] flex gap-1">
            <button onClick={() => setAmPm('AM')}
              className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
                ampm === 'AM' ? 'bg-[var(--accent-orange)] text-white' : 'bg-[var(--bg-secondary)] text-[var(--text-tertiary)] hover:text-white'
              }`}>
              AM
            </button>
            <button onClick={() => setAmPm('PM')}
              className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
                ampm === 'PM' ? 'bg-[var(--accent-orange)] text-white' : 'bg-[var(--bg-secondary)] text-[var(--text-tertiary)] hover:text-white'
              }`}>
              PM
            </button>
          </div>
        </div>
      )}

      <div className="px-4 pb-4">
        {!canSchedule && day && (
          <p className="text-[10px] text-[var(--accent-red)] text-center mb-2">Must be a future date &amp; time</p>
        )}
        <button onClick={handleSchedule} disabled={!canSchedule}
          className="btn-glow w-full py-2.5 text-sm disabled:opacity-50">
          Confirm Draft Schedule
        </button>
      </div>
    </div>
  );
}
