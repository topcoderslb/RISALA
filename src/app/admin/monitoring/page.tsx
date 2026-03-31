'use client';

import { useEffect, useState } from 'react';
import { collection, getDocs, query, where, orderBy, updateDoc, doc, limit, startAfter, DocumentSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/auth-context';
import { logAudit } from '@/lib/audit';
import { AuditLog, LoginSession, UserProfile, AuditAction } from '@/lib/types';
import StatCard from '@/components/StatCard';
import Button from '@/components/Button';
import Modal from '@/components/Modal';
import {
  Shield, Activity, Monitor, Users, Lock, Unlock, Eye,
  Smartphone, Globe, Clock, Filter, RefreshCw, ChevronDown,
  ChevronUp, AlertTriangle, Search, Laptop, Tablet,
} from 'lucide-react';
import toast from 'react-hot-toast';

const ACTION_LABELS: Record<AuditAction, string> = {
  create: 'إنشاء',
  update: 'تعديل',
  delete: 'حذف',
  login: 'تسجيل دخول',
  logout: 'تسجيل خروج',
  block: 'حظر',
  unblock: 'إلغاء حظر',
};

const ACTION_COLORS: Record<AuditAction, string> = {
  create: 'bg-green-100 text-green-800',
  update: 'bg-blue-100 text-blue-800',
  delete: 'bg-red-100 text-red-800',
  login: 'bg-emerald-100 text-emerald-800',
  logout: 'bg-gray-100 text-gray-800',
  block: 'bg-orange-100 text-orange-800',
  unblock: 'bg-teal-100 text-teal-800',
};

const COLLECTION_LABELS: Record<string, string> = {
  operations: 'الحالات',
  medics: 'المسعفين',
  schedules: 'الجداول',
  centerDamageEvents: 'أضرار المراكز',
  vehicleDamageEvents: 'أضرار السيارات',
  injuredMedicEvents: 'المصابين',
  martyrMedicEvents: 'الشهداء',
  centerInfos: 'معلومات المراكز',
  deployments: 'الانتشار',
  auth: 'المصادقة',
  users: 'المستخدمين',
};

type TabType = 'audit' | 'sessions' | 'users';

export default function MonitoringPage() {
  const { profile } = useAuth();

  // ─── State ──────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<TabType>('audit');
  const [loading, setLoading] = useState(true);

  // Audit logs
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditFilter, setAuditFilter] = useState({ action: '', userId: '', collection: '', search: '' });
  const [auditPage, setAuditPage] = useState(1);
  const AUDIT_PER_PAGE = 25;

  // Sessions
  const [sessions, setSessions] = useState<LoginSession[]>([]);
  const [sessionFilter, setSessionFilter] = useState({ activeOnly: false, userId: '' });
  const [expandedSession, setExpandedSession] = useState<string | null>(null);

  // Users
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [blockingUser, setBlockingUser] = useState<string | null>(null);

  // Stats
  const [stats, setStats] = useState({ todayActions: 0, activeSessions: 0, blockedUsers: 0, totalUsers: 0 });

  // ─── Fetch ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (profile?.role === 'superadmin') {
      fetchAll();
    }
  }, [profile]);

  async function fetchAll() {
    setLoading(true);
    await Promise.all([fetchAuditLogs(), fetchSessions(), fetchUsers()]);
    setLoading(false);
  }

  async function fetchAuditLogs() {
    try {
      const snap = await getDocs(query(collection(db, 'auditLogs'), orderBy('timestamp', 'desc')));
      const logs = snap.docs.map(d => ({ id: d.id, ...d.data() })) as AuditLog[];
      setAuditLogs(logs);

      // Count today's actions
      const today = new Date().toISOString().split('T')[0];
      const todayActions = logs.filter(l => l.timestamp.startsWith(today)).length;
      setStats(prev => ({ ...prev, todayActions }));
    } catch (e) {
      console.error('Error fetching audit logs:', e);
    }
  }

  async function fetchSessions() {
    try {
      const snap = await getDocs(query(collection(db, 'loginSessions'), orderBy('loginAt', 'desc')));
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() })) as LoginSession[];
      setSessions(items);

      const activeSessions = items.filter(s => s.isActive).length;
      setStats(prev => ({ ...prev, activeSessions }));
    } catch (e) {
      console.error('Error fetching sessions:', e);
    }
  }

  async function fetchUsers() {
    try {
      const snap = await getDocs(collection(db, 'users'));
      const items = snap.docs.map(d => ({ uid: d.id, ...d.data() })) as UserProfile[];
      setUsers(items);

      const blockedUsers = items.filter(u => u.isBlocked).length;
      setStats(prev => ({ ...prev, blockedUsers, totalUsers: items.length }));
    } catch (e) {
      console.error('Error fetching users:', e);
    }
  }

  // ─── Block / Unblock ───────────────────────────────────────────────────────
  const [blockingDevice, setBlockingDevice] = useState<string | null>(null);

  async function toggleDeviceBlock(session: LoginSession) {
    const newBlocked = !session.isDeviceBlocked;
    const actionAr = newBlocked ? 'حظر' : 'إلغاء حظر';

    if (!confirm(`هل أنت متأكد من ${actionAr} هذا الجهاز (${session.deviceType} - ${session.browser} - ${session.os})؟`)) return;

    setBlockingDevice(session.id);
    try {
      await updateDoc(doc(db, 'loginSessions', session.id), { isDeviceBlocked: newBlocked, isActive: newBlocked ? false : session.isActive });
      logAudit(profile!, newBlocked ? 'block' : 'unblock', 'loginSessions', `${actionAr} جهاز: ${session.userName} (${session.deviceType} ${session.browser})`, session.id);
      toast.success(`تم ${actionAr} الجهاز`);
      await fetchSessions();
    } catch {
      toast.error('حدث خطأ');
    } finally {
      setBlockingDevice(null);
    }
  }

  async function toggleBlock(user: UserProfile) {
    const newBlocked = !user.isBlocked;
    const action = newBlocked ? 'block' : 'unblock';
    const actionAr = newBlocked ? 'حظر' : 'إلغاء حظر';

    if (!confirm(`هل أنت متأكد من ${actionAr} المستخدم "${user.name}"؟`)) return;

    setBlockingUser(user.uid);
    try {
      await updateDoc(doc(db, 'users', user.uid), { isBlocked: newBlocked });

      // If user has a centerId, also update center block status
      if (user.centerId) {
        // Find center doc
        const centersSnap = await getDocs(query(collection(db, 'centers'), where('leaderId', '==', user.uid)));
        for (const centerDoc of centersSnap.docs) {
          await updateDoc(doc(db, 'centers', centerDoc.id), { isBlocked: newBlocked });
        }
      }

      logAudit(profile!, action, 'users', `${actionAr} المستخدم: ${user.name}`, user.uid);
      toast.success(`تم ${actionAr} المستخدم "${user.name}"`);

      // Refresh users
      await fetchUsers();
    } catch {
      toast.error('حدث خطأ');
    } finally {
      setBlockingUser(null);
    }
  }

  // ─── Filtered & paginated audit logs ────────────────────────────────────────
  const filteredLogs = auditLogs.filter(log => {
    if (auditFilter.action && log.action !== auditFilter.action) return false;
    if (auditFilter.userId && log.userId !== auditFilter.userId) return false;
    if (auditFilter.collection && log.collection !== auditFilter.collection) return false;
    if (auditFilter.search) {
      const s = auditFilter.search.toLowerCase();
      if (!log.details.toLowerCase().includes(s) && !log.userName.toLowerCase().includes(s) && !(log.centerName || '').toLowerCase().includes(s)) return false;
    }
    return true;
  });
  const totalAuditPages = Math.ceil(filteredLogs.length / AUDIT_PER_PAGE);
  const paginatedLogs = filteredLogs.slice((auditPage - 1) * AUDIT_PER_PAGE, auditPage * AUDIT_PER_PAGE);

  // Filtered sessions
  const filteredSessions = sessions.filter(s => {
    if (sessionFilter.activeOnly && !s.isActive) return false;
    if (sessionFilter.userId && s.userId !== sessionFilter.userId) return false;
    return true;
  });

  // Unique users for filter dropdowns
  const uniqueAuditUsers = auditLogs.reduce<{ id: string; name: string }[]>((acc, l) => {
    if (!acc.some(u => u.id === l.userId)) acc.push({ id: l.userId, name: l.userName });
    return acc;
  }, []);
  const uniqueCollections = auditLogs.reduce<string[]>((acc, l) => {
    if (!acc.includes(l.collection)) acc.push(l.collection);
    return acc;
  }, []);

  // ─── Helpers ────────────────────────────────────────────────────────────────
  function formatDate(iso: string) {
    if (!iso) return '-';
    const d = new Date(iso);
    return d.toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  function getDeviceIcon(type: string) {
    if (type === 'Mobile') return <Smartphone size={16} className="inline" />;
    if (type === 'Tablet') return <Tablet size={16} className="inline" />;
    return <Laptop size={16} className="inline" />;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-green-100 rounded-lg">
            <Shield size={24} className="text-green-700" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">المراقبة والأمان</h1>
            <p className="text-sm text-gray-500">مراقبة جميع أنشطة المستخدمين وإدارة الحسابات</p>
          </div>
        </div>
        <button
          onClick={() => fetchAll()}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
        >
          <RefreshCw size={16} />
          تحديث
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="إجراءات اليوم" value={stats.todayActions} icon={<Activity size={24} />} color="blue" />
        <StatCard title="جلسات نشطة" value={stats.activeSessions} icon={<Monitor size={24} />} color="green" />
        <StatCard title="حسابات محظورة" value={stats.blockedUsers} icon={<Lock size={24} />} color="red" />
        <StatCard title="إجمالي المستخدمين" value={stats.totalUsers} icon={<Users size={24} />} color="purple" />
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {([
          { key: 'audit' as TabType, label: 'سجل الأنشطة', icon: <Activity size={18} /> },
          { key: 'sessions' as TabType, label: 'الجلسات والأجهزة', icon: <Smartphone size={18} /> },
          { key: 'users' as TabType, label: 'إدارة الحسابات', icon: <Users size={18} /> },
        ]).map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-6 py-3 text-sm font-medium border-b-2 transition ${
              activeTab === tab.key
                ? 'border-green-600 text-green-700 bg-green-50'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* ─── Tab: Audit Logs ──────────────────────────────────────────────── */}
      {activeTab === 'audit' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="bg-white rounded-xl border p-4">
            <div className="flex items-center gap-2 mb-3">
              <Filter size={16} className="text-gray-500" />
              <span className="text-sm font-medium text-gray-700">تصفية</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="relative">
                <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="بحث..."
                  value={auditFilter.search}
                  onChange={e => { setAuditFilter(f => ({ ...f, search: e.target.value })); setAuditPage(1); }}
                  className="w-full pr-9 pl-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
              </div>
              <select
                value={auditFilter.action}
                onChange={e => { setAuditFilter(f => ({ ...f, action: e.target.value })); setAuditPage(1); }}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
              >
                <option value="">كل الإجراءات</option>
                {Object.entries(ACTION_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
              <select
                value={auditFilter.userId}
                onChange={e => { setAuditFilter(f => ({ ...f, userId: e.target.value })); setAuditPage(1); }}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
              >
                <option value="">كل المستخدمين</option>
                {uniqueAuditUsers.map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
              <select
                value={auditFilter.collection}
                onChange={e => { setAuditFilter(f => ({ ...f, collection: e.target.value })); setAuditPage(1); }}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
              >
                <option value="">كل الأقسام</option>
                {uniqueCollections.map(c => (
                  <option key={c} value={c}>{COLLECTION_LABELS[c] || c}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Log Table */}
          <div className="bg-white rounded-xl border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="px-4 py-3 text-right font-medium">التوقيت</th>
                    <th className="px-4 py-3 text-right font-medium">المستخدم</th>
                    <th className="px-4 py-3 text-right font-medium">المركز</th>
                    <th className="px-4 py-3 text-right font-medium">الإجراء</th>
                    <th className="px-4 py-3 text-right font-medium">القسم</th>
                    <th className="px-4 py-3 text-right font-medium">التفاصيل</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paginatedLogs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-gray-400">لا توجد سجلات</td>
                    </tr>
                  ) : (
                    paginatedLogs.map(log => (
                      <tr key={log.id} className="hover:bg-gray-50 transition">
                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">{formatDate(log.timestamp)}</td>
                        <td className="px-4 py-3 font-medium text-gray-800">{log.userName}</td>
                        <td className="px-4 py-3 text-gray-600">{log.centerName || '-'}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${ACTION_COLORS[log.action]}`}>
                            {ACTION_LABELS[log.action]}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-600">{COLLECTION_LABELS[log.collection] || log.collection}</td>
                        <td className="px-4 py-3 text-gray-600 max-w-[200px] truncate">{log.details}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalAuditPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50">
                <span className="text-sm text-gray-500">
                  صفحة {auditPage} من {totalAuditPages} ({filteredLogs.length} سجل)
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setAuditPage(p => Math.max(1, p - 1))}
                    disabled={auditPage === 1}
                    className="px-3 py-1 text-sm border rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    السابق
                  </button>
                  <button
                    onClick={() => setAuditPage(p => Math.min(totalAuditPages, p + 1))}
                    disabled={auditPage === totalAuditPages}
                    className="px-3 py-1 text-sm border rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    التالي
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Tab: Sessions ────────────────────────────────────────────────── */}
      {activeTab === 'sessions' && (
        <div className="space-y-4">
          {/* Filter */}
          <div className="bg-white rounded-xl border p-4">
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={sessionFilter.activeOnly}
                  onChange={e => setSessionFilter(f => ({ ...f, activeOnly: e.target.checked }))}
                  className="rounded text-green-600 focus:ring-green-500"
                />
                الجلسات النشطة فقط
              </label>
              <select
                value={sessionFilter.userId}
                onChange={e => setSessionFilter(f => ({ ...f, userId: e.target.value }))}
                className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
              >
                <option value="">كل المستخدمين</option>
                {sessions.reduce<{ id: string; name: string }[]>((acc, s) => {
                  if (!acc.some(u => u.id === s.userId)) acc.push({ id: s.userId, name: s.userName });
                  return acc;
                }, []).map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Sessions list */}
          <div className="grid gap-3">
            {filteredSessions.length === 0 ? (
              <div className="bg-white rounded-xl border p-8 text-center text-gray-400">
                لا توجد جلسات
              </div>
            ) : (
              filteredSessions.map(session => (
                <div
                  key={session.id}
                  className={`bg-white rounded-xl border transition ${session.isActive ? 'border-green-200 shadow-sm' : ''}`}
                >
                  <div
                    className="flex items-center justify-between p-4 cursor-pointer"
                    onClick={() => setExpandedSession(expandedSession === session.id ? null : session.id)}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${session.isDeviceBlocked ? 'bg-red-500' : session.isActive ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`} />
                      <div>
                        <span className="font-medium text-gray-800">{session.userName}</span>
                        {session.centerName && (
                          <span className="text-xs text-gray-500 mr-2">({session.centerName})</span>
                        )}
                        {session.isDeviceBlocked && (
                          <span className="inline-flex items-center gap-1 mr-2 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            <Lock size={10} />
                            جهاز محظور
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        {getDeviceIcon(session.deviceType)}
                        <span>{session.deviceType}</span>
                      </div>
                      <div className="text-xs text-gray-400">{formatDate(session.loginAt)}</div>
                      {expandedSession === session.id ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                    </div>
                  </div>

                  {expandedSession === session.id && (
                    <div className="px-4 pb-4 border-t pt-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-gray-500 block mb-1">عنوان IP</span>
                          <div className="flex items-center gap-2">
                            <Globe size={14} className="text-gray-400" />
                            <span className="font-mono text-gray-800">{session.ip || 'غير معروف'}</span>
                          </div>
                        </div>
                        <div>
                          <span className="text-gray-500 block mb-1">المتصفح</span>
                          <span className="text-gray-800">{session.browser}</span>
                        </div>
                        <div>
                          <span className="text-gray-500 block mb-1">نظام التشغيل</span>
                          <span className="text-gray-800">{session.os}</span>
                        </div>
                        <div>
                          <span className="text-gray-500 block mb-1">آخر نشاط</span>
                          <div className="flex items-center gap-2">
                            <Clock size={14} className="text-gray-400" />
                            <span className="text-gray-800">{formatDate(session.lastActiveAt)}</span>
                          </div>
                        </div>
                      </div>
                      {session.userAgent && (
                        <div className="mt-3 p-2 bg-gray-50 rounded-lg">
                          <span className="text-xs text-gray-500 block mb-1">User Agent</span>
                          <span className="text-xs text-gray-600 font-mono break-all">{session.userAgent}</span>
                        </div>
                      )}
                      <div className="mt-3 flex justify-end">
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleDeviceBlock(session); }}
                          disabled={blockingDevice === session.id}
                          className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition ${
                            session.isDeviceBlocked
                              ? 'bg-green-600 text-white hover:bg-green-700'
                              : 'bg-red-600 text-white hover:bg-red-700'
                          } disabled:opacity-50`}
                        >
                          {blockingDevice === session.id ? (
                            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white" />
                          ) : session.isDeviceBlocked ? (
                            <><Unlock size={14} /> إلغاء حظر الجهاز</>
                          ) : (
                            <><Lock size={14} /> حظر هذا الجهاز</>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ─── Tab: Users ───────────────────────────────────────────────────── */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="px-4 py-3 text-right font-medium">الاسم</th>
                    <th className="px-4 py-3 text-right font-medium">البريد الإلكتروني</th>
                    <th className="px-4 py-3 text-right font-medium">الدور</th>
                    <th className="px-4 py-3 text-right font-medium">المركز</th>
                    <th className="px-4 py-3 text-right font-medium">الحالة</th>
                    <th className="px-4 py-3 text-right font-medium">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {users
                    .filter(u => u.role !== 'superadmin')
                    .map(user => (
                      <tr key={user.uid} className="hover:bg-gray-50 transition">
                        <td className="px-4 py-3 font-medium text-gray-800">{user.name}</td>
                        <td className="px-4 py-3 text-gray-600 font-mono text-xs">{user.email}</td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {user.role === 'center_leader' ? 'قائد مركز' : 'مدرب'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-600">{user.centerName || '-'}</td>
                        <td className="px-4 py-3">
                          {user.isBlocked ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                              <Lock size={12} />
                              محظور
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              <Unlock size={12} />
                              نشط
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => toggleBlock(user)}
                            disabled={blockingUser === user.uid}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                              user.isBlocked
                                ? 'bg-green-600 text-white hover:bg-green-700'
                                : 'bg-red-600 text-white hover:bg-red-700'
                            } disabled:opacity-50`}
                          >
                            {blockingUser === user.uid ? (
                              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white" />
                            ) : user.isBlocked ? (
                              <>
                                <Unlock size={14} />
                                إلغاء الحظر
                              </>
                            ) : (
                              <>
                                <Lock size={14} />
                                حظر
                              </>
                            )}
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
