import { supabase } from '../../services/supabase';
import { isMigrationPending } from '../settings/studioSettings';

/** One message of a teacher's conversation with the studio admins. */
export interface Message {
  id: string;
  teacher_id: string;
  from_admin: boolean;
  body: string;
  created_at: string;
  read_at: string | null;
}

const COLUMNS = 'id,teacher_id,from_admin,body,created_at,read_at';
export const MESSAGES_PENDING = 'Mesajlar için veritabanı güncellemesi bekleniyor (supabase/migrations/20261009_messages.sql).';

/** One tap fills the box; the admin can still edit it before sending. */
export const QUICK_MESSAGES = ['Sorunu çözdük hocam, tekrar deneyebilirsiniz.', 'Önemli değil hocam.', 'Rica ederiz hocam.', 'Bakıyoruz hocam, çözünce haber vereceğiz.'];

export const messageTime = (iso: string) => new Date(iso).toLocaleString('tr', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/** Messages the reader has not opened yet: admin's messages for a teacher, teachers' for the admin. */
export const unread = (messages: Pick<Message, 'from_admin' | 'read_at'>[], asAdmin: boolean) =>
  messages.filter(m => m.from_admin !== asAdmin && !m.read_at).length;

export async function loadConversation(teacherId: string): Promise<Message[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('messages').select(COLUMNS).eq('teacher_id', teacherId).order('created_at').limit(300);
  if (error) throw new Error(isMigrationPending(error) ? MESSAGES_PENDING : 'Mesajlar okunamadı.');
  return (data || []) as Message[];
}

/** Every conversation's messages, newest first (admins only; RLS gives teachers just their own). */
export async function loadAllMessages(): Promise<Message[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('messages').select(COLUMNS).order('created_at', { ascending: false }).limit(1000);
  if (error) throw new Error(isMigrationPending(error) ? MESSAGES_PENDING : 'Mesajlar okunamadı.');
  return (data || []) as Message[];
}

export async function sendMessage(teacherId: string, body: string, fromAdmin: boolean): Promise<Message> {
  if (!supabase) throw new Error('Bağlantı kurulamadı.');
  const { data, error } = await supabase.from('messages').insert({ teacher_id: teacherId, body: body.trim().slice(0, 2000), from_admin: fromAdmin }).select(COLUMNS).single();
  if (error) throw new Error(isMigrationPending(error) ? MESSAGES_PENDING : /çok fazla/i.test(error.message) ? error.message : 'Mesaj gönderilemedi.');
  return data as Message;
}

/** Admin "Toplu mesaj": the same message into each chosen teacher's own conversation, in one insert. */
export async function sendBulkMessage(teacherIds: string[], body: string): Promise<number> {
  if (!supabase) throw new Error('Bağlantı kurulamadı.');
  const text = body.trim().slice(0, 2000);
  const ids = [...new Set(teacherIds)];
  if (!text || !ids.length) return 0;
  const { error } = await supabase.from('messages').insert(ids.map(teacher_id => ({ teacher_id, body: text, from_admin: true })));
  if (error) throw new Error(isMigrationPending(error) ? MESSAGES_PENDING : 'Mesaj gönderilemedi.');
  return ids.length;
}

export async function markRead(teacherId: string): Promise<void> {
  if (!supabase) return;
  await supabase.rpc('mark_messages_read', { conversation: teacherId });
}
