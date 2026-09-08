'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { listGameChatMessages, sendGameChatMessage, subscribeToGameChat } from '../../lib/services/game-chat-service';

export default function GameChat({ gameId, userId, playerNames = {} }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const endRef = useRef(null);

  const names = useMemo(() => playerNames || {}, [playerNames]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    listGameChatMessages(gameId).then(({ data, error: loadError }) => {
      if (!active) return;
      if (loadError) setError(loadError.message || 'Não foi possível carregar o chat.');
      else setMessages(data || []);
      setLoading(false);
    });

    const unsubscribe = subscribeToGameChat(
      gameId,
      (message) => setMessages((current) => current.some((item) => item.id === message.id) ? current : [...current, message]),
      (message) => setMessages((current) => current.map((item) => item.id === message.id ? message : item)),
      (message) => setMessages((current) => current.filter((item) => item.id !== message.id)),
    );

    return () => { active = false; unsubscribe?.(); };
  }, [gameId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  async function handleSubmit(event) {
    event.preventDefault();
    const value = text.trim();
    if (!value || sending) return;
    setSending(true);
    setError('');
    const { data, error: sendError } = await sendGameChatMessage(gameId, userId, value);
    if (sendError) setError(sendError.message || 'Não foi possível enviar a mensagem.');
    else {
      setText('');
      if (data) setMessages((current) => current.some((item) => item.id === data.id) ? current : [...current, data]);
    }
    setSending(false);
  }

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
          return (
            <div className={`sf-chat-message${own ? ' sf-chat-message-own' : ''}`} key={item.id}>
              <div className="sf-chat-message-author">{name}</div>
              <div className="sf-chat-message-text">{item.message}</div>
              <time dateTime={item.created_at}>{new Date(item.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</time>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {error && <div className="sf-chat-error" role="alert">{error}</div>}

      <form className="sf-chat-form" onSubmit={handleSubmit}>
        <input value={text} onChange={(event) => setText(event.target.value)} maxLength={2000} placeholder="Digite uma mensagem…" aria-label="Mensagem" />
        <button type="submit" disabled={!text.trim() || sending}>{sending ? '…' : 'Enviar'}</button>
      </form>
    </section>
  );
}
