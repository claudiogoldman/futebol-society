'use client';

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import {
  Users, CalendarDays, Trophy, Shuffle, Wallet, Share2, Plus, Check,
  Star, ChevronLeft, Trash2, Loader2, Target, Award, LogOut, LogIn, Hand,
  Handshake, Shield, MessageCircle, Camera, UserRound, Layers, Copy, Settings, X
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { NATIONALITIES, countryFlag } from '../lib/countries';
import PositionTags from '../components/players/PositionTags';
import { drawTeams, isGoalkeeper as isGoleiro, physicalScore } from '../lib/domain/game';
import { averageRatingFor as avgRatingFor, computeGameHighlights as computeGameDestaques, computeRanking } from '../lib/domain/ranking';
import { formatDatePtBr, WEEKDAY_LABELS, nextDateForWeekday, money, gameLocationQuery, gameMapUrls } from '../lib/ui/society-formatters';
import { addGameParticipant, removeGameParticipant, toggleGameWaitlist, setGameCost, setGameGoalkeeperPays, setGamePixDetails as serviceSetGamePixDetails, setGameOrganizer as serviceSetGameOrganizer, setGameLocation as serviceSetGameLocation, setGameMaxPlayers, setGameTeams, setGamePayment, setPlayerStats, setGameResult, setGameGoals, setGameRatings, createGame as serviceCreateGame, deleteGame as serviceDeleteGame, confirmOrganizer as serviceConfirmOrganizer, createGroup as serviceCreateGroup, addGroupMember as serviceAddGroupMember, createGroupLocation as serviceCreateGroupLocation, updateGroupLocation as serviceUpdateGroupLocation, deleteGroupLocation as serviceDeleteGroupLocation, setGroupDefaultLocation as serviceSetGroupDefaultLocation, setGroupDefaults as serviceSetGroupDefaults, leaveGroup as serviceLeaveGroup, removeGroupMember as serviceRemoveGroupMember, deleteGroup as serviceDeleteGroup, addGameGuest as serviceAddGameGuest, joinGameByToken as serviceJoinGameByToken, joinGroupByToken as serviceJoinGroupByToken, updateMyProfile as serviceUpdateMyProfile, setAdmin as serviceSetAdmin } from '../lib/services/society-service';

// ---------- helpers ----------

const POSITION_LABELS = { goleiro: 'Goleiro', fixo: 'Fixo', libero: 'Líbero', meio: 'Meio', ala_esquerdo: 'Ala Esquerdo', ala_direito: 'Ala Direito', pivo: 'Pivô' };
const POSITION_ORDER = ['goleiro', 'fixo', 'libero', 'meio', 'ala_esquerdo', 'ala_direito', 'pivo'];

// combines weight + age deviation from a "typical" player into one number,
// used only to break near-ties in the rating balance so the draw doesn't
// accidentally stack every heavy/young player on the same side.
function playerMeta(p) {
  const bits = [];
  const knownPositions = Array.isArray(p.positions) ? p.positions.filter((pos) => POSITION_LABELS[pos]) : [];
  if (knownPositions.length > 0) bits.push(knownPositions.map((pos) => POSITION_LABELS[pos]).join(' / '));
  if (p.age) bits.push(`${p.age} anos`);
  if (p.weight_kg) bits.push(`${p.weight_kg}kg`);
  return bits.join(' · ');
}

// ---------- player card (ATA/DEF/FOR/HAB rating card) ----------

const POSITION_ABBREV = { goleiro: 'GOL', fixo: 'FIX', libero: 'LIB', meio: 'MEI', ala_esquerdo: 'ALE', ala_direito: 'ALD', pivo: 'PIV' };

function computeOVR(p) {
  const vals = [p.attr_ata, p.attr_def, p.attr_for, p.attr_hab].map((v) => (v == null || v === '' ? 50 : Number(v)));
  return Math.round(vals.reduce((a, b) => a + b, 0) / 4);
}

function primaryPositionAbbrev(p) {
  // skip stale/unknown values (e.g. leftovers from an older position system)
  // instead of silently falling back to LIN on the first entry
  const known = Array.isArray(p.positions) ? p.positions.find((pos) => POSITION_ABBREV[pos]) : null;
  return known ? POSITION_ABBREV[known] : 'LIN';
}

function cardTier(ovr) {
  if (ovr >= 80) return { grad: 'linear-gradient(160deg, #0B2417 0%, #1E4A2E 45%, #FFC53D 100%)', label: 'Lenda', text: '#EDF6EE', accent: '#FFC53D' };
  if (ovr >= 65) return { grad: 'linear-gradient(160deg, #8A6412 0%, #FFC53D 55%, #FFE9B0 100%)', label: 'Ouro', text: '#0B2417', accent: '#0B2417' };
  if (ovr >= 50) return { grad: 'linear-gradient(160deg, #5A636B 0%, #C7CDD3 55%, #EEF1F3 100%)', label: 'Prata', text: '#0B2417', accent: '#0B2417' };
  return { grad: 'linear-gradient(160deg, #4A2E18 0%, #8B5E3C 55%, #C89B6E 100%)', label: 'Bronze', text: '#EDF6EE', accent: '#EDF6EE' };
}

function PlayerCard({ player, compact }) {
  const ovr = computeOVR(player);
  const tier = cardTier(ovr);
  const pos = primaryPositionAbbrev(player);
  const firstName = (player.name || '?').trim().split(' ')[0];
  return (
    <div className={`sf-pcard ${compact ? 'sf-pcard-compact' : ''}`} style={{ background: tier.grad, color: tier.text }}>
      <div className="sf-pcard-top">
        <div className="sf-pcard-ovr">{ovr}</div>
        <div className="sf-pcard-pos">{pos}</div>
      </div>
      <div className="sf-pcard-photo">
        {player.avatar_url ? <img src={player.avatar_url} alt="" /> : <UserRound size={compact ? 26 : 46} color={tier.accent} />}
      </div>
      <div className="sf-pcard-name">{player.nationality_code ? <span aria-label={player.nationality_code} style={{ marginRight: 3 }}>{countryFlag(player.nationality_code)}</span> : null}{firstName}</div>
      {!compact && (
        <div className="sf-pcard-stats">
          <div><span>{player.attr_ata ?? 50}</span><label>ATA</label></div>
          <div><span>{player.attr_def ?? 50}</span><label>DEF</label></div>
          <div><span>{player.attr_for ?? 50}</span><label>FOR</label></div>
          <div><span>{player.attr_hab ?? 50}</span><label>HAB</label></div>
        </div>
      )}
      <div className="sf-pcard-brand">SOCIETY</div>
    </div>
  );
}

// Draws balanced teams while keeping positional coverage when possible.
// Positions are preferences only: a player can be assigned to another slot when
// needed to complete both teams. Players without positions are distributed by
// the normal rating balance and receive fallback positions in the pitch view.
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
  const baseSlots = [
    { pos: 'goleiro', x: 50, y: 90 },
    { pos: 'fixo', x: 30, y: 72 },
    { pos: 'libero', x: 70, y: 72 },
    { pos: 'meio', x: 50, y: 54 },
    { pos: 'ala_esquerdo', x: 20, y: 48 },
    { pos: 'ala_direito', x: 80, y: 48 },
    { pos: 'pivo', x: 50, y: 28 },
  ];
  const extraSlots = [
    { x: 35, y: 60 }, { x: 65, y: 60 }, { x: 35, y: 38 }, { x: 65, y: 38 },
    { x: 50, y: 40 }, { x: 50, y: 65 }, { x: 20, y: 62 }, { x: 80, y: 62 },
  ];

  const assignSlots = (team, mirrored) => {
    const slots = baseSlots.map((s) => ({ ...s, y: mirrored ? 100 - s.y : s.y }));
    const extras = extraSlots.map((s) => ({ ...s, y: mirrored ? 100 - s.y : s.y }));
    const available = [...slots];
    const assigned = [];
    const positional = [];
    const unpositioned = [];

    team.forEach((player) => {
      const positions = Array.isArray(player.positions) ? player.positions : [];
      const known = positions.filter((p) => POSITION_LABELS[p]);
      if (known.length) positional.push({ player, positions: known });
      else unpositioned.push(player);
    });

    positional.sort((a, b) => {
      const aGk = a.positions.includes('goleiro') ? 0 : 1;
      const bGk = b.positions.includes('goleiro') ? 0 : 1;
      return aGk - bGk;
    });

    positional.forEach(({ player, positions }) => {
      const slotIndex = available.findIndex((slot) => positions.includes(slot.pos));
      if (slotIndex >= 0) {
        const [slot] = available.splice(slotIndex, 1);
        assigned.push({ player, ...slot });
      } else {
        unpositioned.push(player);
      }
    });

    for (let i = unpositioned.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [unpositioned[i], unpositioned[j]] = [unpositioned[j], unpositioned[i]];
    }
    unpositioned.forEach((player) => {
      const slot = available.shift() || extras.shift();
      if (slot) assigned.push({ player, ...slot });
    });

    team.slice(assigned.length).forEach((player, i) => {
      const angle = (i / Math.max(1, team.length)) * Math.PI * 2;
      const x = Math.max(10, Math.min(90, 50 + Math.cos(angle) * 34));
      const rawY = 50 + Math.sin(angle) * 28;
      const y = mirrored ? 100 - rawY : rawY;
      assigned.push({ player, x, y });
    });
    return assigned;
  };

  const posA = assignSlots(teamA, false);
  const posB = assignSlots(teamB, true);
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
    const search = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    const joinToken = search ? search.get('join') : null;
    const joinGroupToken = search ? search.get('joinGroup') : null;
    if (joinToken && typeof window !== 'undefined') sessionStorage.setItem('sf_join_token', joinToken);
    if (joinGroupToken && typeof window !== 'undefined') sessionStorage.setItem('sf_join_group_token', joinGroupToken);
    const qs = joinToken ? `/?join=${joinToken}` : (joinGroupToken ? `/?joinGroup=${joinGroupToken}` : '');
    const redirectTo = typeof window !== 'undefined' ? window.location.origin + qs : undefined;
    supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } });
  };
  return (
    <div className="sf-app sf-login">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
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
  const [ataDraft, setAtaDraft] = useState(me.attr_ata ?? 50);
  const [defDraft, setDefDraft] = useState(me.attr_def ?? 50);
  const [forDraft, setForDraft] = useState(me.attr_for ?? 50);
  const [habDraft, setHabDraft] = useState(me.attr_hab ?? 50);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const togglePosition = (pos) => {
    const next = positions.includes(pos) ? positions.filter((p) => p !== pos) : [...positions, pos];
    onUpdate({ positions: next });
  };

  const handlePhotoPick = () => fileInputRef.current?.click();

  const handlePhotoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      const path = `${me.id}/avatar.${ext}`;
      const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true, cacheControl: '3600' });
      if (!error) {
        const { data } = supabase.storage.from('avatars').getPublicUrl(path);
        onUpdate({ avatar_url: `${data.publicUrl}?t=${Date.now()}` });
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const saveAttr = (field, value) => {
    const clamped = Math.max(1, Math.min(99, parseInt(value, 10) || 50));
    onUpdate({ [field]: clamped });
  };

  return (
    <div className="sf-player-card sf-player-card-me sf-me-card">
      <div className="sf-pcard-preview-row">
        <PlayerCard player={{ ...me, attr_ata: ataDraft, attr_def: defDraft, attr_for: forDraft, attr_hab: habDraft }} />
        <div className="sf-pcard-photo-edit">
          <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoChange} />
          <button className="sf-btn-ghost sf-pcard-photo-btn" onClick={handlePhotoPick} disabled={uploading}>
            <Camera size={14} /> {uploading ? 'Enviando...' : 'Trocar foto'}
          </button>
          <div className="sf-muted-sm" style={{ marginTop: 8 }}>Atributos do card (1-99)</div>
          <div className="sf-attr-grid">
            <div className="sf-attr-field">
              <label>ATA</label>
              <input type="number" min="1" max="99" value={ataDraft} onChange={(e) => setAtaDraft(e.target.value)} onBlur={() => saveAttr('attr_ata', ataDraft)} />
            </div>
            <div className="sf-attr-field">
              <label>DEF</label>
              <input type="number" min="1" max="99" value={defDraft} onChange={(e) => setDefDraft(e.target.value)} onBlur={() => saveAttr('attr_def', defDraft)} />
            </div>
            <div className="sf-attr-field">
              <label>FOR</label>
              <input type="number" min="1" max="99" value={forDraft} onChange={(e) => setForDraft(e.target.value)} onBlur={() => saveAttr('attr_for', forDraft)} />
            </div>
            <div className="sf-attr-field">
              <label>HAB</label>
              <input type="number" min="1" max="99" value={habDraft} onChange={(e) => setHabDraft(e.target.value)} onBlur={() => saveAttr('attr_hab', habDraft)} />
            </div>
          </div>
        </div>
      </div>
      <div className="sf-h3">{me.name} <span className="sf-me-tag">você</span></div>
      <div className="sf-muted-sm" style={{ margin: '12px 0 6px' }}>Nacionalidade</div>
      <select
        className="sf-input"
        value={me.nationality_code || ''}
        onChange={(e) => onUpdate({ nationality_code: e.target.value || null })}
      >
        <option value="">Sem nacionalidade</option>
        {NATIONALITIES.map(([code, name]) => <option key={code} value={code}>{countryFlag(code)} {name}</option>)}
      </select>
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



function GameDetail({ game, roster, groupMembers, groupMemberIds, myId, isAdmin, onBack, onToggleMyRSVP, onAddParticipant, onAddGuest, onOpenGroup, onRemoveParticipant, onSetCost, onSetGkPays, onSetMaxPlayers, onSetGamePixDetails, onSetGameOrganizer, onSetGameLocation, onDraw, onSaveTeams, onTogglePaid, onSaveResult, onSavePlayerStats, onSaveRatings, onDelete, onShare }) {
  const [scoreA, setScoreA] = useState(game.result?.scoreA ?? 0);
  const [scoreB, setScoreB] = useState(game.result?.scoreB ?? 0);
  const [scorers, setScorers] = useState(game.result?.scorers || {});
  const [editingCost, setEditingCost] = useState(false);
  const [costDraft, setCostDraft] = useState(game.cost || 0);
  const [editingPix, setEditingPix] = useState(false);
  const [editingMaxPlayers, setEditingMaxPlayers] = useState(false);
  const [editingLocation, setEditingLocation] = useState(false);
  const [locationNameDraft, setLocationNameDraft] = useState(game.local || '');
  const [locationAddressDraft, setLocationAddressDraft] = useState(game.locationAddress || '');
  const [locationCityDraft, setLocationCityDraft] = useState(game.locationCity || '');
  const [locationStateDraft, setLocationStateDraft] = useState(game.locationState || '');
  const [locationLatitudeDraft, setLocationLatitudeDraft] = useState(game.locationLatitude ?? '');
  const [locationLongitudeDraft, setLocationLongitudeDraft] = useState(game.locationLongitude ?? '');
  const [maxPlayersDraft, setMaxPlayersDraft] = useState('');
  const [pixDraft, setPixDraft] = useState(game.pixKey || '');
  const [pixReceiverDraft, setPixReceiverDraft] = useState('');
  const [pixCityDraft, setPixCityDraft] = useState('');
  const [pixOwnerDraft, setPixOwnerDraft] = useState('');
  const [participantDraft, setParticipantDraft] = useState('');
  const [managementOpen, setManagementOpen] = useState(false);
  const [guestNameDraft, setGuestNameDraft] = useState('');
  const [guestEmailDraft, setGuestEmailDraft] = useState('');
  const [guestPositionDraft, setGuestPositionDraft] = useState('');
  const [editingTeams, setEditingTeams] = useState(false);
  const [teamDraft, setTeamDraft] = useState({});

  const [assists, setAssists] = useState(game.result?.scorers ? (game.assists || {}) : {});
  const [myGoalsDraft, setMyGoalsDraft] = useState(game.result?.scorers?.[myId] || 0);
  const [myAssistsDraft, setMyAssistsDraft] = useState(game.assists?.[myId] || 0);
  // Confirmed participants and the persistent waitlist are separate sources of truth.
  const confirmedPlayers = game.confirmed.map((id) => roster.find((p) => p.id === id)).filter(Boolean);
  const maxPlayers = game.maxPlayers || null;
  const activePlayers = maxPlayers ? confirmedPlayers.slice(0, maxPlayers) : confirmedPlayers;
  const waitlistIds = game.waitlist || [];
  const waitlistPlayers = waitlistIds.map((id) => roster.find((p) => p.id === id)).filter(Boolean);
  const gkPays = game.goalkeeperPays !== false;
  const payingPlayers = gkPays ? activePlayers : activePlayers.filter((p) => !isGoleiro(p));
  const rateio = payingPlayers.length > 0 ? (game.cost || 0) / payingPlayers.length : 0;
  const paidCount = payingPlayers.filter((p) => game.payments?.[p.id]).length;
  const hasTeams = game.teamA && game.teamA.length > 0;
  const allPlayers = hasTeams ? [...game.teamA, ...game.teamB] : [];
  const destaques = useMemo(() => computeGameDestaques(game), [game]);
  const iAmConfirmed = game.confirmed.includes(myId);
  const iAmWaitlisted = waitlistIds.includes(myId);
  const myWaitlistPos = waitlistIds.findIndex((id) => id === myId);
  const isGameAdmin = !!(game.groupId && groupMembers.some((m) => String(m.group_id) === String(game.groupId) && String(m.user_id) === String(myId) && m.role === 'admin'));
  // Before completion, the creator can manage the match. After completion,
  // structural changes are restricted to group admins; the creator may still
  // record/correct the final score.
  const canManage = !game.result && myId === game.createdBy || isGameAdmin;
  const canRecordResult = myId === game.createdBy || isGameAdmin;
  const organizer = roster.find((p) => p.id === (game.organizerId || game.createdBy));
  // pix key/receiver/city are per-game settings (whoever is collecting for THAT
  // match may differ from the organizer), falling back to sensible defaults
  const activePixKey = game.pixKey || organizer?.pix_key || null;
  const activePixReceiver = game.pixReceiverName || organizer?.name || 'Organizador';
  const activePixCity = game.pixCity || '';
  const mapUrls = gameMapUrls(game);
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
    window.open(`https://api.whatsapp.com/send/?phone=${p.phone}&text=${encodeURIComponent(msg)}`, '_blank');
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
        {canManage && (
          <button type="button" aria-label="Gestão da partida" title="Gestão da partida" className="sf-game-management-fab" onClick={() => setManagementOpen(true)}>
            <Settings size={24} />
          </button>
        )}
        {canManage && <button className="sf-icon-btn sf-danger" onClick={() => onDelete(game.id)}><Trash2 size={18} /></button>}
      </div>

      {canManage && managementOpen && (
        <div className="sf-modal-backdrop" onClick={() => setManagementOpen(false)}>
          <div className="sf-modal sf-game-management-modal" role="dialog" aria-modal="true" aria-labelledby="sf-game-management-title" onClick={(e) => e.stopPropagation()} style={{ maxHeight: '86vh', overflowY: 'auto' }}>
            <div className="sf-game-management-header">
              <div><div id="sf-game-management-title" className="sf-modal-title" style={{ marginBottom: 2 }}>Gestão da partida</div><div className="sf-muted-sm">{formatDatePtBr(game.date)} · {game.local || 'Local a definir'}</div></div>
              <button type="button" className="sf-icon-btn" aria-label="Fechar gestão" onClick={() => setManagementOpen(false)}><X size={18} /></button>
            </div>
            <section className="sf-management-area">
              <div className="sf-card-title"><Target size={16} /> Manter local</div>
              <div className="sf-management-summary">
                <div><span className="sf-muted">Nome</span><strong>{game.local || 'Local a definir'}</strong></div>
                <div><span className="sf-muted">Endereço</span><strong>{game.locationAddress || 'Não informado'}</strong></div>
                <div><span className="sf-muted">Cidade/UF</span><strong>{game.locationCity || game.locationState ? `${game.locationCity || '—'}/${game.locationState || '—'}` : 'Não informado'}</strong></div>
              </div>
              <button type="button" className="sf-btn-primary" onClick={() => { setLocationNameDraft(game.local || ''); setLocationAddressDraft(game.locationAddress || ''); setLocationCityDraft(game.locationCity || ''); setLocationStateDraft(game.locationState || ''); setLocationLatitudeDraft(game.locationLatitude ?? ''); setLocationLongitudeDraft(game.locationLongitude ?? ''); setManagementOpen(false); setEditingLocation(true); }}><Target size={16} /> Editar local da partida</button>
              {game.groupId && <button type="button" className="sf-btn-ghost" onClick={() => { setManagementOpen(false); onOpenGroup(game.groupId); }}>Gerenciar locais do grupo</button>}
            </section>
            <section className="sf-management-area">
              <div className="sf-card-title"><Users size={16} /> Manter jogadores da partida</div>
              <div className="sf-muted-sm">{activePlayers.length}{maxPlayers ? `/${maxPlayers}` : ''} confirmados</div>
              {game.groupId && <div className="sf-management-player-add"><select className="sf-input" value={participantDraft} onChange={(e) => setParticipantDraft(e.target.value)}><option value="">Adicionar jogador do grupo...</option>{roster.filter((p) => groupMemberIds?.has(String(p.id)) && !game.confirmed.some((id) => String(id) === String(p.id))).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select><button type="button" className="sf-btn-primary" disabled={!participantDraft} onClick={async () => { await onAddParticipant(game.id, participantDraft); setParticipantDraft(''); }}>Adicionar</button></div>}
              <div className="sf-management-subtitle">Adicionar convidado não cadastrado</div>
              <input className="sf-input" placeholder="Nome" value={guestNameDraft} onChange={(e) => setGuestNameDraft(e.target.value)} />
              <input className="sf-input" style={{ marginTop: 6 }} type="email" placeholder="E-mail (opcional)" value={guestEmailDraft} onChange={(e) => setGuestEmailDraft(e.target.value)} />
              <select className="sf-input" style={{ marginTop: 6 }} value={guestPositionDraft} onChange={(e) => setGuestPositionDraft(e.target.value)}><option value="">Posição (opcional)</option>{POSITION_ORDER.map((pos) => <option key={pos} value={pos}>{POSITION_LABELS[pos]}</option>)}</select>
              <button type="button" className="sf-btn-primary" style={{ width: '100%', marginTop: 8 }} disabled={!guestNameDraft.trim()} onClick={async () => { const ok = await onAddGuest(game.id, guestNameDraft.trim(), guestEmailDraft.trim(), guestPositionDraft); if (ok) { setGuestNameDraft(''); setGuestEmailDraft(''); setGuestPositionDraft(''); } }}><Plus size={16} /> Adicionar convidado</button>
              <div className="sf-management-subtitle">Jogadores confirmados</div>
              <div className="sf-rsvp-list">{activePlayers.map((p) => <div key={p.id} className={`sf-rsvp-row sf-rsvp-on ${p.id === myId ? 'sf-rsvp-me' : ''}`}><span className="sf-rsvp-name"><PositionTags player={p} />{p.name}{p.id === myId ? ' (você)' : ''}</span><StarRating value={p.rating} readOnly size={12} onChange={() => {}} />{p.id !== myId && <button type="button" className="sf-mini-btn" title="Remover jogador da partida" onClick={() => onRemoveParticipant(game.id, p.id)}>×</button>}</div>)}{activePlayers.length === 0 && <div className="sf-muted">Nenhum jogador confirmado.</div>}</div>
            </section>
            <div className="sf-modal-actions"><button type="button" className="sf-btn-ghost" onClick={() => setManagementOpen(false)}>Fechar</button></div>
          </div>
        </div>
      )}

      <section id="sf-game-location-card" className="sf-card">
        <div className="sf-card-title"><Target size={16} /> Local da partida</div>
        {!editingLocation ? <>
          <div className="sf-cost-row"><span className="sf-muted">Nome</span><span className="sf-mono-value" style={{ cursor: 'default' }}>{game.local || '—'}</span></div>
          <div className="sf-cost-row"><span className="sf-muted">Endereço</span><span className="sf-mono-value" style={{ cursor: 'default', textAlign: 'right' }}>{game.locationAddress || '—'}</span></div>
          <div className="sf-cost-row"><span className="sf-muted">Cidade/UF</span><span className="sf-mono-value" style={{ cursor: 'default' }}>{game.locationCity || game.locationState ? `${game.locationCity || '—'}/${game.locationState || '—'}` : '—'}</span></div>
          {game.locationLatitude != null && game.locationLongitude != null && <div className="sf-muted-sm" style={{ marginTop: 6 }}>Coordenadas: {game.locationLatitude}, {game.locationLongitude}</div>}
          {(mapUrls.google || mapUrls.waze) && <div className="sf-modal-actions" style={{ marginTop: 10 }}>
            {mapUrls.google && <a className="sf-btn-ghost" href={mapUrls.google} target="_blank" rel="noreferrer">Google Maps</a>}
            {mapUrls.waze && <a className="sf-btn-ghost" href={mapUrls.waze} target="_blank" rel="noreferrer">Waze</a>}
          </div>}
          {canManage && <button className="sf-btn-ghost" style={{ width: '100%', marginTop: 8 }} onClick={() => { setLocationNameDraft(game.local || ''); setLocationAddressDraft(game.locationAddress || ''); setLocationCityDraft(game.locationCity || ''); setLocationStateDraft(game.locationState || ''); setLocationLatitudeDraft(game.locationLatitude ?? ''); setLocationLongitudeDraft(game.locationLongitude ?? ''); setEditingLocation(true); }}>Editar local</button>}
        </> : <>
          <label className="sf-field-label">Nome do local</label><input className="sf-input" value={locationNameDraft} onChange={(e) => setLocationNameDraft(e.target.value)} placeholder="Quadra / arena" />
          <label className="sf-field-label">Endereço</label><input className="sf-input" value={locationAddressDraft} onChange={(e) => setLocationAddressDraft(e.target.value)} placeholder="Rua, número, complemento" />
          <label className="sf-field-label">Cidade</label><input className="sf-input" value={locationCityDraft} onChange={(e) => setLocationCityDraft(e.target.value)} />
          <label className="sf-field-label">Estado/UF</label><input className="sf-input" maxLength="2" value={locationStateDraft} onChange={(e) => setLocationStateDraft(e.target.value.toUpperCase())} />
          <label className="sf-field-label">Latitude (opcional)</label><input type="number" step="any" className="sf-input" value={locationLatitudeDraft} onChange={(e) => setLocationLatitudeDraft(e.target.value)} />
          <label className="sf-field-label">Longitude (opcional)</label><input type="number" step="any" className="sf-input" value={locationLongitudeDraft} onChange={(e) => setLocationLongitudeDraft(e.target.value)} />
          <div className="sf-muted-sm">Geocodificação automática não foi identificada na infraestrutura atual; as coordenadas podem ser informadas manualmente até que um provedor seja definido.</div>
          <div className="sf-modal-actions"><button className="sf-btn-ghost" onClick={() => setEditingLocation(false)}>Cancelar</button><button className="sf-btn-primary" onClick={() => { onSetGameLocation(game.id, { local: locationNameDraft.trim() || null, locationAddress: locationAddressDraft.trim() || null, locationCity: locationCityDraft.trim() || null, locationState: locationStateDraft.trim() || null, locationLatitude: locationLatitudeDraft === '' ? null : Number(locationLatitudeDraft), locationLongitude: locationLongitudeDraft === '' ? null : Number(locationLongitudeDraft) }); setEditingLocation(false); }}>Salvar</button></div>
        </>}
      </section>

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
        <button className={`sf-btn-primary ${(iAmConfirmed || iAmWaitlisted) ? 'sf-btn-toggle-on' : ''}`} onClick={() => onToggleMyRSVP(game.id)}>
          {iAmConfirmed ? <><Check size={16} /> Você está confirmado</> : iAmWaitlisted ? <><span aria-hidden="true">⏳</span> Você tá na espera (#{myWaitlistPos + 1})</> : 'Confirmar minha presença'}
        </button>
        {!iAmConfirmed && maxPlayers && activePlayers.length >= maxPlayers && (
          <div className="sf-muted-sm" style={{ marginTop: 6 }}>Vagas lotadas — você entra na lista de espera.</div>
        )}
        <div className="sf-rsvp-list" style={{ marginTop: 10 }}>
          {roster.filter((p) => game.confirmed.includes(p.id)).map((p) => {
            const on = game.confirmed.includes(p.id);
            const onWaitlist = waitlistPlayers.some((w) => w.id === p.id);
            return (
              <div key={p.id} className={`sf-rsvp-row ${on ? 'sf-rsvp-on' : ''} ${p.id === myId ? 'sf-rsvp-me' : ''} ${onWaitlist ? 'sf-rsvp-waitlist' : ''}`}>
                <span className="sf-rsvp-check">{on && !onWaitlist ? <Check size={14} /> : null}</span>
                <span className="sf-rsvp-name">
                  <PositionTags player={p} />
                  {p.name}{p.id === myId ? ' (você)' : ''}
                </span>
                {onWaitlist && <span className="sf-waitlist-tag">espera #{waitlistPlayers.findIndex((w) => w.id === p.id) + 1}</span>}
                <StarRating value={p.rating} readOnly size={12} onChange={() => {}} />
                {canManage && on && p.id !== myId && <button type="button" className="sf-mini-btn" title="Remover jogador da partida" onClick={() => onRemoveParticipant(game.id, p.id)}>×</button>}
              </div>
            );
          })}
        </div>
        {canManage && <button type="button" className="sf-btn-ghost" style={{ width: '100%', marginTop: 10 }} onClick={() => setManagementOpen(true)}><Users size={16} /> Adicionar jogador</button>}
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
              <div className="sf-modal-actions">
                <button className="sf-btn-primary" onClick={() => onDraw(game.id, activePlayers)}>
                  <Shuffle size={16} /> {hasTeams ? 'Sortear novamente' : 'Sortear times'}
                </button>
                {hasTeams && !editingTeams && (
                  <button className="sf-btn-ghost" onClick={() => { const draft = {}; [...(game.teamA || []), ...(game.teamB || [])].forEach((p) => { draft[p.id] = (game.teamA || []).some((x) => x.id === p.id) ? 'A' : 'B'; }); setTeamDraft(draft); setEditingTeams(true); }}>Remanejar times</button>
                )}
              </div>
            )}
            {hasTeams && (
              <>
                {editingTeams && (
                  <div className="sf-card" style={{ marginTop: 10, padding: 10, background: 'var(--pitch-dark)' }}>
                    <div className="sf-card-subtitle" style={{ marginTop: 0 }}>Distribuição dos times</div>
                    {[...(game.teamA || []), ...(game.teamB || [])].map((p) => (
                      <div key={p.id} className="sf-cost-row">
                        <span>{p.name}{isGoleiro(p) ? ' (GOL)' : ''}</span>
                        <select className="sf-input-inline" value={teamDraft[p.id] || ''} onChange={(e) => setTeamDraft((d) => ({ ...d, [p.id]: e.target.value }))}>
                          <option value="A">Time A</option><option value="B">Time B</option>
                        </select>
                      </div>
                    ))}
                    <div className="sf-modal-actions">
                      <button className="sf-btn-ghost" onClick={() => setEditingTeams(false)}>Cancelar</button>
                      <button className="sf-btn-primary" onClick={async () => { const ok = await onSaveTeams(game.id, teamDraft, activePlayers); if (ok) setEditingTeams(false); }}>Salvar times</button>
                    </div>
                  </div>
                )}
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
          <span className="sf-muted">Organizador</span>
          {canManage ? (
            <select className="sf-input-inline" value={game.organizerId || ''} onChange={(e) => onSetGameOrganizer(game.id, e.target.value || null)}>
              <option value="">Não definido</option>
              {roster.filter((p) => !game.groupId || (groupMembers || []).some((m) => m.group_id === game.groupId && m.user_id === p.id)).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          ) : <span className="sf-mono-value" style={{ cursor: 'default' }}>{organizer?.name || '—'}</span>}
        </div>
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

      {hasTeams && game.result && !canManage && allPlayers.some((p) => p.id === myId) && (
        <section className="sf-card">
          <div className="sf-card-title"><Trophy size={16} /> Meus gols e assistências</div>
          <div className="sf-card-subtitle">Informe apenas os seus números. O organizador pode corrigir o resultado quando necessário.</div>
          <div className="sf-score-row">
            <div className="sf-score-box">
              <span>⚽ Gols</span>
              <input type="number" min="0" className="sf-score-input" value={myGoalsDraft} onChange={(e) => setMyGoalsDraft(Math.max(0, parseInt(e.target.value, 10) || 0))} />
            </div>
            <div className="sf-score-box">
              <span>🎯 Assistências</span>
              <input type="number" min="0" className="sf-score-input" value={myAssistsDraft} onChange={(e) => setMyAssistsDraft(Math.max(0, parseInt(e.target.value, 10) || 0))} />
            </div>
          </div>
          <button className="sf-btn-primary" onClick={() => onSavePlayerStats(game.id, myId, myGoalsDraft, myAssistsDraft)}>
            <Check size={16} /> Salvar meus números
          </button>
        </section>
      )}

      {hasTeams && canRecordResult && (
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

// ---------- group detail ----------

function GroupDetail({ group, games, members, locations, myId, onBack, onSetDefaults, onSetDefaultLocation, onShare, onNewGame, onOpenGame, onLeave, onDelete, onRemoveMember, onCreateLocation, onUpdateLocation, onDeleteLocation }) {
  const [editing, setEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState(group.name);
  const [dayDraft, setDayDraft] = useState(group.defaultDayOfWeek != null ? String(group.defaultDayOfWeek) : '');
  const [timeDraft, setTimeDraft] = useState(group.defaultTime);
  const [maxPlayersDraft, setMaxPlayersDraft] = useState(group.defaultMaxPlayers || '');
  const [costDraft, setCostDraft] = useState(group.defaultCost || '');
  const [locationDraft, setLocationDraft] = useState({ name: '', address: '', city: '', state: '', latitude: '', longitude: '', isDefault: false });
  const [editingLocationId, setEditingLocationId] = useState(null);
  const [goalkeeperPaysDraft, setGoalkeeperPaysDraft] = useState(group.defaultGoalkeeperPays !== false);
  const [pixKeyDraft, setPixKeyDraft] = useState(group.defaultPixKey || '');
  const [pixReceiverDraft, setPixReceiverDraft] = useState(group.defaultPixReceiverName || '');
  const [pixCityDraft, setPixCityDraft] = useState(group.defaultPixCity || '');
  const [avatarDraft, setAvatarDraft] = useState(group.avatar || null);
  const [avatarUrlDraft, setAvatarUrlDraft] = useState(group.avatarUrl || '');
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [organizerDraft, setOrganizerDraft] = useState(group.defaultOrganizerId || '');
  const [locationModalOpen, setLocationModalOpen] = useState(false);

  const isOwner = myId === group.createdBy;
  const myMembership = members.find((m) => m.user_id === myId || m.userId === myId);
  const canManage = isOwner || myMembership?.role === 'admin';
  useEffect(() => {
    setNameDraft(group.name || '');
    setDayDraft(group.defaultDayOfWeek != null ? String(group.defaultDayOfWeek) : '');
    setTimeDraft(group.defaultTime || '');
    setMaxPlayersDraft(group.defaultMaxPlayers ? String(group.defaultMaxPlayers) : '');
    setCostDraft(group.defaultCost != null ? String(group.defaultCost) : '');
    setEditingLocationId(null);
    setGoalkeeperPaysDraft(group.defaultGoalkeeperPays !== false);
    setPixKeyDraft(group.defaultPixKey || '');
    setPixReceiverDraft(group.defaultPixReceiverName || '');
    setPixCityDraft(group.defaultPixCity || '');
    setOrganizerDraft(group.defaultOrganizerId || '');
    setAvatarDraft(group.avatar || null);
    setAvatarUrlDraft(group.avatarUrl || '');
    setEditing(false);
  }, [group.id]);


  const handleAvatarUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { alert('Selecione uma imagem.'); return; }
    if (file.size > 5 * 1024 * 1024) { alert('A imagem deve ter no máximo 5 MB.'); return; }
    setAvatarUploading(true);
    try {
      const safeName = (file.name || 'grupo').replace(/[^a-zA-Z0-9._-]/g, '-');
      const filePath = group.id + '/' + myId + '/' + Date.now() + '-' + safeName;
      const { error } = await supabase.storage.from('group-images').upload(filePath, file, { upsert: false, contentType: file.type });
      if (error) throw error;
      const { data } = supabase.storage.from('group-images').getPublicUrl(filePath);
      setAvatarUrlDraft(data.publicUrl);
      setAvatarDraft(null);
    } catch (error) {
      alert('Não foi possível enviar a imagem: ' + error.message);
    } finally {
      setAvatarUploading(false);
      event.target.value = '';
    }
  };
  const upcoming = [...games].sort((a, b) => (a.date < b.date ? 1 : -1));

  const save = async () => {
    const ok = await onSetDefaults(group.id, {
      name: nameDraft.trim() || group.name,
      default_local: group.defaultLocal || null,
      default_day_of_week: dayDraft !== '' ? parseInt(dayDraft, 10) : null,
      default_time: timeDraft || null,
      default_max_players: maxPlayersDraft ? parseInt(maxPlayersDraft, 10) : null,
      default_cost: costDraft ? parseFloat(costDraft) : null,
      default_goalkeeper_pays: goalkeeperPaysDraft,
      default_pix_key: pixKeyDraft.trim() || null,
      default_pix_receiver_name: pixReceiverDraft.trim() || null,
      default_pix_city: pixCityDraft.trim() || null,
      default_organizer_id: organizerDraft || null,
      avatar: avatarDraft,
      avatar_url: avatarUrlDraft || null,
    });
    if (ok) setEditing(false);
  };

  return (
    <div className="sf-detail">
      <div className="sf-detail-topbar">
        <button className="sf-icon-btn" onClick={onBack}><ChevronLeft size={20} /></button>
        <div>
          <div className="sf-eyebrow">Grupo</div>
          <div className="sf-h2">{group.name}</div>
        </div>
        {isOwner && (
          <button className="sf-icon-btn sf-danger" onClick={() => { if (confirm('Apagar esse grupo? As partidas vinculadas não somem, só perdem o vínculo.')) onDelete(group.id); }}>
            <Trash2 size={18} />
          </button>
        )}
      </div>

      <section className="sf-card">
        <div className="sf-card-title"><Layers size={16} /> Padrões do grupo</div>
        {!editing ? (
          <>
            <div className="sf-cost-row"><span className="sf-muted">Local padrão</span><span className="sf-mono-value" style={{ cursor: 'default' }}>{locations.find((l) => l.is_default)?.name || locations.find((l) => l.isDefault)?.name || '—'}</span></div>
            <div className="sf-cost-row"><span className="sf-muted">Dia</span><span className="sf-mono-value" style={{ cursor: 'default' }}>{group.defaultDayOfWeek != null ? WEEKDAY_LABELS[group.defaultDayOfWeek] : '—'}</span></div>
            <div className="sf-cost-row"><span className="sf-muted">Horário</span><span className="sf-mono-value" style={{ cursor: 'default' }}>{group.defaultTime || '—'}</span></div>
            <div className="sf-cost-row"><span className="sf-muted">Vagas</span><span className="sf-mono-value" style={{ cursor: 'default' }}>{group.defaultMaxPlayers || 'sem limite'}</span></div>
            <div className="sf-cost-row"><span className="sf-muted">Imagem do grupo</span><img src={group.avatarUrl || '/group-avatars/futebol.svg'} alt="Imagem do grupo" style={{ width: 42, height: 42, objectFit: 'cover', borderRadius: 10, border: '1px solid var(--sf-border)' }} /></div>
            <div className="sf-cost-row"><span className="sf-muted">Custo da quadra</span><span className="sf-mono-value" style={{ cursor: 'default' }}>{group.defaultCost ? money(group.defaultCost) : '—'}</span></div>
            <div className="sf-cost-row"><span className="sf-muted">Goleiro paga?</span><span className="sf-mono-value" style={{ cursor: 'default' }}>{group.defaultGoalkeeperPays !== false ? 'Sim' : 'Não'}</span></div>
            <div className="sf-cost-row"><span className="sf-muted">Organizador padrão</span><span className="sf-mono-value" style={{ cursor: 'default' }}>{members.find((m) => m.id === group.defaultOrganizerId)?.name || '—'}</span></div>
            <div className="sf-cost-row"><span className="sf-muted">PIX</span><span className="sf-mono-value" style={{ cursor: 'default' }}>{group.defaultPixKey || '—'}</span></div>
            {canManage && <button className="sf-btn-ghost" style={{ width: '100%', marginTop: 6 }} onClick={() => setEditing(true)}>Editar padrões</button>}
          </>
        ) : (
          <>
            <label className="sf-field-label">Imagem do grupo</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <img src={avatarUrlDraft || '/group-avatars/futebol.svg'} alt="Prévia da imagem do grupo" style={{ width: 84, height: 84, objectFit: 'cover', borderRadius: 16, border: '1px solid var(--sf-border)' }} />
              <div style={{ display: 'grid', gap: 8 }}>
                <label className="sf-btn-ghost" style={{ cursor: avatarUploading ? 'wait' : 'pointer', textAlign: 'center' }}>
                  {avatarUploading ? 'Enviando imagem...' : 'Enviar imagem'}
                  <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" style={{ display: 'none' }} disabled={avatarUploading} onChange={handleAvatarUpload} />
                </label>
                <button type="button" className="sf-btn-ghost" disabled={!avatarUrlDraft || avatarUploading} onClick={() => setAvatarUrlDraft('')}>Remover imagem</button>
              </div>
            </div>
            <div className="sf-field-label" style={{ marginBottom: 8 }}>Ou escolha uma imagem esportiva</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8, marginBottom: 16 }}>
              {[['/group-avatars/futebol.svg','Futebol'],['/group-avatars/futsal.svg','Futsal'],['/group-avatars/society.svg','Society'],['/group-avatars/trophy.svg','Competição']].map(([url, label]) => <button type="button" key={url} onClick={() => { setAvatarUrlDraft(url); setAvatarDraft(null); }} className={avatarUrlDraft === url ? 'sf-btn-primary' : 'sf-btn-ghost'} style={{ padding: 5, minHeight: 74 }} title={label}><img src={url} alt={label} style={{ width: 58, height: 58, objectFit: 'cover', borderRadius: 10 }} /></button>)}
            </div>
            <label className="sf-field-label">Nome do grupo</label>
            <input className="sf-input" value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} />
            <label className="sf-field-label">Local padrão das partidas</label>
            <select className="sf-input" value={locations.find((l) => l.is_default)?.id || ""} onChange={(e) => onSetDefaultLocation(group.id, e.target.value || null)}>
              <option value="">Nenhum local padrão</option>
              {locations.map((loc) => <option key={loc.id} value={loc.id}>{loc.name}</option>)}
            </select>
            <div className="sf-muted-sm" style={{ marginTop: 4 }}>O local padrão é escolhido entre os locais cadastrados abaixo e será sugerido automaticamente nas novas partidas.</div>
            <label className="sf-field-label">Dia padrão</label>
            <select className="sf-input" value={dayDraft} onChange={(e) => setDayDraft(e.target.value)}>
              <option value="">Sem dia fixo</option>
              {WEEKDAY_LABELS.map((label, i) => <option key={i} value={i}>{label}</option>)}
            </select>
            <label className="sf-field-label">Horário padrão</label>
            <input type="time" className="sf-input" value={timeDraft} onChange={(e) => setTimeDraft(e.target.value)} />
            <label className="sf-field-label">Vagas padrão</label>
            <input type="number" min="1" className="sf-input" value={maxPlayersDraft} onChange={(e) => setMaxPlayersDraft(e.target.value)} />
            <label className="sf-field-label">Goleiro paga a quadra?</label>
            <div className="sf-gk-toggle" style={{ marginBottom: 12 }}><button type="button" className={goalkeeperPaysDraft ? 'sf-gk-toggle-on' : ''} onClick={() => setGoalkeeperPaysDraft(true)}>Sim</button><button type="button" className={!goalkeeperPaysDraft ? 'sf-gk-toggle-on' : ''} onClick={() => setGoalkeeperPaysDraft(false)}>Não</button></div>
            <label className="sf-field-label">Organizador padrão das partidas</label>
            <select className="sf-input" value={organizerDraft} onChange={(e) => { const id = e.target.value; setOrganizerDraft(id); const p = members.find((m) => m.id === id); if (p?.pix_key) { setPixKeyDraft(p.pix_key); setPixReceiverDraft(p.name || ''); } }}>
              <option value="">Nenhum organizador padrão</option>
              {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
            <div className="sf-muted-sm">Se o organizador tiver PIX cadastrado, ele será usado na nova partida. O PIX da partida permanece editável.</div>
            <label className="sf-field-label">Chave PIX padrão</label><input className="sf-input" value={pixKeyDraft} onChange={(e) => setPixKeyDraft(e.target.value)} />
            <label className="sf-field-label">Recebedor padrão</label><input className="sf-input" value={pixReceiverDraft} onChange={(e) => setPixReceiverDraft(e.target.value)} />
            <label className="sf-field-label">Cidade do PIX</label><input className="sf-input" value={pixCityDraft} onChange={(e) => setPixCityDraft(e.target.value)} />
            <label className="sf-field-label">Custo padrão da quadra</label>
            <input type="number" min="0" className="sf-input" value={costDraft} onChange={(e) => setCostDraft(e.target.value)} />
            <div className="sf-modal-actions">
              <button className="sf-btn-ghost" onClick={() => setEditing(false)}>Cancelar</button>
              <button className="sf-btn-primary" onClick={save}>Salvar</button>
            </div>
          </>
        )}
      </section>

      <section className="sf-card">
        <div className="sf-card-title"><Target size={16} /> Locais cadastrados ({locations.length})</div>
        {locations.length === 0 && <div className="sf-muted-sm">Nenhum local cadastrado. Cadastre aqui uma vez e reutilize em todas as partidas do grupo.</div>}
        {locations.map((loc) => (
          <div key={loc.id} className="sf-rsvp-row sf-rsvp-on" style={{ display: 'block', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="sf-rsvp-name">{loc.name}</span>
              {loc.is_default && <span className="sf-admin-tag">PADRÃO</span>}
              {canManage && <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}><button type="button" className="sf-admin-toggle" onClick={() => { setEditingLocationId(loc.id); setLocationDraft({ name: loc.name || '', address: loc.address || '', city: loc.city || '', state: loc.state || '', latitude: loc.latitude != null ? String(loc.latitude) : '', longitude: loc.longitude != null ? String(loc.longitude) : '', isDefault: !!loc.is_default }); setLocationModalOpen(true); }}>Editar</button><button type="button" className="sf-admin-toggle" onClick={() => onDeleteLocation(loc.id)}>Excluir</button></div>}
            </div>
            <div className="sf-muted-sm" style={{ marginTop: 4 }}>{[loc.address, loc.city && loc.state ? loc.city + '/' + loc.state : (loc.city || loc.state)].filter(Boolean).join(' · ') || 'Endereço não informado'}</div>
          </div>
        ))}
        {canManage && (
          <>
            <button type="button" className="sf-btn-primary" style={{ marginTop: 10 }} onClick={() => setLocationModalOpen(true)}>
              <Plus size={16} /> Cadastrar novo local
            </button>
            {locationModalOpen && (
              <div className="sf-modal-backdrop" onClick={() => setLocationModalOpen(false)}>
                <div className="sf-modal" onClick={(e) => e.stopPropagation()}>
                  <div className="sf-modal-title">{editingLocationId ? 'Editar local' : 'Cadastrar novo local'}</div>
                  <label className="sf-field-label">Nome da quadra / arena</label>
                  <input autoFocus className="sf-input" placeholder="Ex.: Arena Soccer" value={locationDraft.name} onChange={(e) => setLocationDraft({ ...locationDraft, name: e.target.value })} />
                  <label className="sf-field-label">Endereço</label>
                  <input className="sf-input" placeholder="Rua, número, complemento" value={locationDraft.address} onChange={(e) => setLocationDraft({ ...locationDraft, address: e.target.value })} />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 72px', gap: 6 }}><input className="sf-input" placeholder="Cidade" value={locationDraft.city} onChange={(e) => setLocationDraft({ ...locationDraft, city: e.target.value })} /><input className="sf-input" maxLength="2" placeholder="UF" value={locationDraft.state} onChange={(e) => setLocationDraft({ ...locationDraft, state: e.target.value.toUpperCase() })} /></div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}><input type="number" step="any" className="sf-input" placeholder="Latitude (opcional)" value={locationDraft.latitude} onChange={(e) => setLocationDraft({ ...locationDraft, latitude: e.target.value })} /><input type="number" step="any" className="sf-input" placeholder="Longitude (opcional)" value={locationDraft.longitude} onChange={(e) => setLocationDraft({ ...locationDraft, longitude: e.target.value })} /></div>
                  <label className="sf-check-row"><input type="checkbox" checked={locationDraft.isDefault} onChange={(e) => setLocationDraft({ ...locationDraft, isDefault: e.target.checked })} /> Usar como local padrão do grupo</label>
                  <div className="sf-modal-actions">
                    <button type="button" className="sf-btn-ghost" onClick={() => { setLocationModalOpen(false); setEditingLocationId(null); }}>Cancelar</button><button type="button" className="sf-btn-primary" onClick={async () => { if (!locationDraft.name.trim()) return alert('Informe o nome do local.'); const ok = editingLocationId ? await onUpdateLocation(group.id, editingLocationId, locationDraft) : await onCreateLocation(group.id, locationDraft); if (ok) { setLocationDraft({ name: '', address: '', city: '', state: '', latitude: '', longitude: '', isDefault: false }); setLocationModalOpen(false); setEditingLocationId(null); } }}>{editingLocationId ? 'Salvar alterações' : 'Cadastrar local'}</button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </section>

      <section className="sf-card">
        <div className="sf-card-title"><Users size={16} /> Membros ({members.length})</div>
        <div className="sf-rsvp-list">
          {members.map((m) => (
            <div key={m.id} className={`sf-rsvp-row sf-rsvp-on ${m.id === myId ? 'sf-rsvp-me' : ''}`}>
              <span className="sf-rsvp-name">{m.name}{m.id === myId ? ' (você)' : ''}{m.id === group.createdBy ? ' · dono' : ''}{m.role === 'admin' && m.id !== group.createdBy ? ' · admin' : ''}</span>
              {canManage && m.id !== group.createdBy && m.id !== myId && (
                <button
                  type="button"
                  className="sf-admin-toggle"
                  style={{ marginLeft: 'auto' }}
                  onClick={() => {
                    if (confirm(`Remover ${m.name} deste grupo?`)) onRemoveMember(group.id, m.id);
                  }}
                >
                  Remover
                </button>
              )}
            </div>
          ))}
        </div>
        <button className="sf-btn-whatsapp" style={{ marginTop: 10 }} onClick={() => onShare(group)}>
          <Share2 size={16} /> Convidar pro grupo (WhatsApp)
        </button>
        {!isOwner && (
          <button className="sf-btn-ghost" style={{ width: '100%', marginTop: 8 }} onClick={() => { if (confirm('Sair desse grupo?')) onLeave(group.id); }}>
            Sair do grupo
          </button>
        )}
      </section>

      <section className="sf-card">
        <div className="sf-card-title"><CalendarDays size={16} /> Partidas do grupo</div>
        {upcoming.length === 0 && <div className="sf-muted">Nenhuma partida criada nesse grupo ainda.</div>}
        {upcoming.map((g) => (
          <button key={g.id} className="sf-game-card" style={{ marginBottom: 8 }} onClick={() => onOpenGame(g.id)}>
            <div className="sf-game-card-date">{formatDatePtBr(g.date)}</div>
            <div className="sf-game-card-info">
              <div className="sf-h3">{g.local || 'Local a definir'}</div>
              <div className="sf-muted-sm"><Users size={12} /> {g.confirmed.length} confirmados</div>
            </div>
          </button>
        ))}
        <button className="sf-btn-primary" onClick={() => onNewGame(group)}>
          <Plus size={18} /> Nova partida (já com os padrões do grupo)
        </button>
      </section>
    </div>
  );
}

// ---------- main app (authenticated) ----------

function MainApp({ session }) {
  const myId = session.user.id;
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState([]);
  const [games, setGames] = useState([]);
  const [groups, setGroups] = useState([]);
  const [groupMembers, setGroupMembers] = useState([]);
  const [tab, setTab] = useState('partidas');
  const [subTab, setSubTab] = useState('elenco');
  const [partidasFilter, setPartidasFilter] = useState('proximas');
  const [selectedGameId, setSelectedGameId] = useState(null);
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [elencoGroupFilter, setElencoGroupFilter] = useState('all');
  const [showNewGame, setShowNewGame] = useState(false);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [viewingCardPlayer, setViewingCardPlayer] = useState(null);
  const [newDate, setNewDate] = useState('');
  const [newLocal, setNewLocal] = useState('');
  const [newLocationAddress, setNewLocationAddress] = useState('');
  const [newLocationCity, setNewLocationCity] = useState('');
  const [newLocationState, setNewLocationState] = useState('');
  const [newLocationLatitude, setNewLocationLatitude] = useState('');
  const [newLocationLongitude, setNewLocationLongitude] = useState('');
  const [newMaxPlayers, setNewMaxPlayers] = useState('');
  const [newGameGroupId, setNewGameGroupId] = useState(null);
  const [newGameOrganizerId, setNewGameOrganizerId] = useState('');
  const [groupLocations, setGroupLocations] = useState([]);
  const [newGameLocationId, setNewGameLocationId] = useState('');
  const [inlineLocationOpen, setInlineLocationOpen] = useState(false);
  const [inlineLocationDraft, setInlineLocationDraft] = useState({ name: '', address: '', city: '', state: '', latitude: '', longitude: '', isDefault: false });
  const [rankingGroupFilter, setRankingGroupFilter] = useState('');
  const [newGameCost, setNewGameCost] = useState('');
  const [newGameGoalkeeperPays, setNewGameGoalkeeperPays] = useState(true);
  const [newGamePixKey, setNewGamePixKey] = useState('');
  const [newGamePixReceiverName, setNewGamePixReceiverName] = useState('');
  const [newGamePixCity, setNewGamePixCity] = useState('');
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupLocal, setNewGroupLocal] = useState('');
  const [newGroupDay, setNewGroupDay] = useState('6');
  const [newGroupTime, setNewGroupTime] = useState('');
  const [newGroupMaxPlayers, setNewGroupMaxPlayers] = useState('');
  const [newGroupCost, setNewGroupCost] = useState('');

  const me = profiles.find((p) => p.id === myId);

  const loadAll = useCallback(async () => {
    const [profilesRes, gamesRes, confRes, waitlistRes, teamsRes, paysRes, goalsRes, ratingsRes, groupsRes, groupMembersRes, groupLocationsRes] = await Promise.all([
      supabase.from('profiles').select('*').order('name'),
      supabase.from('games').select('*').order('date', { ascending: false }),
      supabase.from('game_confirmations').select('*'),
      supabase.from('game_waitlist').select('*').order('queued_at', { ascending: true }).order('id', { ascending: true }),
      supabase.from('game_teams').select('*'),
      supabase.from('payments').select('*'),
      supabase.from('goals').select('*'),
      supabase.from('ratings').select('*'),
      supabase.from('groups').select('*').order('name'),
      supabase.from('group_members').select('*'),
      supabase.from('group_locations').select('*').order('is_default', { ascending: false }).order('name'),
    ]);
    const profs = profilesRes.data || [];
    const profileMap = Object.fromEntries(profs.map((p) => [p.id, p]));
    const assembled = (gamesRes.data || []).map((g) => {
      // ordered by confirmed_at so the waitlist (anyone past max_players) is well defined
      const confirmed = (confRes.data || [])
        .filter((c) => c.game_id === g.id)
        .sort((a, b) => new Date(a.confirmed_at) - new Date(b.confirmed_at))
        .map((c) => c.user_id);
      const waitlist = (waitlistRes.data || []).filter((w) => w.game_id === g.id).sort((a, b) => new Date(a.queued_at) - new Date(b.queued_at) || String(a.id).localeCompare(String(b.id))).map((w) => w.user_id);
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
        id: g.id, date: g.date, local: g.local, locationAddress: g.location_address || null, locationCity: g.location_city || null, locationState: g.location_state || null, locationLatitude: g.location_latitude != null ? Number(g.location_latitude) : null, locationLongitude: g.location_longitude != null ? Number(g.location_longitude) : null, cost: Number(g.cost) || 0, goalkeeperPays: g.goalkeeper_pays !== false,
        createdBy: g.created_by,
        maxPlayers: g.max_players || null,
        pixKey: g.pix_key || null,
        pixOwnerId: g.pix_owner_id || null,
        inviteToken: g.invite_token,
        pixReceiverName: g.pix_receiver_name || null,
        pixCity: g.pix_city || null,
        groupId: g.group_id || null,
        organizerId: g.organizer_id || null,
        confirmed, waitlist, teamA, teamB, payments, scorers, assists, ratings,
        result: (g.score_a != null && g.score_b != null) ? { scoreA: g.score_a, scoreB: g.score_b, scorers } : null,
      };
    });
    setProfiles(profs);
    setGames(assembled);
    setGroups((groupsRes.data || []).map((g) => ({
      id: g.id, name: g.name, createdBy: g.created_by, inviteToken: g.invite_token,
      defaultLocal: g.default_local || '', defaultDayOfWeek: g.default_day_of_week,
      defaultTime: g.default_time || '', defaultMaxPlayers: g.default_max_players || null,
      defaultCost: g.default_cost != null ? Number(g.default_cost) : null,
      defaultGoalkeeperPays: g.default_goalkeeper_pays !== false,
      defaultPixKey: g.default_pix_key || '',
      defaultPixReceiverName: g.default_pix_receiver_name || '',
      defaultPixCity: g.default_pix_city || '',
      defaultOrganizerId: g.default_organizer_id || null,
      avatar: g.avatar || null,
      avatarUrl: g.avatar_url || '',
    })));
    setGroupMembers(groupMembersRes.data || []);
    setGroupLocations(groupLocationsRes.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // if we arrived via a per-match invite link (?join=token, or one stashed
  // before the Google redirect), join that match and jump straight to it
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const token = params.get('join') || sessionStorage.getItem('sf_join_token');
    const groupToken = params.get('joinGroup') || sessionStorage.getItem('sf_join_group_token');
    if (!token && !groupToken) return;
    sessionStorage.removeItem('sf_join_token');
    sessionStorage.removeItem('sf_join_group_token');
    const url = new URL(window.location.href);
    url.searchParams.delete('join');
    url.searchParams.delete('joinGroup');
    window.history.replaceState({}, '', url.toString());
    (async () => {
      try {
        if (token) {
          const { data: gameId } = await serviceJoinGameByToken(token);
          await loadAll();
          if (gameId) { setTab('partidas'); setSelectedGameId(gameId); }
        } else if (groupToken) {
          const { data: groupId } = await serviceJoinGroupByToken(groupToken);
          await loadAll();
          if (groupId) { setTab('grupos'); setSelectedGroupId(groupId); }
        }
      } catch (e) {
        console.error('invalid invite link', e);
      }
    })();
  }, [loadAll]);

  const addGuest = async (gameId, name, email, position) => {
    const { error } = await serviceAddGameGuest(gameId, name, email, position);
    if (error) { alert('Não foi possível adicionar o convidado: ' + error.message); return false; }
    await loadAll();
    return true;
  };

  const addParticipant = async (gameId, userId) => {
    const game = games.find((g) => g.id === gameId);
    if (!game?.groupId) { alert('A partida precisa estar vinculada a um grupo.'); return; }
    const member = groupMembers.some((m) => String(m.group_id) === String(game.groupId) && String(m.user_id) === String(userId));
    if (!member) { alert('Só é possível adicionar jogadores que pertencem ao grupo da partida.'); return; }
    const { error } = await addGameParticipant(gameId, userId);
    if (error) { alert('Não foi possível adicionar o jogador: ' + error.message); return; }
    await loadAll();
  };

  const removeParticipant = async (gameId, userId) => {
    const { error } = await removeGameParticipant(gameId, userId);
    if (error) { alert('Não foi possível remover o jogador: ' + error.message); return; }
    await loadAll();
  };

  const toggleMyRSVP = async (gameId) => {
    const g = games.find((x) => x.id === gameId);
    if (!g) return;
    let response;
    if (g.confirmed.includes(myId)) {
      response = await removeGameParticipant(gameId, myId);
    } else if ((g.waitlist || []).includes(myId)) {
      response = await toggleGameWaitlist(gameId, myId, false);
    } else {
      response = await addGameParticipant(gameId, myId);
    }
    const { error } = response;
    if (error) { alert('Não foi possível alterar sua presença: ' + error.message); return; }
    await loadAll();
  };

  const setCost = async (gameId, cost) => {
    const { error } = await setGameCost(gameId, cost);
    if (error) { alert('Não foi possível alterar o custo da partida: ' + error.message); return false; }
    await loadAll();
    return true;
  };

  const setGkPays = async (gameId, goalkeeper_pays) => {
    const { error } = await setGameGoalkeeperPays(gameId, goalkeeper_pays);
    if (error) { alert('Não foi possível alterar se o goleiro paga: ' + error.message); return false; }
    await loadAll();
    return true;
  };

  const setGamePixDetails = async (gameId, { pixKey, pixReceiverName, pixCity, pixOwnerId }) => {
    const { error } = await serviceSetGamePixDetails(gameId, { pixKey, pixReceiverName, pixCity, pixOwnerId });
    if (error) { alert('Não foi possível salvar os dados do PIX: ' + error.message); return false; }
    await loadAll();
    return true;
  };

  const setGameOrganizer = async (gameId, organizerId) => {
    const { error } = await serviceSetGameOrganizer(gameId, organizerId);
    if (error) { alert('Não foi possível alterar o organizador: ' + error.message); return; }
    loadAll();
  };

  const setGameLocation = async (gameId, { local, locationAddress, locationCity, locationState, locationLatitude, locationLongitude }) => {
    const { error } = await serviceSetGameLocation(gameId, { local, locationAddress, locationCity, locationState, locationLatitude, locationLongitude });
    if (error) { alert('Não foi possível salvar o local da partida: ' + error.message); return false; }
    await loadAll();
    return true;
  };

  const setMaxPlayers = async (gameId, maxPlayers) => {
    const { error } = await setGameMaxPlayers(gameId, maxPlayers);
    if (error) { alert('Não foi possível alterar o limite de vagas: ' + error.message); return false; }
    await loadAll();
    return true;
  };

  const handleSaveTeams = async (gameId, teamDraft, activePlayers) => {
    const teamA = activePlayers.filter((p) => teamDraft[p.id] !== 'B').map((p) => p.id);
    const teamB = activePlayers.filter((p) => teamDraft[p.id] === 'B').map((p) => p.id);
    if (activePlayers.length < 2) { alert('É necessário ter pelo menos 2 jogadores para definir os times.'); return false; }
    if (!teamA.length || !teamB.length) { alert('Distribua os jogadores entre os dois times.'); return false; }
    const { error } = await setGameTeams(gameId, teamA, teamB);
    if (error) { alert('Não foi possível salvar os times: ' + error.message); return false; }
    await loadAll();
    return true;
  };

  const handleDraw = async (gameId, confirmedPlayers) => {
    const { teamA, teamB } = drawTeams(confirmedPlayers);
    const { error } = await setGameTeams(gameId, teamA.map((p) => p.id), teamB.map((p) => p.id));
    if (error) { alert('Não foi possível salvar o novo sorteio: ' + error.message); return false; }
    await loadAll();
    return true;
  };

  const togglePaid = async (gameId, userId, paid) => {
    const { error } = await setGamePayment(gameId, userId, paid);
    if (error) { alert('Não foi possível atualizar o pagamento: ' + error.message); return false; }
    await loadAll();
    return true;
  };

  const savePlayerStats = async (gameId, userId, goals, assists) => {
    const safeGoals = Math.max(0, parseInt(goals, 10) || 0);
    const safeAssists = Math.max(0, parseInt(assists, 10) || 0);
    const { error } = await setPlayerStats(gameId, userId, safeGoals, safeAssists);
    if (error) { alert('Não foi possível salvar seus gols/assistências: ' + error.message); return; }
    loadAll();
  };

  const saveResult = async (gameId, scoreA, scoreB, scorers, assists, playerIds) => {
    const { error: resultError } = await setGameResult(gameId, scoreA, scoreB);
    if (resultError) { alert('Não foi possível salvar o placar: ' + resultError.message); return false; }
    const rows = playerIds.map((id) => ({ game_id: gameId, user_id: id, goals: scorers[id] || 0, assists: assists[id] || 0 }));
    if (rows.length) {
      const { error: goalsError } = await setGameGoals(gameId, rows);
      if (goalsError) { alert('O placar foi salvo, mas os gols/assistências não puderam ser salvos: ' + goalsError.message); await loadAll(); return false; }
    }
    await loadAll();
    return true;
  };

  const saveRatings = async (gameId, ratingsMap) => {
    const rows = Object.entries(ratingsMap)
      .filter(([, score]) => score > 0)
      .map(([ratedId, score]) => ({ game_id: gameId, rater_id: myId, rated_id: ratedId, score }));
    if (rows.length) {
      const { error } = await setGameRatings(rows);
      if (error) { alert('Não foi possível salvar as avaliações: ' + error.message); return false; }
    }
    await loadAll();
    return true;
  };

  const createInlineGameLocation = async () => {
    if (!newGameGroupId) { alert('Selecione um grupo antes de cadastrar o local.'); return; }
    if (!inlineLocationDraft.name.trim()) { alert('Informe o nome do local.'); return; }
    const { data, error } = await serviceCreateGroupLocation(newGameGroupId, inlineLocationDraft, myId);
    if (error) { alert('Não foi possível cadastrar o local: ' + error.message); return; }
    setGroupLocations((prev) => [...prev, data]);
    setNewGameLocationId(data.id);
    setNewLocal(data.name || '');
    setNewLocationAddress(data.address || '');
    setNewLocationCity(data.city || '');
    setNewLocationState(data.state || '');
    setNewLocationLatitude(data.latitude != null ? String(data.latitude) : '');
    setNewLocationLongitude(data.longitude != null ? String(data.longitude) : '');
    setInlineLocationDraft({ name: '', address: '', city: '', state: '', latitude: '', longitude: '', isDefault: false });
    setInlineLocationOpen(false);
  };

  const createGroupLocation = async (groupId, draft) => {
    const { data, error } = await serviceCreateGroupLocation(groupId, draft, myId);
    if (error) { alert('Não foi possível cadastrar o local: ' + error.message); return false; }
    await loadAll();
    return true;
  };

  const deleteGroupLocation = async (locationId) => {
    if (!confirm('Excluir este local cadastrado?')) return;
    const { error } = await serviceDeleteGroupLocation(locationId);
    if (error) { alert('Não foi possível excluir o local: ' + error.message); return; }
    await loadAll();
  };

  const setGroupDefaultLocation = async (groupId, locationId) => {
    const { error } = await serviceSetGroupDefaultLocation(groupId, locationId);
    if (error) { alert('Não foi possível definir o local padrão: ' + error.message); return false; }
    await loadAll();
    return true;
  };

  const updateGroupLocation = async (groupId, locationId, draft) => {
    const { error } = await serviceUpdateGroupLocation(groupId, locationId, draft);
    if (error) { alert('Não foi possível editar o local: ' + error.message); return false; }
    if (draft.isDefault) { const ok = await setGroupDefaultLocation(groupId, locationId); if (!ok) return false; }
    await loadAll();
    return true;
  };

  const createGame = async () => {
    const date = newDate || new Date().toISOString().slice(0, 10);
    const maxPlayers = newMaxPlayers ? parseInt(newMaxPlayers, 10) : null;
    const { data, error } = await serviceCreateGame({
      date, local: newLocal.trim(), location_address: newLocationAddress.trim() || null, location_city: newLocationCity.trim() || null, location_state: newLocationState.trim() || null, location_latitude: newLocationLatitude === '' ? null : Number(newLocationLatitude), location_longitude: newLocationLongitude === '' ? null : Number(newLocationLongitude), created_by: myId, max_players: maxPlayers, group_id: newGameGroupId || null,
      cost: newGameCost === '' ? 0 : Number(newGameCost),
      organizer_id: newGameOrganizerId || null,
      goalkeeper_pays: newGameGoalkeeperPays,
      pix_key: newGamePixKey.trim() || null,
      pix_receiver_name: newGamePixReceiverName.trim() || null,
      pix_city: newGamePixCity.trim() || null,
    });
    if (error) { alert('Não deu pra criar a partida: ' + error.message); return; }
    setNewDate(''); setNewLocal(''); setNewLocationAddress(''); setNewLocationCity(''); setNewLocationState(''); setNewLocationLatitude(''); setNewLocationLongitude(''); setNewMaxPlayers(''); setNewGameGroupId(null); setNewGameOrganizerId(''); setNewGameLocationId(''); setInlineLocationOpen(false); setInlineLocationDraft({ name: '', address: '', city: '', state: '', latitude: '', longitude: '', isDefault: false });
    setNewGameCost(''); setNewGameGoalkeeperPays(true); setNewGamePixKey(''); setNewGamePixReceiverName(''); setNewGamePixCity('');
    setShowNewGame(false);
    await loadAll();
    if (data) {
      if (newGameOrganizerId) {
        const { error: organizerConfirmationError } = await serviceConfirmOrganizer(data.id, newGameOrganizerId);
        if (organizerConfirmationError) {
          console.error('failed to confirm organizer in game', organizerConfirmationError);
        }
      }
      setSelectedGameId(data.id);
    }
  };

  // opens the "nova partida" modal pre-filled with a group's own defaults
  const openNewGameForGroup = (group) => {
    setNewGameGroupId(group.id);
    setNewDate(nextDateForWeekday(group.defaultDayOfWeek));
    setNewLocal('');
    setNewMaxPlayers(group.defaultMaxPlayers ? String(group.defaultMaxPlayers) : '');
    setNewGameCost(group.defaultCost != null ? String(group.defaultCost) : '');
    setNewGameGoalkeeperPays(group.defaultGoalkeeperPays !== false);
    setNewGameOrganizerId(group.defaultOrganizerId || '');
    const defaultOrganizer = profiles.find((p) => p.id === group.defaultOrganizerId);
    setNewGamePixKey(defaultOrganizer?.pix_key || group.defaultPixKey || '');
    setNewGamePixReceiverName(defaultOrganizer?.pix_key ? (defaultOrganizer.name || '') : (group.defaultPixReceiverName || ''));
    setNewGamePixReceiverName(group.defaultPixReceiverName || '');
    setNewGamePixCity(group.defaultPixCity || '');
    setShowNewGame(true);
  };

  const deleteGame = async (gameId) => {
    const { error } = await serviceDeleteGame(gameId);
    if (error) { alert('Não foi possível excluir a partida: ' + error.message); return false; }
    setSelectedGameId(null);
    await loadAll();
    return true;
  };

  const createGroup = async () => {
    if (!newGroupName.trim()) return;
    const { data, error } = await serviceCreateGroup({
      name: newGroupName.trim(),
      created_by: myId,
      default_local: newGroupLocal.trim() || null,
      default_day_of_week: newGroupDay !== '' ? parseInt(newGroupDay, 10) : null,
      default_time: newGroupTime || null,
      default_max_players: newGroupMaxPlayers ? parseInt(newGroupMaxPlayers, 10) : null,
      default_cost: newGroupCost ? parseFloat(newGroupCost) : null,
    });
    if (error) { alert('Não deu pra criar o grupo: ' + error.message); return; }
    if (data) {
      if (newGroupLocal.trim()) {
        const { error: locationError } = await serviceCreateGroupLocation(data.id, { name: newGroupLocal.trim(), address: '', city: '', state: '', latitude: '', longitude: '', isDefault: true }, myId);
        if (locationError) { console.error('failed to create initial group location', locationError); }
      }
      const { error: memberError } = await serviceAddGroupMember(data.id, myId);
      if (memberError) console.error('failed to add self as member', memberError);
    }
    setNewGroupName(''); setNewGroupLocal(''); setNewGroupDay('6'); setNewGroupTime(''); setNewGroupMaxPlayers(''); setNewGroupCost('');
    setShowNewGroup(false);
    await loadAll();
    if (data) setSelectedGroupId(data.id);
  };

  const setGroupDefaults = async (groupId, fields) => {
    const { error } = await serviceSetGroupDefaults(groupId, fields);
    if (error) { alert('Não foi possível salvar os padrões do grupo: ' + error.message); return false; }
    await loadAll();
    return true;
  };

  const leaveGroup = async (groupId) => {
    const { error } = await serviceLeaveGroup(groupId, myId);
    if (error) { alert('Não foi possível sair do grupo: ' + error.message); return; }
    setSelectedGroupId(null);
    await loadAll();
  };

  const removeGroupMember = async (groupId, userId) => {
    const { error } = await serviceRemoveGroupMember(groupId, userId);
    if (error) { alert('Não foi possível remover o membro: ' + error.message); return; }
    await loadAll();
  };

  const deleteGroup = async (groupId) => {
    const { error } = await serviceDeleteGroup(groupId);
    if (error) { alert('Não foi possível excluir o grupo: ' + error.message); return false; }
    setSelectedGroupId(null);
    await loadAll();
    return true;
  };

  const updateMyProfile = async (fields) => {
    const { error } = await serviceUpdateMyProfile(myId, fields);
    if (error) { alert('Não foi possível salvar seu perfil: ' + error.message); return false; }
    await loadAll();
    return true;
  };

  const toggleAdmin = async (userId, isAdmin) => {
    const { error } = await serviceSetAdmin(userId, isAdmin);
    if (error) { alert('Não foi possível alterar a administração: ' + error.message); return false; }
    await loadAll();
    return true;
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
    window.open(`https://api.whatsapp.com/send/?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const shareGroupWhatsApp = (group) => {
    let msg = `⚽ *${group.name}*\n\nEntra no grupo pra ver e confirmar presença nos jogos:\n${window.location.origin}/?joinGroup=${group.inviteToken}\n\nBora! 🙌`;
    window.open(`https://api.whatsapp.com/send/?text=${encodeURIComponent(msg)}`, '_blank');
  };

  useEffect(() => { if (!rankingGroupFilter && groups.length) setRankingGroupFilter(groups[0].id); }, [groups, rankingGroupFilter]);
  const ranking = useMemo(() => { if (!rankingGroupFilter) return []; const memberIds = new Set(groupMembers.filter((m) => String(m.group_id) === String(rankingGroupFilter)).map((m) => String(m.user_id))); const groupGames = games.filter((g) => String(g.groupId) === String(rankingGroupFilter)); return computeRanking(profiles.filter((p) => memberIds.has(String(p.id))), groupGames); }, [profiles, games, groupMembers, rankingGroupFilter]);
  const todayIso = new Date().toISOString().slice(0, 10);
  const upcomingGames = useMemo(() => [...games].filter((g) => g.date >= todayIso).sort((a, b) => (a.date > b.date ? 1 : -1)), [games, todayIso]);
  const pastGames = useMemo(() => [...games].filter((g) => g.date < todayIso).sort((a, b) => (a.date < b.date ? 1 : -1)), [games, todayIso]);
  const sortedGames = partidasFilter === 'passadas' ? pastGames : upcomingGames;
  const selectedGame = games.find((g) => g.id === selectedGameId);
  const selectedGroup = groups.find((g) => g.id === selectedGroupId);
  const myGroupIds = useMemo(() => {
    const ids = new Set(groupMembers.filter((m) => m.user_id === myId).map((m) => m.group_id));
    groups.filter((g) => g.createdBy === myId).forEach((g) => ids.add(g.id));
    return ids;
  }, [groupMembers, groups, myId]);
  const elencoGroupOptions = useMemo(
    () => groups.filter((g) => myGroupIds.has(g.id)).sort((a, b) => a.name.localeCompare(b.name)),
    [groups, myGroupIds]
  );
  const elencoProfiles = useMemo(() => {
    const scopedGroupIds = elencoGroupFilter === 'all'
      ? myGroupIds
      : new Set(myGroupIds.has(elencoGroupFilter) ? [elencoGroupFilter] : []);
    const memberIds = new Set(
      groupMembers
        .filter((m) => scopedGroupIds.has(m.group_id))
        .map((m) => m.user_id)
    );
    return profiles.filter((p) => p.id !== myId && memberIds.has(p.id));
  }, [profiles, groupMembers, myId, myGroupIds, elencoGroupFilter]);

  if (loading) {
    return (
      <div className="sf-app sf-loading">
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
        <Loader2 className="sf-spin" size={28} />
      </div>
    );
  }

  return (
    <div className="sf-app">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

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
            <div className="sf-subtabs">
              <button className={`sf-subtab ${partidasFilter === 'proximas' ? 'sf-subtab-on' : ''}`} onClick={() => setPartidasFilter('proximas')}>Próximas</button>
              <button className={`sf-subtab ${partidasFilter === 'passadas' ? 'sf-subtab-on' : ''}`} onClick={() => setPartidasFilter('passadas')}>Passadas</button>
            </div>
            {sortedGames.length === 0 && (
              <div className="sf-empty">
                <CalendarDays size={32} color="#5C7A67" />
                <p>{partidasFilter === 'passadas' ? 'Nenhuma partida passada ainda.' : 'Nenhuma partida marcada ainda.'}</p>
              </div>
            )}
            {sortedGames.map((g) => {
              const gGroup = groups.find((gr) => gr.id === g.groupId);
              const status = g.result ? 'Finalizada' : (g.teamA?.length ? 'Times prontos' : 'Sorteio pendente');
              return (
                <button key={g.id} className="sf-game-card" onClick={() => setSelectedGameId(g.id)}>
                  <div className="sf-game-card-date">{formatDatePtBr(g.date)}</div>
                  <div className="sf-game-card-info">
                    <div className="sf-h3">{g.local || 'Local a definir'}</div>
                    <div className="sf-muted-sm">
                      <Users size={12} /> {Math.min(g.confirmed.length, g.maxPlayers || Infinity)}{g.maxPlayers ? `/${g.maxPlayers}` : ''} confirmados
                      {g.maxPlayers && g.confirmed.length > g.maxPlayers ? ` · ${g.confirmed.length - g.maxPlayers} na espera` : ''}
                      {gGroup ? ` · ${gGroup.name}` : ''}
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
            groupMembers={groupMembers}
            groupMemberIds={new Set(groupMembers.filter((m) => String(m.group_id) === String(selectedGame?.groupId)).map((m) => String(m.user_id)))}
            myId={myId}
            isAdmin={!!me?.is_admin}
            onBack={() => setSelectedGameId(null)}
            onToggleMyRSVP={toggleMyRSVP}
            onAddParticipant={addParticipant}
            onAddGuest={addGuest}
            onOpenGroup={(groupId) => { setTab('grupos'); setSelectedGroupId(groupId); setSelectedGameId(null); }}
            onRemoveParticipant={removeParticipant}
            onSetCost={setCost}
            onSetGkPays={setGkPays}
            onSetGamePixDetails={setGamePixDetails}
            onSetGameOrganizer={setGameOrganizer}
            onSetGameLocation={setGameLocation}
            onSetMaxPlayers={setMaxPlayers}
            onDraw={handleDraw}
            onSaveTeams={handleSaveTeams}
            onTogglePaid={togglePaid}
            onSaveResult={saveResult}
            onSavePlayerStats={savePlayerStats}
            onSaveRatings={saveRatings}
            onDelete={deleteGame}
            onShare={shareWhatsApp}
          />
        )}

        {tab === 'grupos' && !selectedGroup && (
          <div className="sf-list-view">
            {groups.length === 0 && (
              <div className="sf-empty"><Layers size={32} color="#5C7A67" /><p>Você ainda não participa de nenhum grupo.</p></div>
            )}
            {groups.map((g) => {
              const memberCount = groupMembers.filter((m) => m.group_id === g.id).length;
              return (
                <button key={g.id} className="sf-game-card" onClick={() => setSelectedGroupId(g.id)}>
                  <div className="sf-game-card-info">
                    <div className="sf-h3">{g.name}</div>
                    <div className="sf-muted-sm">
                      <Users size={12} /> {memberCount} {memberCount === 1 ? 'membro' : 'membros'}
                      {g.defaultDayOfWeek != null ? ` · ${WEEKDAY_LABELS[g.defaultDayOfWeek]}` : ''}
                    </div>
                  </div>
                </button>
              );
            })}
            <button className="sf-btn-primary sf-fixed-add" onClick={() => setShowNewGroup(true)}>
              <Plus size={18} /> Criar grupo
            </button>
          </div>
        )}

        {tab === 'grupos' && selectedGroup && (
          <GroupDetail
            group={selectedGroup}
            games={games.filter((g) => g.groupId === selectedGroup.id)}
            members={groupMembers.filter((m) => m.group_id === selectedGroup.id).map((m) => {
              const profile = profiles.find((p) => p.id === m.user_id);
              return profile ? { ...profile, user_id: m.user_id, role: m.role || 'member', membershipId: m.id } : null;
            }).filter(Boolean)}
            myId={myId}
            onBack={() => setSelectedGroupId(null)}
            onSetDefaults={setGroupDefaults}
            onShare={shareGroupWhatsApp}
            onNewGame={openNewGameForGroup}
            onOpenGame={(id) => { setTab('partidas'); setSelectedGameId(id); }}
            onLeave={leaveGroup}
            onDelete={deleteGroup}
            onRemoveMember={removeGroupMember}
            onSetDefaultLocation={setGroupDefaultLocation}
            locations={groupLocations.filter((l) => String(l.group_id) === String(selectedGroupId))}
            onCreateLocation={createGroupLocation}
            onUpdateLocation={updateGroupLocation}
            onDeleteLocation={deleteGroupLocation}
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
                <div className="sf-roster-filter">
                  <label className="sf-field-label">Grupo</label>
                  <select
                    className="sf-input"
                    value={elencoGroupFilter}
                    onChange={(e) => setElencoGroupFilter(e.target.value)}
                  >
                    <option value="all">Todos os meus grupos</option>
                    {elencoGroupOptions.map((g) => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                  </select>
                </div>
                {me && <MyProfileCard me={me} onUpdate={updateMyProfile} />}
                {elencoProfiles.map((p) => (
                  <div key={p.id} className="sf-player-card">
                    <button className="sf-pcard-trigger" onClick={() => setViewingCardPlayer(p)}>
                      <PlayerCard player={p} compact />
                    </button>
                    <div className="sf-player-card-info">
                      <div className="sf-h3">
                        <PositionTags player={p} />
                        {p.nationality_code ? <span aria-label={p.nationality_code} style={{ marginRight: 5 }}>{countryFlag(p.nationality_code)}</span> : null}
                        {p.name}
                        {p.is_admin && <span className="sf-admin-tag" title="Admin">ADMIN</span>}
                      </div>
                      <StarRating value={p.rating} readOnly onChange={() => {}} />
                      {playerMeta(p) && <div className="sf-muted-sm" style={{ marginTop: 3 }}>{playerMeta(p)}</div>}
                      {me?.is_admin && (
                        <button className="sf-admin-toggle" onClick={() => toggleAdmin(p.id, !p.is_admin)}>
                          {p.is_admin ? 'Remover admin' : 'Tornar admin'}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                <p className="sf-muted-sm sf-roster-hint">
                  O elenco mostra somente jogadores dos grupos dos quais você participa. Use o filtro acima para ver um grupo específico.
                  {me?.is_admin ? ' Você é admin: pode editar partidas de qualquer organizador e indicar outros admins.' : ''}
                </p>
              </>
            )}

            {subTab === 'ranking' && (
              <>
              <div className="sf-roster-filter">
                <label className="sf-field-label">Grupo do ranking</label>
                <select className="sf-input" value={rankingGroupFilter} onChange={(e) => setRankingGroupFilter(e.target.value)}>
                  <option value="">Selecione um grupo</option>
                  {elencoGroupOptions.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>
              <div className="sf-ranking-table">
                <div className="sf-ranking-header">
                  <span className="sf-rk-name">Jogador</span>
                  <span>J</span><span>V</span><span>G/A</span><span>Nota</span><span>Freq</span><span>Pts</span>
                </div>
                {ranking.length === 0 && <div className="sf-empty"><Trophy size={32} color="#5C7A67" /><p>Finalize partidas para gerar o ranking.</p></div>}
                {ranking.map((r, i) => (
                  <div key={r.id} className="sf-ranking-row">
                    <span className="sf-rk-name">
                      {i === 0 && r.pontos > 0 ? '🏆 ' : ''}{r.nationality_code ? <span aria-label={r.nationality_code} style={{ marginRight: 5 }}>{countryFlag(r.nationality_code)}</span> : null}{r.name}{r.mvps > 0 ? <span className="sf-mvp-tag"> ⭐×{r.mvps}</span> : ''}
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
              </>
            )}
          </div>
        )}
      </main>

      <nav className="sf-tabbar">
        <button className={`sf-tab ${tab === 'partidas' ? 'sf-tab-on' : ''}`} onClick={() => setTab('partidas')}>
          <CalendarDays size={20} /><span>Partidas</span>
        </button>
        <button className={`sf-tab ${tab === 'grupos' ? 'sf-tab-on' : ''}`} onClick={() => { setTab('grupos'); setSelectedGameId(null); }}>
          <Layers size={20} /><span>Grupos</span>
        </button>
        <button className={`sf-tab ${tab === 'elenco' ? 'sf-tab-on' : ''}`} onClick={() => { setTab('elenco'); setSelectedGameId(null); }}>
          <Users size={20} /><span>Elenco</span>
        </button>
      </nav>

      {showNewGame && (
        <div className="sf-modal-backdrop" onClick={() => { setShowNewGame(false); setNewGameGroupId(null); }}>
          <div className="sf-modal" onClick={(e) => e.stopPropagation()}>
            <div className="sf-modal-title">Nova partida</div>
            {groups.length > 0 && (
              <>
                <label className="sf-field-label">Grupo (opcional)</label>
                <select
                  className="sf-input"
                  value={newGameGroupId || ''}
                  onChange={(e) => {
          const gid = e.target.value || null;
          setNewGameGroupId(gid);
          const g = groups.find((gr) => gr.id === gid);
          if (g) {
            // Selecting a group must inherit every group default.
            // The fields remain editable for this specific game.
            setNewDate(nextDateForWeekday(g.defaultDayOfWeek));
            setNewLocal('');
            setNewMaxPlayers(g.defaultMaxPlayers ? String(g.defaultMaxPlayers) : '');
            setNewGameCost(g.defaultCost != null ? String(g.defaultCost) : '');
            setNewGameGoalkeeperPays(g.defaultGoalkeeperPays !== false);
            const defaultLocation = groupLocations.find((l) => String(l.group_id) === String(g.id) && l.is_default) || groupLocations.find((l) => String(l.group_id) === String(g.id));
            setNewGameLocationId(defaultLocation?.id || '');
            if (defaultLocation) {
              setNewLocal(defaultLocation.name || '');
              setNewLocationAddress(defaultLocation.address || '');
              setNewLocationCity(defaultLocation.city || '');
              setNewLocationState(defaultLocation.state || '');
              setNewLocationLatitude(defaultLocation.latitude != null ? String(defaultLocation.latitude) : '');
              setNewLocationLongitude(defaultLocation.longitude != null ? String(defaultLocation.longitude) : '');
            }
            setNewGameOrganizerId(g.defaultOrganizerId || '');
            const defaultOrganizer = profiles.find((p) => p.id === g.defaultOrganizerId);
            setNewGamePixKey(defaultOrganizer?.pix_key || g.defaultPixKey || '');
            setNewGamePixReceiverName(defaultOrganizer?.pix_key ? (defaultOrganizer.name || '') : (g.defaultPixReceiverName || ''));
            setNewGamePixReceiverName(g.defaultPixReceiverName || '');
            setNewGamePixCity(g.defaultPixCity || '');
          } else {
            setNewDate('');
            setNewLocal('');
            setNewMaxPlayers('');
            setNewGameCost('');
            setNewGameGoalkeeperPays(true);
            setNewGameOrganizerId('');
            setNewGameLocationId('');
            setNewLocal('');
            setNewLocationAddress('');
            setNewLocationCity('');
            setNewLocationState('');
            setNewLocationLatitude('');
            setNewLocationLongitude('');
            setNewGamePixKey('');
            setNewGamePixReceiverName('');
            setNewGamePixCity('');
          }
        }}
                >
                  <option value="">Nenhum grupo</option>
                  {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </>
            )}
            <label className="sf-field-label">Organizador da partida</label>
            <select className="sf-input" value={newGameOrganizerId} onChange={(e) => { const id = e.target.value; setNewGameOrganizerId(id); const p = profiles.find((x) => x.id === id); if (p?.pix_key) { setNewGamePixKey(p.pix_key); setNewGamePixReceiverName(p.name || ''); } }}>
              <option value="">Não definido</option>
              {profiles.filter((p) => !newGameGroupId || (groupMembers || []).some((m) => m.group_id === newGameGroupId && m.user_id === p.id)).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            {newGameGroupId && (
              <>
                <label className="sf-field-label">Local da partida</label>
                <select className="sf-input" value={newGameLocationId} onChange={(e) => {
                  const id = e.target.value;
                  setNewGameLocationId(id);
                  const location = groupLocations.find((l) => String(l.id) === String(id));
                  if (location) {
                    setNewLocal(location.name || '');
                    setNewLocationAddress(location.address || '');
                    setNewLocationCity(location.city || '');
                    setNewLocationState(location.state || '');
                    setNewLocationLatitude(location.latitude != null ? String(location.latitude) : '');
                    setNewLocationLongitude(location.longitude != null ? String(location.longitude) : '');
                  }
                }}>
                  <option value="">Selecionar local cadastrado...</option>
                  {groupLocations.filter((l) => String(l.group_id) === String(newGameGroupId)).map((l) => (
                    <option key={l.id} value={l.id}>{l.name}{l.is_default ? ' · padrão' : ''}</option>
                  ))}
                </select>
                <button type="button" className="sf-btn-ghost" style={{ marginTop: 6 }} onClick={() => setInlineLocationOpen((v) => !v)}>{inlineLocationOpen ? 'Fechar cadastro de local' : 'Cadastrar novo local sem sair da partida'}</button>
                {inlineLocationOpen && <div className="sf-card" style={{ marginTop: 8 }}>
                  <label className="sf-field-label">Nome do local</label><input className="sf-input" placeholder="Quadra / arena" value={inlineLocationDraft.name} onChange={(e) => setInlineLocationDraft({ ...inlineLocationDraft, name: e.target.value })} />
                  <label className="sf-field-label">Endereço</label><input className="sf-input" placeholder="Rua, número, complemento" value={inlineLocationDraft.address} onChange={(e) => setInlineLocationDraft({ ...inlineLocationDraft, address: e.target.value })} />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 72px', gap: 6 }}><input className="sf-input" placeholder="Cidade" value={inlineLocationDraft.city} onChange={(e) => setInlineLocationDraft({ ...inlineLocationDraft, city: e.target.value })} /><input className="sf-input" maxLength="2" placeholder="UF" value={inlineLocationDraft.state} onChange={(e) => setInlineLocationDraft({ ...inlineLocationDraft, state: e.target.value.toUpperCase() })} /></div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 6 }}><input type="number" step="any" className="sf-input" placeholder="Latitude" value={inlineLocationDraft.latitude} onChange={(e) => setInlineLocationDraft({ ...inlineLocationDraft, latitude: e.target.value })} /><input type="number" step="any" className="sf-input" placeholder="Longitude" value={inlineLocationDraft.longitude} onChange={(e) => setInlineLocationDraft({ ...inlineLocationDraft, longitude: e.target.value })} /></div>
                  <label className="sf-check-row" style={{ marginTop: 8 }}><input type="checkbox" checked={inlineLocationDraft.isDefault} onChange={(e) => setInlineLocationDraft({ ...inlineLocationDraft, isDefault: e.target.checked })} /> Tornar padrão do grupo</label>
                  <button type="button" className="sf-btn-primary" style={{ marginTop: 8 }} onClick={createInlineGameLocation}>Cadastrar e usar nesta partida</button>
                </div>}
              </>
            )}
            <label className="sf-field-label">Data</label>
            <input type="date" className="sf-input" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
            <label className="sf-field-label">Nome do local</label>
            <input className="sf-input" placeholder="Quadra / arena" value={newLocal} onChange={(e) => setNewLocal(e.target.value)} />
            <label className="sf-field-label">Endereço</label><input className="sf-input" value={newLocationAddress} onChange={(e) => setNewLocationAddress(e.target.value)} placeholder="Rua, número, complemento" />
            <label className="sf-field-label">Cidade</label><input className="sf-input" value={newLocationCity} onChange={(e) => setNewLocationCity(e.target.value)} />
            <label className="sf-field-label">Estado/UF</label><input className="sf-input" maxLength="2" value={newLocationState} onChange={(e) => setNewLocationState(e.target.value.toUpperCase())} />
            <label className="sf-field-label">Latitude (opcional)</label><input type="number" step="any" className="sf-input" value={newLocationLatitude} onChange={(e) => setNewLocationLatitude(e.target.value)} />
            <label className="sf-field-label">Longitude (opcional)</label><input type="number" step="any" className="sf-input" value={newLocationLongitude} onChange={(e) => setNewLocationLongitude(e.target.value)} />
            <div className="sf-muted-sm">Geocodificação automática não foi identificada na infraestrutura atual; coordenadas podem ser informadas manualmente.</div>
            <label className="sf-field-label">Limite de vagas (opcional)</label>
            <input type="number" min="1" className="sf-input" placeholder="Sem limite" value={newMaxPlayers} onChange={(e) => setNewMaxPlayers(e.target.value)} />
            <label className="sf-field-label">Custo da quadra</label><input type="number" min="0" step="0.01" className="sf-input" value={newGameCost} onChange={(e) => setNewGameCost(e.target.value)} />
            <label className="sf-field-label">Goleiro paga a quadra?</label><div className="sf-gk-toggle" style={{ marginBottom: 12 }}><button type="button" className={newGameGoalkeeperPays ? 'sf-gk-toggle-on' : ''} onClick={() => setNewGameGoalkeeperPays(true)}>Sim</button><button type="button" className={!newGameGoalkeeperPays ? 'sf-gk-toggle-on' : ''} onClick={() => setNewGameGoalkeeperPays(false)}>Não</button></div>
            <label className="sf-field-label">Chave PIX</label><input className="sf-input" value={newGamePixKey} onChange={(e) => setNewGamePixKey(e.target.value)} />
            <label className="sf-field-label">Recebedor do PIX</label><input className="sf-input" value={newGamePixReceiverName} onChange={(e) => setNewGamePixReceiverName(e.target.value)} />
            <label className="sf-field-label">Cidade do PIX</label><input className="sf-input" value={newGamePixCity} onChange={(e) => setNewGamePixCity(e.target.value)} />
            <div className="sf-modal-actions">
              <button className="sf-btn-ghost" onClick={() => { setShowNewGame(false); setNewGameGroupId(null); }}>Cancelar</button>
              <button className="sf-btn-primary" onClick={createGame}>Criar</button>
            </div>
          </div>
        </div>
      )}

      {showNewGroup && (
        <div className="sf-modal-backdrop" onClick={() => setShowNewGroup(false)}>
          <div className="sf-modal" onClick={(e) => e.stopPropagation()}>
            <div className="sf-modal-title">Criar grupo</div>
            <label className="sf-field-label">Nome do grupo</label>
            <input className="sf-input" placeholder="ex: Bola com os camarada" value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} />
            <label className="sf-field-label">Local inicial (opcional)</label>
            <input className="sf-input" placeholder="Nome da quadra / arena" value={newGroupLocal} onChange={(e) => setNewGroupLocal(e.target.value)} />
            <div className="sf-muted-sm" style={{ marginTop: 4 }}>Depois de criar o grupo, você poderá cadastrar o endereço completo e definir o local padrão em Locais cadastrados.</div>
            <label className="sf-field-label">Dia padrão</label>
            <select className="sf-input" value={newGroupDay} onChange={(e) => setNewGroupDay(e.target.value)}>
              {WEEKDAY_LABELS.map((label, i) => <option key={i} value={i}>{label}</option>)}
            </select>
            <label className="sf-field-label">Horário padrão (opcional)</label>
            <input type="time" className="sf-input" value={newGroupTime} onChange={(e) => setNewGroupTime(e.target.value)} />
            <label className="sf-field-label">Vagas padrão (opcional)</label>
            <input type="number" min="1" className="sf-input" placeholder="Sem limite" value={newGroupMaxPlayers} onChange={(e) => setNewGroupMaxPlayers(e.target.value)} />
            <label className="sf-field-label">Custo padrão da quadra (opcional)</label>
            <input type="number" min="0" className="sf-input" placeholder="ex: 170" value={newGroupCost} onChange={(e) => setNewGroupCost(e.target.value)} />
            <div className="sf-modal-actions">
              <button className="sf-btn-ghost" onClick={() => setShowNewGroup(false)}>Cancelar</button>
              <button className="sf-btn-primary" onClick={createGroup}>Criar</button>
            </div>
          </div>
        </div>
      )}

      {viewingCardPlayer && (
        <div className="sf-modal-backdrop" onClick={() => setViewingCardPlayer(null)}>
          <div className="sf-modal sf-card-modal" onClick={(e) => e.stopPropagation()}>
            <PlayerCard player={viewingCardPlayer} />
            <div className="sf-h3" style={{ marginTop: 14 }}>{viewingCardPlayer.name}</div>
            {playerMeta(viewingCardPlayer) && <div className="sf-muted-sm" style={{ marginTop: 3 }}>{playerMeta(viewingCardPlayer)}</div>}
            <StarRating value={viewingCardPlayer.rating} readOnly size={18} onChange={() => {}} />
            <button className="sf-btn-ghost" style={{ marginTop: 14 }} onClick={() => setViewingCardPlayer(null)}>Fechar</button>
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
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
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
  .sf-roster-filter { background: var(--pitch-mid); border: 1px solid var(--line); border-radius: 10px; padding: 10px 12px; }
  .sf-roster-filter .sf-field-label { display: block; margin: 0 0 6px; }

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

  .sf-game-management-fab { position: fixed; right: 18px; bottom: 92px; z-index: 60; width: 56px; height: 56px; border: 0; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: var(--floodlight); color: var(--pitch-dark); box-shadow: 0 8px 24px rgba(0,0,0,.38); cursor: pointer; }
  .sf-game-management-fab:active { transform: scale(.96); }
  .sf-game-management-modal { gap: 12px; }
  .sf-game-management-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
  .sf-management-area { background: var(--pitch-dark); border: 1px solid var(--line); border-radius: 12px; padding: 14px; display: flex; flex-direction: column; gap: 8px; }
  .sf-management-summary { display: flex; flex-direction: column; gap: 7px; margin: 2px 0 4px; }
  .sf-management-summary > div { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; font-size: 12px; }
  .sf-management-summary strong { text-align: right; font-weight: 500; color: var(--chalk); }
  .sf-management-subtitle { font-size: 11px; color: var(--chalk-dim); margin-top: 8px; }
  .sf-management-player-add { display: grid; grid-template-columns: 1fr auto; gap: 8px; align-items: center; }
  @media (max-width: 380px) { .sf-game-management-fab { right: 14px; bottom: 86px; } .sf-management-player-add { grid-template-columns: 1fr; } }
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

  .sf-player-card { display: flex; gap: 12px; align-items: flex-start; background: var(--pitch-mid); border: 1px solid var(--line); border-radius: 10px; padding: 12px 14px; margin-bottom: 8px; }
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

  /* player card (FIFA-style, own palette) */
  .sf-pcard {
    width: 140px; min-width: 140px; height: 196px; border-radius: 14px; position: relative;
    display: flex; flex-direction: column; align-items: center; padding: 10px 8px 8px;
    box-shadow: 0 6px 16px rgba(0,0,0,0.35); font-family: 'Oswald', sans-serif;
  }
  .sf-pcard-compact { width: 64px; min-width: 64px; height: 90px; border-radius: 8px; padding: 5px 4px 4px; box-shadow: 0 3px 8px rgba(0,0,0,0.3); }
  .sf-pcard-top { position: absolute; top: 10px; left: 10px; text-align: center; line-height: 1; }
  .sf-pcard-compact .sf-pcard-top { top: 4px; left: 4px; }
  .sf-pcard-ovr { font-size: 22px; font-weight: 700; }
  .sf-pcard-compact .sf-pcard-ovr { font-size: 13px; }
  .sf-pcard-pos { font-size: 10px; font-weight: 600; opacity: 0.85; margin-top: 1px; }
  .sf-pcard-compact .sf-pcard-pos { font-size: 6px; }
  .sf-pcard-photo {
    width: 64px; height: 64px; border-radius: 50%; background: rgba(0,0,0,0.15);
    display: flex; align-items: center; justify-content: center; overflow: hidden;
    margin-top: 26px; border: 2px solid rgba(255,255,255,0.4); flex-shrink: 0;
  }
  .sf-pcard-compact .sf-pcard-photo { width: 30px; height: 30px; margin-top: 12px; border-width: 1px; }
  .sf-pcard-photo img { width: 100%; height: 100%; object-fit: cover; }
  .sf-pcard-name { font-size: 13px; font-weight: 700; text-transform: uppercase; margin-top: 8px; text-align: center; line-height: 1.1; }
  .sf-pcard-compact .sf-pcard-name { font-size: 8px; margin-top: 4px; }
  .sf-pcard-stats { display: flex; gap: 8px; margin-top: 10px; }
  .sf-pcard-stats > div { display: flex; flex-direction: column; align-items: center; }
  .sf-pcard-stats span { font-size: 13px; font-weight: 700; }
  .sf-pcard-stats label { font-size: 8px; opacity: 0.8; letter-spacing: 0.5px; }
  .sf-pcard-brand { position: absolute; bottom: 6px; font-size: 8px; letter-spacing: 1.5px; opacity: 0.75; font-weight: 600; }

  .sf-pcard-preview-row { display: flex; gap: 14px; align-items: flex-start; margin-bottom: 14px; }
  .sf-pcard-photo-edit { flex: 1; min-width: 0; }
  .sf-pcard-photo-btn { width: 100%; display: flex; align-items: center; justify-content: center; gap: 6px; font-size: 12px; padding: 9px; }
  .sf-attr-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-top: 6px; }
  .sf-attr-field { display: flex; align-items: center; justify-content: space-between; gap: 6px; background: var(--pitch-dark); border: 1px solid var(--line); border-radius: 6px; padding: 5px 8px; }
  .sf-attr-field label { font-size: 10px; color: var(--chalk-dim); font-weight: 700; }
  .sf-attr-field input { width: 36px; background: none; border: none; color: var(--chalk); font-family: 'JetBrains Mono', monospace; font-size: 13px; text-align: right; }

  .sf-player-card-info { flex: 1; min-width: 0; }
  .sf-pcard-trigger { background: none; border: none; padding: 0; cursor: pointer; flex-shrink: 0; }
  .sf-card-modal { align-items: center; text-align: center; }
`;
