/** Pure presentation/formatting helpers for the Society UI. */

export function formatDatePtBr(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });
}

export const WEEKDAY_LABELS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

export function nextDateForWeekday(weekday) {
  if (weekday == null) return '';
  const today = new Date();
  const diff = (weekday - today.getDay() + 7) % 7 || 7;
  const d = new Date(today);
  d.setDate(today.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

export function money(n) {
  return (n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function gameLocationQuery(game) {
  if (game.locationLatitude != null && game.locationLongitude != null) return `${game.locationLatitude},${game.locationLongitude}`;
  return [game.local, game.locationAddress, game.locationCity, game.locationState].filter(Boolean).join(', ');
}

export function gameMapUrls(game) {
  const query = gameLocationQuery(game);
  if (!query) return { google: null, waze: null };
  const encoded = encodeURIComponent(query);
  return {
    google: `https://www.google.com/maps/dir/?api=1&destination=${encoded}`,
    waze: game.locationLatitude != null && game.locationLongitude != null
      ? `https://www.waze.com/ul?ll=${encoded}&navigate=yes`
      : `https://www.waze.com/ul?q=${encoded}&navigate=yes`,
  };
}
