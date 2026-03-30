'use client';

import { useEffect, useState } from 'react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { db, auth } from '@/lib/firebase';
import { useAuth } from '@/lib/auth-context';
import { Center, UserProfile } from '@/lib/types';
import Modal from '@/components/Modal';
import Button from '@/components/Button';
import SearchFilter from '@/components/SearchFilter';
import { Building2, Plus, Edit, Trash2, Ban, CheckCircle, Eye } from 'lucide-react';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import ImageUpload from '@/components/ImageUpload';

export default function CentersPage() {
  const { profile } = useAuth();
  const router = useRouter();
  const [centers, setCenters] = useState<Center[]>([]);
  const [filteredCenters, setFilteredCenters] = useState<Center[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCenter, setEditingCenter] = useState<Center | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    location: '',
    image: '',
    leaderName: '',
    leaderEmail: '',
    leaderPassword: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchCenters();
  }, []);

  async function fetchCenters() {
    try {
      const snap = await getDocs(collection(db, 'centers'));
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Center[];
      setCenters(data);
      setFilteredCenters(data);
    } catch (error) {
      console.error('Error fetching centers:', error);
    } finally {
      setLoading(false);
    }
  }

  const handleSearch = (term: string) => {
    if (!term) {
      setFilteredCenters(centers);
      return;
    }
    const lower = term.toLowerCase();
    setFilteredCenters(
      centers.filter(
        (c) =>
          c.name.toLowerCase().includes(lower) ||
          c.leaderName?.toLowerCase().includes(lower) ||
          c.location?.toLowerCase().includes(lower)
      )
    );
  };

  const openCreateModal = () => {
    setEditingCenter(null);
    setFormData({ name: '', location: '', image: '', leaderName: '', leaderEmail: '', leaderPassword: '' });
    setShowModal(true);
  };

  const openEditModal = (center: Center) => {
    setEditingCenter(center);
    setFormData({
      name: center.name,
      location: center.location || '',
      image: center.image || '',
      leaderName: center.leaderName || '',
      leaderEmail: center.leaderEmail || '',
      leaderPassword: '',
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('يرجى إدخال اسم المركز');
      return;
    }

    setSaving(true);
    try {
      const now = new Date().toISOString();

      if (editingCenter) {
        // Update center
        await updateDoc(doc(db, 'centers', editingCenter.id), {
          name: formData.name.trim(),
          location: formData.location.trim(),
          image: formData.image,
          leaderName: formData.leaderName.trim(),
          updatedAt: now,
        });
        toast.success('تم تحديث المركز بنجاح');
      } else {
        // Create center and optionally create leader account
        let leaderId = '';

        if (formData.leaderEmail && formData.leaderPassword) {
          // We need to create the user via a workaround since we can't use Admin SDK
          // We'll create auth user with a secondary auth instance approach
          // For simplicity, we store the data and admin creates user manually
          // or we use client-side createUserWithEmailAndPassword
          const { initializeApp } = await import('firebase/app');
          const { getAuth, createUserWithEmailAndPassword: createUser } = await import('firebase/auth');
          
          // Create a secondary app to avoid signing out current user
          const secondaryApp = initializeApp(
            {
              apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
              authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
              projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
            },
            'secondary-' + Date.now()
          );
          const secondaryAuth = getAuth(secondaryApp);

          try {
            const cred = await createUser(secondaryAuth, formData.leaderEmail.trim(), formData.leaderPassword);
            leaderId = cred.user.uid;
            await secondaryAuth.signOut();
          } finally {
            await (await import('firebase/app')).deleteApp(secondaryApp);
          }
        }

        const centerRef = await addDoc(collection(db, 'centers'), {
          name: formData.name.trim(),
          location: formData.location.trim(),
          image: formData.image,
          leaderId,
          leaderName: formData.leaderName.trim(),
          leaderEmail: formData.leaderEmail.trim(),
          centerNumber: centers.length + 1,
          isBlocked: false,
          createdAt: now,
          updatedAt: now,
          createdBy: profile?.uid || '',
        });

        // Create user profile if leader was created
        if (leaderId) {
          const { setDoc } = await import('firebase/firestore');
          await setDoc(doc(db, 'users', leaderId), {
            uid: leaderId,
            email: formData.leaderEmail.trim(),
            name: formData.leaderName.trim(),
            role: 'center_leader',
            centerId: centerRef.id,
            centerName: formData.name.trim(),
            isBlocked: false,
            createdAt: now,
            updatedAt: now,
            createdBy: profile?.uid || '',
          } as UserProfile);
        }

        toast.success('تم إنشاء المركز بنجاح');
      }

      setShowModal(false);
      fetchCenters();
    } catch (error: any) {
      console.error('Error saving center:', error);
      if (error?.code === 'auth/email-already-in-use') {
        toast.error('البريد الإلكتروني مستخدم بالفعل');
      } else if (error?.code === 'auth/weak-password') {
        toast.error('كلمة المرور ضعيفة - 6 أحرف على الأقل');
      } else {
        toast.error('حدث خطأ أثناء الحفظ');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (center: Center) => {
    if (!confirm(`هل أنت متأكد من حذف المركز "${center.name}"؟`)) return;

    try {
      await deleteDoc(doc(db, 'centers', center.id));
      toast.success('تم حذف المركز');
      fetchCenters();
    } catch (error) {
      console.error('Error deleting center:', error);
      toast.error('حدث خطأ أثناء الحذف');
    }
  };

  const toggleBlock = async (center: Center) => {
    try {
      await updateDoc(doc(db, 'centers', center.id), {
        isBlocked: !center.isBlocked,
        updatedAt: new Date().toISOString(),
      });

      // Also block/unblock the leader
      if (center.leaderId) {
        await updateDoc(doc(db, 'users', center.leaderId), {
          isBlocked: !center.isBlocked,
          updatedAt: new Date().toISOString(),
        });
      }

      toast.success(center.isBlocked ? 'تم إلغاء حظر المركز' : 'تم حظر المركز');
      fetchCenters();
    } catch (error) {
      console.error('Error toggling block:', error);
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
          <h1 className="text-2xl font-bold text-slate-800">المراكز</h1>
          <p className="text-slate-500 mt-1">إدارة المراكز وقادة المراكز</p>
        </div>
        <Button onClick={openCreateModal} icon={<Plus size={18} />}>
          إضافة مركز
        </Button>
      </div>

      <SearchFilter
        searchPlaceholder="بحث باسم المركز أو القائد..."
        onSearch={handleSearch}
      />

      {/* Centers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredCenters.map((center) => (
          <div
            key={center.id}
            className={`bg-white rounded-2xl shadow-sm border p-6 hover:shadow-md transition-shadow animate-fade-in ${
              center.isBlocked ? 'border-red-200 bg-red-50/30' : 'border-slate-100'
            }`}
          >
            {center.image && (
              <img src={center.image} alt={center.name} className="w-full h-32 object-cover rounded-xl mb-4" loading="lazy" />
            )}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl ${center.isBlocked ? 'bg-red-100' : 'bg-primary-50'}`}>
                  <Building2 size={20} className={center.isBlocked ? 'text-red-600' : 'text-primary-600'} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800">{center.name}</h3>
                  {center.location && (
                    <p className="text-xs text-slate-400 mt-0.5">{center.location}</p>
                  )}
                </div>
              </div>
              {center.isBlocked && (
                <span className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded-full">
                  محظور
                </span>
              )}
            </div>

            {center.leaderName && (
              <div className="mb-4 p-3 bg-slate-50 rounded-xl">
                <p className="text-xs text-slate-400">قائد المركز</p>
                <p className="text-sm font-medium text-slate-700">{center.leaderName}</p>
                <p className="text-xs text-slate-400 mt-0.5" dir="ltr">{center.leaderEmail}</p>
              </div>
            )}

            <div className="flex items-center gap-2 flex-wrap">
              <Button variant="ghost" size="sm" onClick={() => openEditModal(center)} icon={<Edit size={14} />}>
                تعديل
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => toggleBlock(center)}
                icon={center.isBlocked ? <CheckCircle size={14} /> : <Ban size={14} />}
              >
                {center.isBlocked ? 'إلغاء الحظر' : 'حظر'}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => handleDelete(center)} icon={<Trash2 size={14} />} className="text-red-500 hover:text-red-700">
                حذف
              </Button>
              <Button variant="ghost" size="sm" onClick={() => router.push(`/admin/centers/${center.id}`)} icon={<Eye size={14} />} className="text-primary-600 hover:text-primary-800">
                دخول المركز
              </Button>
            </div>
          </div>
        ))}
      </div>

      {filteredCenters.length === 0 && (
        <div className="text-center py-12">
          <Building2 size={48} className="text-slate-300 mx-auto mb-4" />
          <p className="text-slate-400">لا توجد مراكز</p>
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingCenter ? 'تعديل المركز' : 'إضافة مركز جديد'}
        size="lg"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">اسم المركز *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="أدخل اسم المركز"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">الموقع</label>
            <input
              type="text"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="أدخل موقع المركز"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">صورة المركز</label>
            <ImageUpload
              images={formData.image ? [formData.image] : []}
              onChange={(imgs) => setFormData({ ...formData, image: imgs[0] || '' })}
              maxImages={1}
            />
          </div>

          <div className="border-t border-slate-100 pt-4">
            <h3 className="text-sm font-bold text-slate-700 mb-3">بيانات قائد المركز</h3>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1.5">اسم القائد</label>
                <input
                  type="text"
                  value={formData.leaderName}
                  onChange={(e) => setFormData({ ...formData, leaderName: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              {!editingCenter && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1.5">البريد الإلكتروني</label>
                    <input
                      type="email"
                      value={formData.leaderEmail}
                      onChange={(e) => setFormData({ ...formData, leaderEmail: e.target.value })}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      dir="ltr"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1.5">كلمة المرور</label>
                    <input
                      type="password"
                      value={formData.leaderPassword}
                      onChange={(e) => setFormData({ ...formData, leaderPassword: e.target.value })}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      dir="ltr"
                      placeholder="6 أحرف على الأقل"
                    />
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button onClick={handleSave} loading={saving}>
              {editingCenter ? 'تحديث' : 'إنشاء'}
            </Button>
            <Button variant="secondary" onClick={() => setShowModal(false)}>
              إلغاء
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
