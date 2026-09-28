import { supabase } from '../../services/supabase';

/** Where reports are sent when the database is not ready (e-mail fallback). */
export const ADMIN_EMAIL = 'yunusemreyilmaz93@gmail.com';

export interface ReportContext {
  page?: string;
  projectId?: string;
  projectTitle?: string;
  step?: string;
}

export interface FeedbackContext extends ReportContext {
  url: string;
  at: string;
  browser: string;
  screen: string;
  /** Messages the teacher could see (role="alert") when opening the form. */
  shownErrors: string[];
  /** Recent errors from the page itself, newest last. */
  recentErrors: string[];
}

let current: ReportContext = {};
/** Pages and the editor say what the teacher is working on, so a report needs no explanation. */
export function setReportContext(context: ReportContext) {
  current = context;
}

const recent: string[] = [];
const remember = (text: string) => {
  const line = `${new Date().toLocaleTimeString('tr')} · ${text}`.replace(/\s+/g, ' ').slice(0, 300);
  if (recent[recent.length - 1] !== line) recent.push(line);
  if (recent.length > 8) recent.shift();
};

let installed = false;
/** Keeps the last few page errors in memory (never sent unless the teacher sends a report). */
export function installErrorBuffer() {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  window.addEventListener('error', e => remember(e.message || 'Bilinmeyen hata'));
  window.addEventListener('unhandledrejection', e => remember(String((e.reason as any)?.message || e.reason || 'İşlenmemiş hata')));
  const original = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    remember(args.map(a => (a instanceof Error ? a.message : typeof a === 'string' ? a : '')).filter(Boolean).join(' '));
    original(...args);
  };
}

export function collectContext(doc: Pick<Document, 'querySelectorAll'> = document): FeedbackContext {
  const shownErrors = Array.from(doc.querySelectorAll('[role="alert"]'))
    .map(el => (el.textContent || '').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .slice(0, 5)
    .map(text => text.slice(0, 300));
  return {
    ...current,
    url: location.pathname + location.search,
    at: new Date().toISOString(),
    browser: navigator.userAgent.slice(0, 200),
    screen: `${window.innerWidth}×${window.innerHeight}`,
    shownErrors,
    recentErrors: [...recent],
  };
}

/** Plain text of a report, for the e-mail fallback and the admin list. */
export function describeReport(message: string, context: FeedbackContext, sender?: string): string {
  const lines = [
    message.trim() || '(Açıklama yazılmadı)',
    '',
    sender && `Gönderen: ${sender}`,
    context.page && `Sayfa: ${context.page}`,
    context.projectTitle && `Soru: ${context.projectTitle}${context.step ? ` · ${context.step} adımı` : ''}`,
    `Zaman: ${new Date(context.at).toLocaleString('tr')}`,
    context.shownErrors.length && `Ekrandaki uyarılar:\n- ${context.shownErrors.join('\n- ')}`,
    context.recentErrors.length && `Son hatalar:\n- ${context.recentErrors.join('\n- ')}`,
    `Tarayıcı: ${context.browser} · ${context.screen}`,
  ];
  return lines.filter((line): line is string => typeof line === 'string').join('\n');
}

export type SendResult = { sent: true } | { sent: false; reason: string; mailto: string };

export async function sendFeedback(message: string, context: FeedbackContext, sender?: string): Promise<SendResult> {
  const mailto = `mailto:${ADMIN_EMAIL}?subject=${encodeURIComponent('Soru Stüdyosu · Sorun bildirimi')}&body=${encodeURIComponent(describeReport(message, context, sender).slice(0, 1800))}`;
  if (!supabase) return { sent: false, reason: 'Bağlantı kurulamadı.', mailto };
  try {
    const { error } = await supabase.from('feedback').insert({ message: message.trim().slice(0, 2000), context });
    if (!error) return { sent: true };
    return { sent: false, reason: /çok fazla/i.test(error.message) ? error.message : 'Bildirim kaydedilemedi.', mailto };
  } catch {
    return { sent: false, reason: 'Bildirim gönderilemedi.', mailto };
  }
}
