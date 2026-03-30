'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, User } from 'firebase/auth';
import { doc, getDoc, addDoc, collection, updateDoc, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from './firebase';
import { UserProfile } from './types';
import { logAudit, parseUserAgent, getClientIP } from './audit';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  login: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionId, setSessionId] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        try {
          const docRef = doc(db, 'users', firebaseUser.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data() as UserProfile;
            if (data.isBlocked) {
              await signOut(auth);
              setUser(null);
              setProfile(null);
            } else {
              setProfile({ ...data, uid: firebaseUser.uid });
            }
          }
        } catch (error) {
          console.error('Error fetching user profile:', error);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  /* ── Mark session inactive on unmount / tab close ─── */
  useEffect(() => {
    if (!sessionId) return;
    const markInactive = () => {
      if (sessionId) {
        // navigator.sendBeacon is fire-and-forget
        updateDoc(doc(db, 'loginSessions', sessionId), { isActive: false, lastActiveAt: new Date().toISOString() }).catch(() => {});
      }
    };
    window.addEventListener('beforeunload', markInactive);
    return () => window.removeEventListener('beforeunload', markInactive);
  }, [sessionId]);

  const login = async (email: string, password: string) => {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const docRef = doc(db, 'users', cred.user.uid);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data() as UserProfile;
      if (data.isBlocked) {
        await signOut(auth);
        throw new Error('تم حظر حسابك. تواصل مع المسؤول.');
      }
      if (data.role === 'center_leader' && data.centerId) {
        const centerDoc = await getDoc(doc(db, 'centers', data.centerId));
        if (centerDoc.exists() && centerDoc.data().isBlocked) {
          await signOut(auth);
          throw new Error('تم حظر المركز الخاص بك. تواصل مع المسؤول.');
        }
      }

      const p: UserProfile = { ...data, uid: cred.user.uid };

      /* ── Record login session (fire-and-forget) ─── */
      recordLoginSession(p);
      logAudit(p, 'login', 'auth', `تسجيل دخول: ${p.name} (${p.role})`);
    }
  };

  /** Create a loginSessions document with device info, deactivate old sessions. */
  const recordLoginSession = async (p: UserProfile) => {
    try {
      const ua = navigator.userAgent;
      const { deviceType, browser, os } = parseUserAgent(ua);
      const ip = await getClientIP();
      const now = new Date().toISOString();

      // Deactivate prior sessions for this user
      const oldSnap = await getDocs(query(collection(db, 'loginSessions'), where('userId', '==', p.uid), where('isActive', '==', true)));
      const batch: Promise<void>[] = [];
      oldSnap.docs.forEach(d => batch.push(updateDoc(doc(db, 'loginSessions', d.id), { isActive: false, lastActiveAt: now })));
      await Promise.all(batch);

      const ref = await addDoc(collection(db, 'loginSessions'), {
        userId: p.uid,
        userName: p.name,
        userRole: p.role,
        centerId: p.centerId || '',
        centerName: p.centerName || '',
        ip,
        userAgent: ua,
        deviceType,
        browser,
        os,
        loginAt: now,
        lastActiveAt: now,
        isActive: true,
      });
      setSessionId(ref.id);
    } catch {
      // Silent — never block the login
    }
  };

  const logout = async () => {
    if (profile) logAudit(profile, 'logout', 'auth', `تسجيل خروج: ${profile.name}`);
    if (sessionId) {
      updateDoc(doc(db, 'loginSessions', sessionId), { isActive: false, lastActiveAt: new Date().toISOString() }).catch(() => {});
      setSessionId(null);
    }
    await signOut(auth);
    setUser(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
