'use client';

import { useEffect, useState } from 'react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/auth-context';
import { CenterInfo, Deployment } from '@/lib/types';
import { logAudit } from '@/lib/audit';
import Button from '@/components/Button';
import Modal from '@/components/Modal';
import { Building2, Phone, Truck, Flame, Shield, Save, Edit2, FileDown, MapPin, Plus, Users, ChevronDown, ChevronUp, Trash2, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import { exportCenterInfoToPDF, exportDeploymentsToPDF } from '@/lib/pdf-utils';

export default function CenterInfoPage() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [existingId, setExistingId] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);

  const [form, setForm] = useState({
    townName: '',
    squadLeaderName: '',
    squadLeaderPhone: '',
    ambulanceCount: 1,
    ambulanceNumbers: [''],
    hasFireDepartment: false,
    fireManagerName: '',
    fireManagerPhone: '',
    fireVehicleCount: 1,
    fireVehicleNumbers: [''],
    hasRescueDepartment: false,
    rescueManagerName: '',
    rescueManagerPhone: '',
    rescueVehicleCount: 1,
    rescueVehicleNumbers: [''],
  });

  // Deployment state
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [showDeployModal, setShowDeployModal] = useState(false);
  const [deployExpanded, setDeployExpanded] = useState<string | null>(null);
  const [deployForm, setDeployForm] = useState({
    teamMembers: [''],
    location: '',
    date: '',
    vehicleInfo: '',
    notes: '',
  });

  useEffect(() => {
    if (!profile?.centerId) return;
    fetchInfo();
    fetchDeployments();
  }, [profile]);

  async function fetchDeployments() {
    try {
      const snap = await getDocs(query(collection(db, 'deployments'), where('centerId', '==', profile!.centerId)));
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() })) as Deployment[];
      items.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      setDeployments(items);
    } catch (error) { console.error(error); }
  }

  const saveDeployment = async () => {
    if (!deployForm.location.trim()) { toast.error('الموقع مطلوب'); return; }
    if (!deployForm.date) { toast.error('التاريخ مطلوب'); return; }
    const members = deployForm.teamMembers.map(m => m.trim()).filter(Boolean);
    if (members.length === 0) { toast.error('أضف عنصراً واحداً على الأقل'); return; }
    setSaving(true);
    try {
      const now = new Date().toISOString();
      await addDoc(collection(db, 'deployments'), {
        centerId: profile!.centerId,
        centerName: profile!.centerName || '',
        teamMembers: members,
        location: deployForm.location.trim(),
        date: deployForm.date,
        vehicleInfo: deployForm.vehicleInfo.trim(),
        notes: deployForm.notes.trim(),
        createdAt: now,
        createdBy: profile!.uid,
      });
      toast.success('تم حفظ سجل الانتشار');
      logAudit(profile!, 'create', 'deployments', 'إضافة سجل انتشار');
      setShowDeployModal(false);
      setDeployForm({ teamMembers: [''], location: '', date: '', vehicleInfo: '', notes: '' });
      fetchDeployments();
    } catch { toast.error('حدث خطأ'); } finally { setSaving(false); }
  };

  const deleteDeployment = async (id: string) => {
    if (!confirm('هل تريد حذف سجل الانتشار؟')) return;
    try {
      await deleteDoc(doc(db, 'deployments', id));
      toast.success('تم الحذف');
      logAudit(profile!, 'delete', 'deployments', 'حذف سجل انتشار', id);
      fetchDeployments();
    } catch { toast.error('حدث خطأ أثناء الحذف'); }
  };

  async function fetchInfo() {
    try {
      const snap = await getDocs(query(collection(db, 'centerInfos'), where('centerId', '==', profile!.centerId)));
      if (!snap.empty) {
        const data = snap.docs[0].data() as Omit<CenterInfo, 'id'>;
        setExistingId(snap.docs[0].id);
        setForm({
          townName: data.townName || '',
          squadLeaderName: data.squadLeaderName || '',
          squadLeaderPhone: data.squadLeaderPhone || '',
          ambulanceCount: data.ambulanceCount || 1,
          ambulanceNumbers: data.ambulanceNumbers?.length ? data.ambulanceNumbers : [''],
          hasFireDepartment: data.hasFireDepartment || false,
          fireManagerName: data.fireManagerName || '',
          fireManagerPhone: data.fireManagerPhone || '',
          fireVehicleCount: data.fireVehicleCount || 1,
          fireVehicleNumbers: data.fireVehicleNumbers?.length ? data.fireVehicleNumbers : [''],
          hasRescueDepartment: data.hasRescueDepartment || false,
          rescueManagerName: data.rescueManagerName || '',
          rescueManagerPhone: data.rescueManagerPhone || '',
          rescueVehicleCount: data.rescueVehicleCount || 1,
          rescueVehicleNumbers: data.rescueVehicleNumbers?.length ? data.rescueVehicleNumbers : [''],
        });
        setEditMode(false);
      } else {
        setEditMode(true);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  const handleAmbulanceCountChange = (count: number) => {
    const c = Math.max(0, count);
    setForm(prev => {
      const nums = [...prev.ambulanceNumbers];
      while (nums.length < c) nums.push('');
      return { ...prev, ambulanceCount: c, ambulanceNumbers: nums.slice(0, c) };
    });
  };

  const handleFireVehicleCountChange = (count: number) => {
    const c = Math.max(0, count);
    setForm(prev => {
      const nums = [...prev.fireVehicleNumbers];
      while (nums.length < c) nums.push('');
      return { ...prev, fireVehicleCount: c, fireVehicleNumbers: nums.slice(0, c) };
    });
  };

  const handleRescueVehicleCountChange = (count: number) => {
    const c = Math.max(0, count);
    setForm(prev => {
      const nums = [...prev.rescueVehicleNumbers];
      while (nums.length < c) nums.push('');
      return { ...prev, rescueVehicleCount: c, rescueVehicleNumbers: nums.slice(0, c) };
    });
  };

  const handleSave = async () => {
    if (!form.townName.trim()) { toast.error('اسم البلدة مطلوب'); return; }
    if (!form.squadLeaderName.trim()) { toast.error('اسم قائد الفرقة مطلوب'); return; }
    if (!form.squadLeaderPhone.trim()) { toast.error('رقم هاتف قائد الفرقة مطلوب'); return; }

    setSaving(true);
    try {
      const now = new Date().toISOString();
      const payload = {
        centerId: profile!.centerId,
        centerName: profile!.centerName || '',
        townName: form.townName.trim(),
        squadLeaderName: form.squadLeaderName.trim(),
        squadLeaderPhone: form.squadLeaderPhone.trim(),
        ambulanceCount: form.ambulanceCount,
        ambulanceNumbers: form.ambulanceNumbers.map(n => n.trim()).filter(Boolean),
        hasFireDepartment: form.hasFireDepartment,
        fireManagerName: form.hasFireDepartment ? form.fireManagerName.trim() : '',
        fireManagerPhone: form.hasFireDepartment ? form.fireManagerPhone.trim() : '',
        fireVehicleCount: form.hasFireDepartment ? form.fireVehicleCount : 0,
        fireVehicleNumbers: form.hasFireDepartment ? form.fireVehicleNumbers.map(n => n.trim()).filter(Boolean) : [],
        hasRescueDepartment: form.hasRescueDepartment,
        rescueManagerName: form.hasRescueDepartment ? form.rescueManagerName.trim() : '',
        rescueManagerPhone: form.hasRescueDepartment ? form.rescueManagerPhone.trim() : '',
        rescueVehicleCount: form.hasRescueDepartment ? form.rescueVehicleCount : 0,
        rescueVehicleNumbers: form.hasRescueDepartment ? form.rescueVehicleNumbers.map(n => n.trim()).filter(Boolean) : [],
        updatedAt: now,
        createdBy: profile!.uid,
      };

      if (existingId) {
        await updateDoc(doc(db, 'centerInfos', existingId), payload);
        toast.success('تم تحديث معلومات المركز');
        logAudit(profile!, 'update', 'centerInfos', 'تحديث معلومات المركز', existingId);
      } else {
        await addDoc(collection(db, 'centerInfos'), { ...payload, createdAt: now });
        toast.success('تم حفظ معلومات المركز');
        logAudit(profile!, 'create', 'centerInfos', 'إضافة معلومات المركز');
      }
      setEditMode(false);
      fetchInfo();
    } catch {
      toast.error('حدث خطأ أثناء الحفظ');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full" /></div>;
  }

  const isReadOnly = existingId && !editMode;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">معلومات المركز</h1>
          <p className="text-slate-500 mt-1">{profile?.centerName || 'المركز'}</p>
        </div>
        {isReadOnly && (
          <div className="flex items-center gap-2">
            <Button onClick={() => {
              const info: CenterInfo = { id: existingId || '', centerId: profile!.centerId!, centerName: profile!.centerName || '', ...form, ambulanceNumbers: form.ambulanceNumbers.filter(Boolean), fireVehicleNumbers: form.fireVehicleNumbers.filter(Boolean), rescueVehicleNumbers: form.rescueVehicleNumbers.filter(Boolean), createdAt: '', updatedAt: '', createdBy: '' };
              exportCenterInfoToPDF(info);
            }} icon={<FileDown size={18} />} variant="secondary">تصدير PDF</Button>
            <Button onClick={() => setEditMode(true)} icon={<Edit2 size={18} />}>تعديل</Button>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-8">
        {/* ─── Basic Info ─────────────────────────────────────────────────── */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-primary-100 rounded-lg flex items-center justify-center"><Building2 size={18} className="text-primary-700" /></div>
            <h2 className="text-lg font-bold text-slate-800">معلومات عامة</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">اسم البلدة <span className="text-red-500">*</span></label>
              {isReadOnly ? (
                <p className="px-4 py-2.5 bg-slate-50 rounded-xl text-slate-800">{form.townName || '—'}</p>
              ) : (
                <input type="text" value={form.townName} onChange={e => setForm(prev => ({ ...prev, townName: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm" placeholder="اسم البلدة" />
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">اسم المركز</label>
              <p className="px-4 py-2.5 bg-slate-50 rounded-xl text-slate-800">{profile?.centerName || '—'}</p>
            </div>
          </div>
        </div>

        {/* ─── Squad Leader ───────────────────────────────────────────────── */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center"><Phone size={18} className="text-blue-700" /></div>
            <h2 className="text-lg font-bold text-slate-800">قائد الفرقة</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">اسم قائد الفرقة <span className="text-red-500">*</span></label>
              {isReadOnly ? (
                <p className="px-4 py-2.5 bg-slate-50 rounded-xl text-slate-800">{form.squadLeaderName || '—'}</p>
              ) : (
                <input type="text" value={form.squadLeaderName} onChange={e => setForm(prev => ({ ...prev, squadLeaderName: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm" placeholder="الاسم الكامل" />
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">رقم هاتف قائد الفرقة <span className="text-red-500">*</span></label>
              {isReadOnly ? (
                <p className="px-4 py-2.5 bg-slate-50 rounded-xl text-slate-800 dir-ltr">{form.squadLeaderPhone || '—'}</p>
              ) : (
                <input type="tel" value={form.squadLeaderPhone} onChange={e => setForm(prev => ({ ...prev, squadLeaderPhone: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm" placeholder="رقم الهاتف" />
              )}
            </div>
          </div>
        </div>

        {/* ─── Ambulances (الإسعاف) ───────────────────────────────────────── */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center"><Truck size={18} className="text-emerald-700" /></div>
            <h2 className="text-lg font-bold text-slate-800">آليات الإسعاف</h2>
          </div>
          <p className="text-xs text-slate-400 mb-3">اكتب اسم الآلية وموديلها ورقمها (مثال: تويوتا هايلكس 2020 - رقم 123)</p>
          <div className="space-y-4">
            <div className="max-w-xs">
              <label className="block text-sm font-medium text-slate-600 mb-1">عدد آليات الإسعاف</label>
              {isReadOnly ? (
                <p className="px-4 py-2.5 bg-slate-50 rounded-xl text-slate-800">{form.ambulanceCount}</p>
              ) : (
                <input type="number" min="0" value={form.ambulanceCount} onChange={e => handleAmbulanceCountChange(parseInt(e.target.value) || 0)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm" />
              )}
            </div>
            {form.ambulanceCount > 0 && (
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-2">أرقام آليات الإسعاف</label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {form.ambulanceNumbers.map((num, i) => (
                    <div key={i}>
                      {isReadOnly ? (
                        <p className="px-4 py-2.5 bg-slate-50 rounded-xl text-slate-800 text-sm">{num || '—'}</p>
                      ) : (
                        <input type="text" value={num} onChange={e => {
                          const updated = [...form.ambulanceNumbers];
                          updated[i] = e.target.value;
                          setForm(prev => ({ ...prev, ambulanceNumbers: updated }));
                        }}
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                          placeholder={`اسم الآلية وموديلها ورقمها - آلية ${i + 1}`} />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ─── Fire Department (الإطفاء) ────────────────────────────────────────── */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center"><Flame size={18} className="text-red-700" /></div>
            <h2 className="text-lg font-bold text-slate-800">قسم الإطفاء</h2>
          </div>
          <p className="text-xs text-slate-400 mb-3">اكتب اسم الآلية وموديلها ورقمها (مثال: إطفاء مان 2019 - رقم 456)</p>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-slate-600">هل يوجد آلية إطفاء؟</label>
              {isReadOnly ? (
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${form.hasFireDepartment ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {form.hasFireDepartment ? 'نعم' : 'لا'}
                </span>
              ) : (
                <div className="flex gap-3">
                  <button onClick={() => setForm(prev => ({ ...prev, hasFireDepartment: true }))}
                    className={`px-4 py-1.5 rounded-xl text-sm font-medium transition-all ${form.hasFireDepartment ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>نعم</button>
                  <button onClick={() => setForm(prev => ({ ...prev, hasFireDepartment: false }))}
                    className={`px-4 py-1.5 rounded-xl text-sm font-medium transition-all ${!form.hasFireDepartment ? 'bg-red-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>لا</button>
                </div>
              )}
            </div>

            {form.hasFireDepartment && (
              <div className="bg-red-50/50 rounded-xl p-4 space-y-4 border border-red-100">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1">اسم مسؤول الإطفاء</label>
                    {isReadOnly ? (
                      <p className="px-4 py-2.5 bg-white rounded-xl text-slate-800">{form.fireManagerName || '—'}</p>
                    ) : (
                      <input type="text" value={form.fireManagerName} onChange={e => setForm(prev => ({ ...prev, fireManagerName: e.target.value }))}
                        className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm" placeholder="الاسم" />
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1">رقم هاتف مسؤول الإطفاء</label>
                    {isReadOnly ? (
                      <p className="px-4 py-2.5 bg-white rounded-xl text-slate-800">{form.fireManagerPhone || '—'}</p>
                    ) : (
                      <input type="tel" value={form.fireManagerPhone} onChange={e => setForm(prev => ({ ...prev, fireManagerPhone: e.target.value }))}
                        className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm" placeholder="رقم الهاتف" />
                    )}
                  </div>
                </div>
                <div className="max-w-xs">
                  <label className="block text-sm font-medium text-slate-600 mb-1">عدد آليات الإطفاء</label>
                  {isReadOnly ? (
                    <p className="px-4 py-2.5 bg-white rounded-xl text-slate-800">{form.fireVehicleCount}</p>
                  ) : (
                    <input type="number" min="0" value={form.fireVehicleCount} onChange={e => handleFireVehicleCountChange(parseInt(e.target.value) || 0)}
                      className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm" />
                  )}
                </div>
                {form.fireVehicleCount > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-2">أرقام آليات الإطفاء</label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {form.fireVehicleNumbers.map((num, i) => (
                        <div key={i}>
                          {isReadOnly ? (
                            <p className="px-4 py-2.5 bg-white rounded-xl text-slate-800 text-sm">{num || '—'}</p>
                          ) : (
                            <input type="text" value={num} onChange={e => {
                              const updated = [...form.fireVehicleNumbers];
                              updated[i] = e.target.value;
                              setForm(prev => ({ ...prev, fireVehicleNumbers: updated }));
                            }}
                              className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                              placeholder={`اسم الآلية وموديلها ورقمها - آلية ${i + 1}`} />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ─── Rescue Department (الإنقاذ) ──────────────────────────────────── */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center"><Shield size={18} className="text-amber-700" /></div>
            <h2 className="text-lg font-bold text-slate-800">قسم الإنقاذ</h2>
          </div>
          <p className="text-xs text-slate-400 mb-3">اكتب اسم الآلية وموديلها ورقمها (مثال: إنقاذ ياماها 2021 - رقم 789)</p>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-slate-600">هل يوجد آليات إنقاذ؟</label>
              {isReadOnly ? (
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${form.hasRescueDepartment ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {form.hasRescueDepartment ? 'نعم' : 'لا'}
                </span>
              ) : (
                <div className="flex gap-3">
                  <button onClick={() => setForm(prev => ({ ...prev, hasRescueDepartment: true }))}
                    className={`px-4 py-1.5 rounded-xl text-sm font-medium transition-all ${form.hasRescueDepartment ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>نعم</button>
                  <button onClick={() => setForm(prev => ({ ...prev, hasRescueDepartment: false }))}
                    className={`px-4 py-1.5 rounded-xl text-sm font-medium transition-all ${!form.hasRescueDepartment ? 'bg-red-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>لا</button>
                </div>
              )}
            </div>

            {form.hasRescueDepartment && (
              <div className="bg-amber-50/50 rounded-xl p-4 space-y-4 border border-amber-100">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1">اسم مسؤول الإنقاذ</label>
                    {isReadOnly ? (
                      <p className="px-4 py-2.5 bg-white rounded-xl text-slate-800">{form.rescueManagerName || '—'}</p>
                    ) : (
                      <input type="text" value={form.rescueManagerName} onChange={e => setForm(prev => ({ ...prev, rescueManagerName: e.target.value }))}
                        className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm" placeholder="الاسم" />
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1">رقم هاتف مسؤول الإنقاذ</label>
                    {isReadOnly ? (
                      <p className="px-4 py-2.5 bg-white rounded-xl text-slate-800">{form.rescueManagerPhone || '—'}</p>
                    ) : (
                      <input type="tel" value={form.rescueManagerPhone} onChange={e => setForm(prev => ({ ...prev, rescueManagerPhone: e.target.value }))}
                        className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm" placeholder="رقم الهاتف" />
                    )}
                  </div>
                </div>
                <div className="max-w-xs">
                  <label className="block text-sm font-medium text-slate-600 mb-1">عدد آليات الإنقاذ</label>
                  {isReadOnly ? (
                    <p className="px-4 py-2.5 bg-white rounded-xl text-slate-800">{form.rescueVehicleCount}</p>
                  ) : (
                    <input type="number" min="0" value={form.rescueVehicleCount} onChange={e => handleRescueVehicleCountChange(parseInt(e.target.value) || 0)}
                      className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm" />
                  )}
                </div>
                {form.rescueVehicleCount > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-2">أرقام آليات الإنقاذ</label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {form.rescueVehicleNumbers.map((num, i) => (
                        <div key={i}>
                          {isReadOnly ? (
                            <p className="px-4 py-2.5 bg-white rounded-xl text-slate-800 text-sm">{num || '—'}</p>
                          ) : (
                            <input type="text" value={num} onChange={e => {
                              const updated = [...form.rescueVehicleNumbers];
                              updated[i] = e.target.value;
                              setForm(prev => ({ ...prev, rescueVehicleNumbers: updated }));
                            }}
                              className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                              placeholder={`اسم الآلية وموديلها ورقمها - آلية ${i + 1}`} />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ─── Save / Cancel ──────────────────────────────────────────────── */}
        {!isReadOnly && (
          <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
            <Button onClick={handleSave} loading={saving} icon={<Save size={18} />}>
              {existingId ? 'تحديث المعلومات' : 'حفظ المعلومات'}
            </Button>
            {existingId && editMode && (
              <button onClick={() => { setEditMode(false); fetchInfo(); }}
                className="px-6 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors">إلغاء</button>
            )}
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/*  الانتشار (Deployment)                                            */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <div className="bg-white/80 backdrop-blur rounded-2xl shadow-sm border border-slate-100 p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center"><MapPin size={18} className="text-indigo-700" /></div>
            <h2 className="text-lg font-bold text-slate-800">الانتشار</h2>
            {deployments.length > 0 && (
              <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full text-xs font-bold">{deployments.length}</span>
            )}
          </div>
          <div className="flex gap-2">
            {deployments.length > 0 && (
              <Button variant="ghost" size="sm" icon={<FileDown size={16} />}
                onClick={() => exportDeploymentsToPDF(deployments, profile?.centerName)}>
                تصدير PDF
              </Button>
            )}
            <Button variant="primary" size="sm" icon={<Plus size={16} />}
              onClick={() => { setDeployForm({ teamMembers: [''], location: '', date: '', vehicleInfo: '', notes: '' }); setShowDeployModal(true); }}>
              إضافة انتشار
            </Button>
          </div>
        </div>

        {deployments.length === 0 ? (
          <p className="text-center text-slate-400 py-8">لا يوجد بيانات انتشار بعد</p>
        ) : (
          <div className="space-y-4">
            {deployments.map(dep => (
              <div key={dep.id} className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Clock size={14} className="text-slate-400" />
                    <span className="text-sm text-slate-500">{dep.date}</span>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => exportDeploymentsToPDF([dep], profile?.centerName)} className="p-1.5 hover:bg-emerald-100 rounded-lg transition-colors" title="تصدير PDF">
                      <FileDown size={16} className="text-emerald-600" />
                    </button>
                    <button onClick={() => deleteDeployment(dep.id)} className="p-1.5 hover:bg-red-100 rounded-lg transition-colors" title="حذف">
                      <Trash2 size={16} className="text-red-500" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-slate-500">الموقع:</span>
                    <span className="font-medium text-slate-800 mr-2">{dep.location}</span>
                  </div>
                  {dep.vehicleInfo && (
                    <div>
                      <span className="text-slate-500">الآلية:</span>
                      <span className="font-medium text-slate-800 mr-2">{dep.vehicleInfo}</span>
                    </div>
                  )}
                </div>

                <div className="mt-3">
                  <div className="flex items-center gap-1 mb-2">
                    <Users size={14} className="text-slate-400" />
                    <span className="text-sm text-slate-500">أعضاء الفريق:</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {dep.teamMembers.map((m: string, i: number) => (
                      <span key={i} className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-medium">{m}</span>
                    ))}
                  </div>
                </div>

                {dep.notes && (
                  <p className="mt-3 text-sm text-slate-500 bg-white p-3 rounded-lg">{dep.notes}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─── Deployment Modal ─────────────────────────────────────────── */}
      <Modal isOpen={showDeployModal} onClose={() => setShowDeployModal(false)} title="إضافة انتشار جديد">
        <div className="space-y-4">
          {/* Team Members */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">أعضاء الفريق</label>
            {deployForm.teamMembers.map((member: string, i: number) => (
              <div key={i} className="flex gap-2 mb-2">
                <input type="text" value={member} onChange={e => {
                  const updated = [...deployForm.teamMembers];
                  updated[i] = e.target.value;
                  setDeployForm(prev => ({ ...prev, teamMembers: updated }));
                }}
                  className="flex-1 px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                  placeholder={`عضو ${i + 1}`} />
                {deployForm.teamMembers.length > 1 && (
                  <button onClick={() => {
                    const updated = deployForm.teamMembers.filter((_: string, idx: number) => idx !== i);
                    setDeployForm(prev => ({ ...prev, teamMembers: updated }));
                  }} className="p-2 text-red-500 hover:bg-red-50 rounded-xl"><Trash2 size={16} /></button>
                )}
              </div>
            ))}
            <button onClick={() => setDeployForm(prev => ({ ...prev, teamMembers: [...prev.teamMembers, ''] }))}
              className="text-sm text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1 mt-1">
              <Plus size={14} /> إضافة عضو
            </button>
          </div>

          {/* Location */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">موقع الانتشار</label>
            <input type="text" value={deployForm.location} onChange={e => setDeployForm(prev => ({ ...prev, location: e.target.value }))}
              className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
              placeholder="مثال: شارع الحمرا - بيروت" />
          </div>

          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">تاريخ الانتشار</label>
            <input type="date" value={deployForm.date} onChange={e => setDeployForm(prev => ({ ...prev, date: e.target.value }))}
              className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm" />
          </div>

          {/* Vehicle Info */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">معلومات الآلية</label>
            <input type="text" value={deployForm.vehicleInfo} onChange={e => setDeployForm(prev => ({ ...prev, vehicleInfo: e.target.value }))}
              className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
              placeholder="اكتب اسم السيارة وموديلها ورقمها" />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">ملاحظات</label>
            <textarea value={deployForm.notes} onChange={e => setDeployForm(prev => ({ ...prev, notes: e.target.value }))}
              className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
              rows={3} placeholder="ملاحظات إضافية (اختياري)" />
          </div>

          <div className="flex gap-3 pt-2">
            <Button onClick={saveDeployment} loading={saving} icon={<Save size={16} />}>حفظ الانتشار</Button>
            <button onClick={() => setShowDeployModal(false)} className="px-6 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors">إلغاء</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
