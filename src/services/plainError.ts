/**
 * What a teacher reads when something fails. The studio's own messages are Turkish and say what to
 * do; a browser or library error ("Failed to fetch", "Cannot read properties of undefined") is
 * not shown as it is: it becomes a plain Turkish sentence. The original still goes to the error log.
 */
const TURKISH = /[çğıöşüÇĞİÖŞÜ]|\b(ve|bir|bu|için|lütfen|tekrar|deneyin|yok|var|ile)\b/i;
const NETWORK = /failed to fetch|networkerror|network request failed|load failed|err_network|timed? ?out|aborted/i;

export const NETWORK_MESSAGE = 'Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edip tekrar deneyin; sürerse sayfayı yenileyin.';

export function plainMessage(error: unknown, fallback: string): string {
  const raw = (error instanceof Error ? error.message : typeof error === 'string' ? error : (error as { message?: unknown })?.message);
  const text = typeof raw === 'string' ? raw.trim() : '';
  if (!text) return fallback;
  if (NETWORK.test(text) && !TURKISH.test(text)) return NETWORK_MESSAGE;
  if (TURKISH.test(text)) return text;
  return `${fallback} Tekrar deneyin; sürerse "Sorun bildir" ile bize iletin.`;
}
