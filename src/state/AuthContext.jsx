import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "../services/firebase";
import { DB_SCHEMA, getUserDocId } from "../constants/dataSchema";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [initializing, setInitializing] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);

  useEffect(() => {
    return onAuthStateChanged(auth, (firebaseUser) => {
      (async () => {
        try {
          setUser(firebaseUser || null);
          if (firebaseUser) {
            const userDocId = getUserDocId(firebaseUser);
            await setDoc(
              doc(db, DB_SCHEMA.users, userDocId),
              {
                uid: firebaseUser.uid,
                email: firebaseUser.email || "",
                displayName: firebaseUser.displayName || "",
                updatedAt: new Date().toISOString(),
              },
              { merge: true },
            );
            const snap = await getDoc(doc(db, DB_SCHEMA.users, userDocId));
            setProfile(snap.exists() ? snap.data() : null);
          } else {
            setProfile(null);
          }
        } catch (error) {
          console.error("Auth initialization failed:", error);
          setProfile(null);
        } finally {
          setInitializing(false);
        }
      })();
    });
  }, []);

  const value = useMemo(
    () => ({
      user,
      profile,
      initializing,
      authLoading,
      async login({ email, password }) {
        setAuthLoading(true);
        try {
          await signInWithEmailAndPassword(auth, email.trim(), password);
        } finally {
          setAuthLoading(false);
        }
      },
      async signup({ email, password, displayName }) {
        setAuthLoading(true);
        try {
          const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
          const userDocId = getUserDocId(credential.user);
          await setDoc(
            doc(db, DB_SCHEMA.users, userDocId),
            {
              uid: credential.user.uid,
              email: credential.user.email || "",
              displayName: displayName || "",
              createdAt: new Date().toISOString(),
            },
            { merge: true },
          );
        } finally {
          setAuthLoading(false);
        }
      },
      async logout() {
        setAuthLoading(true);
        try {
          await signOut(auth);
        } finally {
          setAuthLoading(false);
        }
      },
    }),
    [authLoading, initializing, profile, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
