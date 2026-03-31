// ===================================
// سكربت تهيئة حساب المدير الأعلى
// Run: npx ts-node scripts/init-admin.ts
// أو: npx tsx scripts/init-admin.ts
// ===================================
// يجب إنشاء ملف .env.local أولاً بمتغيرات Firebase

import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, setDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyD7M9l_HGu7F4Xm7N3_N9II6Kbvs95lSL8',
  authDomain: 'risalamnt2atnye-c77f8.firebaseapp.com',
  projectId: 'risalamnt2atnye-c77f8',
  storageBucket: 'risalamnt2atnye-c77f8.firebasestorage.app',
  messagingSenderId: '1035914010394',
  appId: '1:1035914010394:web:55339820ef5e62ccc256a3',
};

// ---- غيّر هذه البيانات ----
const ADMIN_EMAIL = 'admin@risala.com';
const ADMIN_PASSWORD = 'Admin@123456';
const ADMIN_NAME = 'فضل عاصي قائد المنطقة الثانية';
// ----------------------------

async function main() {
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);

  if (!firebaseConfig.apiKey) {
    console.error('❌ لم يتم العثور على متغيرات Firebase. تأكد من تعبئة firebaseConfig');
    process.exit(1);
  }

  try {
    console.log('🔄 جاري إنشاء حساب قائد المنطقة...');

    const cred = await createUserWithEmailAndPassword(auth, ADMIN_EMAIL, ADMIN_PASSWORD);
    const uid = cred.user.uid;

    await setDoc(doc(db, 'users', uid), {
      uid,
      email: ADMIN_EMAIL,
      name: ADMIN_NAME,
      role: 'superadmin',
      isBlocked: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    console.log('✅ تم إنشاء حساب قائد المنطقة بنجاح!');
    console.log(`   البريد: ${ADMIN_EMAIL}`);
    console.log(`   كلمة المرور: ${ADMIN_PASSWORD}`);
    console.log(`   UID: ${uid}`);
    process.exit(0);
  } catch (error: any) {
    if (error.code === 'auth/email-already-in-use') {
      console.log('⚠️ الحساب موجود بالفعل، جاري تسجيل الدخول وإنشاء بيانات Firestore...');
      try {
        const cred = await signInWithEmailAndPassword(auth, ADMIN_EMAIL, ADMIN_PASSWORD);
        const uid = cred.user.uid;
        await setDoc(doc(db, 'users', uid), {
          uid,
          email: ADMIN_EMAIL,
          name: ADMIN_NAME,
          role: 'superadmin',
          isBlocked: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        console.log('✅ تم إنشاء بيانات قائد المنطقة بنجاح!');
        console.log(`   البريد: ${ADMIN_EMAIL}`);
        console.log(`   كلمة المرور: ${ADMIN_PASSWORD}`);
        console.log(`   UID: ${uid}`);
        process.exit(0);
      } catch (e: any) {
        console.error('❌ خطأ:', e.message);
        process.exit(1);
      }
    } else {
      console.error('❌ خطأ:', error.message);
    }
    process.exit(1);
  }
}

main();
