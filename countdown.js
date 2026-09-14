// Shared live countdown for challenge end times. Ticks every 30s — plenty
// live-feeling for a multi-day window without redrawing needlessly.
function formatCountdown(endsAtIso) {
  const diffMs = new Date(endsAtIso).getTime() - Date.now();
  if (diffMs <= 0) return 'ended';
  const totalMinutes = Math.floor(diffMs / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return days + 'd ' + hours + 'h';
  if (hours > 0) return hours + 'h ' + minutes + 'm';
  return minutes + 'm';
}

function startCountdown(el, endsAtIso) {
  if (!el) return null;
  const tick = () => { el.textContent = formatCountdown(endsAtIso); };
  tick();
  return setInterval(tick, 30000);
}
