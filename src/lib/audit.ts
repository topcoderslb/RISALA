import { addDoc, collection } from 'firebase/firestore';
import { db } from './firebase';
import { UserProfile, AuditAction } from './types';

/**
 * Log an audit event to Firestore.
 * Fire-and-forget — never blocks or throws to the caller.
 */
export function logAudit(
  profile: UserProfile | null,
  action: AuditAction,
  col: string,
  details: string,
  documentId?: string,
) {
  if (!profile) return;
  const entry = {
    userId: profile.uid,
    userName: profile.name,
    userRole: profile.role,
    centerId: profile.centerId || '',
    centerName: profile.centerName || '',
    action,
    collection: col,
    documentId: documentId || '',
    details,
    timestamp: new Date().toISOString(),
  };
  addDoc(collection(db, 'auditLogs'), entry).catch(() => {});
}

/* ── Device / browser helpers ────────────────────────────────────────────── */

export function parseUserAgent(ua: string) {
  let deviceType = 'Desktop';
  if (/Mobile|Android|iPhone|iPad|iPod/i.test(ua)) deviceType = 'Mobile';
  if (/Tablet|iPad/i.test(ua)) deviceType = 'Tablet';

  let browser = 'Unknown';
  if (/Edg\//i.test(ua)) browser = 'Edge';
  else if (/OPR|Opera/i.test(ua)) browser = 'Opera';
  else if (/Chrome/i.test(ua)) browser = 'Chrome';
  else if (/Safari/i.test(ua)) browser = 'Safari';
  else if (/Firefox/i.test(ua)) browser = 'Firefox';

  let os = 'Unknown';
  if (/Windows/i.test(ua)) os = 'Windows';
  else if (/Mac OS/i.test(ua)) os = 'macOS';
  else if (/Android/i.test(ua)) os = 'Android';
  else if (/iPhone|iPad|iPod/i.test(ua)) os = 'iOS';
  else if (/Linux/i.test(ua)) os = 'Linux';

  return { deviceType, browser, os };
}

/**
 * Best-effort client-side IP fetch via a public API.
 * Returns empty string on failure — never delays the UI.
 */
export async function getClientIP(): Promise<string> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    const res = await fetch('https://api.ipify.org?format=json', { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return '';
    const data = await res.json();
    return typeof data?.ip === 'string' ? data.ip : '';
  } catch {
    return '';
  }
}
