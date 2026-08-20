'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import {
  Users, CalendarDays, Trophy, Shuffle, Wallet, Share2, Plus, Check,
  Star, ChevronLeft, Trash2, Loader2, Target, Award, LogOut, LogIn, Hand,
  Handshake, Shield, MessageCircle
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

// ---------- helpers ----------

const POSITION_LABELS = { goleiro: 'Goleiro', fixo: 'Fixo', libero: 'Líbero', meio: 'Meio', ala_esquerdo: 'Ala Esquerdo', ala_direito: 'Ala Direito', pivo: 'Pivô' };
const POSITION_ORDER = ['goleiro', 'fixo', 'libero', 'meio', 'ala_esquerdo', 'ala_direito', 'pivo'];

function isGoleiro(p) {
  return Array.isArray(p.positions) && p.positions.includes('goleiro');
}

// combines weight + age deviation from a "typical" player into one number,
// used only to break near-ties in the rating balance so the draw doesn't
// accidentally stack every heavy/young player on the same side.
function physicalScore(p) {
  let score = 0;
  if (p.weight_kg) score += (p.weight_kg - 75) / 10;
  if (p.age) score += (p.age - 30) / 10;
  return score;
}

function playerMeta(p) {
  const bits = [];
  if (Array.isArray(p.positions) && p.positions.length > 0) bits.push(p.positions.map((pos) => POSITION_LABELS[pos] || pos).join(' / '));
  if (p.age) bits.push(`${p.age} anos`);
  if (p.weight_kg) bits.push(`${p.weight_kg}kg`);
  return bits.join(' · ');
}

// distributes goalkeepers one per team first (so the draw doesn't stack both GKs
// on the same side), then balances everyone else by rating with a snake draft;
// weight/age only break near-ties so physical profile doesn't stack on one side.
function drawTeams(confirmedPlayers) {
  const goleiros = confirmedPlayers.filter(isGoleiro);
  const linha = confirmedPlayers.filter((p) => !isGoleiro(p));

  let teamA = [], teamB = [], sumA = 0, sumB = 0, physA = 0, physB = 0;

  const place = (p) => {
    const rating = p.rating || 3;
    const phys = physicalScore(p);
    const ratingGap = sumA - sumB;
    const goToA = Math.abs(ratingGap) > 0.75 ? ratingGap <= 0 : physA <= physB;
    if (goToA) { teamA.push(p); sumA += rating; physA += phys; }
    else { teamB.push(p); sumB += rating; physB += phys; }
  };

  [...goleiros].sort((a, b) => (b.rating || 3) - (a.rating || 3)).forEach((p) => place(p));

  const noisy = linha.map((p) => ({ ...p, _r: (p.rating || 3) + Math.random() * 0.5 }));
  noisy.sort((a, b) => b._r - a._r);
  noisy.forEach((p) => {
    const { _r, ...clean } = p;
    place(clean);
  });
  return { teamA, teamB };
}

function avgRatingFor(game, playerId) {
  const ratings = game.ratings || {};
  let sum = 0, count = 0;
  Object.values(ratings).forEach((raterMap) => {
    if (raterMap && raterMap[playerId] != null) { sum += raterMap[playerId]; count += 1; }
  });
  return count > 0 ? sum / count : null;
}

function computeGameDestaques(game) {
  if (!game.result) return null;
  const all = [...(game.teamA || []), ...(game.teamB || [])];
  const scorers = game.result.scorers || {};
  const assists = game.assists || {};
  const idsA = (game.teamA || []).map((p) => p.id);
  const idsB = (game.teamB || []).map((p) => p.id);

  let mvp = null, mvpAvg = -1, mvpVotes = 0;
  all.forEach((p) => {
    const avg = avgRatingFor(game, p.id);
    if (avg != null && avg > mvpAvg) {
      mvpAvg = avg; mvp = p;
      mvpVotes = Object.values(game.ratings || {}).filter((r) => r[p.id] != null).length;
    }
  });

  let artilheiro = null, maxGoals = 0;
  all.forEach((p) => {
    const gl = scorers[p.id] || 0;
    if (gl > maxGoals) { maxGoals = gl; artilheiro = p; }
  });

  let passador = null, maxAssists = 0;
  all.forEach((p) => {
    const as = assists[p.id] || 0;
    if (as > maxAssists) { maxAssists = as; passador = p; }
  });

  // muro: goalkeeper on the team that conceded the fewest goals
  let muro = null, muroConceded = null;
  const gkA = (game.teamA || []).find(isGoleiro);
  const gkB = (game.teamB || []).find(isGoleiro);
  if (gkA) { muro = gkA; muroConceded = game.result.scoreB; }
  if (gkB && (muroConceded == null || game.result.scoreA < muroConceded)) { muro = gkB; muroConceded = game.result.scoreA; }

  return { mvp, mvpAvg, mvpVotes, artilheiro, maxGoals, passador, maxAssists, muro, muroConceded };
}

function computeRanking(profiles, games) {
  const stats = {};
  profiles.forEach((p) => { stats[p.id] = { id: p.id, name: p.name, jogos: 0, vit: 0, emp: 0, der: 0, gols: 0, assistencias: 0, pontos: 0, notaSum: 0, notaCount: 0, mvps: 0, muros: 0 }; });
  const finalizadas = games.filter((g) => g.result);
  finalizadas.forEach((g) => {
    const { scoreA, scoreB } = g.result;
    const idsA = (g.teamA || []).map((p) => p.id);
    const idsB = (g.teamB || []).map((p) => p.id);
    [...idsA, ...idsB].forEach((id) => {
      if (!stats[id]) return;
      stats[id].jogos += 1;
      const inA = idsA.includes(id);
      if (scoreA === scoreB) { stats[id].emp += 1; stats[id].pontos += 1; }
      else if ((inA && scoreA > scoreB) || (!inA && scoreB > scoreA)) { stats[id].vit += 1; stats[id].pontos += 3; }
      else { stats[id].der += 1; }
    });
    Object.entries(g.scorers || {}).forEach(([id, n]) => { if (stats[id] && n) stats[id].gols += n; });
    Object.entries(g.assists || {}).forEach(([id, n]) => { if (stats[id] && n) stats[id].assistencias += n; });
    Object.values(g.ratings || {}).forEach((raterMap) => {
      Object.entries(raterMap || {}).forEach(([id, score]) => {
        if (stats[id] && score != null) { stats[id].notaSum += score; stats[id].notaCount += 1; }
      });
    });
    const destaques = computeGameDestaques(g);
    if (destaques?.mvp && stats[destaques.mvp.id]) stats[destaques.mvp.id].mvps += 1;
    if (destaques?.muro && stats[destaques.muro.id]) stats[destaques.muro.id].muros += 1;
  });
  const totalFinalizadas = finalizadas.length;
  return Object.values(stats)
    .map((s) => ({
      ...s,
      nota: s.notaCount > 0 ? s.notaSum / s.notaCount : null,
      presencaPct: totalFinalizadas > 0 ? Math.round((s.jogos / totalFinalizadas) * 100) : null,
    }))
    .sort((a, b) => b.pontos - a.pontos || b.gols - a.gols || b.vit - a.vit);
}

function formatDatePtBr(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });
}

function money(n) {
  return (n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// ---------- pix "copia e cola" generator (BR Code / EMV standard, no gateway needed) ----------

function crc16(payload) {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1);
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function tlv(id, value) {
  const len = value.length.toString().padStart(2, '0');
  return `${id}${len}${value}`;
}

// strip accents / non-ascii and clamp length — required by the BR Code spec
function pixSanitize(str, maxLen) {
  const clean = (str || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9 ]/g, '')
    .trim();
  return (clean || 'NA').slice(0, maxLen);
}

function generatePixCode({ key, receiverName, city, amount, txid }) {
  if (!key) return null;
  const merchantAccount = tlv('00', 'br.gov.bcb.pix') + tlv('01', key.trim());
  const additionalData = tlv('05', pixSanitize(txid || '***', 25));
  let payload =
    tlv('00', '01') +
    tlv('26', merchantAccount) +
    tlv('52', '0000') +
    tlv('53', '986') +
    (amount > 0 ? tlv('54', amount.toFixed(2)) : '') +
    tlv('58', 'BR') +
    tlv('59', pixSanitize(receiverName, 25)) +
    tlv('60', pixSanitize(city || 'BRASIL', 15)) +
    tlv('62', additionalData);
  payload += '6304';
  return payload + crc16(payload);
}

// identifies which kind of Pix key was entered, just to label it clearly in the UI
function pixKeyType(key) {
  if (!key) return null;
  const k = key.trim();
  if (/^\+55\d{10,11}$/.test(k)) return 'Telefone';
  if (/^\d{11}$/.test(k)) return 'CPF';
  if (/^\d{14}$/.test(k)) return 'CNPJ';
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(k)) return 'E-mail';
  if (/^[0-9a-fA-F-]{32,36}$/.test(k)) return 'Chave aleatória';
  return 'Chave Pix';
}

// a bare 11-digit number is ambiguous between CPF and a Brazilian phone
// (both have 11 digits) — phone keys are only valid with the +55 country code,
// so we warn instead of guessing wrong.
function pixKeyWarning(key) {
  if (!key) return null;
  const k = key.trim();
  if (/^\d{10,11}$/.test(k)) {
    return 'Se isso for um telefone, precisa começar com +55 (ex: +5551999998888) — só números o Pix não reconhece como telefone.';
  }
  return null;
}



function StarRating({ value, onChange, size = 16, readOnly = false }) {
  return (
    <div className="sf-stars">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          size={size}
          fill={n <= value ? '#FFC53D' : 'none'}
          color={n <= value ? '#FFC53D' : '#5C7A67'}
          onClick={readOnly ? undefined : () => onChange(n)}
          style={{ cursor: readOnly ? 'default' : 'pointer' }}
        />
      ))}
    </div>
  );
}

function PitchView({ teamA, teamB }) {
  const rows = (n) => {
    if (n <= 0) return [];
    if (n <= 3) return [n];
    if (n <= 6) return [Math.ceil(n / 2), Math.floor(n / 2)];
    const r1 = Math.ceil(n / 3);
    const r2 = Math.ceil((n - r1) / 2);
    return [r1, r2, n - r1 - r2];
  };
  const layout = (team, mirrored) => {
    const rw = rows(team.length);
    const positions = [];
    let idx = 0;
    const rowCount = rw.length;
    rw.forEach((count, rIdx) => {
      let yPct = rowCount === 1 ? 50 : 18 + (rIdx * (64 / (rowCount - 1)));
      if (mirrored) yPct = 100 - yPct;
      for (let c = 0; c < count; c++) {
        const xPct = count === 1 ? 50 : 12 + (c * (76 / (count - 1)));
        positions.push({ player: team[idx], x: xPct, y: yPct });
        idx++;
      }
    });
    return positions;
  };
  const posA = layout(teamA, false);
  const posB = layout(teamB, true);
  const H = 380, W = 260;
  const Marker = ({ p, x, y, color }) => {
    const isGK = isGoleiro(p);
    return (
      <g transform={`translate(${(x / 100) * W}, ${(y / 100) * H})`}>
        <circle r="15" fill={color} stroke={isGK ? '#FFC53D' : '#0B2417'} strokeWidth={isGK ? '3' : '2'} />
        <text textAnchor="middle" dy="5" fontSize="12" fontWeight="700" fill="#0B2417" fontFamily="Inter, sans-serif">
          {(p.name || '?').trim().slice(0, 2).toUpperCase()}
        </text>
      </g>
    );
  };
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: 340, display: 'block', margin: '0 auto' }}>
      <rect x="4" y="4" width={W - 8} height={H - 8} rx="6" fill="#153A24" stroke="rgba(237,246,238,0.25)" strokeWidth="2" />
      <line x1="4" y1={H / 2} x2={W - 4} y2={H / 2} stroke="rgba(237,246,238,0.25)" strokeWidth="1.5" />
      <circle cx={W / 2} cy={H / 2} r="34" fill="none" stroke="rgba(237,246,238,0.25)" strokeWidth="1.5" />
      <rect x={W / 2 - 45} y="4" width="90" height="34" fill="none" stroke="rgba(237,246,238,0.25)" strokeWidth="1.5" />
      <rect x={W / 2 - 45} y={H - 38} width="90" height="34" fill="none" stroke="rgba(237,246,238,0.25)" strokeWidth="1.5" />
      {posA.map((pp, i) => <Marker key={'a' + i} p={pp.player} x={pp.x} y={pp.y} color="#FF5C5C" />)}
      {posB.map((pp, i) => <Marker key={'b' + i} p={pp.player} x={pp.x} y={pp.y} color="#4FC3F7" />)}
    </svg>
  );
}

// ---------- login ----------

function LoginScreen() {
  const signIn = () => {
    // keep the invite link working across the OAuth round trip: stash it now,
    // and also pass it through the redirect URL as a backup
    const joinToken = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('join') : null;
    if (joinToken && typeof window !== 'undefined') sessionStorage.setItem('sf_join_token', joinToken);
    const redirectTo = typeof window !== 'undefined'
      ? window.location.origin + (joinToken ? `/?join=${joinToken}` : '')
      : undefined;
    supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } });
  };
  return (
    <div className="sf-app sf-login">
      <style>{CSS}</style>
      <div className="sf-login-box">
        <div className="sf-wordmark">SOCIETY<span className="sf-wordmark-dot">.</span></div>
        <div className="sf-tagline">seu futebol, organizado</div>
        <p className="sf-login-copy">Entre com sua conta Google pra confirmar presença, sortear times e avaliar a galera.</p>
        <button className="sf-btn-primary sf-btn-google" onClick={signIn}>
          <LogIn size={18} /> Entrar com Google
        </button>
      </div>
    </div>
  );
}

// ---------- evaluation (peer ratings) ----------

function EvaluationSection({ game, myId, onSaveRatings }) {
  const allPlayers = [...(game.teamA || []), ...(game.teamB || [])];
  const others = allPlayers.filter((p) => p.id !== myId);
  const [draft, setDraft] = useState(() => game.ratings?.[myId] || {});
  const already = !!game.ratings?.[myId];

  if (!allPlayers.some((p) => p.id === myId)) return null; // only players in this game can rate

  const setScore = (playerId, score) => setDraft((d) => ({ ...d, [playerId]: score }));

  return (
    <section className="sf-card">
      <div className="sf-card-title"><Star size={16} /> Avaliação da galera</div>
      <div className="sf-card-subtitle">
        {already ? 'Suas notas (ajuste e salve de novo se quiser):' : 'Dê uma nota pros seus parceiros de hoje:'}
      </div>
      <div className="sf-eval-list">
        {others.map((p) => (
          <div key={p.id} className="sf-eval-row">
            <span>{p.name}</span>
            <StarRating value={draft[p.id] || 0} onChange={(n) => setScore(p.id, n)} size={18} />
          </div>
        ))}
      </div>
      <button className="sf-btn-primary" onClick={() => onSaveRatings(game.id, draft)}>
        <Check size={16} /> Salvar avaliação
      </button>
    </section>
  );
}

// ---------- my profile card (positions I play) ----------

function MyProfileCard({ me, onUpdate }) {
  const positions = Array.isArray(me.positions) ? me.positions : [];
  const [weightDraft, setWeightDraft] = useState(me.weight_kg || '');
  const [ageDraft, setAgeDraft] = useState(me.age || '');
  const [phoneDraft, setPhoneDraft] = useState(me.phone || '');
  const [pixDraft, setPixDraft] = useState(me.pix_key || '');

  const togglePosition = (pos) => {
    const next = positions.includes(pos) ? positions.filter((p) => p !== pos) : [...positions, pos];
    onUpdate({ positions: next });
  };

  return (
    <div className="sf-player-card sf-player-card-me sf-me-card">
      <div className="sf-h3">{me.name} <span className="sf-me-tag">você</span></div>
      <div className="sf-muted-sm" style={{ margin: '8px 0 4px' }}>seu nível (autoavaliação)</div>
      <StarRating value={me.rating} onChange={(rating) => onUpdate({ rating })} size={20} />
      <div className="sf-muted-sm" style={{ margin: '12px 0 6px' }}>posições que você joga</div>
      <div className="sf-position-pills">
        {POSITION_ORDER.map((pos) => (
          <button
            key={pos}
            className={`sf-pos-pill ${positions.includes(pos) ? 'sf-pos-pill-on' : ''} ${pos === 'goleiro' ? 'sf-pos-pill-gk' : ''}`}
            onClick={() => togglePosition(pos)}
          >
            {pos === 'goleiro' && <Hand size={12} />} {POSITION_LABELS[pos]}
          </button>
        ))}
      </div>
      <div className="sf-muted-sm" style={{ margin: '12px 0 6px' }}>peso e idade (opcional — ajuda no sorteio a não empilhar só pesados ou só jovens de um lado)</div>
      <div className="sf-physical-row">
        <div className="sf-physical-field">
          <label className="sf-field-label">Peso (kg)</label>
          <input
            type="number" min="30" max="200" className="sf-input" placeholder="ex: 78"
            value={weightDraft}
            onChange={(e) => setWeightDraft(e.target.value)}
            onBlur={() => onUpdate({ weight_kg: weightDraft ? parseFloat(weightDraft) : null })}
          />
        </div>
        <div className="sf-physical-field">
          <label className="sf-field-label">Idade</label>
          <input
            type="number" min="10" max="100" className="sf-input" placeholder="ex: 34"
            value={ageDraft}
            onChange={(e) => setAgeDraft(e.target.value)}
            onBlur={() => onUpdate({ age: ageDraft ? parseInt(ageDraft, 10) : null })}
          />
        </div>
      </div>
      <div className="sf-muted-sm" style={{ margin: '12px 0 6px' }}>WhatsApp (opcional — permite que te cobrem o rateio direto no seu zap)</div>
      <input
        type="tel" className="sf-input" placeholder="5511999999999 (DDI+DDD+número, só números)"
        value={phoneDraft}
        onChange={(e) => setPhoneDraft(e.target.value.replace(/[^\d]/g, ''))}
        onBlur={() => onUpdate({ phone: phoneDraft || null })}
      />
      <div className="sf-muted-sm" style={{ margin: '12px 0 6px' }}>Chave Pix (aparece pro grupo se você for organizar uma partida)</div>
      <input
        type="text" className="sf-input" placeholder="CPF, CNPJ, e-mail, +55DDDnúmero ou chave aleatória"
        value={pixDraft}
        onChange={(e) => setPixDraft(e.target.value)}
        onBlur={() => onUpdate({ pix_key: pixDraft.trim() || null })}
      />
      {pixKeyWarning(pixDraft) && <div className="sf-pix-warning">⚠️ {pixKeyWarning(pixDraft)}</div>}
    </div>
  );
}



function GameDetail({ game, roster, myId, isAdmin, onBack, onToggleMyRSVP, onSetCost, onSetGkPays, onSetMaxPlayers, onSetGamePixDetails, onDraw, onTogglePaid, onSaveResult, onSaveRatings, onDelete, onShare }) {
  const [scoreA, setScoreA] = useState(game.result?.scoreA ?? 0);
  const [scoreB, setScoreB] = useState(game.result?.scoreB ?? 0);
  const [scorers, setScorers] = useState(game.result?.scorers || {});
  const [editingCost, setEditingCost] = useState(false);
  const [costDraft, setCostDraft] = useState(game.cost || 0);
  const [editingPix, setEditingPix] = useState(false);
  const [editingMaxPlayers, setEditingMaxPlayers] = useState(false);
  const [maxPlayersDraft, setMaxPlayersDraft] = useState('');
  const [pixDraft, setPixDraft] = useState(game.pixKey || '');
  const [pixReceiverDraft, setPixReceiverDraft] = useState('');
  const [pixCityDraft, setPixCityDraft] = useState('');
  const [pixOwnerDraft, setPixOwnerDraft] = useState('');

  const [assists, setAssists] = useState(game.result?.scorers ? (game.assists || {}) : {});
  // preserve RSVP order (first-come, first-served) so the waitlist is well defined
  const confirmedPlayers = game.confirmed.map((id) => roster.find((p) => p.id === id)).filter(Boolean);
  const maxPlayers = game.maxPlayers || null;
  const activePlayers = maxPlayers ? confirmedPlayers.slice(0, maxPlayers) : confirmedPlayers;
  const waitlistPlayers = maxPlayers ? confirmedPlayers.slice(maxPlayers) : [];
  const gkPays = game.goalkeeperPays !== false;
  const payingPlayers = gkPays ? activePlayers : activePlayers.filter((p) => !isGoleiro(p));
  const rateio = payingPlayers.length > 0 ? (game.cost || 0) / payingPlayers.length : 0;
  const paidCount = payingPlayers.filter((p) => game.payments?.[p.id]).length;
  const hasTeams = game.teamA && game.teamA.length > 0;
  const allPlayers = hasTeams ? [...game.teamA, ...game.teamB] : [];
  const destaques = useMemo(() => computeGameDestaques(game), [game]);
  const iAmConfirmed = game.confirmed.includes(myId);
  const myWaitlistPos = waitlistPlayers.findIndex((p) => p.id === myId);
  const canManage = isAdmin || myId === game.createdBy;
  const organizer = roster.find((p) => p.id === game.createdBy);
  // pix key/receiver/city are per-game settings (whoever is collecting for THAT
  // match may differ from the organizer), falling back to sensible defaults
  const activePixKey = game.pixKey || organizer?.pix_key || null;
  const activePixReceiver = game.pixReceiverName || organizer?.name || 'Organizador';
  const activePixCity = game.pixCity || '';
  const pixCode = activePixKey
    ? generatePixCode({ key: activePixKey, receiverName: activePixReceiver, city: activePixCity, amount: rateio, txid: game.id.slice(0, 8) })
    : null;
  const [pixCopied, setPixCopied] = useState(false);

  const bumpGoal = (id, delta) => {
    setScorers((s) => ({ ...s, [id]: Math.max(0, (s[id] || 0) + delta) }));
  };
  const bumpAssist = (id, delta) => {
    setAssists((s) => ({ ...s, [id]: Math.max(0, (s[id] || 0) + delta) }));
  };
  const chargeWhatsApp = (p) => {
    const msg = `Fala ${p.name}! ⚽ Só lembrando: falta ${money(rateio)} da quadra de ${formatDatePtBr(game.date)}${game.local ? ` (${game.local})` : ''}. Valeu! 🙏`;
    window.open(`https://wa.me/${p.phone}?text=${encodeURIComponent(msg)}`, '_blank');
  };
  const copyPix = async () => {
    try { await navigator.clipboard.writeText(pixCode); setPixCopied(true); setTimeout(() => setPixCopied(false), 2000); } catch {}
  };

  return (
    <div className="sf-detail">
      <div className="sf-detail-topbar">
        <button className="sf-icon-btn" onClick={onBack}><ChevronLeft size={20} /></button>
        <div>
          <div className="sf-eyebrow">{formatDatePtBr(game.date)}</div>
          <div className="sf-h2">{game.local || 'Local a definir'}</div>
        </div>
        {canManage && <button className="sf-icon-btn sf-danger" onClick={() => onDelete(game.id)}><Trash2 size={18} /></button>}
      </div>

      <section className="sf-card">
        <div className="sf-card-title">
          <Users size={16} /> Confirmados ({activePlayers.length}{maxPlayers ? `/${maxPlayers}` : ''})
        </div>
        {canManage && (
          <div className="sf-cost-row" style={{ marginBottom: 8 }}>
            <span className="sf-muted">Limite de vagas</span>
            {editingMaxPlayers ? (
              <input
                autoFocus type="number" min="1" className="sf-input-inline"
                placeholder="Sem limite"
                value={maxPlayersDraft}
                onChange={(e) => setMaxPlayersDraft(e.target.value)}
                onBlur={() => { onSetMaxPlayers(game.id, maxPlayersDraft ? parseInt(maxPlayersDraft, 10) : null); setEditingMaxPlayers(false); }}
              />
            ) : (
              <button className="sf-mono-value" onClick={() => { setMaxPlayersDraft(maxPlayers || ''); setEditingMaxPlayers(true); }}>
                {maxPlayers ? `${maxPlayers} vagas · editar` : 'sem limite · definir'}
              </button>
            )}
          </div>
        )}
        <button className={`sf-btn-primary ${iAmConfirmed ? 'sf-btn-toggle-on' : ''}`} onClick={() => onToggleMyRSVP(game.id)}>
          {iAmConfirmed
            ? (myWaitlistPos >= 0 ? <><Check size={16} /> Você tá na espera (#{myWaitlistPos + 1})</> : <><Check size={16} /> Você tá confirmado</>)
            : 'Confirmar minha presença'}
        </button>
        {!iAmConfirmed && maxPlayers && activePlayers.length >= maxPlayers && (
          <div className="sf-muted-sm" style={{ marginTop: 6 }}>Vagas lotadas — você entra na lista de espera.</div>
        )}
        <div className="sf-rsvp-list" style={{ marginTop: 10 }}>
          {roster.map((p) => {
            const on = game.confirmed.includes(p.id);
            const onWaitlist = waitlistPlayers.some((w) => w.id === p.id);
            return (
              <div key={p.id} className={`sf-rsvp-row ${on ? 'sf-rsvp-on' : ''} ${p.id === myId ? 'sf-rsvp-me' : ''} ${onWaitlist ? 'sf-rsvp-waitlist' : ''}`}>
                <span className="sf-rsvp-check">{on && !onWaitlist ? <Check size={14} /> : null}</span>
                <span className="sf-rsvp-name">
                  {isGoleiro(p) && <span className="sf-gk-tag" title="Goleiro"><Hand size={10} /> GOL</span>}
                  {p.name}{p.id === myId ? ' (você)' : ''}
                </span>
                {onWaitlist && <span className="sf-waitlist-tag">espera #{waitlistPlayers.findIndex((w) => w.id === p.id) + 1}</span>}
                <StarRating value={p.rating} readOnly size={12} onChange={() => {}} />
              </div>
            );
          })}
        </div>
      </section>

      <section className="sf-card">
        <div className="sf-card-title"><Shuffle size={16} /> Times</div>
        {!hasTeams && !canManage ? (
          <div className="sf-muted">O organizador ainda não sorteou os times.</div>
        ) : activePlayers.length < 2 && !hasTeams ? (
          <div className="sf-muted">Confirme pelo menos 2 jogadores para sortear.</div>
        ) : (
          <>
            {canManage && (
              <button className="sf-btn-primary" onClick={() => onDraw(game.id, activePlayers)}>
                <Shuffle size={16} /> {hasTeams ? 'Sortear novamente' : 'Sortear times'}
              </button>
            )}
            {hasTeams && (
              <>
                <PitchView teamA={game.teamA} teamB={game.teamB} />
                <div className="sf-teams-legend">
                  <div><span className="sf-dot sf-dot-a" /> Time A — {game.teamA.map((p) => isGoleiro(p) ? `${p.name} (GOL)` : p.name).join(', ')}</div>
                  <div><span className="sf-dot sf-dot-b" /> Time B — {game.teamB.map((p) => isGoleiro(p) ? `${p.name} (GOL)` : p.name).join(', ')}</div>
                </div>
              </>
            )}
          </>
        )}
      </section>

      <section className="sf-card">
        <div className="sf-card-title"><Wallet size={16} /> Rateio</div>
        <div className="sf-cost-row">
          <span className="sf-muted">Custo da quadra</span>
          {!canManage ? (
            <span className="sf-mono-value" style={{ cursor: 'default' }}>{money(game.cost || 0)}</span>
          ) : editingCost ? (
            <input
              autoFocus type="number" className="sf-input-inline" value={costDraft}
              onChange={(e) => setCostDraft(e.target.value)}
              onBlur={() => { onSetCost(game.id, parseFloat(costDraft) || 0); setEditingCost(false); }}
            />
          ) : (
            <button className="sf-mono-value" onClick={() => { setCostDraft(game.cost || 0); setEditingCost(true); }}>
              {money(game.cost || 0)}
            </button>
          )}
        </div>
        {activePlayers.length > 0 && (
          <>
            <div className="sf-cost-row">
              <span className="sf-muted">Goleiro paga a quadra?</span>
              {canManage ? (
                <div className="sf-gk-toggle">
                  <button className={gkPays ? 'sf-gk-toggle-on' : ''} onClick={() => onSetGkPays(game.id, true)}>Sim</button>
                  <button className={!gkPays ? 'sf-gk-toggle-on' : ''} onClick={() => onSetGkPays(game.id, false)}>Não</button>
                </div>
              ) : (
                <span className="sf-mono-value">{gkPays ? 'Sim' : 'Não'}</span>
              )}
            </div>
            <div className="sf-cost-row"><span className="sf-muted">Valor por pessoa</span><span className="sf-mono-value">{money(rateio)}</span></div>
            <div className="sf-cost-row"><span className="sf-muted">Arrecadado</span><span className="sf-mono-value">{paidCount}/{payingPlayers.length} pagaram</span></div>
            <div className="sf-paid-list">
              {activePlayers.map((p) => {
                const exempt = !gkPays && isGoleiro(p);
                const paid = !!game.payments?.[p.id];
                const canTogglePaid = !exempt && (canManage || p.id === myId || myId === game.pixOwnerId);
                return (
                  <div key={p.id} className="sf-paid-item">
                    <button
                      className={`sf-paid-chip ${paid ? 'sf-paid-on' : ''} ${exempt ? 'sf-paid-exempt' : ''}`}
                      disabled={!canTogglePaid}
                      onClick={() => canTogglePaid && onTogglePaid(game.id, p.id, !paid)}
                    >
                      {exempt ? 'Isento · ' : (paid ? <Check size={12} /> : null)} {p.name}
                    </button>
                    {!exempt && !paid && p.phone && (
                      <button className="sf-charge-btn" title={`Cobrar ${p.name} no WhatsApp`} onClick={() => chargeWhatsApp(p)}>
                        <MessageCircle size={13} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="sf-pix-box">
              {canManage && (
                <>
                  {!editingPix && (
                    <button
                      className="sf-btn-ghost sf-pix-edit-toggle"
                      onClick={() => {
                        setPixDraft(game.pixKey || '');
                        setPixReceiverDraft(game.pixReceiverName || organizer?.name || '');
                        setPixCityDraft(game.pixCity || '');
                        setEditingPix(true);
                      }}
                    >
                      {activePixKey ? 'Editar dados do Pix desta partida' : 'Configurar Pix pra essa partida'}
                    </button>
                  )}
                  {editingPix && (
                    <div className="sf-pix-form">
                      <label className="sf-field-label">Chave Pix</label>
                      <input
                        autoFocus type="text" className="sf-input" placeholder="CPF, CNPJ, e-mail, +55DDDnúmero..."
                        value={pixDraft}
                        onChange={(e) => setPixDraft(e.target.value)}
                      />
                      {pixKeyWarning(pixDraft) && <div className="sf-pix-warning">⚠️ {pixKeyWarning(pixDraft)}</div>}
                      <label className="sf-field-label">Nome de quem recebe</label>
                      <input
                        type="text" className="sf-input" placeholder={organizer?.name || 'Nome do recebedor'}
                        value={pixReceiverDraft}
                        onChange={(e) => setPixReceiverDraft(e.target.value)}
                      />
                      <label className="sf-field-label">Cidade (não é o local do jogo — é a cidade de quem recebe)</label>
                      <input
                        type="text" className="sf-input" placeholder="ex: Porto Alegre"
                        value={pixCityDraft}
                        onChange={(e) => setPixCityDraft(e.target.value)}
                      />
                      <label className="sf-field-label">Quem confere os pagamentos (dono da chave Pix)</label>
                      <select className="sf-input" value={pixOwnerDraft} onChange={(e) => setPixOwnerDraft(e.target.value)}>
                        <option value="">Só eu (organizador) e admins</option>
                        {roster.filter((p) => p.id !== game.createdBy).map((p) => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                      <div className="sf-muted-sm">Essa pessoa vai poder marcar quem pagou, além de você e de cada jogador marcar a si mesmo.</div>
                      <div className="sf-modal-actions">
                        <button className="sf-btn-ghost" onClick={() => setEditingPix(false)}>Cancelar</button>
                        <button
                          className="sf-btn-primary"
                          onClick={() => {
                            onSetGamePixDetails(game.id, {
                              pixKey: pixDraft.trim(),
                              pixReceiverName: pixReceiverDraft.trim(),
                              pixCity: pixCityDraft.trim(),
                              pixOwnerId: pixOwnerDraft || null,
                            });
                            setEditingPix(false);
                          }}
                        >
                          Salvar
                        </button>
                      </div>
                    </div>
                  )}
                  {!editingPix && !game.pixKey && organizer?.pix_key && (
                    <div className="sf-muted-sm" style={{ margin: '6px 0' }}>Usando a chave Pix salva no seu perfil por padrão.</div>
                  )}
                </>
              )}
              {!editingPix && pixCode ? (
                <>
                  <div className="sf-card-subtitle" style={{ margin: '10px 0 6px' }}>Pagar via Pix pra {activePixReceiver}</div>
                  <div className="sf-pix-key-row">
                    <span className="sf-pix-key-type">{pixKeyType(activePixKey)}</span>
                    <span className="sf-pix-key-value">{activePixKey}</span>
                  </div>
                  <div className="sf-muted-sm" style={{ margin: '8px 0 4px' }}>Código copia-e-cola (com o valor {money(rateio)} já incluído):</div>
                  <div className="sf-pix-code">{pixCode}</div>
                  <button className="sf-btn-primary sf-btn-pix" onClick={copyPix}>
                    {pixCopied ? <><Check size={16} /> Copiado!</> : <>Copiar código Pix ({money(rateio)})</>}
                  </button>
                </>
              ) : !editingPix && canManage ? (
                <div className="sf-muted-sm">Configure a chave Pix acima pra gerar o código de pagamento.</div>
              ) : !editingPix ? (
                <div className="sf-muted-sm">O organizador ainda não configurou uma chave Pix pra essa partida.</div>
              ) : null}
            </div>
          </>
        )}
      </section>

      {hasTeams && canManage && (
        <section className="sf-card">
          <div className="sf-card-title"><Trophy size={16} /> Resultado</div>
          <div className="sf-score-row">
            <div className="sf-score-box">
              <span className="sf-dot sf-dot-a" /> Time A
              <input type="number" min="0" className="sf-score-input" value={scoreA} onChange={(e) => setScoreA(parseInt(e.target.value) || 0)} />
            </div>
            <span className="sf-score-x">x</span>
            <div className="sf-score-box">
              <span className="sf-dot sf-dot-b" /> Time B
              <input type="number" min="0" className="sf-score-input" value={scoreB} onChange={(e) => setScoreB(parseInt(e.target.value) || 0)} />
            </div>
          </div>
          <div className="sf-card-subtitle">Gols e assistências (opcional)</div>
          <div className="sf-scorers-list">
            {allPlayers.map((p) => (
              <div key={p.id} className="sf-scorer-row">
                <span>{p.name}</span>
                <div className="sf-scorer-controls-group">
                  <div className="sf-scorer-controls" title="Gols">
                    <button className="sf-mini-btn" onClick={() => bumpGoal(p.id, -1)}>-</button>
                    <span className="sf-mono-value">⚽{scorers[p.id] || 0}</span>
                    <button className="sf-mini-btn" onClick={() => bumpGoal(p.id, 1)}>+</button>
                  </div>
                  <div className="sf-scorer-controls" title="Assistências">
                    <button className="sf-mini-btn" onClick={() => bumpAssist(p.id, -1)}>-</button>
                    <span className="sf-mono-value">🎯{assists[p.id] || 0}</span>
                    <button className="sf-mini-btn" onClick={() => bumpAssist(p.id, 1)}>+</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <button className="sf-btn-primary" onClick={() => onSaveResult(game.id, scoreA, scoreB, scorers, assists, allPlayers.map((p) => p.id))}>
            <Check size={16} /> Salvar resultado
          </button>
        </section>
      )}

      {hasTeams && !canManage && game.result && (
        <section className="sf-card">
          <div className="sf-card-title"><Trophy size={16} /> Resultado</div>
          <div className="sf-score-row">
            <div className="sf-score-box"><span className="sf-dot sf-dot-a" /> Time A<span className="sf-mono-value" style={{ fontSize: 22 }}>{game.result.scoreA}</span></div>
            <span className="sf-score-x">x</span>
            <div className="sf-score-box"><span className="sf-dot sf-dot-b" /> Time B<span className="sf-mono-value" style={{ fontSize: 22 }}>{game.result.scoreB}</span></div>
          </div>
        </section>
      )}

      {game.result && destaques && (destaques.mvp || destaques.artilheiro || destaques.passador || destaques.muro) && (
        <section className="sf-card sf-destaques-card">
          <div className="sf-card-title"><Award size={16} /> Destaques da rodada</div>
          <div className="sf-destaques-grid">
            {destaques.mvp && (
              <div className="sf-destaque-item">
                <Trophy size={20} color="#FFC53D" />
                <div>
                  <div className="sf-destaque-label">MVP</div>
                  <div className="sf-destaque-name">{destaques.mvp.name}</div>
                  <div className="sf-muted-sm">nota {destaques.mvpAvg.toFixed(1)} ({destaques.mvpVotes} {destaques.mvpVotes === 1 ? 'voto' : 'votos'})</div>
                </div>
              </div>
            )}
            {destaques.artilheiro && (
              <div className="sf-destaque-item">
                <Target size={20} color="#FF5C5C" />
                <div>
                  <div className="sf-destaque-label">Artilheiro</div>
                  <div className="sf-destaque-name">{destaques.artilheiro.name}</div>
                  <div className="sf-muted-sm">{destaques.maxGoals} {destaques.maxGoals === 1 ? 'gol' : 'gols'}</div>
                </div>
              </div>
            )}
            {destaques.passador && (
              <div className="sf-destaque-item">
                <Handshake size={20} color="#4FC3F7" />
                <div>
                  <div className="sf-destaque-label">Passador</div>
                  <div className="sf-destaque-name">{destaques.passador.name}</div>
                  <div className="sf-muted-sm">{destaques.maxAssists} {destaques.maxAssists === 1 ? 'assistência' : 'assistências'}</div>
                </div>
              </div>
            )}
            {destaques.muro && (
              <div className="sf-destaque-item">
                <Shield size={20} color="#8FB39C" />
                <div>
                  <div className="sf-destaque-label">Muro</div>
                  <div className="sf-destaque-name">{destaques.muro.name}</div>
                  <div className="sf-muted-sm">{destaques.muroConceded} {destaques.muroConceded === 1 ? 'gol sofrido' : 'gols sofridos'}</div>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {game.result && hasTeams && (
        <EvaluationSection game={game} myId={myId} onSaveRatings={onSaveRatings} />
      )}

      <button className="sf-btn-whatsapp" onClick={() => onShare(game, activePlayers, waitlistPlayers, rateio)}>
        <Share2 size={16} /> Compartilhar no WhatsApp
      </button>
    </div>
  );
}

// ---------- main app (authenticated) ----------

function MainApp({ session }) {
  const myId = session.user.id;
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState([]);
  const [games, setGames] = useState([]);
  const [tab, setTab] = useState('partidas');
  const [subTab, setSubTab] = useState('elenco');
  const [selectedGameId, setSelectedGameId] = useState(null);
  const [showNewGame, setShowNewGame] = useState(false);
  const [newDate, setNewDate] = useState('');
  const [newLocal, setNewLocal] = useState('');
  const [newMaxPlayers, setNewMaxPlayers] = useState('');

  const me = profiles.find((p) => p.id === myId);

  const loadAll = useCallback(async () => {
    const [profilesRes, gamesRes, confRes, teamsRes, paysRes, goalsRes, ratingsRes] = await Promise.all([
      supabase.from('profiles').select('*').order('name'),
      supabase.from('games').select('*').order('date', { ascending: false }),
      supabase.from('game_confirmations').select('*'),
      supabase.from('game_teams').select('*'),
      supabase.from('payments').select('*'),
      supabase.from('goals').select('*'),
      supabase.from('ratings').select('*'),
    ]);
    const profs = profilesRes.data || [];
    const profileMap = Object.fromEntries(profs.map((p) => [p.id, p]));
    const assembled = (gamesRes.data || []).map((g) => {
      // ordered by confirmed_at so the waitlist (anyone past max_players) is well defined
      const confirmed = (confRes.data || [])
        .filter((c) => c.game_id === g.id)
        .sort((a, b) => new Date(a.confirmed_at) - new Date(b.confirmed_at))
        .map((c) => c.user_id);
      const teamRows = (teamsRes.data || []).filter((t) => t.game_id === g.id);
      const teamA = teamRows.filter((t) => t.team === 'A').map((t) => profileMap[t.user_id]).filter(Boolean);
      const teamB = teamRows.filter((t) => t.team === 'B').map((t) => profileMap[t.user_id]).filter(Boolean);
      const payments = {};
      (paysRes.data || []).filter((p) => p.game_id === g.id).forEach((p) => { payments[p.user_id] = p.paid; });
      const scorers = {};
      const assists = {};
      (goalsRes.data || []).filter((gl) => gl.game_id === g.id).forEach((gl) => {
        scorers[gl.user_id] = gl.goals;
        assists[gl.user_id] = gl.assists || 0;
      });
      const ratings = {};
      (ratingsRes.data || []).filter((r) => r.game_id === g.id).forEach((r) => {
        ratings[r.rater_id] = ratings[r.rater_id] || {};
        ratings[r.rater_id][r.rated_id] = r.score;
      });
      return {
        id: g.id, date: g.date, local: g.local, cost: Number(g.cost) || 0, goalkeeperPays: g.goalkeeper_pays !== false,
        createdBy: g.created_by,
        maxPlayers: g.max_players || null,
        pixKey: g.pix_key || null,
        pixOwnerId: g.pix_owner_id || null,
        inviteToken: g.invite_token,
        pixReceiverName: g.pix_receiver_name || null,
        pixCity: g.pix_city || null,
        confirmed, teamA, teamB, payments, scorers, assists, ratings,
        result: (g.score_a != null && g.score_b != null) ? { scoreA: g.score_a, scoreB: g.score_b, scorers } : null,
      };
    });
    setProfiles(profs);
    setGames(assembled);
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // if we arrived via a per-match invite link (?join=token, or one stashed
  // before the Google redirect), join that match and jump straight to it
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const token = params.get('join') || sessionStorage.getItem('sf_join_token');
    if (!token) return;
    sessionStorage.removeItem('sf_join_token');
    const url = new URL(window.location.href);
    url.searchParams.delete('join');
    window.history.replaceState({}, '', url.toString());
    (async () => {
      try {
        const { data: gameId } = await supabase.rpc('join_game_by_token', { p_token: token });
        await loadAll();
        if (gameId) { setTab('partidas'); setSelectedGameId(gameId); }
      } catch (e) {
        console.error('invalid invite link', e);
      }
    })();
  }, [loadAll]);

  const toggleMyRSVP = async (gameId) => {
    const g = games.find((x) => x.id === gameId);
    if (g.confirmed.includes(myId)) {
      await supabase.from('game_confirmations').delete().eq('game_id', gameId).eq('user_id', myId);
    } else {
      await supabase.from('game_confirmations').insert({ game_id: gameId, user_id: myId });
    }
    loadAll();
  };

  const setCost = async (gameId, cost) => {
    await supabase.from('games').update({ cost }).eq('id', gameId);
    loadAll();
  };

  const setGkPays = async (gameId, goalkeeper_pays) => {
    await supabase.from('games').update({ goalkeeper_pays }).eq('id', gameId);
    loadAll();
  };

  const setGamePixDetails = async (gameId, { pixKey, pixReceiverName, pixCity, pixOwnerId }) => {
    await supabase.from('games').update({
      pix_key: pixKey || null,
      pix_receiver_name: pixReceiverName || null,
      pix_city: pixCity || null,
      pix_owner_id: pixOwnerId || null,
    }).eq('id', gameId);
    loadAll();
  };

  const setMaxPlayers = async (gameId, maxPlayers) => {
    await supabase.from('games').update({ max_players: maxPlayers }).eq('id', gameId);
    loadAll();
  };

  const handleDraw = async (gameId, confirmedPlayers) => {
    const { teamA, teamB } = drawTeams(confirmedPlayers);
    await supabase.from('game_teams').delete().eq('game_id', gameId);
    const rows = [
      ...teamA.map((p) => ({ game_id: gameId, user_id: p.id, team: 'A' })),
      ...teamB.map((p) => ({ game_id: gameId, user_id: p.id, team: 'B' })),
    ];
    if (rows.length) await supabase.from('game_teams').insert(rows);
    loadAll();
  };

  const togglePaid = async (gameId, userId, paid) => {
    await supabase.from('payments').upsert({ game_id: gameId, user_id: userId, paid });
    loadAll();
  };

  const saveResult = async (gameId, scoreA, scoreB, scorers, assists, playerIds) => {
    await supabase.from('games').update({ score_a: scoreA, score_b: scoreB }).eq('id', gameId);
    const rows = playerIds.map((id) => ({ game_id: gameId, user_id: id, goals: scorers[id] || 0, assists: assists[id] || 0 }));
    if (rows.length) await supabase.from('goals').upsert(rows);
    loadAll();
  };

  const saveRatings = async (gameId, ratingsMap) => {
    const rows = Object.entries(ratingsMap)
      .filter(([, score]) => score > 0)
      .map(([ratedId, score]) => ({ game_id: gameId, rater_id: myId, rated_id: ratedId, score }));
    if (rows.length) await supabase.from('ratings').upsert(rows);
    loadAll();
  };

  const createGame = async () => {
    const date = newDate || new Date().toISOString().slice(0, 10);
    const maxPlayers = newMaxPlayers ? parseInt(newMaxPlayers, 10) : null;
    const { data } = await supabase.from('games').insert({ date, local: newLocal.trim(), created_by: myId, max_players: maxPlayers }).select().single();
    setNewDate(''); setNewLocal(''); setNewMaxPlayers(''); setShowNewGame(false);
    await loadAll();
    if (data) setSelectedGameId(data.id);
  };

  const deleteGame = async (gameId) => {
    await supabase.from('games').delete().eq('id', gameId);
    setSelectedGameId(null);
    loadAll();
  };

  const updateMyProfile = async (fields) => {
    await supabase.from('profiles').update(fields).eq('id', myId);
    loadAll();
  };

  const toggleAdmin = async (userId, isAdmin) => {
    await supabase.from('profiles').update({ is_admin: isAdmin }).eq('id', userId);
    loadAll();
  };

  const shareWhatsApp = (game, activePlayers, waitlistPlayers, rateio) => {
    let msg = `⚽ *Futebol Society* — ${formatDatePtBr(game.date)}\n`;
    if (game.local) msg += `📍 ${game.local}\n`;
    msg += `\n✅ Confirmados (${activePlayers.length}${game.maxPlayers ? `/${game.maxPlayers}` : ''}):\n`;
    msg += activePlayers.map((p) => `• ${p.name}`).join('\n') || '—';
    if (waitlistPlayers && waitlistPlayers.length > 0) {
      msg += `\n\n⏳ Lista de espera:\n`;
      msg += waitlistPlayers.map((p, i) => `${i + 1}. ${p.name}`).join('\n');
    }
    if (game.teamA && game.teamA.length > 0) {
      msg += `\n\n🔴 Time A: ${game.teamA.map((p) => p.name).join(', ')}`;
      msg += `\n🔵 Time B: ${game.teamB.map((p) => p.name).join(', ')}`;
    }
    if (game.cost > 0) msg += `\n\n💰 Rateio: ${money(rateio)} por pessoa (total ${money(game.cost)})`;
    if (game.result) {
      msg += `\n\n📊 Placar: Time A ${game.result.scoreA} x ${game.result.scoreB} Time B`;
      const destaques = computeGameDestaques(game);
      if (destaques?.mvp) msg += `\n🏆 MVP: ${destaques.mvp.name}`;
      if (destaques?.artilheiro) msg += `\n🎯 Artilheiro: ${destaques.artilheiro.name} (${destaques.maxGoals})`;
      if (destaques?.passador) msg += `\n🤝 Passador: ${destaques.passador.name} (${destaques.maxAssists})`;
      if (destaques?.muro) msg += `\n🧤 Muro: ${destaques.muro.name} (${destaques.muroConceded} sofridos)`;
    }
    msg += `\n\nEntre e confirme presença: ${window.location.origin}/?join=${game.inviteToken}\n\nBora! 🙌`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const ranking = useMemo(() => computeRanking(profiles, games), [profiles, games]);
  const sortedGames = useMemo(() => [...games].sort((a, b) => (a.date < b.date ? 1 : -1)), [games]);
  const selectedGame = games.find((g) => g.id === selectedGameId);

  if (loading) {
    return (
      <div className="sf-app sf-loading">
        <style>{CSS}</style>
        <Loader2 className="sf-spin" size={28} />
      </div>
    );
  }

  return (
    <div className="sf-app">
      <style>{CSS}</style>

      <header className="sf-header">
        <div className="sf-header-row">
          <div>
            <div className="sf-wordmark">SOCIETY<span className="sf-wordmark-dot">.</span></div>
            <div className="sf-tagline">seu futebol, organizado</div>
          </div>
          <button className="sf-icon-btn" title="Sair" onClick={() => supabase.auth.signOut()}><LogOut size={18} /></button>
        </div>
      </header>

      <main className="sf-main">
        {tab === 'partidas' && !selectedGame && (
          <div className="sf-list-view">
            {sortedGames.length === 0 && (
              <div className="sf-empty"><CalendarDays size={32} color="#5C7A67" /><p>Nenhuma partida marcada ainda.</p></div>
            )}
            {sortedGames.map((g) => {
              const status = g.result ? 'Finalizada' : (g.teamA?.length ? 'Times prontos' : 'Sorteio pendente');
              return (
                <button key={g.id} className="sf-game-card" onClick={() => setSelectedGameId(g.id)}>
                  <div className="sf-game-card-date">{formatDatePtBr(g.date)}</div>
                  <div className="sf-game-card-info">
                    <div className="sf-h3">{g.local || 'Local a definir'}</div>
                    <div className="sf-muted-sm">
                      <Users size={12} /> {Math.min(g.confirmed.length, g.maxPlayers || Infinity)}{g.maxPlayers ? `/${g.maxPlayers}` : ''} confirmados
                      {g.maxPlayers && g.confirmed.length > g.maxPlayers ? ` · ${g.confirmed.length - g.maxPlayers} na espera` : ''}
                    </div>
                  </div>
                  <div className={`sf-badge ${g.result ? 'sf-badge-done' : ''}`}>{status}</div>
                </button>
              );
            })}
            <button className="sf-btn-primary sf-fixed-add" onClick={() => setShowNewGame(true)}>
              <Plus size={18} /> Nova partida
            </button>
          </div>
        )}

        {tab === 'partidas' && selectedGame && (
          <GameDetail
            game={selectedGame}
            roster={profiles}
            myId={myId}
            isAdmin={!!me?.is_admin}
            onBack={() => setSelectedGameId(null)}
            onToggleMyRSVP={toggleMyRSVP}
            onSetCost={setCost}
            onSetGkPays={setGkPays}
            onSetGamePixDetails={setGamePixDetails}
            onSetMaxPlayers={setMaxPlayers}
            onDraw={handleDraw}
            onTogglePaid={togglePaid}
            onSaveResult={saveResult}
            onSaveRatings={saveRatings}
            onDelete={deleteGame}
            onShare={shareWhatsApp}
          />
        )}

        {tab === 'elenco' && (
          <div className="sf-list-view">
            <div className="sf-subtabs">
              <button className={`sf-subtab ${subTab === 'elenco' ? 'sf-subtab-on' : ''}`} onClick={() => setSubTab('elenco')}>Elenco</button>
              <button className={`sf-subtab ${subTab === 'ranking' ? 'sf-subtab-on' : ''}`} onClick={() => setSubTab('ranking')}>Ranking</button>
            </div>

            {subTab === 'elenco' && (
              <>
                {me && <MyProfileCard me={me} onUpdate={updateMyProfile} />}
                {profiles.filter((p) => p.id !== myId).map((p) => (
                  <div key={p.id} className="sf-player-card">
                    <div>
                      <div className="sf-h3">
                        {isGoleiro(p) && <span className="sf-gk-tag" title="Goleiro"><Hand size={10} /> GOL</span>}
                        {p.name}
                        {p.is_admin && <span className="sf-admin-tag" title="Admin">ADMIN</span>}
                      </div>
                      <StarRating value={p.rating} readOnly onChange={() => {}} />
                      {playerMeta(p) && <div className="sf-muted-sm" style={{ marginTop: 3 }}>{playerMeta(p)}</div>}
                    </div>
                    {me?.is_admin && (
                      <button className="sf-admin-toggle" onClick={() => toggleAdmin(p.id, !p.is_admin)}>
                        {p.is_admin ? 'Remover admin' : 'Tornar admin'}
                      </button>
                    )}
                  </div>
                ))}
                <p className="sf-muted-sm sf-roster-hint">
                  O elenco é formado por quem já entrou no app com a conta Google. Manda o link pra galera se cadastrar.
                  {me?.is_admin ? ' Você é admin: pode editar partidas de qualquer organizador e indicar outros admins.' : ''}
                </p>
              </>
            )}

            {subTab === 'ranking' && (
              <div className="sf-ranking-table">
                <div className="sf-ranking-header">
                  <span className="sf-rk-name">Jogador</span>
                  <span>J</span><span>V</span><span>G/A</span><span>Nota</span><span>Freq</span><span>Pts</span>
                </div>
                {ranking.length === 0 && <div className="sf-empty"><Trophy size={32} color="#5C7A67" /><p>Finalize partidas para gerar o ranking.</p></div>}
                {ranking.map((r, i) => (
                  <div key={r.id} className="sf-ranking-row">
                    <span className="sf-rk-name">
                      {i === 0 && r.pontos > 0 ? '🏆 ' : ''}{r.name}{r.mvps > 0 ? <span className="sf-mvp-tag"> ⭐×{r.mvps}</span> : ''}
                    </span>
                    <span className="sf-mono-value">{r.jogos}</span>
                    <span className="sf-mono-value">{r.vit}</span>
                    <span className="sf-mono-value">{r.gols}/{r.assistencias}</span>
                    <span className="sf-mono-value">{r.nota != null ? r.nota.toFixed(1) : '—'}</span>
                    <span className="sf-mono-value">{r.presencaPct != null ? `${r.presencaPct}%` : '—'}</span>
                    <span className="sf-mono-value sf-rk-pts">{r.pontos}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      <nav className="sf-tabbar">
        <button className={`sf-tab ${tab === 'partidas' ? 'sf-tab-on' : ''}`} onClick={() => setTab('partidas')}>
          <CalendarDays size={20} /><span>Partidas</span>
        </button>
        <button className={`sf-tab ${tab === 'elenco' ? 'sf-tab-on' : ''}`} onClick={() => { setTab('elenco'); setSelectedGameId(null); }}>
          <Users size={20} /><span>Elenco</span>
        </button>
      </nav>

      {showNewGame && (
        <div className="sf-modal-backdrop" onClick={() => setShowNewGame(false)}>
          <div className="sf-modal" onClick={(e) => e.stopPropagation()}>
            <div className="sf-modal-title">Nova partida</div>
            <label className="sf-field-label">Data</label>
            <input type="date" className="sf-input" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
            <label className="sf-field-label">Local</label>
            <input className="sf-input" placeholder="Quadra / arena" value={newLocal} onChange={(e) => setNewLocal(e.target.value)} />
            <label className="sf-field-label">Limite de vagas (opcional)</label>
            <input type="number" min="1" className="sf-input" placeholder="Sem limite" value={newMaxPlayers} onChange={(e) => setNewMaxPlayers(e.target.value)} />
            <div className="sf-modal-actions">
              <button className="sf-btn-ghost" onClick={() => setShowNewGame(false)}>Cancelar</button>
              <button className="sf-btn-primary" onClick={createGame}>Criar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- root ----------

export default function Home() {
  const [session, setSession] = useState(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => setSession(sess));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (session === undefined) {
    return (
      <div className="sf-app sf-loading">
        <style>{CSS}</style>
        <Loader2 className="sf-spin" size={28} />
      </div>
    );
  }
  if (!session) return <LoginScreen />;
  return <MainApp session={session} />;
}

// ---------- styles ----------

const CSS = `
  .sf-app {
    --pitch-dark: #0B2417;
    --pitch-mid: #143622;
    --pitch-mid2: #1E4A2E;
    --chalk: #EDF6EE;
    --chalk-dim: #8FB39C;
    --floodlight: #FFC53D;
    --team-a: #FF5C5C;
    --team-b: #4FC3F7;
    --danger: #FF6B6B;
    --line: rgba(237,246,238,0.14);
    font-family: 'Inter', sans-serif;
    background: var(--pitch-dark);
    color: var(--chalk);
    min-height: 100vh;
    max-width: 480px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    position: relative;
  }
  .sf-loading { align-items: center; justify-content: center; }
  .sf-spin { animation: sf-spin 1s linear infinite; color: var(--floodlight); }
  @keyframes sf-spin { to { transform: rotate(360deg); } }

  .sf-login { align-items: center; justify-content: center; padding: 24px; }
  .sf-login-box { text-align: center; display: flex; flex-direction: column; align-items: center; gap: 14px; }
  .sf-login-copy { color: var(--chalk-dim); font-size: 13px; max-width: 280px; margin: 0; }
  .sf-btn-google { max-width: 260px; }

  .sf-header { padding: 20px 20px 16px; border-bottom: 1px solid var(--line); background: linear-gradient(180deg, rgba(255,197,61,0.06), transparent); }
  .sf-header-row { display: flex; align-items: flex-start; justify-content: space-between; }
  .sf-wordmark { font-family: 'Oswald', sans-serif; font-weight: 700; font-size: 26px; letter-spacing: 2px; text-transform: uppercase; }
  .sf-wordmark-dot { color: var(--floodlight); }
  .sf-tagline { color: var(--chalk-dim); font-size: 12px; margin-top: 2px; letter-spacing: 0.3px; }

  .sf-main { flex: 1; padding: 16px; padding-bottom: 96px; overflow-y: auto; }

  .sf-h2 { font-family: 'Oswald', sans-serif; font-size: 18px; font-weight: 600; }
  .sf-h3 { font-family: 'Oswald', sans-serif; font-size: 15px; font-weight: 600; }
  .sf-eyebrow { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: var(--floodlight); font-weight: 600; }
  .sf-muted { color: var(--chalk-dim); font-size: 13px; padding: 8px 0; }
  .sf-muted-sm { color: var(--chalk-dim); font-size: 11px; display: flex; align-items: center; gap: 4px; margin-top: 2px; }
  .sf-roster-hint { margin-top: 4px; line-height: 1.5; }

  .sf-empty { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 48px 16px; color: var(--chalk-dim); text-align: center; font-size: 13px; }

  .sf-list-view { display: flex; flex-direction: column; gap: 10px; }

  .sf-game-card { display: flex; align-items: center; gap: 12px; background: var(--pitch-mid); border: 1px solid var(--line); border-radius: 10px; padding: 12px 14px; text-align: left; cursor: pointer; color: inherit; }
  .sf-game-card-date { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--floodlight); text-transform: uppercase; width: 44px; flex-shrink: 0; }
  .sf-game-card-info { flex: 1; }
  .sf-badge { font-size: 10px; padding: 4px 8px; border-radius: 20px; background: var(--pitch-mid2); color: var(--chalk-dim); white-space: nowrap; }
  .sf-badge-done { background: rgba(79,195,247,0.15); color: var(--team-b); }

  .sf-fixed-add { position: sticky; bottom: 8px; width: 100%; margin-top: 8px; }

  .sf-btn-primary { display: flex; align-items: center; justify-content: center; gap: 8px; background: var(--floodlight); color: var(--pitch-dark); border: none; font-family: 'Inter', sans-serif; font-weight: 700; font-size: 14px; padding: 12px 16px; border-radius: 10px; cursor: pointer; width: 100%; margin-top: 8px; }
  .sf-btn-toggle-on { background: var(--team-b); }
  .sf-btn-ghost { background: transparent; border: 1px solid var(--line); color: var(--chalk); padding: 12px 16px; border-radius: 10px; font-size: 14px; cursor: pointer; flex: 1; }
  .sf-btn-whatsapp { display: flex; align-items: center; justify-content: center; gap: 8px; background: #25D366; color: #0B2417; border: none; font-weight: 700; padding: 13px 16px; border-radius: 10px; cursor: pointer; width: 100%; margin: 16px 0 8px; }

  .sf-icon-btn { background: var(--pitch-mid2); border: none; color: var(--chalk); border-radius: 8px; padding: 8px; cursor: pointer; display: flex; }
  .sf-danger { color: var(--danger); }

  .sf-tabbar { position: fixed; bottom: 0; left: 50%; transform: translateX(-50%); width: 100%; max-width: 480px; display: flex; background: var(--pitch-mid); border-top: 1px solid var(--line); padding: 8px 12px calc(8px + env(safe-area-inset-bottom)); }
  .sf-tab { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 3px; background: none; border: none; color: var(--chalk-dim); font-size: 11px; padding: 6px; cursor: pointer; }
  .sf-tab-on { color: var(--floodlight); }

  .sf-card { background: var(--pitch-mid); border: 1px solid var(--line); border-radius: 12px; padding: 14px; margin-bottom: 12px; }
  .sf-card-title { display: flex; align-items: center; gap: 8px; font-family: 'Oswald', sans-serif; font-size: 14px; letter-spacing: 0.5px; text-transform: uppercase; color: var(--chalk-dim); margin-bottom: 10px; }
  .sf-card-subtitle { font-size: 12px; color: var(--chalk-dim); margin: 10px 0 6px; }

  .sf-detail-topbar { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
  .sf-detail-topbar > div:nth-child(2) { flex: 1; }

  .sf-rsvp-list { display: flex; flex-direction: column; gap: 6px; max-height: 260px; overflow-y: auto; }
  .sf-rsvp-row { display: flex; align-items: center; gap: 10px; background: var(--pitch-dark); border: 1px solid var(--line); border-radius: 8px; padding: 9px 10px; color: var(--chalk); text-align: left; }
  .sf-rsvp-on { border-color: var(--floodlight); background: rgba(255,197,61,0.08); }
  .sf-rsvp-me { border-color: var(--team-b); }
  .sf-rsvp-waitlist { opacity: 0.75; border-style: dashed; }
  .sf-waitlist-tag { font-size: 10px; color: var(--floodlight); background: rgba(255,197,61,0.12); border-radius: 10px; padding: 2px 7px; margin-right: 6px; white-space: nowrap; }
  .sf-rsvp-check { width: 18px; height: 18px; border-radius: 5px; border: 1.5px solid var(--chalk-dim); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .sf-rsvp-on .sf-rsvp-check { background: var(--floodlight); border-color: var(--floodlight); color: var(--pitch-dark); }
  .sf-rsvp-name { flex: 1; font-size: 13px; }

  .sf-stars { display: flex; gap: 2px; }

  .sf-teams-legend { display: flex; flex-direction: column; gap: 4px; font-size: 12px; margin-top: 10px; }
  .sf-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 6px; }
  .sf-dot-a { background: var(--team-a); }
  .sf-dot-b { background: var(--team-b); }

  .sf-cost-row { display: flex; justify-content: space-between; align-items: center; padding: 6px 0; font-size: 13px; }
  .sf-mono-value { font-family: 'JetBrains Mono', monospace; font-weight: 600; background: none; border: none; color: var(--floodlight); cursor: pointer; font-size: 13px; }
  .sf-input-inline { font-family: 'JetBrains Mono', monospace; background: var(--pitch-dark); border: 1px solid var(--floodlight); color: var(--chalk); border-radius: 6px; padding: 4px 8px; width: 90px; text-align: right; }

  .sf-paid-list { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
  .sf-paid-item { display: flex; align-items: center; gap: 4px; }
  .sf-charge-btn { display: flex; align-items: center; justify-content: center; width: 24px; height: 24px; border-radius: 50%; background: #25D366; border: none; color: #0B2417; cursor: pointer; flex-shrink: 0; }

  .sf-pix-box { margin-top: 12px; padding-top: 12px; border-top: 1px dashed var(--line); }
  .sf-pix-key-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .sf-pix-key-type { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--pitch-dark); background: #32BCAD; border-radius: 5px; padding: 3px 7px; }
  .sf-pix-key-value { font-family: 'JetBrains Mono', monospace; font-size: 13px; color: var(--chalk); word-break: break-all; }
  .sf-pix-warning { font-size: 11px; color: var(--floodlight); background: rgba(255,197,61,0.1); border-radius: 8px; padding: 8px 10px; margin-top: 6px; line-height: 1.4; }
  .sf-pix-edit-toggle { width: 100%; text-align: center; margin-bottom: 8px; }
  .sf-pix-form { display: flex; flex-direction: column; gap: 4px; margin-bottom: 10px; }
  .sf-pix-form .sf-field-label { margin-top: 8px; }
  .sf-pix-code { font-family: 'JetBrains Mono', monospace; font-size: 10px; word-break: break-all; background: var(--pitch-dark); border: 1px solid var(--line); border-radius: 8px; padding: 10px; color: var(--chalk-dim); max-height: 70px; overflow-y: auto; margin-bottom: 8px; }
  .sf-btn-pix { background: #32BCAD; color: #0B2417; }

  .sf-admin-tag { font-size: 9px; font-weight: 700; color: var(--pitch-dark); background: var(--floodlight); border-radius: 4px; padding: 2px 5px; margin-left: 6px; vertical-align: middle; }
  .sf-admin-toggle { font-size: 10px; background: var(--pitch-dark); border: 1px solid var(--line); color: var(--chalk-dim); border-radius: 8px; padding: 6px 8px; cursor: pointer; white-space: nowrap; }
  .sf-paid-chip { font-size: 11px; padding: 6px 10px; border-radius: 20px; background: var(--pitch-dark); border: 1px solid var(--line); color: var(--chalk-dim); cursor: pointer; display: flex; align-items: center; gap: 4px; }
  .sf-paid-on { background: rgba(79,195,247,0.15); border-color: var(--team-b); color: var(--team-b); }

  .sf-score-row { display: flex; align-items: center; justify-content: center; gap: 14px; margin: 6px 0 4px; }
  .sf-score-box { display: flex; flex-direction: column; align-items: center; gap: 6px; font-size: 11px; color: var(--chalk-dim); }
  .sf-score-input { width: 56px; text-align: center; font-family: 'JetBrains Mono', monospace; font-size: 22px; font-weight: 700; background: var(--pitch-dark); border: 1px solid var(--line); border-radius: 8px; color: var(--floodlight); padding: 6px 0; }
  .sf-score-x { color: var(--chalk-dim); font-family: 'Oswald', sans-serif; }

  .sf-scorers-list { display: flex; flex-direction: column; gap: 6px; max-height: 200px; overflow-y: auto; margin-bottom: 10px; }
  .sf-scorer-row { display: flex; justify-content: space-between; align-items: center; font-size: 13px; padding: 4px 0; }
  .sf-scorer-controls-group { display: flex; align-items: center; gap: 14px; }
  .sf-scorer-controls { display: flex; align-items: center; gap: 8px; }
  .sf-mini-btn { width: 24px; height: 24px; border-radius: 6px; border: 1px solid var(--line); background: var(--pitch-dark); color: var(--chalk); cursor: pointer; }

  .sf-subtabs { display: flex; gap: 8px; margin-bottom: 12px; }
  .sf-subtab { flex: 1; padding: 9px; border-radius: 8px; border: 1px solid var(--line); background: var(--pitch-mid); color: var(--chalk-dim); font-size: 13px; cursor: pointer; }
  .sf-subtab-on { background: var(--floodlight); color: var(--pitch-dark); font-weight: 700; border-color: var(--floodlight); }

  .sf-player-card { display: flex; justify-content: space-between; align-items: center; background: var(--pitch-mid); border: 1px solid var(--line); border-radius: 10px; padding: 12px 14px; margin-bottom: 8px; }
  .sf-me-card { display: block; }
  .sf-player-card-me { border-color: var(--floodlight); background: rgba(255,197,61,0.06); }
  .sf-me-tag { font-size: 10px; color: var(--floodlight); text-transform: uppercase; letter-spacing: 0.5px; }

  .sf-position-pills { display: flex; flex-wrap: wrap; gap: 6px; }
  .sf-physical-row { display: flex; gap: 10px; }
  .sf-physical-field { flex: 1; display: flex; flex-direction: column; gap: 4px; }
  .sf-physical-field .sf-input { width: 100%; box-sizing: border-box; }
  .sf-pos-pill { font-size: 12px; padding: 7px 12px; border-radius: 20px; background: var(--pitch-dark); border: 1px solid var(--line); color: var(--chalk-dim); cursor: pointer; display: flex; align-items: center; gap: 4px; }
  .sf-pos-pill-on { background: var(--floodlight); color: var(--pitch-dark); border-color: var(--floodlight); font-weight: 700; }
  .sf-pos-pill-gk.sf-pos-pill-on { background: #FFC53D; }

  .sf-gk-tag { display: inline-flex; align-items: center; gap: 2px; font-size: 9px; font-weight: 700; color: #0B2417; background: var(--floodlight); border-radius: 4px; padding: 2px 5px; margin-right: 6px; vertical-align: middle; }

  .sf-gk-toggle { display: flex; gap: 6px; }
  .sf-gk-toggle button { font-size: 12px; padding: 5px 12px; border-radius: 20px; background: var(--pitch-dark); border: 1px solid var(--line); color: var(--chalk-dim); cursor: pointer; }
  .sf-gk-toggle-on { background: var(--team-b) !important; color: var(--pitch-dark) !important; border-color: var(--team-b) !important; font-weight: 700; }

  .sf-paid-exempt { opacity: 0.6; cursor: default; font-style: italic; }

  .sf-ranking-table { background: var(--pitch-mid); border: 1px solid var(--line); border-radius: 10px; overflow: hidden; }
  .sf-ranking-header, .sf-ranking-row { display: grid; grid-template-columns: 1fr 20px 20px 34px 32px 30px 30px; align-items: center; padding: 10px 8px; gap: 3px; font-size: 11px; }
  .sf-ranking-header { color: var(--chalk-dim); text-transform: uppercase; font-size: 10px; letter-spacing: 0.5px; border-bottom: 1px solid var(--line); }
  .sf-ranking-row { border-bottom: 1px solid var(--line); }
  .sf-ranking-row:last-child { border-bottom: none; }
  .sf-rk-name { text-align: left; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .sf-rk-pts { color: var(--floodlight); font-weight: 700; }
  .sf-mvp-tag { color: var(--floodlight); font-size: 10px; }

  .sf-destaques-card { background: linear-gradient(135deg, rgba(255,197,61,0.10), rgba(79,195,247,0.06)); border-color: rgba(255,197,61,0.3); }
  .sf-destaques-grid { display: flex; gap: 16px; }
  .sf-destaque-item { display: flex; align-items: flex-start; gap: 10px; flex: 1; }
  .sf-destaque-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--chalk-dim); }
  .sf-destaque-name { font-family: 'Oswald', sans-serif; font-size: 15px; font-weight: 600; }

  .sf-eval-list { display: flex; flex-direction: column; gap: 10px; max-height: 260px; overflow-y: auto; margin-bottom: 10px; }
  .sf-eval-row { display: flex; justify-content: space-between; align-items: center; font-size: 13px; background: var(--pitch-dark); border: 1px solid var(--line); border-radius: 8px; padding: 9px 10px; }

  .sf-modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: flex-end; justify-content: center; z-index: 50; }
  .sf-modal { background: var(--pitch-mid); width: 100%; max-width: 480px; border-radius: 16px 16px 0 0; padding: 20px; display: flex; flex-direction: column; gap: 8px; }
  .sf-modal-title { font-family: 'Oswald', sans-serif; font-size: 18px; font-weight: 600; margin-bottom: 8px; }
  .sf-field-label { font-size: 11px; color: var(--chalk-dim); margin-top: 6px; }
  .sf-input { background: var(--pitch-dark); border: 1px solid var(--line); color: var(--chalk); border-radius: 8px; padding: 11px 12px; font-size: 14px; font-family: 'Inter', sans-serif; }
  .sf-modal-actions { display: flex; gap: 10px; margin-top: 14px; }
`;
