'use client';

import { useEffect, useState } from 'react';
import { collection, getDocs, addDoc, query, where, deleteDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/auth-context';
import { CenterDamageEvent, VehicleDamageEvent, InjuredMedicEvent, MartyrMedicEvent } from '@/lib/types';
import { logAudit } from '@/lib/audit';
import Modal from '@/components/Modal';
import Button from '@/components/Button';
import ImageUpload from '@/components/ImageUpload';
import { Building2, Truck, HeartPulse, Star, Plus, Trash2, ChevronDown, ChevronUp, FileDown } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  exportCenterDamageToPDF, exportVehicleDamageToPDF,
  exportInjuredMedicToPDF, exportMartyrMedicToPDF,
  exportAllCenterDamagesToPDF, exportAllVehicleDamagesToPDF,
  exportAllInjuredMedicsToPDF, exportAllMartyrMedicsToPDF,
} from '@/lib/pdf-utils';

type ActiveTab = 'center_damage' | 'vehicle_damage' | 'injured' | 'martyrs';

export default function CenterEventsPage() {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<ActiveTab>('center_damage');
  const [loading, setLoading] = useState(true);

  // Data
  const [centerDamages, setCenterDamages] = useState<CenterDamageEvent[]>([]);
  const [vehicleDamages, setVehicleDamages] = useState<VehicleDamageEvent[]>([]);
  const [injured, setInjured] = useState<InjuredMedicEvent[]>([]);
  const [martyrs, setMartyrs] = useState<MartyrMedicEvent[]>([]);

  // Modals
  const [showCenterDamageModal, setShowCenterDamageModal] = useState(false);
  const [showVehicleDamageModal, setShowVehicleDamageModal] = useState(false);
  const [showInjuredModal, setShowInjuredModal] = useState(false);
  const [showMartyrModal, setShowMartyrModal] = useState(false);
  const [saving, setSaving] = useState(false);

  // Expand details
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Forms
  const [cdForm, setCdForm] = useState({ damageLevel: 'partial' as 'total' | 'partial' | 'cracks', estimatedCost: '', attackDate: '', attackType: 'direct' as 'direct' | 'nearby', images: [] as string[], notes: '' });
  const [vdForm, setVdForm] = useState({ vehicleNumber: '', vehicleTypeModel: '', incidentDate: '', resultingDefects: '', damageSize: 'small' as 'big' | 'small', estimatedCost: '', maintenanceType: 'direct' as 'direct' | 'difficult', fieldStatus: 'in_service' as 'out_of_service' | 'in_service', images: [] as string[], notes: '' });
  const [injForm, setInjForm] = useState({ fullName: '', birthDate: '', mission: '', injuryDate: '', injuryType: '', injuryLocation: '', severity: 'minor' as 'serious' | 'moderate' | 'minor', hospitalName: '', followUpType: 'medical' as 'medical' | 'surgical' | 'pharmaceutical', notes: '' });
  const [martForm, setMartForm] = useState({ fullName: '', mission: '', birthDate: '', familyStatus: '', martyrdomDate: '', martyrdomPlace: '', hospitalName: '', notes: '' });

  useEffect(() => {
    if (!profile?.centerId) return;
    fetchAll();
  }, [profile]);

  async function fetchAll() {
    try {
      const cid = profile!.centerId;
      const [cdSnap, vdSnap, injSnap, martSnap] = await Promise.all([
        getDocs(query(collection(db, 'centerDamageEvents'), where('centerId', '==', cid))),
        getDocs(query(collection(db, 'vehicleDamageEvents'), where('centerId', '==', cid))),
        getDocs(query(collection(db, 'injuredMedicEvents'), where('centerId', '==', cid))),
        getDocs(query(collection(db, 'martyrMedicEvents'), where('centerId', '==', cid))),
      ]);
      setCenterDamages(cdSnap.docs.map(d => ({ id: d.id, ...d.data() })) as CenterDamageEvent[]);
      setVehicleDamages(vdSnap.docs.map(d => ({ id: d.id, ...d.data() })) as VehicleDamageEvent[]);
      setInjured(injSnap.docs.map(d => ({ id: d.id, ...d.data() })) as InjuredMedicEvent[]);
      setMartyrs(martSnap.docs.map(d => ({ id: d.id, ...d.data() })) as MartyrMedicEvent[]);
    } catch (error) { console.error(error); } finally { setLoading(false); }
  }

  // ─── Save handlers ──────────────────────────────────────────────────────────
  const saveCenterDamage = async () => {
    if (!cdForm.attackDate) { toast.error('تاريخ الاعتداء مطلوب'); return; }
    setSaving(true);
    try {
      const now = new Date().toISOString();
      await addDoc(collection(db, 'centerDamageEvents'), {
        centerId: profile!.centerId, centerName: profile!.centerName || '',
        damageLevel: cdForm.damageLevel, estimatedCost: cdForm.estimatedCost.trim(),
        attackDate: cdForm.attackDate, attackType: cdForm.attackType,
        images: cdForm.images, notes: cdForm.notes.trim(),
        createdAt: now, updatedAt: now, createdBy: profile!.uid,
      });
      toast.success('تم حفظ استمارة أضرار المركز');
      logAudit(profile!, 'create', 'centerDamageEvents', 'إضافة استمارة أضرار مركز');
      setShowCenterDamageModal(false);
      setCdForm({ damageLevel: 'partial', estimatedCost: '', attackDate: '', attackType: 'direct', images: [], notes: '' });
      fetchAll();
    } catch { toast.error('حدث خطأ'); } finally { setSaving(false); }
  };

  const saveVehicleDamage = async () => {
    if (!vdForm.vehicleNumber.trim()) { toast.error('رقم السيارة مطلوب'); return; }
    if (!vdForm.incidentDate) { toast.error('تاريخ الحادثة مطلوب'); return; }
    setSaving(true);
    try {
      const now = new Date().toISOString();
      await addDoc(collection(db, 'vehicleDamageEvents'), {
        centerId: profile!.centerId, centerName: profile!.centerName || '',
        vehicleNumber: vdForm.vehicleNumber.trim(), vehicleTypeModel: vdForm.vehicleTypeModel.trim(),
        incidentDate: vdForm.incidentDate, resultingDefects: vdForm.resultingDefects.trim(),
        damageSize: vdForm.damageSize, estimatedCost: vdForm.estimatedCost.trim(),
        maintenanceType: vdForm.maintenanceType, fieldStatus: vdForm.fieldStatus,
        images: vdForm.images, notes: vdForm.notes.trim(),
        createdAt: now, updatedAt: now, createdBy: profile!.uid,
      });
      toast.success('تم حفظ استمارة أضرار السيارة');
      logAudit(profile!, 'create', 'vehicleDamageEvents', 'إضافة استمارة أضرار سيارة');
      setShowVehicleDamageModal(false);
      setVdForm({ vehicleNumber: '', vehicleTypeModel: '', incidentDate: '', resultingDefects: '', damageSize: 'small', estimatedCost: '', maintenanceType: 'direct', fieldStatus: 'in_service', images: [], notes: '' });
      fetchAll();
    } catch { toast.error('حدث خطأ'); } finally { setSaving(false); }
  };

  const saveInjured = async () => {
    if (!injForm.fullName.trim()) { toast.error('اسم المصاب مطلوب'); return; }
    if (!injForm.injuryDate) { toast.error('تاريخ الإصابة مطلوب'); return; }
    setSaving(true);
    try {
      const now = new Date().toISOString();
      await addDoc(collection(db, 'injuredMedicEvents'), {
        centerId: profile!.centerId, centerName: profile!.centerName || '',
        fullName: injForm.fullName.trim(), birthDate: injForm.birthDate,
        mission: injForm.mission.trim(), injuryDate: injForm.injuryDate,
        injuryType: injForm.injuryType.trim(), injuryLocation: injForm.injuryLocation.trim(),
        severity: injForm.severity, hospitalName: injForm.hospitalName.trim(),
        followUpType: injForm.followUpType, notes: injForm.notes.trim(),
        createdAt: now, updatedAt: now, createdBy: profile!.uid,
      });
      toast.success('تم حفظ استمارة المصاب');
      logAudit(profile!, 'create', 'injuredMedicEvents', 'إضافة استمارة مصاب');
      setShowInjuredModal(false);
      setInjForm({ fullName: '', birthDate: '', mission: '', injuryDate: '', injuryType: '', injuryLocation: '', severity: 'minor', hospitalName: '', followUpType: 'medical', notes: '' });
      fetchAll();
    } catch { toast.error('حدث خطأ'); } finally { setSaving(false); }
  };

  const saveMartyr = async () => {
    if (!martForm.fullName.trim()) { toast.error('اسم الشهيد مطلوب'); return; }
    if (!martForm.martyrdomDate) { toast.error('تاريخ الاستشهاد مطلوب'); return; }
    setSaving(true);
    try {
      const now = new Date().toISOString();
      await addDoc(collection(db, 'martyrMedicEvents'), {
        centerId: profile!.centerId, centerName: profile!.centerName || '',
        fullName: martForm.fullName.trim(), mission: martForm.mission.trim(),
        birthDate: martForm.birthDate, familyStatus: martForm.familyStatus.trim(),
        martyrdomDate: martForm.martyrdomDate, martyrdomPlace: martForm.martyrdomPlace.trim(),
        hospitalName: martForm.hospitalName.trim(), notes: martForm.notes.trim(),
        createdAt: now, updatedAt: now, createdBy: profile!.uid,
      });
      toast.success('تم حفظ استمارة الشهيد');
      logAudit(profile!, 'create', 'martyrMedicEvents', 'إضافة استمارة شهيد');
      setShowMartyrModal(false);
      setMartForm({ fullName: '', mission: '', birthDate: '', familyStatus: '', martyrdomDate: '', martyrdomPlace: '', hospitalName: '', notes: '' });
      fetchAll();
    } catch { toast.error('حدث خطأ'); } finally { setSaving(false); }
  };

  const handleDelete = async (col: string, id: string) => {
    if (!confirm('هل أنت متأكد من الحذف؟')) return;
    try {
      await deleteDoc(doc(db, col, id));
      toast.success('تم الحذف');
      logAudit(profile!, 'delete', col, 'حذف سجل حدث', id);
      fetchAll();
    } catch { toast.error('حدث خطأ'); }
  };

  // ─── Labels ─────────────────────────────────────────────────────────────────
  const damageLevelLabel: Record<string, string> = { total: 'تدمير كامل', partial: 'تدمير جزئي', cracks: 'تصدعات وتكسر زجاج' };
  const attackTypeLabel: Record<string, string> = { direct: 'غارة مباشرة', nearby: 'غارة قريبة' };
  const damageSizeLabel: Record<string, string> = { big: 'كبير', small: 'صغير' };
  const maintenanceTypeLabel: Record<string, string> = { direct: 'صيانة مباشرة', difficult: 'صعوبة إجراء الصيانة' };
  const fieldStatusLabel: Record<string, string> = { out_of_service: 'خارجة عن الخدمة', in_service: 'دخلت الخدمة' };
  const severityLabel: Record<string, string> = { serious: 'خطيرة', moderate: 'متوسطة', minor: 'طفيفة' };
  const followUpLabel: Record<string, string> = { medical: 'طبية', surgical: 'جراحية', pharmaceutical: 'دوائية' };

  const tabs = [
    { key: 'center_damage' as ActiveTab, label: 'أضرار المركز', icon: <Building2 size={20} />, color: 'bg-red-500', count: centerDamages.length },
    { key: 'vehicle_damage' as ActiveTab, label: 'أضرار السيارات', icon: <Truck size={20} />, color: 'bg-orange-500', count: vehicleDamages.length },
    { key: 'injured' as ActiveTab, label: 'جرحى المسعفين', icon: <HeartPulse size={20} />, color: 'bg-yellow-500', count: injured.length },
    { key: 'martyrs' as ActiveTab, label: 'شهداء المسعفين', icon: <Star size={20} />, color: 'bg-slate-700', count: martyrs.length },
  ];

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full" /></div>;
  }

  const inputCls = "w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">أحداث المركز</h1>
        <p className="text-slate-500 mt-1">توثيق أحداث وأضرار المركز</p>
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {tabs.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-3 p-4 rounded-2xl border-2 transition-all ${activeTab === tab.key ? 'border-primary-500 bg-primary-50 shadow-md' : 'border-slate-100 bg-white hover:border-slate-200'}`}>
            <div className={`w-10 h-10 ${tab.color} rounded-xl flex items-center justify-center text-white`}>{tab.icon}</div>
            <div className="text-right">
              <p className={`text-sm font-bold ${activeTab === tab.key ? 'text-primary-700' : 'text-slate-700'}`}>{tab.label}</p>
              <p className="text-xs text-slate-400">{tab.count} سجل</p>
            </div>
          </button>
        ))}
      </div>

      {/* ─── Center Damage Tab ─────────────────────────────────────────────── */}
      {activeTab === 'center_damage' && (
        <div className="space-y-4">
          <div className="flex justify-end gap-2">
            {centerDamages.length > 0 && <Button variant="ghost" onClick={() => exportAllCenterDamagesToPDF(centerDamages)} icon={<FileDown size={18} />}>تصدير PDF</Button>}
            <Button onClick={() => { setCdForm({ damageLevel: 'partial', estimatedCost: '', attackDate: '', attackType: 'direct', images: [], notes: '' }); setShowCenterDamageModal(true); }} icon={<Plus size={18} />}>إضافة</Button>
          </div>
          {centerDamages.length === 0 && <div className="text-center py-12 bg-white rounded-2xl border border-slate-100"><Building2 size={48} className="text-slate-300 mx-auto mb-4" /><p className="text-slate-400">لا توجد سجلات أضرار</p></div>}
          {centerDamages.map(item => (
            <div key={item.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50" onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center"><Building2 size={20} className="text-red-600" /></div>
                  <div>
                    <p className="font-bold text-slate-800">{damageLevelLabel[item.damageLevel]}</p>
                    <p className="text-xs text-slate-400">{item.attackDate}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={(e) => { e.stopPropagation(); exportCenterDamageToPDF(item); }} className="p-1.5 rounded-lg hover:bg-emerald-50 text-emerald-500"><FileDown size={16} /></button>
                  <button onClick={(e) => { e.stopPropagation(); handleDelete('centerDamageEvents', item.id); }} className="p-1.5 rounded-lg hover:bg-red-50 text-red-400"><Trash2 size={16} /></button>
                  {expandedId === item.id ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
                </div>
              </div>
              {expandedId === item.id && (
                <div className="px-4 pb-4 border-t border-slate-100 pt-3 space-y-2 text-sm">
                  <div className="grid grid-cols-2 gap-3">
                    <div><span className="text-slate-400">مستوى الضرر:</span> <span className="font-medium">{damageLevelLabel[item.damageLevel]}</span></div>
                    <div><span className="text-slate-400">نوع الاعتداء:</span> <span className="font-medium">{attackTypeLabel[item.attackType]}</span></div>
                    <div><span className="text-slate-400">تقدير كلفة الصيانة:</span> <span className="font-medium">{item.estimatedCost || '—'}</span></div>
                    <div><span className="text-slate-400">تاريخ الاعتداء:</span> <span className="font-medium">{item.attackDate}</span></div>
                  </div>
                  {item.notes && <div><span className="text-slate-400">ملاحظات:</span> <span className="font-medium">{item.notes}</span></div>}
                  {item.images?.length > 0 && <div className="flex flex-wrap gap-2 mt-2">{item.images.map((url, i) => <img key={i} src={url} alt="" className="w-24 h-24 rounded-xl object-cover" />)}</div>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ─── Vehicle Damage Tab ────────────────────────────────────────────── */}
      {activeTab === 'vehicle_damage' && (
        <div className="space-y-4">
          <div className="flex justify-end gap-2">
            {vehicleDamages.length > 0 && <Button variant="ghost" onClick={() => exportAllVehicleDamagesToPDF(vehicleDamages)} icon={<FileDown size={18} />}>تصدير PDF</Button>}
            <Button onClick={() => { setVdForm({ vehicleNumber: '', vehicleTypeModel: '', incidentDate: '', resultingDefects: '', damageSize: 'small', estimatedCost: '', maintenanceType: 'direct', fieldStatus: 'in_service', images: [], notes: '' }); setShowVehicleDamageModal(true); }} icon={<Plus size={18} />}>إضافة</Button>
          </div>
          {vehicleDamages.length === 0 && <div className="text-center py-12 bg-white rounded-2xl border border-slate-100"><Truck size={48} className="text-slate-300 mx-auto mb-4" /><p className="text-slate-400">لا توجد سجلات أضرار سيارات</p></div>}
          {vehicleDamages.map(item => (
            <div key={item.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50" onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center"><Truck size={20} className="text-orange-600" /></div>
                  <div>
                    <p className="font-bold text-slate-800">{item.vehicleTypeModel || item.vehicleNumber}</p>
                    <p className="text-xs text-slate-400">{item.incidentDate} — <span className={item.fieldStatus === 'out_of_service' ? 'text-red-500' : 'text-green-500'}>{fieldStatusLabel[item.fieldStatus]}</span></p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={(e) => { e.stopPropagation(); exportVehicleDamageToPDF(item); }} className="p-1.5 rounded-lg hover:bg-emerald-50 text-emerald-500"><FileDown size={16} /></button>
                  <button onClick={(e) => { e.stopPropagation(); handleDelete('vehicleDamageEvents', item.id); }} className="p-1.5 rounded-lg hover:bg-red-50 text-red-400"><Trash2 size={16} /></button>
                  {expandedId === item.id ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
                </div>
              </div>
              {expandedId === item.id && (
                <div className="px-4 pb-4 border-t border-slate-100 pt-3 space-y-2 text-sm">
                  <div className="grid grid-cols-2 gap-3">
                    <div><span className="text-slate-400">رقم السيارة:</span> <span className="font-medium">{item.vehicleNumber}</span></div>
                    <div><span className="text-slate-400">النوع والموديل:</span> <span className="font-medium">{item.vehicleTypeModel || '—'}</span></div>
                    <div><span className="text-slate-400">حجم الضرر:</span> <span className="font-medium">{damageSizeLabel[item.damageSize]}</span></div>
                    <div><span className="text-slate-400">تقدير كلفة الصيانة:</span> <span className="font-medium">{item.estimatedCost || '—'}</span></div>
                    <div><span className="text-slate-400">نوع الصيانة:</span> <span className="font-medium">{maintenanceTypeLabel[item.maintenanceType]}</span></div>
                    <div><span className="text-slate-400">الوضع الميداني:</span> <span className={`font-medium ${item.fieldStatus === 'out_of_service' ? 'text-red-600' : 'text-green-600'}`}>{fieldStatusLabel[item.fieldStatus]}</span></div>
                  </div>
                  {item.resultingDefects && <div><span className="text-slate-400">الأعطال الناجمة:</span> <span className="font-medium">{item.resultingDefects}</span></div>}
                  {item.notes && <div><span className="text-slate-400">ملاحظات:</span> <span className="font-medium">{item.notes}</span></div>}
                  {item.images?.length > 0 && <div className="flex flex-wrap gap-2 mt-2">{item.images.map((url, i) => <img key={i} src={url} alt="" className="w-24 h-24 rounded-xl object-cover" />)}</div>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ─── Injured Tab ───────────────────────────────────────────────────── */}
      {activeTab === 'injured' && (
        <div className="space-y-4">
          <div className="flex justify-end gap-2">
            {injured.length > 0 && <Button variant="ghost" onClick={() => exportAllInjuredMedicsToPDF(injured)} icon={<FileDown size={18} />}>تصدير PDF</Button>}
            <Button onClick={() => { setInjForm({ fullName: '', birthDate: '', mission: '', injuryDate: '', injuryType: '', injuryLocation: '', severity: 'minor', hospitalName: '', followUpType: 'medical', notes: '' }); setShowInjuredModal(true); }} icon={<Plus size={18} />}>إضافة</Button>
          </div>
          {injured.length === 0 && <div className="text-center py-12 bg-white rounded-2xl border border-slate-100"><HeartPulse size={48} className="text-slate-300 mx-auto mb-4" /><p className="text-slate-400">لا توجد سجلات جرحى</p></div>}
          {injured.map(item => (
            <div key={item.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50" onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-yellow-100 rounded-xl flex items-center justify-center"><HeartPulse size={20} className="text-yellow-600" /></div>
                  <div>
                    <p className="font-bold text-slate-800">{item.fullName}</p>
                    <p className="text-xs text-slate-400">{item.injuryDate} — <span className={item.severity === 'serious' ? 'text-red-500' : item.severity === 'moderate' ? 'text-yellow-600' : 'text-green-500'}>{severityLabel[item.severity]}</span></p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={(e) => { e.stopPropagation(); exportInjuredMedicToPDF(item); }} className="p-1.5 rounded-lg hover:bg-emerald-50 text-emerald-500"><FileDown size={16} /></button>
                  <button onClick={(e) => { e.stopPropagation(); handleDelete('injuredMedicEvents', item.id); }} className="p-1.5 rounded-lg hover:bg-red-50 text-red-400"><Trash2 size={16} /></button>
                  {expandedId === item.id ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
                </div>
              </div>
              {expandedId === item.id && (
                <div className="px-4 pb-4 border-t border-slate-100 pt-3 space-y-2 text-sm">
                  <div className="grid grid-cols-2 gap-3">
                    <div><span className="text-slate-400">الاسم الثلاثي:</span> <span className="font-medium">{item.fullName}</span></div>
                    <div><span className="text-slate-400">تاريخ الولادة:</span> <span className="font-medium">{item.birthDate || '—'}</span></div>
                    <div><span className="text-slate-400">المهمة:</span> <span className="font-medium">{item.mission || '—'}</span></div>
                    <div><span className="text-slate-400">تاريخ الإصابة:</span> <span className="font-medium">{item.injuryDate}</span></div>
                    <div><span className="text-slate-400">نوع الإصابة:</span> <span className="font-medium">{item.injuryType || '—'}</span></div>
                    <div><span className="text-slate-400">مكان الإصابة:</span> <span className="font-medium">{item.injuryLocation || '—'}</span></div>
                    <div><span className="text-slate-400">الخطورة:</span> <span className={`font-medium ${item.severity === 'serious' ? 'text-red-600' : item.severity === 'moderate' ? 'text-yellow-600' : 'text-green-600'}`}>{severityLabel[item.severity]}</span></div>
                    <div><span className="text-slate-400">المستشفى:</span> <span className="font-medium">{item.hospitalName || '—'}</span></div>
                    <div><span className="text-slate-400">المتابعة:</span> <span className="font-medium">{followUpLabel[item.followUpType]}</span></div>
                  </div>
                  {item.notes && <div><span className="text-slate-400">ملاحظات:</span> <span className="font-medium">{item.notes}</span></div>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ─── Martyrs Tab ───────────────────────────────────────────────────── */}
      {activeTab === 'martyrs' && (
        <div className="space-y-4">
          <div className="flex justify-end gap-2">
            {martyrs.length > 0 && <Button variant="ghost" onClick={() => exportAllMartyrMedicsToPDF(martyrs)} icon={<FileDown size={18} />}>تصدير PDF</Button>}
            <Button onClick={() => { setMartForm({ fullName: '', mission: '', birthDate: '', familyStatus: '', martyrdomDate: '', martyrdomPlace: '', hospitalName: '', notes: '' }); setShowMartyrModal(true); }} icon={<Plus size={18} />}>إضافة</Button>
          </div>
          {martyrs.length === 0 && <div className="text-center py-12 bg-white rounded-2xl border border-slate-100"><Star size={48} className="text-slate-300 mx-auto mb-4" /><p className="text-slate-400">لا توجد سجلات شهداء</p></div>}
          {martyrs.map(item => (
            <div key={item.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50" onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-slate-200 rounded-xl flex items-center justify-center"><Star size={20} className="text-slate-700" /></div>
                  <div>
                    <p className="font-bold text-slate-800">{item.fullName}</p>
                    <p className="text-xs text-slate-400">{item.martyrdomDate}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={(e) => { e.stopPropagation(); exportMartyrMedicToPDF(item); }} className="p-1.5 rounded-lg hover:bg-emerald-50 text-emerald-500"><FileDown size={16} /></button>
                  <button onClick={(e) => { e.stopPropagation(); handleDelete('martyrMedicEvents', item.id); }} className="p-1.5 rounded-lg hover:bg-red-50 text-red-400"><Trash2 size={16} /></button>
                  {expandedId === item.id ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
                </div>
              </div>
              {expandedId === item.id && (
                <div className="px-4 pb-4 border-t border-slate-100 pt-3 space-y-2 text-sm">
                  <div className="grid grid-cols-2 gap-3">
                    <div><span className="text-slate-400">الاسم الثلاثي:</span> <span className="font-medium">{item.fullName}</span></div>
                    <div><span className="text-slate-400">تاريخ الولادة:</span> <span className="font-medium">{item.birthDate || '—'}</span></div>
                    <div><span className="text-slate-400">المهمة:</span> <span className="font-medium">{item.mission || '—'}</span></div>
                    <div><span className="text-slate-400">الوضع العائلي:</span> <span className="font-medium">{item.familyStatus || '—'}</span></div>
                    <div><span className="text-slate-400">تاريخ الاستشهاد:</span> <span className="font-medium">{item.martyrdomDate}</span></div>
                    <div><span className="text-slate-400">مكان الاستشهاد:</span> <span className="font-medium">{item.martyrdomPlace || '—'}</span></div>
                    <div><span className="text-slate-400">المستشفى:</span> <span className="font-medium">{item.hospitalName || '—'}</span></div>
                  </div>
                  {item.notes && <div><span className="text-slate-400">ملاحظات:</span> <span className="font-medium">{item.notes}</span></div>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ─── Center Damage Modal ───────────────────────────────────────────── */}
      <Modal isOpen={showCenterDamageModal} onClose={() => setShowCenterDamageModal(false)} title="استمارة أضرار المركز" size="lg">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">مستوى الضرر *</label>
            <select value={cdForm.damageLevel} onChange={e => setCdForm({ ...cdForm, damageLevel: e.target.value as any })} className={inputCls}>
              <option value="total">تدمير كامل</option>
              <option value="partial">تدمير جزئي</option>
              <option value="cracks">تصدعات وتكسر زجاج</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">تاريخ الاعتداء *</label>
            <input type="date" value={cdForm.attackDate} onChange={e => setCdForm({ ...cdForm, attackDate: e.target.value })} className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">نوع الاعتداء *</label>
            <select value={cdForm.attackType} onChange={e => setCdForm({ ...cdForm, attackType: e.target.value as any })} className={inputCls}>
              <option value="direct">غارة مباشرة</option>
              <option value="nearby">غارة قريبة</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">تقدير كلفة الصيانة</label>
            <input type="text" value={cdForm.estimatedCost} onChange={e => setCdForm({ ...cdForm, estimatedCost: e.target.value })} placeholder="مثال: 5000$" className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">ملاحظات</label>
            <textarea value={cdForm.notes} onChange={e => setCdForm({ ...cdForm, notes: e.target.value })} rows={3} className={inputCls + ' resize-none'} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">صور (اختياري)</label>
            <ImageUpload images={cdForm.images} onChange={images => setCdForm({ ...cdForm, images })} />
          </div>
          <div className="flex gap-3 pt-4">
            <Button onClick={saveCenterDamage} loading={saving}>حفظ</Button>
            <Button variant="secondary" onClick={() => setShowCenterDamageModal(false)}>إلغاء</Button>
          </div>
        </div>
      </Modal>

      {/* ─── Vehicle Damage Modal ──────────────────────────────────────────── */}
      <Modal isOpen={showVehicleDamageModal} onClose={() => setShowVehicleDamageModal(false)} title="استمارة أضرار سيارة الإسعاف" size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1.5">رقم السيارة *</label>
              <input type="text" value={vdForm.vehicleNumber} onChange={e => setVdForm({ ...vdForm, vehicleNumber: e.target.value })} className={inputCls} dir="ltr" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1.5">نوع السيارة وموديلها</label>
              <input type="text" value={vdForm.vehicleTypeModel} onChange={e => setVdForm({ ...vdForm, vehicleTypeModel: e.target.value })} placeholder="مثال: تويوتا هايلكس 2020" className={inputCls} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">تاريخ الحادثة *</label>
            <input type="date" value={vdForm.incidentDate} onChange={e => setVdForm({ ...vdForm, incidentDate: e.target.value })} className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">الأعطال الناجمة عن الضرر</label>
            <textarea value={vdForm.resultingDefects} onChange={e => setVdForm({ ...vdForm, resultingDefects: e.target.value })} rows={3} placeholder="وصف الأعطال الناجمة..." className={inputCls + ' resize-none'} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1.5">حجم الضرر</label>
              <select value={vdForm.damageSize} onChange={e => setVdForm({ ...vdForm, damageSize: e.target.value as any })} className={inputCls}>
                <option value="small">صغير</option>
                <option value="big">كبير</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1.5">تقدير كلفة الصيانة</label>
              <input type="text" value={vdForm.estimatedCost} onChange={e => setVdForm({ ...vdForm, estimatedCost: e.target.value })} placeholder="مثال: 3000$" className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1.5">نوع الصيانة</label>
              <select value={vdForm.maintenanceType} onChange={e => setVdForm({ ...vdForm, maintenanceType: e.target.value as any })} className={inputCls}>
                <option value="direct">صيانة مباشرة</option>
                <option value="difficult">صعوبة إجراء الصيانة</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1.5">الوضع الميداني</label>
              <select value={vdForm.fieldStatus} onChange={e => setVdForm({ ...vdForm, fieldStatus: e.target.value as any })} className={inputCls}>
                <option value="in_service">دخلت الخدمة</option>
                <option value="out_of_service">خارجة عن الخدمة</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">ملاحظات</label>
            <textarea value={vdForm.notes} onChange={e => setVdForm({ ...vdForm, notes: e.target.value })} rows={2} className={inputCls + ' resize-none'} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">صور (اختياري)</label>
            <ImageUpload images={vdForm.images} onChange={images => setVdForm({ ...vdForm, images })} />
          </div>
          <div className="flex gap-3 pt-4">
            <Button onClick={saveVehicleDamage} loading={saving}>حفظ</Button>
            <Button variant="secondary" onClick={() => setShowVehicleDamageModal(false)}>إلغاء</Button>
          </div>
        </div>
      </Modal>

      {/* ─── Injured Modal ─────────────────────────────────────────────────── */}
      <Modal isOpen={showInjuredModal} onClose={() => setShowInjuredModal(false)} title="استمارة جريح مسعف" size="lg">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">الاسم الثلاثي *</label>
            <input type="text" value={injForm.fullName} onChange={e => setInjForm({ ...injForm, fullName: e.target.value })} placeholder="الاسم الثلاثي للمصاب" className={inputCls} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1.5">تاريخ الولادة</label>
              <input type="date" value={injForm.birthDate} onChange={e => setInjForm({ ...injForm, birthDate: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1.5">المهمة</label>
              <input type="text" value={injForm.mission} onChange={e => setInjForm({ ...injForm, mission: e.target.value })} placeholder="المهمة التي أصيب خلالها" className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1.5">تاريخ الإصابة *</label>
              <input type="date" value={injForm.injuryDate} onChange={e => setInjForm({ ...injForm, injuryDate: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1.5">نوع الإصابة</label>
              <input type="text" value={injForm.injuryType} onChange={e => setInjForm({ ...injForm, injuryType: e.target.value })} placeholder="مثال: كسر، جرح، حرق..." className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1.5">مكان الإصابة في الجسم</label>
              <input type="text" value={injForm.injuryLocation} onChange={e => setInjForm({ ...injForm, injuryLocation: e.target.value })} placeholder="مثال: الساق اليمنى" className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1.5">خطورة الإصابة</label>
              <select value={injForm.severity} onChange={e => setInjForm({ ...injForm, severity: e.target.value as any })} className={inputCls}>
                <option value="minor">طفيفة</option>
                <option value="moderate">متوسطة</option>
                <option value="serious">خطيرة</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1.5">اسم المستشفى</label>
              <input type="text" value={injForm.hospitalName} onChange={e => setInjForm({ ...injForm, hospitalName: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1.5">نوع المتابعة المطلوبة</label>
              <select value={injForm.followUpType} onChange={e => setInjForm({ ...injForm, followUpType: e.target.value as any })} className={inputCls}>
                <option value="medical">طبية</option>
                <option value="surgical">جراحية</option>
                <option value="pharmaceutical">دوائية</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">ملاحظات</label>
            <textarea value={injForm.notes} onChange={e => setInjForm({ ...injForm, notes: e.target.value })} rows={2} className={inputCls + ' resize-none'} />
          </div>
          <div className="flex gap-3 pt-4">
            <Button onClick={saveInjured} loading={saving}>حفظ</Button>
            <Button variant="secondary" onClick={() => setShowInjuredModal(false)}>إلغاء</Button>
          </div>
        </div>
      </Modal>

      {/* ─── Martyr Modal ──────────────────────────────────────────────────── */}
      <Modal isOpen={showMartyrModal} onClose={() => setShowMartyrModal(false)} title="استمارة شهيد مسعف" size="lg">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">الاسم الثلاثي *</label>
            <input type="text" value={martForm.fullName} onChange={e => setMartForm({ ...martForm, fullName: e.target.value })} placeholder="الاسم الثلاثي للشهيد" className={inputCls} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1.5">تاريخ الولادة</label>
              <input type="date" value={martForm.birthDate} onChange={e => setMartForm({ ...martForm, birthDate: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1.5">الوضع العائلي</label>
              <input type="text" value={martForm.familyStatus} onChange={e => setMartForm({ ...martForm, familyStatus: e.target.value })} placeholder="مثال: متزوج، أعزب..." className={inputCls} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">المهمة</label>
            <input type="text" value={martForm.mission} onChange={e => setMartForm({ ...martForm, mission: e.target.value })} placeholder="المهمة التي استشهد خلالها" className={inputCls} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1.5">تاريخ الاستشهاد *</label>
              <input type="date" value={martForm.martyrdomDate} onChange={e => setMartForm({ ...martForm, martyrdomDate: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1.5">مكان الاستشهاد</label>
              <input type="text" value={martForm.martyrdomPlace} onChange={e => setMartForm({ ...martForm, martyrdomPlace: e.target.value })} className={inputCls} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">اسم المستشفى</label>
            <input type="text" value={martForm.hospitalName} onChange={e => setMartForm({ ...martForm, hospitalName: e.target.value })} className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">ملاحظات</label>
            <textarea value={martForm.notes} onChange={e => setMartForm({ ...martForm, notes: e.target.value })} rows={2} className={inputCls + ' resize-none'} />
          </div>
          <div className="flex gap-3 pt-4">
            <Button onClick={saveMartyr} loading={saving}>حفظ</Button>
            <Button variant="secondary" onClick={() => setShowMartyrModal(false)}>إلغاء</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
