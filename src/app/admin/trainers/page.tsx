'use client';

import { useEffect, useState } from 'react';
import { collection, getDocs, updateDoc, deleteDoc, doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/auth-context';
import { UserProfile } from '@/lib/types';
import Modal from '@/components/Modal';
import Button from '@/components/Button';
import SearchFilter from '@/components/SearchFilter';
import { GraduationCap, Plus, Trash2, Ban, CheckCircle, Mail, User } from 'lucide-react';
import toast from 'react-hot-toast';

export default function TrainersPage() {
  const { profile } = useAuth();
  const [trainers, setTrainers] = useState<UserProfile[]>([]);
  const [filtered, setFiltered] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTrainer, setEditingTrainer] = useState<UserProfile | null>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
  });

  useEffect(() => {
    fetchTrainers();
  }, []);

  async function fetchTrainers() {
    try {
      const snap = await getDocs(collection(db, 'users'));
      const all = snap.docs.map((d) => ({ ...d.data() })) as UserProfile[];
      const trainerList = all.filter((u) => u.role === 'trainer');
      setTrainers(trainerList);
      setFiltered(trainerList);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  }

  const handleSearch = (term: string) => {
    if (!term) { setFiltered(trainers); return; }
    const lower = term.toLowerCase();
    setFiltered(trainers.filter((t) =>
      t.name.toLowerCase().includes(lower) ||
      t.email.toLowerCase().includes(lower)
    ));
  };

  const openCreateModal = () => {
    setEditingTrainer(null);
    setFormData({ name: '', email: '', password: '' });
    setShowModal(true);
  };

  const openEditModal = (trainer: UserProfile) => {
    setEditingTrainer(trainer);
    setFormData({ name: trainer.name, email: trainer.email, password: '' });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) { toast.error('يرجى إدخال اسم المدرب'); return; }
    if (!editingTrainer && !formData.email.trim()) { toast.error('يرجى إدخال البريد الإلكتروني'); return; }
    if (!editingTrainer && formData.password.length < 6) { toast.error('كلمة المرور يجب أن تكون 6 أحرف على الأقل'); return; }

    setSaving(true);
    try {
      const now = new Date().toISOString();

      if (editingTrainer) {
        await updateDoc(doc(db, 'users', editingTrainer.uid), {
          name: formData.name.trim(),
          updatedAt: now,
        });
        toast.success('تم تحديث بيانات المدرب');
      } else {
        // Create Firebase Auth account using secondary app to avoid signing out current admin
        const { initializeApp, deleteApp } = await import('firebase/app');
        const { getAuth, createUserWithEmailAndPassword } = await import('firebase/auth');

        const secondaryApp = initializeApp(
          {
            apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
            authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
            projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
          },
          'trainer-secondary-' + Date.now()
        );
        const secondaryAuth = getAuth(secondaryApp);

        let uid = '';
        try {
          const cred = await createUserWithEmailAndPassword(
            secondaryAuth,
            formData.email.trim(),
            formData.password
          );
          uid = cred.user.uid;
          await secondaryAuth.signOut();
        } finally {
          await deleteApp(secondaryApp);
        }

        await setDoc(doc(db, 'users', uid), {
          uid,
          email: formData.email.trim(),
          name: formData.name.trim(),
          role: 'trainer',
          isBlocked: false,
          createdAt: now,
          updatedAt: now,
          createdBy: profile?.uid || '',
        } as UserProfile);

        toast.success('تم إنشاء حساب المدرب بنجاح');
      }

      setShowModal(false);
      fetchTrainers();
    } catch (error: any) {
      console.error('Error:', error);
      if (error?.code === 'auth/email-already-in-use') {
        toast.error('البريد الإلكتروني مستخدم بالفعل');
      } else if (error?.code === 'auth/weak-password') {
        toast.error('كلمة المرور ضعيفة جداً');
      } else if (error?.code === 'auth/invalid-email') {
        toast.error('البريد الإلكتروني غير صالح');
      } else {
        toast.error('حدث خطأ أثناء الحفظ');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (trainer: UserProfile) => {
    if (!confirm(`هل أنت متأكد من حذف حساب المدرب "${trainer.name}"؟`)) return;
    try {
      await deleteDoc(doc(db, 'users', trainer.uid));
      toast.success('تم حذف المدرب');
      fetchTrainers();
    } catch (error) {
      toast.error('حدث خطأ أثناء الحذف');
    }
  };

  const toggleBlock = async (trainer: UserProfile) => {
    try {
      await updateDoc(doc(db, 'users', trainer.uid), {
        isBlocked: !trainer.isBlocked,
        updatedAt: new Date().toISOString(),
      });
      toast.success(trainer.isBlocked ? 'تم إلغاء حظر المدرب' : 'تم حظر المدرب');
      fetchTrainers();
    } catch (error) {
      toast.error('حدث خطأ');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">المدربون</h1>
          <p className="text-slate-500 mt-1">إدارة حسابات المدربين ({trainers.length})</p>
        </div>
        <Button onClick={openCreateModal} icon={<Plus size={18} />}>
          إضافة مدرب
        </Button>
      </div>

      <SearchFilter
        searchPlaceholder="بحث باسم المدرب أو البريد الإلكتروني..."
        onSearch={handleSearch}
      />

      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-100">
          <GraduationCap size={48} className="mx-auto text-slate-300 mb-4" />
          <p className="text-slate-500 font-medium">لا يوجد مدربون</p>
          <p className="text-slate-400 text-sm mt-1">أضف أول مدرب بالضغط على "إضافة مدرب"</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((trainer) => (
            <div
              key={trainer.uid}
              className={`bg-white rounded-2xl border p-5 shadow-sm hover:shadow-md transition-shadow ${
                trainer.isBlocked ? 'border-red-200 opacity-75' : 'border-slate-100'
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 bg-emerald-100 rounded-xl flex items-center justify-center">
                    <GraduationCap size={22} className="text-emerald-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-800">{trainer.name}</h3>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        trainer.isBlocked
                          ? 'bg-red-100 text-red-600'
                          : 'bg-emerald-100 text-emerald-700'
                      }`}
                    >
                      {trainer.isBlocked ? 'محظور' : 'نشط'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5 mb-4 text-sm text-slate-500">
                <div className="flex items-center gap-2">
                  <Mail size={14} />
                  <span className="truncate" dir="ltr">{trainer.email}</span>
                </div>
                <div className="flex items-center gap-2">
                  <User size={14} />
                  <span>مدرب</span>
                </div>
                <div className="text-xs text-slate-400">
                  أُنشئ: {new Date(trainer.createdAt).toLocaleDateString('ar-SA')}
                </div>
              </div>

              <div className="flex gap-2 pt-3 border-t border-slate-100">
                <button
                  onClick={() => openEditModal(trainer)}
                  className="flex-1 text-xs py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
                >
                  تعديل
                </button>
                <button
                  onClick={() => toggleBlock(trainer)}
                  className={`flex-1 text-xs py-1.5 rounded-lg transition-colors flex items-center justify-center gap-1 ${
                    trainer.isBlocked
                      ? 'bg-emerald-100 hover:bg-emerald-200 text-emerald-700'
                      : 'bg-amber-100 hover:bg-amber-200 text-amber-700'
                  }`}
                >
                  {trainer.isBlocked ? (
                    <><CheckCircle size={13} /> إلغاء الحظر</>
                  ) : (
                    <><Ban size={13} /> حظر</>
                  )}
                </button>
                <button
                  onClick={() => handleDelete(trainer)}
                  className="text-xs px-3 py-1.5 rounded-lg bg-red-100 hover:bg-red-200 text-red-600 transition-colors"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingTrainer ? 'تعديل بيانات المدرب' : 'إضافة مدرب جديد'}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">اسم المدرب *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="اسم المدرب الكامل"
            />
          </div>

          {!editingTrainer && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">البريد الإلكتروني *</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 text-left"
                  dir="ltr"
                  placeholder="trainer@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">كلمة المرور *</label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData((p) => ({ ...p, password: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 text-left"
                  dir="ltr"
                  placeholder="6 أحرف على الأقل"
                />
              </div>

              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm text-emerald-700">
                <p className="font-medium mb-1">معلومات تسجيل الدخول</p>
                <p>سيتمكن المدرب من تسجيل الدخول باستخدام البريد الإلكتروني وكلمة المرور المدخلة أعلاه.</p>
              </div>
            </>
          )}

          <div className="flex gap-3 pt-2">
            <Button onClick={handleSave} loading={saving} className="flex-1">
              {editingTrainer ? 'حفظ التعديلات' : 'إنشاء الحساب'}
            </Button>
            <button
              onClick={() => setShowModal(false)}
              className="px-4 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50"
            >
              إلغاء
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
