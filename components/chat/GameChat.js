'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  createGameChatMentions,
  deleteGameChatMessage,
  listGameChatMessages,
  listGameChatReactions,
  sendGameChatMessage,
  subscribeToGameChat,
  toggleGameChatReaction,
  updateGameChatMessage,
} from '../../lib/services/game-chat-service';

const REACTIONS = ['👍', '❤️', '😂', '⚽'];

const normalize = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

function mentionedUserIds(text, names) {
  return Object.entries(names)
    .filter(([id, name]) => new RegExp(`(^|\\s)@${String(name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=\\s|$)`, 'i').test(text))
    .map(([id]) => id);
}

export default function GameChat({ gameId, userId, playerNames = {} }) {
  const [messages, setMessages] = useState([]);
  const [reactions, setReactions] = useState([]);
  const [text, setText] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editingText, setEditingText] = useState('');
  const [mentionOptions, setMentionOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [reactionBusy, setReactionBusy] = useState('');
  const [error, setError] = useState('');
  const endRef = useRef(null);

  const names = useMemo(() => playerNames || {}, [playerNames]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([listGameChatMessages(gameId), listGameChatReactions([])]).then(async ([messagesResult]) => {
      if (!active) return;
      if (messagesResult.error) setError(messagesResult.error.message || 'Não foi possível carregar o chat.');
      else {
        const loaded = messagesResult.data || [];
        setMessages(loaded);
        const reactionResult = await listGameChatReactions(loaded.map((item) => item.id));
        if (active && !reactionResult.error) setReactions(reactionResult.data || []);
      }
      setLoading(false);
    });

    const unsubscribe = subscribeToGameChat(
      gameId,
      (message) => setMessages((current) => current.some((item) => item.id === message.id) ? current : [...current, message]),
      (message) => setMessages((current) => current.map((item) => item.id === message.id ? message : item)),
      (message) => {
        setMessages((current) => current.filter((item) => item.id !== message.id));
        setReactions((current) => current.filter((item) => item.message_id !== message.id));
      },
      ({ type, reaction }) => setReactions((current) => {
        const belongsToCurrentGame = messages.some((item) => item.id === reaction.message_id);
        if (!belongsToCurrentGame) return current;
        if (type === 'INSERT' && !current.some((item) => item.id === reaction.id)) return [...current, reaction];
        if (type === 'DELETE') return current.filter((item) => item.id !== reaction.id);
        return current;
      }),
    );

    return () => { active = false; unsubscribe?.(); };
  }, [gameId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  function updateMentionOptions(value) {
    setText(value);
    const match = value.match(/(?:^|\s)@([^\s@]*)$/);
    if (!match) return setMentionOptions([]);
    const partial = normalize(match[1]);
    const options = Object.entries(names)
      .filter(([id, name]) => id !== userId && normalize(name).startsWith(partial))
      .map(([id, name]) => ({ id, name }));
    setMentionOptions(options);
  }

  function chooseMention(option) {
    const next = text.replace(/(?:^|\s)@([^\s@]*)$/, (match) => `${match.startsWith(' ') ? ' ' : ''}@${option.name} `);
    setText(next);
    setMentionOptions([]);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const value = text.trim();
    if (!value || sending) return;
    setSending(true);
    setError('');
    const { data, error: sendError } = await sendGameChatMessage(gameId, userId, value);
    if (sendError) setError(sendError.message || 'Não foi possível enviar a mensagem.');
    else if (data) {
      setText('');
      setMentionOptions([]);
      setMessages((current) => current.some((item) => item.id === data.id) ? current : [...current, data]);
      const ids = mentionedUserIds(value, names).filter((id) => id !== userId);
      if (ids.length) await createGameChatMentions(data.id, ids);
    }
    setSending(false);
  }

  async function handleReaction(messageId, reaction) {
    const key = `${messageId}:${reaction}`;
    if (reactionBusy) return;
    setReactionBusy(key);
    const { error: reactionError } = await toggleGameChatReaction(messageId, userId, reaction);
    if (reactionError) setError(reactionError.message || 'Não foi possível registrar a reação.');
    setReactionBusy('');
  }

  function startEditing(message) {
    setError('');
    setEditingId(message.id);
    setEditingText(message.message);
  }

  function cancelEditing() {
    if (savingEdit) return;
    setEditingId(null);
    setEditingText('');
  }

  async function handleEdit(messageId) {
    const value = editingText.trim();
    if (!value || savingEdit) return;
    setSavingEdit(true);
    setError('');
    const { data, error: editError } = await updateGameChatMessage(messageId, userId, value);
    if (editError) setError(editError.message || 'Não foi possível editar a mensagem.');
    else if (data) {
      setMessages((current) => current.map((item) => item.id === data.id ? data : item));
      setEditingId(null);
      setEditingText('');
    }
    setSavingEdit(false);
  }

  async function handleDelete(messageId) {
    if (deletingId) return;
    if (!window.confirm('Excluir esta mensagem?')) return;
    setDeletingId(messageId);
    setError('');
    const { error: deleteError } = await deleteGameChatMessage(messageId, userId);
    if (deleteError) setError(deleteError.message || 'Não foi possível excluir a mensagem.');
    else {
      setMessages((current) => current.filter((item) => item.id !== messageId));
      setReactions((current) => current.filter((item) => item.message_id !== messageId));
      if (editingId === messageId) cancelEditing();
    }
    setDeletingId(null);
  }

  const reactionSummary = (messageId) => REACTIONS.map((reaction) => {
    const items = reactions.filter((item) => item.message_id === messageId && item.reaction === reaction);
    return { reaction, count: items.length, mine: items.some((item) => item.user_id === userId) };
  }).filter((item) => item.count > 0 || true);

  return (
    <section className="sf-chat" aria-label="Chat da partida">
      <div className="sf-chat-header">
        <div>
          <strong>💬 Chat da partida</strong>
          <div className="sf-chat-subtitle">Converse com quem vai jogar</div>
        </div>
      </div>

      <div className="sf-chat-messages" aria-live="polite">
        {loading && <div className="sf-chat-empty">Carregando conversa…</div>}
        {!loading && messages.length === 0 && <div className="sf-chat-empty">Ainda não há mensagens. Seja o primeiro a falar.</div>}
        {messages.map((item) => {
          const own = item.user_id === userId;
          const name = names[item.user_id] || (own ? 'Você' : 'Jogador');
          const editing = editingId === item.id;
          const deleting = deletingId === item.id;
          return (
            <div className={`sf-chat-message${own ? ' sf-chat-message-own' : ''}`} key={item.id}>
              <div className="sf-chat-message-author">{name}</div>
              {editing ? (
                <div className="sf-chat-edit-form">
                  <input value={editingText} onChange={(event) => setEditingText(event.target.value)} maxLength={2000} aria-label="Editar mensagem" disabled={savingEdit} autoFocus />
                  <div className="sf-chat-message-actions">
                    <button type="button" onClick={() => handleEdit(item.id)} disabled={!editingText.trim() || savingEdit}>{savingEdit ? 'Salvando…' : 'Salvar'}</button>
                    <button type="button" onClick={cancelEditing} disabled={savingEdit}>Cancelar</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="sf-chat-message-text">{item.message}</div>
                  <div className="sf-chat-reactions" aria-label="Reações">
                    {reactionSummary(item.id).map(({ reaction, count, mine }) => (
                      <button key={reaction} type="button" className={mine ? 'sf-chat-reaction sf-chat-reaction-active' : 'sf-chat-reaction'} onClick={() => handleReaction(item.id, reaction)} disabled={reactionBusy === `${item.id}:${reaction}`} aria-label={`Reagir com ${reaction}`}>
                        {reaction}{count > 0 ? ` ${count}` : ''}
                      </button>
                    ))}
                  </div>
                  <div className="sf-chat-message-meta">
                    <time dateTime={item.updated_at || item.created_at}>{new Date(item.updated_at || item.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</time>
                    {item.updated_at && item.updated_at !== item.created_at && <span>editada</span>}
                    {own && (
                      <span className="sf-chat-message-actions">
                        <button type="button" onClick={() => startEditing(item)} disabled={deleting} aria-label={`Editar mensagem de ${name}`}>Editar</button>
                        <button type="button" onClick={() => handleDelete(item.id)} disabled={deleting} aria-label={`Excluir mensagem de ${name}`}>{deleting ? 'Excluindo…' : 'Excluir'}</button>
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {error && <div className="sf-chat-error" role="alert">{error}</div>}

      <form className="sf-chat-form" onSubmit={handleSubmit}>
        <div className="sf-chat-input-wrap">
          <input value={text} onChange={(event) => updateMentionOptions(event.target.value)} maxLength={2000} placeholder="Digite uma mensagem… Use @ para mencionar" aria-label="Mensagem" />
          {mentionOptions.length > 0 && (
            <div className="sf-chat-mention-list" role="listbox" aria-label="Jogadores para mencionar">
              {mentionOptions.map((option) => (
                <button key={option.id} type="button" onClick={() => chooseMention(option)}>{option.name}</button>
              ))}
            </div>
          )}
        </div>
        <button type="submit" disabled={!text.trim() || sending}>{sending ? '…' : 'Enviar'}</button>
      </form>
    </section>
  );
}
