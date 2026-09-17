'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft, Save, Shield, UserRound } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '../../../../lib/supabaseClient';

const POSITIONS = [
  ['goleiro', 'Goleiro'],
  ['fixo', 'Fixo'],
  ['libero', 'Líbero'],
  ['meio', 'Meio'],
  ['ala_esquerdo', 'Ala esquerdo'],
  ['ala_direito', 'Ala direito'],
  ['pivo', 'Pivô'],
];

const EMPTY = {
  name: '', nickname: '', email: '', avatar_url: '', rating: 0, preferred_foot: '', weight_kg: '',
  positions: [], phone: '', age: '', is_admin: false, pix_key: '', attr_ata: '', attr_def: '',
  attr_for: '', attr_hab: '', nationality_code: '', created_at: null,
};

function errorMessage(message) {
  const map = {
    ADMIN_ONLY: 'Acesso restrito ao administrador.', USER_NOT_FOUND: 'Usuário não encontrado.', NAME_REQUIRED: 'O nome é obrigatório.',
    INVALID_RATING: 'Rating deve estar entre 0 e 100.', INVALID_AGE: 'Idade inválida.', INVALID_WEIGHT: 'Peso inválido.',
    INVALID_ATA: 'Ataque deve estar entre 0 e 100.', INVALID_DEF: 'Defesa deve estar entre 0 e 100.', INVALID_FOR: 'Força deve estar entre 0 e 100.',
    INVALID_HAB: 'Habilidade deve estar entre 0 e 100.', EMAIL_REQUIRED: 'O e-mail é obrigatório.', INVALID_EMAIL: 'E-mail inválido.',
    EMAIL_ALREADY_IN_USE: 'Este e-mail já está sendo usado por outra conta.', CANNOT_DEMOTE_SELF: 'Você não pode remover o próprio acesso de administrador.',
    AUTH_USER_NOT_FOUND: 'Conta de autenticação não encontrada.',
  };
  const key = Object.keys(map).find((item) => message?.includes(item));
  return map[key] || 'Não foi possível salvar o perfil.';
}

function numberOrNull(value) {
  if (value === '' || value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export default function AdminPlayerEditPage() {
  const { id } = useParams();
  const router = useRouter();
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      setLoading(true); setError('');
      const { data, error: rpcError } = await supabase.rpc('get_admin_user_profile', { p_user_id: id });
      if (rpcError || !data?.[0]) setError(errorMessage(rpcError?.message || 'USER_NOT_FOUND'));
      else setForm({ ...EMPTY, ...data[0], positions: data[0].positions || [], weight_kg: data[0].weight_kg ?? '', age: data[0].age ?? '', attr_ata: data[0].attr_ata ?? '', attr_def: data[0].attr_def ?? '', attr_for: data[0].attr_for ?? '', attr_hab: data[0].attr_hab ?? '' });
      setLoading(false);
    };
    load();
  }, [id]);

  const set = (field, value) => { setSaved(false); setForm((current) => ({ ...current, [field]: value })); };
  const togglePosition = (position) => set('positions', form.positions.includes(position) ? form.positions.filter((item) => item !== position) : [...form.positions, position]);

  const save = async (event) => {
    event.preventDefault(); setSaving(true); setError(''); setSaved(false);
    const { error: rpcError } = await supabase.rpc('admin_update_user_profile', {
      p_user_id: id, p_name: form.name, p_nickname: form.nickname, p_avatar_url: form.avatar_url,
      p_rating: numberOrNull(form.rating), p_preferred_foot: form.preferred_foot, p_weight_kg: numberOrNull(form.weight_kg),
      p_positions: form.positions, p_phone: form.phone, p_age: numberOrNull(form.age), p_is_admin: form.is_admin,
      p_pix_key: form.pix_key, p_attr_ata: numberOrNull(form.attr_ata), p_attr_def: numberOrNull(form.attr_def),
      p_attr_for: numberOrNull(form.attr_for), p_attr_hab: numberOrNull(form.attr_hab), p_nationality_code: form.nationality_code,
      p_email: form.email,
    });
    setSaving(false);
    if (rpcError) setError(errorMessage(rpcError.message));
    else { setSaved(true); setTimeout(() => router.push('/admin/jogadores'), 500); }
  };

  if (loading) return <main style={styles.page}><div style={styles.card}>Carregando perfil...</div></main>;
  if (error && !form.id) return <main style={styles.page}><div style={styles.card}><div style={styles.error}>{error}</div><Link href="/admin/jogadores">Voltar para jogadores</Link></div></main>;

  return (
    <main style={styles.page}>
      <div style={styles.wrap}>
        <div style={styles.top}>
          <Link href="/admin/jogadores" style={styles.back}><ArrowLeft size={17} /> Jogadores</Link>
          <div><div style={styles.kicker}><Shield size={17} /> ADMINISTRAÇÃO</div><h1 style={styles.title}>Editar perfil</h1><p style={styles.muted}>O administrador pode corrigir os dados cadastrais e esportivos da conta.</p></div>
        </div>

        {error ? <div style={styles.error}>{error}</div> : null}
        {saved ? <div style={styles.success}>Perfil salvo. Retornando à lista...</div> : null}

        <form onSubmit={save} style={styles.form}>
          <section style={styles.section}>
            <h2 style={styles.sectionTitle}><UserRound size={18} /> Dados da conta</h2>
            <div style={styles.grid}>
              <Field label="Nome" value={form.name} onChange={(v) => set('name', v)} required />
              <Field label="Apelido" value={form.nickname} onChange={(v) => set('nickname', v)} />
              <Field label="E-mail" type="email" value={form.email} onChange={(v) => set('email', v)} required />
              <Field label="Telefone" value={form.phone} onChange={(v) => set('phone', v)} />
              <Field label="URL da foto" value={form.avatar_url} onChange={(v) => set('avatar_url', v)} />
              <Field label="Chave PIX" value={form.pix_key} onChange={(v) => set('pix_key', v)} />
              <Field label="Nacionalidade (código)" value={form.nationality_code} onChange={(v) => set('nationality_code', v)} />
              <label style={styles.checkboxRow}><input type="checkbox" checked={Boolean(form.is_admin)} onChange={(e) => set('is_admin', e.target.checked)} /> Administrador global</label>
            </div>
          </section>

          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>Dados esportivos</h2>
            <div style={styles.grid}>
              <Field label="Rating" type="number" min="0" max="100" value={form.rating} onChange={(v) => set('rating', v)} required />
              <Field label="Idade" type="number" min="0" max="120" value={form.age} onChange={(v) => set('age', v)} />
              <Field label="Peso (kg)" type="number" min="0" max="500" step="0.1" value={form.weight_kg} onChange={(v) => set('weight_kg', v)} />
              <label style={styles.label}>Pé preferencial<select style={styles.input} value={form.preferred_foot || ''} onChange={(e) => set('preferred_foot', e.target.value)}><option value="">Não informado</option><option value="direito">Direito</option><option value="esquerdo">Esquerdo</option><option value="ambidestro">Ambidestro</option></select></label>
            </div>
            <div style={styles.positions}><div style={styles.labelText}>Posições</div><div style={styles.positionGrid}>{POSITIONS.map(([value, label]) => <label key={value} style={styles.position}><input type="checkbox" checked={form.positions.includes(value)} onChange={() => togglePosition(value)} /> {label}</label>)}</div></div>
          </section>

          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>Atributos</h2>
            <div style={styles.gridFour}>
              <Field label="Ataque" type="number" min="0" max="100" value={form.attr_ata} onChange={(v) => set('attr_ata', v)} />
              <Field label="Defesa" type="number" min="0" max="100" value={form.attr_def} onChange={(v) => set('attr_def', v)} />
              <Field label="Força" type="number" min="0" max="100" value={form.attr_for} onChange={(v) => set('attr_for', v)} />
              <Field label="Habilidade" type="number" min="0" max="100" value={form.attr_hab} onChange={(v) => set('attr_hab', v)} />
            </div>
          </section>

          <div style={styles.actions}><Link href="/admin/jogadores" style={styles.cancel}>Cancelar</Link><button type="submit" disabled={saving} style={styles.save}><Save size={17} /> {saving ? 'Salvando...' : 'Salvar perfil'}</button></div>
        </form>
      </div>
    </main>
  );
}

function Field({ label, value, onChange, type = 'text', min, max, step, required }) {
  return <label style={styles.label}>{label}<input style={styles.input} type={type} min={min} max={max} step={step} value={value ?? ''} onChange={(e) => onChange(e.target.value)} required={required} /></label>;
}

const styles = {
  page: { minHeight: '100vh', padding: '24px 16px 40px', background: '#f5f7f5', color: '#132018' },
  wrap: { maxWidth: 1000, margin: '0 auto' },
  card: { maxWidth: 560, margin: '80px auto', padding: 30, borderRadius: 16, background: '#fff', textAlign: 'center' },
  top: { marginBottom: 18 }, back: { display: 'inline-flex', alignItems: 'center', gap: 6, color: '#315c3d', textDecoration: 'none', marginBottom: 18, fontWeight: 700 },
  kicker: { display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, fontWeight: 800, letterSpacing: '.08em', color: '#315c3d' },
  title: { margin: '5px 0', fontSize: 28 }, muted: { margin: 0, color: '#607064' },
  form: { display: 'grid', gap: 16 }, section: { padding: 18, background: '#fff', border: '1px solid #dbe2dc', borderRadius: 14 },
  sectionTitle: { display: 'flex', alignItems: 'center', gap: 7, margin: '0 0 14px', fontSize: 17 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 13 }, gridFour: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 13 },
  label: { display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, fontWeight: 700 }, input: { width: '100%', boxSizing: 'border-box', padding: '10px 11px', border: '1px solid #cbd5ce', borderRadius: 9, background: '#fff', color: '#132018', fontSize: 14 },
  checkboxRow: { display: 'flex', alignItems: 'center', gap: 8, alignSelf: 'end', minHeight: 40, fontSize: 14, fontWeight: 700 }, positions: { marginTop: 15 }, labelText: { fontSize: 13, fontWeight: 700, marginBottom: 8 }, positionGrid: { display: 'flex', flexWrap: 'wrap', gap: 10 }, position: { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '8px 10px', border: '1px solid #dbe2dc', borderRadius: 9, background: '#f8faf8', fontSize: 13 },
  actions: { display: 'flex', justifyContent: 'flex-end', gap: 10 }, cancel: { display: 'inline-flex', alignItems: 'center', padding: '10px 14px', border: '1px solid #cbd5ce', borderRadius: 9, background: '#fff', color: '#26362b', textDecoration: 'none' }, save: { display: 'inline-flex', alignItems: 'center', gap: 7, padding: '10px 16px', border: 0, borderRadius: 9, background: '#315c3d', color: '#fff', fontWeight: 800, cursor: 'pointer' },
  error: { padding: 12, borderRadius: 10, background: '#fff0f0', color: '#9b2525', marginBottom: 14 }, success: { padding: 12, borderRadius: 10, background: '#eef8f0', color: '#28623a', marginBottom: 14 },
};
