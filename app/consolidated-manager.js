'use client';

import { useEffect, useMemo, useState } from 'react';
import { MapPin, Users, Plus, Trash2, X, Check } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

export default function ConsolidatedManager() {
  const [session, setSession] = useState(null);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState('guests');
  const [games, setGames] = useState([]);
  const [groups, setGroups] = useState([]);
  const [guests, setGuests] = useState([]);
  const [locations, setLocations] = useState([]);
  const [gameId, setGameId] = useState('');
  const [groupId, setGroupId] = useState('');
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [locationName, setLocationName] = useState('');
  const [locationAddress, setLocationAddress] = useState('');
  const [locationCity, setLocationCity] = useState('');
  const [locationState, setLocationState] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { supabase.auth.getSession().then(({ data }) => setSession(data.session)); }, []);

  const load = async () => {
    const [{ data: gamesData }, { data: groupsData }] = await Promise.all([
      supabase.from('games').select('id,date,local,group_id').order('date', { ascending: false }),
      supabase.from('groups').select('id,name').order('name'),
    ]);
    setGames(gamesData || []);
    setGroups(groupsData || []);
    if (!gameId && gamesData?.[0]) setGameId(gamesData[0].id);
    if (!groupId && groupsData?.[0]) setGroupId(groupsData[0].id);
  };

  const loadGuests = async (id) => {
    if (!id) return setGuests([]);
    const { data } = await supabase.from('game_guests').select('*').eq('game_id', id).order('created_at');
    setGuests(data || []);
  };

  const loadLocations = async (id) => {
    if (!id) return setLocations([]);
    const { data } = await supabase.from('group_locations').select('*').eq('group_id', id).order('is_default', { ascending: false }).order('name');
    setLocations(data || []);
  };

  useEffect(() => { if (open && session) load(); }, [open, session]);
  useEffect(() => { if (open) loadGuests(gameId); }, [open, gameId]);
  useEffect(() => { if (open) loadLocations(groupId); }, [open, groupId]);

  const selectedGame = useMemo(() => games.find((g) => g.id === gameId), [games, gameId]);

  const addGuest = async () => {
    if (!gameId || !guestName.trim()) return;
    setSaving(true);
    const { error } = await supabase.from('game_guests').insert({ game_id: gameId, name: guestName.trim(), email: guestEmail.trim() || null, created_by: session.user.id });
    setSaving(false);
    if (error) return alert('Não foi possível adicionar o convidado: ' + error.message);
    setGuestName(''); setGuestEmail(''); loadGuests(gameId);
  };

  const setGuestAccepted = async (guest, accepted) => {
    const { error } = await supabase.from('game_guests').update({ accepted_at: accepted ? new Date().toISOString() : null }).eq('id', guest.id);
    if (error) return alert('Não foi possível atualizar a presença: ' + error.message);
    loadGuests(gameId);
  };

  const deleteGuest = async (id) => {
    if (!confirm('Remover este convidado da partida?')) return;
    const { error } = await supabase.from('game_guests').delete().eq('id', id);
    if (error) return alert('Não foi possível remover o convidado: ' + error.message);
    loadGuests(gameId);
  };

  const addLocation = async () => {
    if (!groupId || !locationName.trim()) return;
    setSaving(true);
    const { error } = await supabase.from('group_locations').insert({ group_id: groupId, name: locationName.trim(), address: locationAddress.trim() || null, city: locationCity.trim() || null, state: locationState.trim().toUpperCase() || null, created_by: session.user.id });
    setSaving(false);
    if (error) return alert('Não foi possível cadastrar o local: ' + error.message);
    setLocationName(''); setLocationAddress(''); setLocationCity(''); setLocationState(''); loadLocations(groupId);
  };

  const setDefaultLocation = async (location) => {
    const { error: clearError } = await supabase.from('group_locations').update({ is_default: false }).eq('group_id', groupId).eq('is_default', true);
    if (clearError) return alert('Não foi possível atualizar o local padrão: ' + clearError.message);
    const { error } = await supabase.from('group_locations').update({ is_default: true }).eq('id', location.id);
    if (error) return alert('Não foi possível definir o local padrão: ' + error.message);
    loadLocations(groupId);
  };

  const deleteLocation = async (id) => {
    if (!confirm('Remover este local salvo?')) return;
    const { error } = await supabase.from('group_locations').delete().eq('id', id);
    if (error) return alert('Não foi possível remover o local: ' + error.message);
    loadLocations(groupId);
  };

  const applyLocationToGame = async (location) => {
    if (!selectedGame || selectedGame.group_id !== groupId) return alert('Selecione uma partida do mesmo grupo do local.');
    const { error } = await supabase.from('games').update({ local: location.name, location_address: location.address, location_city: location.city, location_state: location.state, location_latitude: location.latitude, location_longitude: location.longitude }).eq('id', selectedGame.id);
    if (error) return alert('Não foi possível aplicar o local à partida: ' + error.message);
    await load();
    alert('Local aplicado à partida.');
  };

  if (!session) return null;

  return (
    <>
      <button className="sf-consolidated-trigger" onClick={() => setOpen(true)} title="Convidados e locais"><MapPin size={15} /><span>Gestão</span></button>
      {open && (
        <div className="sf-consolidated-backdrop" onClick={() => setOpen(false)}>
          <div className="sf-consolidated-panel" onClick={(e) => e.stopPropagation()}>
            <div className="sf-consolidated-head"><div><strong>Gestão</strong><small>Convidados e locais reutilizáveis</small></div><button onClick={() => setOpen(false)}><X size={18} /></button></div>
            <div className="sf-consolidated-tabs">
              <button className={tab === 'guests' ? 'on' : ''} onClick={() => setTab('guests')}><Users size={15} /> Convidados</button>
              <button className={tab === 'locations' ? 'on' : ''} onClick={() => setTab('locations')}><MapPin size={15} /> Locais</button>
            </div>

            {tab === 'guests' && <div>
              <label>Partida</label>
              <select value={gameId} onChange={(e) => setGameId(e.target.value)}><option value="">Selecione</option>{games.map((g) => <option key={g.id} value={g.id}>{g.date} · {g.local || 'Local a definir'}</option>)}</select>
              <div className="sf-consolidated-form">
                <input placeholder="Nome do convidado *" value={guestName} onChange={(e) => setGuestName(e.target.value)} />
                <input type="email" placeholder="E-mail (opcional)" value={guestEmail} onChange={(e) => setGuestEmail(e.target.value)} />
                <button onClick={addGuest} disabled={saving || !guestName.trim()}><Plus size={15} /> Adicionar</button>
              </div>
              <div className="sf-consolidated-list">
                {guests.map((g) => <div className="sf-consolidated-row" key={g.id}><div><strong>{g.name}</strong><small>{g.email || 'E-mail não informado'}</small></div><button className={g.accepted_at ? 'accepted' : ''} onClick={() => setGuestAccepted(g, !g.accepted_at)}>{g.accepted_at ? <Check size={15} /> : 'Pendente'}</button><button onClick={() => deleteGuest(g.id)}><Trash2 size={15} /></button></div>)}
                {!guests.length && <small className="empty">Nenhum convidado cadastrado nesta partida.</small>}
              </div>
              <small className="sf-consolidated-note">Convidados ficam vinculados à partida. O sorteio atual usa perfis do sistema; convidado externo não é convertido automaticamente em perfil.</small>
            </div>}

            {tab === 'locations' && <div>
              <label>Grupo</label>
              <select value={groupId} onChange={(e) => setGroupId(e.target.value)}><option value="">Selecione</option>{groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select>
              <div className="sf-consolidated-form">
                <input placeholder="Nome do local *" value={locationName} onChange={(e) => setLocationName(e.target.value)} />
                <input placeholder="Endereço" value={locationAddress} onChange={(e) => setLocationAddress(e.target.value)} />
                <div className="sf-consolidated-two"><input placeholder="Cidade" value={locationCity} onChange={(e) => setLocationCity(e.target.value)} /><input maxLength={2} placeholder="UF" value={locationState} onChange={(e) => setLocationState(e.target.value.toUpperCase())} /></div>
                <button onClick={addLocation} disabled={saving || !locationName.trim()}><Plus size={15} /> Salvar local</button>
              </div>
              <label>Partida para aplicar o local</label>
              <select value={gameId} onChange={(e) => setGameId(e.target.value)}><option value="">Selecione</option>{games.filter((g) => g.group_id === groupId).map((g) => <option key={g.id} value={g.id}>{g.date} · {g.local || 'Local a definir'}</option>)}</select>
              <div className="sf-consolidated-list">
                {locations.map((l) => <div className="sf-consolidated-row" key={l.id}><div><strong>{l.name}{l.is_default ? ' · padrão' : ''}</strong><small>{[l.address, l.city, l.state].filter(Boolean).join(', ') || 'Endereço não informado'}</small></div><button onClick={() => setDefaultLocation(l)} disabled={l.is_default}>{l.is_default ? <Check size={15} /> : 'Padrão'}</button>{selectedGame?.group_id === groupId && <button onClick={() => applyLocationToGame(l)}>Aplicar</button>}<button onClick={() => deleteLocation(l.id)}><Trash2 size={15} /></button></div>)}
                {!locations.length && <small className="empty">Nenhum local salvo para este grupo.</small>}
              </div>
              <small className="sf-consolidated-note">O local salvo é reutilizável. Latitude/longitude não são exibidas nem solicitadas neste cadastro.</small>
            </div>}
          </div>
        </div>
      )}
    </>
  );
}
