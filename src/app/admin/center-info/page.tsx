'use client';

import { useEffect, useState } from 'react';
import { collection, getDocs, addDoc, updateDoc, doc, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { cachedGetDocs, invalidateCachePrefix } from '@/lib/firebase-cache';
import { useAuth } from '@/lib/auth-context';
import { CenterInfo, Center, Deployment } from '@/lib/types';
import Button from '@/components/Button';
import Modal from '@/components/Modal';
import { Building2, Phone, Truck, Flame, Shield, Save, Plus, Edit2, Eye, Info, ChevronDown, ChevronUp, FileDown, MapPin, Users, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import { exportCenterInfoToPDF, exportDeploymentsToPDF } from '@/lib/pdf-utils';

export default function AdminCenterInfoPage() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [centerInfos, setCenterInfos] = useState<CenterInfo[]>([]);
  const [centers, setCenters] = useState<Center[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterCenter, setFilterCenter] = useState('');
  const [allDeployments, setAllDeployments] = useState<Deployment[]>([]);

  // Create / Edit modal
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedCenterId, setSelectedCenterId] = useState('');

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

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    invalidateCachePrefix('centerInfos');
    invalidateCachePrefix('deployments');
    try {
      const [infoSnap, centersSnap, deploySnap] = await Promise.all([
        cachedGetDocs(collection(db, 'centerInfos'), 'centerInfos'),
        cachedGetDocs(collection(db, 'centers'), 'centers'),
        cachedGetDocs(collection(db, 'deployments'), 'deployments'),
      ]);
      setCenterInfos(infoSnap.docs.map(d => ({ id: d.id, ...d.data() })) as CenterInfo[]);
      setCenters(centersSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Center[]);
      const deps = deploySnap.docs.map(d => ({ id: d.id, ...d.data() })) as Deployment[];
      deps.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      setAllDeployments(deps);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  const resetForm = () => {
    setForm({
      townName: '', squadLeaderName: '', squadLeaderPhone: '',
      ambulanceCount: 1, ambulanceNumbers: [''],
      hasFireDepartment: false, fireManagerName: '', fireManagerPhone: '', fireVehicleCount: 1, fireVehicleNumbers: [''],
      hasRescueDepartment: false, rescueManagerName: '', rescueManagerPhone: '', rescueVehicleCount: 1, rescueVehicleNumbers: [''],
    });
    setSelectedCenterId('');
    setEditingId(null);
  };

  const openCreate = () => {
    resetForm();
    setShowModal(true);
  };

  const openEdit = (info: CenterInfo) => {
    setEditingId(info.id);
    setSelectedCenterId(info.centerId);
    setForm({
      townName: info.townName || '',
      squadLeaderName: info.squadLeaderName || '',
      squadLeaderPhone: info.squadLeaderPhone || '',
      ambulanceCount: info.ambulanceCount || 1,
      ambulanceNumbers: info.ambulanceNumbers?.length ? info.ambulanceNumbers : [''],
      hasFireDepartment: info.hasFireDepartment || false,
      fireManagerName: info.fireManagerName || '',
      fireManagerPhone: info.fireManagerPhone || '',
      fireVehicleCount: info.fireVehicleCount || 1,
      fireVehicleNumbers: info.fireVehicleNumbers?.length ? info.fireVehicleNumbers : [''],
      hasRescueDepartment: info.hasRescueDepartment || false,
      rescueManagerName: info.rescueManagerName || '',
      rescueManagerPhone: info.rescueManagerPhone || '',
      rescueVehicleCount: info.rescueVehicleCount || 1,
      rescueVehicleNumbers: info.rescueVehicleNumbers?.length ? info.rescueVehicleNumbers : [''],
    });
    setShowModal(true);
  };

  // Centers that don't have an info record yet
  const centersWithoutInfo = centers.filter(c => !centerInfos.find(ci => ci.centerId === c.id));

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
    if (!editingId && !selectedCenterId) { toast.error('اختر المركز أولاً'); return; }
    if (!form.townName.trim()) { toast.error('اسم البلدة مطلوب'); return; }
    if (!form.squadLeaderName.trim()) { toast.error('اسم قائد الفرقة مطلوب'); return; }
    if (!form.squadLeaderPhone.trim()) { toast.error('رقم هاتف قائد الفرقة مطلوب'); return; }

    // Check if this center already has info (for new records)
    if (!editingId) {
      const existing = centerInfos.find(ci => ci.centerId === selectedCenterId);
      if (existing) { toast.error('هذا المركز لديه معلومات بالفعل. يمكنك تعديلها.'); return; }
    }

    setSaving(true);
    try {
      const now = new Date().toISOString();
      const center = centers.find(c => c.id === (editingId ? centerInfos.find(ci => ci.id === editingId)?.centerId : selectedCenterId));
      const payload = {
        centerId: editingId ? centerInfos.find(ci => ci.id === editingId)!.centerId : selectedCenterId,
        centerName: center?.name || '',
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

      if (editingId) {
        await updateDoc(doc(db, 'centerInfos', editingId), payload);
        toast.success('تم تحديث معلومات المركز');
      } else {
        await addDoc(collection(db, 'centerInfos'), { ...payload, createdAt: now });
        toast.success('تم حفظ معلومات المركز');
      }
      setShowModal(false);
      resetForm();
      fetchData();
    } catch {
      toast.error('حدث خطأ أثناء الحفظ');
    } finally {
      setSaving(false);
    }
  };

  const filteredInfos = filterCenter ? centerInfos.filter(ci => ci.centerName === filterCenter) : centerInfos;
  const allCenterNames = Array.from(new Set(centerInfos.map(ci => ci.centerName).filter(Boolean)));

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">معلومات المراكز</h1>
          <p className="text-slate-500 mt-1">معلومات جميع مراكز المنطقة الثانية</p>
        </div>
        <div className="flex items-center gap-3">
          {allCenterNames.length > 0 && (
            <select value={filterCenter} onChange={e => setFilterCenter(e.target.value)}
              className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
              <option value="">كل المراكز</option>
              {allCenterNames.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          )}
          <Button onClick={openCreate} icon={<Plus size={18} />}>إضافة معلومات مركز</Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm text-center">
          <p className="text-2xl font-bold text-primary-700">{centerInfos.length}</p>
          <p className="text-xs text-slate-400 mt-1">مراكز مسجلة</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm text-center">
          <p className="text-2xl font-bold text-emerald-700">{centerInfos.reduce((s, ci) => s + (ci.ambulanceCount || 0), 0)}</p>
          <p className="text-xs text-slate-400 mt-1">آليات إسعاف</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm text-center">
          <p className="text-2xl font-bold text-red-700">{centerInfos.filter(ci => ci.hasFireDepartment).length}</p>
          <p className="text-xs text-slate-400 mt-1">مراكز بإطفاء</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm text-center">
          <p className="text-2xl font-bold text-amber-700">{centerInfos.filter(ci => ci.hasRescueDepartment).length}</p>
          <p className="text-xs text-slate-400 mt-1">مراكز بإنقاذ</p>
        </div>
      </div>

      {/* List */}
      {filteredInfos.length === 0 && (
        <div className="text-center py-12 bg-white rounded-2xl border border-slate-100">
          <Info size={48} className="text-slate-300 mx-auto mb-4" />
          <p className="text-slate-400">لا توجد معلومات مراكز مسجلة</p>
        </div>
      )}

      {filteredInfos.map(info => (
        <div key={info.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50" onClick={() => setExpandedId(expandedId === info.id ? null : info.id)}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary-100 rounded-xl flex items-center justify-center"><Building2 size={20} className="text-primary-700" /></div>
              <div>
                <p className="font-bold text-slate-800">{info.centerName}</p>
                <p className="text-xs text-slate-400">{info.townName} — قائد الفرقة: {info.squadLeaderName}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={(e) => { e.stopPropagation(); exportCenterInfoToPDF(info); }}
                className="p-1.5 rounded-lg hover:bg-emerald-50 text-emerald-500" title="تصدير PDF"><FileDown size={16} /></button>
              <button onClick={(e) => { e.stopPropagation(); openEdit(info); }}
                className="p-1.5 rounded-lg hover:bg-primary-50 text-primary-500"><Edit2 size={16} /></button>
              {expandedId === info.id ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
            </div>
          </div>
          {expandedId === info.id && (
            <div className="px-4 pb-4 border-t border-slate-100 pt-3 space-y-4 text-sm">
              {/* General */}
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-slate-400">المركز:</span> <span className="font-medium text-primary-700">{info.centerName}</span></div>
                <div><span className="text-slate-400">البلدة:</span> <span className="font-medium">{info.townName}</span></div>
                <div><span className="text-slate-400">قائد الفرقة:</span> <span className="font-medium">{info.squadLeaderName}</span></div>
                <div><span className="text-slate-400">هاتف القائد:</span> <span className="font-medium">{info.squadLeaderPhone}</span></div>
              </div>

              {/* Ambulances */}
              <div className="bg-emerald-50/50 rounded-xl p-3 border border-emerald-100">
                <p className="font-bold text-emerald-800 mb-2 flex items-center gap-2"><Truck size={16} /> آليات الإسعاف ({info.ambulanceCount})</p>
                {info.ambulanceNumbers?.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {info.ambulanceNumbers.map((n, i) => (
                      <span key={i} className="px-3 py-1 bg-white rounded-full text-xs font-medium text-emerald-700 border border-emerald-200">{n}</span>
                    ))}
                  </div>
                )}
              </div>

              {/* Fire */}
              <div className={`rounded-xl p-3 border ${info.hasFireDepartment ? 'bg-red-50/50 border-red-100' : 'bg-slate-50 border-slate-100'}`}>
                <p className="font-bold mb-2 flex items-center gap-2">
                  <Flame size={16} className={info.hasFireDepartment ? 'text-red-600' : 'text-slate-400'} />
                  <span className={info.hasFireDepartment ? 'text-red-800' : 'text-slate-500'}>
                    قسم الإطفاء: {info.hasFireDepartment ? 'نعم' : 'لا يوجد'}
                  </span>
                </p>
                {info.hasFireDepartment && (
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div><span className="text-slate-400">المسؤول:</span> <span className="font-medium">{info.fireManagerName || '—'}</span></div>
                    <div><span className="text-slate-400">الهاتف:</span> <span className="font-medium">{info.fireManagerPhone || '—'}</span></div>
                    <div><span className="text-slate-400">عدد الآليات:</span> <span className="font-medium">{info.fireVehicleCount || 0}</span></div>
                    {info.fireVehicleNumbers && info.fireVehicleNumbers.length > 0 && (
                      <div className="col-span-2 flex flex-wrap gap-1 mt-1">
                        {info.fireVehicleNumbers.map((n, i) => (
                          <span key={i} className="px-2 py-0.5 bg-white rounded-full text-xs font-medium text-red-700 border border-red-200">{n}</span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Rescue */}
              <div className={`rounded-xl p-3 border ${info.hasRescueDepartment ? 'bg-amber-50/50 border-amber-100' : 'bg-slate-50 border-slate-100'}`}>
                <p className="font-bold mb-2 flex items-center gap-2">
                  <Shield size={16} className={info.hasRescueDepartment ? 'text-amber-600' : 'text-slate-400'} />
                  <span className={info.hasRescueDepartment ? 'text-amber-800' : 'text-slate-500'}>
                    قسم الإنقاذ: {info.hasRescueDepartment ? 'نعم' : 'لا يوجد'}
                  </span>
                </p>
                {info.hasRescueDepartment && (
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div><span className="text-slate-400">المسؤول:</span> <span className="font-medium">{info.rescueManagerName || '—'}</span></div>
                    <div><span className="text-slate-400">الهاتف:</span> <span className="font-medium">{info.rescueManagerPhone || '—'}</span></div>
                    <div><span className="text-slate-400">عدد الآليات:</span> <span className="font-medium">{info.rescueVehicleCount || 0}</span></div>
                    {info.rescueVehicleNumbers && info.rescueVehicleNumbers.length > 0 && (
                      <div className="col-span-2 flex flex-wrap gap-1 mt-1">
                        {info.rescueVehicleNumbers.map((n, i) => (
                          <span key={i} className="px-2 py-0.5 bg-white rounded-full text-xs font-medium text-amber-700 border border-amber-200">{n}</span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
              {/* Deployments */}
              {(() => {
                const centerDeps = allDeployments.filter(d => d.centerId === info.centerId);
                if (centerDeps.length === 0) return null;
                return (
                  <div className="bg-indigo-50/50 rounded-xl p-3 border border-indigo-100">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-bold text-indigo-800 flex items-center gap-2"><MapPin size={16} /> الانتشار ({centerDeps.length})</p>
                      <button onClick={() => exportDeploymentsToPDF(centerDeps, info.centerName)}
                        className="p-1.5 hover:bg-indigo-100 rounded-lg transition-colors" title="تصدير PDF">
                        <FileDown size={16} className="text-indigo-600" />
                      </button>
                    </div>
                    <div className="space-y-2">
                      {centerDeps.map(dep => (
                        <div key={dep.id} className="bg-white rounded-lg p-3 border border-indigo-100 text-xs">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <Clock size={12} className="text-slate-400" />
                              <span className="text-slate-500">{dep.date}</span>
                            </div>
                            <span className="text-slate-500">{dep.location}</span>
                          </div>
                          {dep.vehicleInfo && (
                            <p className="text-slate-500 mb-1">الآلية: <span className="font-medium text-slate-700">{dep.vehicleInfo}</span></p>
                          )}
                          <div className="flex flex-wrap gap-1 mt-1">
                            {dep.teamMembers.map((m: string, i: number) => (
                              <span key={i} className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full text-xs">{m}</span>
                            ))}
                          </div>
                          {dep.notes && <p className="text-slate-400 mt-1">{dep.notes}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      ))}

      {/* ─── Create / Edit Modal ──────────────────────────────────────────── */}
      <Modal isOpen={showModal} onClose={() => { setShowModal(false); resetForm(); }} title={editingId ? 'تعديل معلومات المركز' : 'إضافة معلومات مركز'} size="lg">
        <div className="space-y-6">
          {/* Center Selection (only for new) */}
          {!editingId && (
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">اختر المركز <span className="text-red-500">*</span></label>
              <select value={selectedCenterId} onChange={e => setSelectedCenterId(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm">
                <option value="">— اختر المركز —</option>
                {centersWithoutInfo.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}

          {/* Basic */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">اسم البلدة <span className="text-red-500">*</span></label>
              <input type="text" value={form.townName} onChange={e => setForm(prev => ({ ...prev, townName: e.target.value }))}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm" placeholder="اسم البلدة" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">اسم قائد الفرقة <span className="text-red-500">*</span></label>
              <input type="text" value={form.squadLeaderName} onChange={e => setForm(prev => ({ ...prev, squadLeaderName: e.target.value }))}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm" placeholder="الاسم الكامل" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">رقم هاتف قائد الفرقة <span className="text-red-500">*</span></label>
              <input type="tel" value={form.squadLeaderPhone} onChange={e => setForm(prev => ({ ...prev, squadLeaderPhone: e.target.value }))}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm" placeholder="رقم الهاتف" />
            </div>
          </div>

          {/* Ambulances */}
          <div>
            <h3 className="font-bold text-slate-700 mb-3 flex items-center gap-2"><Truck size={16} className="text-emerald-600" /> آليات الإسعاف</h3>
            <div className="space-y-3">
              <div className="max-w-xs">
                <label className="block text-sm font-medium text-slate-600 mb-1">عدد آليات الإسعاف</label>
                <input type="number" min="0" value={form.ambulanceCount} onChange={e => handleAmbulanceCountChange(parseInt(e.target.value) || 0)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm" />
              </div>
              {form.ambulanceCount > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {form.ambulanceNumbers.map((num, i) => (
                    <input key={i} type="text" value={num} onChange={e => {
                      const updated = [...form.ambulanceNumbers];
                      updated[i] = e.target.value;
                      setForm(prev => ({ ...prev, ambulanceNumbers: updated }));
                    }}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                      placeholder={`آلية ${i + 1}`} />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Fire */}
          <div>
            <h3 className="font-bold text-slate-700 mb-3 flex items-center gap-2"><Flame size={16} className="text-red-600" /> قسم الإطفاء</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium text-slate-600">هل يوجد آلية إطفاء؟</label>
                <div className="flex gap-3">
                  <button type="button" onClick={() => setForm(prev => ({ ...prev, hasFireDepartment: true }))}
                    className={`px-4 py-1.5 rounded-xl text-sm font-medium transition-all ${form.hasFireDepartment ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>نعم</button>
                  <button type="button" onClick={() => setForm(prev => ({ ...prev, hasFireDepartment: false }))}
                    className={`px-4 py-1.5 rounded-xl text-sm font-medium transition-all ${!form.hasFireDepartment ? 'bg-red-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>لا</button>
                </div>
              </div>
              {form.hasFireDepartment && (
                <div className="bg-red-50/50 rounded-xl p-4 space-y-3 border border-red-100">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-slate-600 mb-1">اسم مسؤول الإطفاء</label>
                      <input type="text" value={form.fireManagerName} onChange={e => setForm(prev => ({ ...prev, fireManagerName: e.target.value }))}
                        className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm" placeholder="الاسم" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-600 mb-1">رقم هاتف مسؤول الإطفاء</label>
                      <input type="tel" value={form.fireManagerPhone} onChange={e => setForm(prev => ({ ...prev, fireManagerPhone: e.target.value }))}
                        className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm" placeholder="رقم الهاتف" />
                    </div>
                  </div>
                  <div className="max-w-xs">
                    <label className="block text-sm font-medium text-slate-600 mb-1">عدد آليات الإطفاء</label>
                    <input type="number" min="0" value={form.fireVehicleCount} onChange={e => handleFireVehicleCountChange(parseInt(e.target.value) || 0)}
                      className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm" />
                  </div>
                  {form.fireVehicleCount > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {form.fireVehicleNumbers.map((num, i) => (
                        <input key={i} type="text" value={num} onChange={e => {
                          const updated = [...form.fireVehicleNumbers];
                          updated[i] = e.target.value;
                          setForm(prev => ({ ...prev, fireVehicleNumbers: updated }));
                        }}
                          className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                          placeholder={`آلية ${i + 1}`} />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Rescue */}
          <div>
            <h3 className="font-bold text-slate-700 mb-3 flex items-center gap-2"><Shield size={16} className="text-amber-600" /> قسم الإنقاذ</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium text-slate-600">هل يوجد آليات إنقاذ؟</label>
                <div className="flex gap-3">
                  <button type="button" onClick={() => setForm(prev => ({ ...prev, hasRescueDepartment: true }))}
                    className={`px-4 py-1.5 rounded-xl text-sm font-medium transition-all ${form.hasRescueDepartment ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>نعم</button>
                  <button type="button" onClick={() => setForm(prev => ({ ...prev, hasRescueDepartment: false }))}
                    className={`px-4 py-1.5 rounded-xl text-sm font-medium transition-all ${!form.hasRescueDepartment ? 'bg-red-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>لا</button>
                </div>
              </div>
              {form.hasRescueDepartment && (
                <div className="bg-amber-50/50 rounded-xl p-4 space-y-3 border border-amber-100">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-slate-600 mb-1">اسم مسؤول الإنقاذ</label>
                      <input type="text" value={form.rescueManagerName} onChange={e => setForm(prev => ({ ...prev, rescueManagerName: e.target.value }))}
                        className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm" placeholder="الاسم" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-600 mb-1">رقم هاتف مسؤول الإنقاذ</label>
                      <input type="tel" value={form.rescueManagerPhone} onChange={e => setForm(prev => ({ ...prev, rescueManagerPhone: e.target.value }))}
                        className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm" placeholder="رقم الهاتف" />
                    </div>
                  </div>
                  <div className="max-w-xs">
                    <label className="block text-sm font-medium text-slate-600 mb-1">عدد آليات الإنقاذ</label>
                    <input type="number" min="0" value={form.rescueVehicleCount} onChange={e => handleRescueVehicleCountChange(parseInt(e.target.value) || 0)}
                      className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm" />
                  </div>
                  {form.rescueVehicleCount > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {form.rescueVehicleNumbers.map((num, i) => (
                        <input key={i} type="text" value={num} onChange={e => {
                          const updated = [...form.rescueVehicleNumbers];
                          updated[i] = e.target.value;
                          setForm(prev => ({ ...prev, rescueVehicleNumbers: updated }));
                        }}
                          className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                          placeholder={`آلية ${i + 1}`} />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Save */}
          <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
            <Button onClick={handleSave} loading={saving} icon={<Save size={18} />}>
              {editingId ? 'تحديث' : 'حفظ'}
            </Button>
            <button onClick={() => { setShowModal(false); resetForm(); }}
              className="px-6 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors">إلغاء</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
