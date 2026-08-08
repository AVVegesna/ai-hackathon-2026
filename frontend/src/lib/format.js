// Formatting helpers. Timecodes always carry hours: a recording can run to
// eleven and a half hours, and the mockup's MM:SS rendered 690 minutes as
// "690:00".

export function timecode(totalSeconds) {
  if (totalSeconds == null || Number.isNaN(totalSeconds)) return '--:--:--';
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map((n) => String(n).padStart(2, '0')).join(':');
}

export function durationLabel(minutes) {
  if (minutes == null) return '—';
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

// SQLite hands back "YYYY-MM-DD HH:MM:SS" in UTC with no zone marker; Safari
// refuses to parse that form, so normalise it before constructing a Date.
export function parseDbDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  const iso = String(value).trim().replace(' ', 'T');
  const withZone = /[zZ]|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : `${iso}Z`;
  const d = new Date(withZone);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatDate(value) {
  const d = parseDbDate(value);
  if (!d) return '—';
  return d.toLocaleDateString('en-NZ', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateTime(value) {
  const d = parseDbDate(value);
  if (!d) return '—';
  return d.toLocaleString('en-NZ', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Deadline state drives both the label and the colour, so the two can never
// disagree. Returned tone is consumed by the .due element's data attributes.
export function dueState(dueAt) {
  const d = parseDbDate(dueAt);
  if (!d) return { label: 'No deadline', overdue: false, soon: false, days: null };

  const ms = d.getTime() - Date.now();
  const days = Math.round(ms / 86400000);

  if (ms < 0) {
    const overdueBy = Math.abs(days);
    return {
      label: overdueBy === 0 ? 'Overdue today' : `Overdue by ${overdueBy}d`,
      overdue: true,
      soon: false,
      days,
    };
  }
  return {
    label: days === 0 ? 'Due today' : `Due in ${days}d`,
    overdue: false,
    soon: days <= 2,
    days,
  };
}

export const SEVERITY_GLYPH = { High: '▲', Medium: '■', Low: '●' };

export function severityClass(severity) {
  const key = String(severity || '').toLowerCase();
  if (key === 'high') return 'badge-high';
  if (key === 'medium') return 'badge-medium';
  return 'badge-low';
}
