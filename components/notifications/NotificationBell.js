'use client';

import { useEffect, useState } from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { listNotifications, markAllNotificationsRead, markNotificationRead, subscribeToNotifications } from '../../lib/services/notification-service';

function relativeTime(value) {
  const diff = Math.max(0, Date.now() - new Date(value).getTime());
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'agora';
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours}h`;
  return `há ${Math.floor(hours / 24)}d`;
}

export default function NotificationBell() {
  const [userId, setUserId] = useState(null);
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let unsubscribe;
    let active = true;
    supabase.auth.getUser().then(async ({ data }) => {
      const id = data?.user?.id;
      if (!active || !id) return;
      setUserId(id);
      const result = await listNotifications(id);
      if (active && !result.error) setItems(result.data || []);
      unsubscribe = subscribeToNotifications(id, (notification) => {
        setItems((current) => current.some((item) => item.id === notification.id) ? current : [notification, ...current]);
      }, (notification) => {
        setItems((current) => current.map((item) => item.id === notification.id ? notification : item));
      });
    });
    return () => { active = false; unsubscribe?.(); };
  }, []);

  const unread = items.filter((item) => !item.read_at).length;

  async function read(item) {
    if (!item.read_at && userId) {
      await markNotificationRead(item.id, userId);
      setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, read_at: new Date().toISOString() } : entry));
    }
    setOpen(false);
  }

  async function readAll() {
    if (!userId || unread === 0) return;
    await markAllNotificationsRead(userId);
    setItems((current) => current.map((item) => ({ ...item, read_at: item.read_at || new Date().toISOString() })));
  }

  if (!userId) return null;

  return (
    <div className="sf-notification-root">
      <button type="button" className="sf-notification-bell" onClick={() => setOpen((value) => !value)} aria-label={`Notificações${unread ? `, ${unread} não lidas` : ''}`}>
        <Bell size={20} />
        {unread > 0 && <span className="sf-notification-badge">{unread > 99 ? '99+' : unread}</span>}
      </button>
      {open && (
        <div className="sf-notification-panel">
          <div className="sf-notification-panel-header">
            <strong>Notificações</strong>
            <button type="button" onClick={readAll} disabled={unread === 0}><CheckCheck size={15} /> Marcar lidas</button>
          </div>
          <div className="sf-notification-list">
            {items.length === 0 && <div className="sf-notification-empty">Nenhuma notificação.</div>}
            {items.map((item) => (
              <button type="button" key={item.id} className={`sf-notification-item${item.read_at ? '' : ' sf-notification-unread'}`} onClick={() => read(item)}>
                <span className="sf-notification-title">{item.title}</span>
                {item.body && <span className="sf-notification-body">{item.body}</span>}
                <span className="sf-notification-time">{relativeTime(item.created_at)}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
