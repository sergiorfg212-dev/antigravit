import React, { useState } from 'react';
import { useAppStore } from '../../hooks/useAppStore';
import { db as ddb, getLocalFallbackMode, setLocalFallbackMode, initializeFirestoreListeners } from '../../lib/db';
import { auth, db as fdb } from '../../lib/firebase';
import { Button } from '../ui/button';
import { ShieldAlert, LogIn, UserPlus, Mail, ArrowLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  getDoc,
  serverTimestamp
} from 'firebase/firestore';
import { syncLocalStorageWithCloud } from '../../lib/sync';

export function AuthModule() {
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [showConfigHelp, setShowConfigHelp] = useState(false);
  const [errorType, setErrorType] = useState<string>('');
  
  // Password recovery states
  const [recoveryEmail, setRecoveryEmail] = useState('');

  const { setCurrentUser, setIsAdminMode } = useAppStore();

  const handleGoogleLogin = async () => {
    setLoading(true);
    setShowConfigHelp(false);
    setErrorType('');
    try {
      const provider = new GoogleAuthProvider();
      const userCredential = await signInWithPopup(auth, provider);
      const fbUser = userCredential.user;

      // Fetch or create user profile in Firestore
      const userDocRef = doc(fdb, 'users', fbUser.uid);
      let userDocSnap: any = null;
      let userProfile: any = null;

      const isInitiallyFallback = getLocalFallbackMode();

      if (!isInitiallyFallback) {
        try {
          userDocSnap = await getDoc(userDocRef);
          if (userDocSnap.exists()) {
            userProfile = userDocSnap.data();
          }
        } catch (getDocError: any) {
          const errMsg = (getDocError?.message || String(getDocError)).toLowerCase();
          const errCode = (getDocError?.code || String(getDocError?.code || '')).toLowerCase();
          if (
            errMsg.includes('quota') || 
            errMsg.includes('resource-exhausted') || 
            errMsg.includes('exhausted') || 
            errMsg.includes('quota_exceeded') ||
            errCode.includes('quota') ||
            errCode.includes('resource-exhausted') ||
            errCode.includes('quota_exceeded')
          ) {
            setLocalFallbackMode(true);
            window.dispatchEvent(new CustomEvent('nom030-db-quota-exhausted'));
          }
          console.warn("No se pudo obtener el documento del usuario desde Firestore (modo desconectado u offline):", getDocError);
        }
      }

      if (!userProfile) {
        // Fallback a localStorage
        try {
          const stored = localStorage.getItem(`nom030_fallback_users_${fbUser.uid}`);
          if (stored) {
            const parsed = JSON.parse(stored);
            if (parsed && parsed.length > 0) {
              userProfile = parsed[0];
            }
          }
        } catch (e) {}
      }

      if (!userProfile) {
        const isMasterAdmin = fbUser.email?.trim().toLowerCase() === 'sergio.rfg212@gmail.com';
        userProfile = {
          uid: fbUser.uid,
          name: fbUser.displayName || fbUser.email?.split('@')[0] || 'Asesor Técnico',
          email: fbUser.email,
          role: isMasterAdmin ? 'admin' : 'user',
          isBlocked: false,
          createdAt: new Date()
        };
      }

      const isMasterAdmin = fbUser.email?.trim().toLowerCase() === 'sergio.rfg212@gmail.com';
      if (userProfile.role === 'admin' && !isMasterAdmin) {
        userProfile.role = 'user';
      }

      if (!getLocalFallbackMode()) {
        try {
          await setDoc(userDocRef, {
            ...userProfile,
            createdAt: serverTimestamp()
          });
        } catch (setDocError: any) {
          const errMsg = (setDocError?.message || String(setDocError)).toLowerCase();
          const errCode = (setDocError?.code || String(setDocError?.code || '')).toLowerCase();
          if (
            errMsg.includes('quota') || 
            errMsg.includes('resource-exhausted') || 
            errMsg.includes('exhausted') || 
            errMsg.includes('quota_exceeded') ||
            errCode.includes('quota') ||
            errCode.includes('resource-exhausted') ||
            errCode.includes('quota_exceeded')
          ) {
            setLocalFallbackMode(true);
            window.dispatchEvent(new CustomEvent('nom030-db-quota-exhausted'));
          }
          console.warn('No se pudo respaldar perfil online:', setDocError);
        }
      }

      try {
        localStorage.setItem(`nom030_fallback_users_${fbUser.uid}`, JSON.stringify([userProfile]));
      } catch (e) {}

      if (userProfile.isBlocked) {
        toast.error('Esta cuenta ha sido bloqueada por el Administrador.');
        await auth.signOut();
        setLoading(false);
        return;
      }

      const syncToastId = toast.loading("Sincronizando sus datos con la nube de forma segura de doble vía...");
      try {
        const { pushedCount, pulledCount } = await syncLocalStorageWithCloud(fbUser.uid);
        if (pushedCount > 0) {
          toast.success(`¡Sincronización exitosa! Se subieron ${pushedCount} registros locales y se descargaron los datos actualizados.`);
        } else {
          toast.success("¡Datos sincronizados exitosamente con la nube!");
        }
      } catch (syncErr) {
        console.error("Error during initial cloud bidirectional sync:", syncErr);
        toast.warning("Inició sesión, pero no se pudo realizar la sincronización bidireccional completa (Modo Fuera de Línea).");
      } finally {
        toast.dismiss(syncToastId);
      }

      // Local db persistence for backwards compatibility
      const dexieUserObj = {
        name: userProfile.name,
        email: userProfile.email || fbUser.email || '',
        passwordHash: btoa('google_auth_provider'),
        role: userProfile.role,
        createdAt: new Date()
      };

      // Load user configurations if present
      if (userProfile.settings) {
        if (userProfile.settings.currentCompanyId !== undefined) {
          useAppStore.getState().setCurrentCompanyId(userProfile.settings.currentCompanyId);
        }
        if (userProfile.settings.activeTab !== undefined) {
          useAppStore.getState().setActiveTab(userProfile.settings.activeTab);
        }
      }

      setCurrentUser(dexieUserObj);
      const isMasterAdminUser = (userProfile.email || fbUser.email || '').trim().toLowerCase() === 'sergio.rfg212@gmail.com';
      setIsAdminMode(userProfile.role === 'admin' && isMasterAdminUser);
      toast.success(`¡Bienvenido, ${userProfile.name}!`);

    } catch (error: any) {
      console.error(error);
      if (error.code === 'auth/operation-not-allowed') {
        setShowConfigHelp(true);
        setErrorType('auth/operation-not-allowed');
        toast.error('Google Sign-In no está activo o permitido en tu consola de Firebase.');
      } else if (error.code === 'auth/unauthorized-domain') {
        setErrorType('auth/unauthorized-domain');
        toast.error('Dominio no autorizado para usar Firebase Auth. Revisa la guía en pantalla.');
      } else if (error.code === 'auth/invalid-credential') {
        setErrorType('auth/invalid-credential');
        toast.error('Credencial de Firebase no válida o rechazada.');
      } else {
        toast.error(error.message || 'Error al iniciar sesión con Google.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLocalOnlyLogin = () => {
    const localUser = {
      name: "Asesor Local (Sin Conexión)",
      email: "local.user@nom030.com",
      role: "user" as const,
      createdAt: new Date()
    };
    
    try {
      localStorage.setItem('nom030_use_local_only', 'true');
      localStorage.setItem('nom030_local_user', JSON.stringify(localUser));
    } catch (e) {}

    setLocalFallbackMode(true);
    initializeFirestoreListeners("local_user_uid", localUser.email);
    
    setCurrentUser(localUser);
    setIsAdminMode(false);
    
    toast.success("¡Ingresaste en Modo Local! Los cambios se guardarán en tu navegador de forma segura.");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setShowConfigHelp(false);
    setErrorType('');

    if (!email || !password) {
      toast.error('Por favor ingresa correo y contraseña.');
      return;
    }

    setLoading(true);

    try {
      if (mode === 'login') {
        const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
        const fbUser = userCredential.user;

        // Fetch user profile from Firestore with local fallback if offline
        const userDocRef = doc(fdb, 'users', fbUser.uid);
        let userProfile: any = null;

        const isInitiallyFallback = getLocalFallbackMode();

        if (!isInitiallyFallback) {
          try {
            const userDocSnap = await getDoc(userDocRef);
            if (userDocSnap.exists()) {
              userProfile = userDocSnap.data();
              const isMasterAdmin = fbUser.email?.trim().toLowerCase() === 'sergio.rfg212@gmail.com';
              if (userProfile.role === 'admin' && !isMasterAdmin) {
                userProfile.role = 'user';
              }
            } else {
              // If profile does not exist in Firestore yet (legacy or auto-migration), create it now
              const isMasterAdmin = fbUser.email?.trim().toLowerCase() === 'sergio.rfg212@gmail.com';
              userProfile = {
                uid: fbUser.uid,
                name: fbUser.displayName || fbUser.email?.split('@')[0] || 'Asesor Técnico',
                email: fbUser.email,
                role: isMasterAdmin ? 'admin' : 'user',
                isBlocked: false,
                createdAt: new Date()
              };
              
              if (!getLocalFallbackMode()) {
                await setDoc(userDocRef, {
                  ...userProfile,
                  createdAt: serverTimestamp()
                }).catch((setDocError: any) => {
                  const errMsg = (setDocError?.message || String(setDocError)).toLowerCase();
                  const errCode = (setDocError?.code || String(setDocError?.code || '')).toLowerCase();
                  if (
                    errMsg.includes('quota') || 
                    errMsg.includes('resource-exhausted') || 
                    errMsg.includes('exhausted') || 
                    errMsg.includes('quota_exceeded') ||
                    errCode.includes('quota') ||
                    errCode.includes('resource-exhausted') ||
                    errCode.includes('quota_exceeded')
                  ) {
                    setLocalFallbackMode(true);
                    window.dispatchEvent(new CustomEvent('nom030-db-quota-exhausted'));
                  }
                  console.warn('No se pudo respaldar perfil online:', setDocError);
                });
              }
            }
          } catch (fetchErr: any) {
            console.warn('No se pudo recuperar el perfil de Firestore por límites de conexión u offline:', fetchErr);
            const errMsg = (fetchErr?.message || String(fetchErr)).toLowerCase();
            const errCode = (fetchErr?.code || String(fetchErr?.code || '')).toLowerCase();
            if (
              errMsg.includes('quota') || 
              errMsg.includes('resource-exhausted') || 
              errMsg.includes('exhausted') || 
              errMsg.includes('quota_exceeded') ||
              errCode.includes('quota') ||
              errCode.includes('resource-exhausted') ||
              errCode.includes('quota_exceeded')
            ) {
              setLocalFallbackMode(true);
              window.dispatchEvent(new CustomEvent('nom030-db-quota-exhausted'));
            }
          }
        }

        if (!userProfile) {
          // Fallback a los datos locales en Dexie o localStorage
          let localUsers: any[] = [];
          try {
            localUsers = await ddb.users.toArray();
          } catch (dexieErr) {
            console.error('Error leyendo usuarios de Dexie:', dexieErr);
          }

          if (localUsers.length > 0 && localUsers[0].email === fbUser.email) {
            const localUser = localUsers[0];
            const isMasterAdmin = fbUser.email?.trim().toLowerCase() === 'sergio.rfg212@gmail.com';
            userProfile = {
              uid: fbUser.uid,
              name: localUser.name,
              email: localUser.email,
              role: (localUser.role === 'admin' && !isMasterAdmin) ? 'user' : (localUser.role || 'user'),
              isBlocked: localUser.isBlocked || false,
              createdAt: localUser.createdAt
            };
          } else {
            // Also try fallback localStorage
            try {
              const stored = localStorage.getItem(`nom030_fallback_users_${fbUser.uid}`);
              if (stored) {
                const parsed = JSON.parse(stored);
                if (parsed && parsed.length > 0) {
                  userProfile = parsed[0];
                }
              }
            } catch (e) {}

            if (!userProfile) {
              const isMasterAdmin = fbUser.email?.trim().toLowerCase() === 'sergio.rfg212@gmail.com';
              userProfile = {
                uid: fbUser.uid,
                name: fbUser.displayName || fbUser.email?.split('@')[0] || 'Asesor Técnico',
                email: fbUser.email,
                role: isMasterAdmin ? 'admin' : 'user',
                isBlocked: false,
                createdAt: new Date()
              };
            }
          }
        }

        // Save to localStorage users
        try {
          localStorage.setItem(`nom030_fallback_users_${fbUser.uid}`, JSON.stringify([userProfile]));
        } catch (e) {}

        // Check if user is blocked
        if (userProfile.isBlocked) {
          toast.error('Esta cuenta ha sido bloqueada por el Administrador.');
          await auth.signOut();
          setLoading(false);
          return;
        }

        // Synchronize all user other collections data with cloud bidirectional sync
        const syncToastId = toast.loading("Sincronizando sus datos con la nube de forma segura de doble vía...");
        try {
          const { pushedCount, pulledCount } = await syncLocalStorageWithCloud(fbUser.uid);
          if (pushedCount > 0) {
            toast.success(`¡Sincronización exitosa! Se subieron ${pushedCount} registros locales y se descargaron los datos actualizados.`);
          } else {
            toast.success("¡Datos sincronizados exitosamente con la nube!");
          }
        } catch (syncErr) {
          console.error("Error during initial cloud bidirectional sync:", syncErr);
          toast.warning("Inició sesión, pero no se pudo realizar la sincronización bidireccional completa (Modo Fuera de Línea).");
        } finally {
          toast.dismiss(syncToastId);
        }

        // Store user in local Dexie database for backwards compatibility
        const dexieUserObj = {
          name: userProfile.name,
          email: userProfile.email,
          passwordHash: btoa(password),
          role: userProfile.role,
          createdAt: new Date()
        };

        // Load user configurations if present
        if (userProfile.settings) {
          if (userProfile.settings.currentCompanyId !== undefined) {
            useAppStore.getState().setCurrentCompanyId(userProfile.settings.currentCompanyId);
          }
          if (userProfile.settings.activeTab !== undefined) {
            useAppStore.getState().setActiveTab(userProfile.settings.activeTab);
          }
        }

        setCurrentUser(dexieUserObj);
        
        const isMasterAdmin = userProfile.role === 'admin' && (userProfile.email || fbUser.email || '').trim().toLowerCase() === 'sergio.rfg212@gmail.com';
        setIsAdminMode(isMasterAdmin);
        toast.success(`¡Bienvenido de vuelta, ${userProfile.name}!`);

      } else {
        // Registering a new account
        if (!name) {
          toast.error('Por favor ingresa tu nombre completo.');
          setLoading(false);
          return;
        }

        const isMasterAdmin = email.trim().toLowerCase() === 'sergio.rfg212@gmail.com';
        const determinedRole = isMasterAdmin ? 'admin' : 'user';

        // 1. Create in Firebase Auth
        const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
        const fbUser = userCredential.user;

        // 2. Create profile doc in Firestore
        const userDocRef = doc(fdb, 'users', fbUser.uid);
        const userProfile = {
          uid: fbUser.uid,
          name: name.trim(),
          email: fbUser.email?.trim().toLowerCase() || email.trim().toLowerCase(),
          role: determinedRole,
          isBlocked: false,
          createdAt: new Date()
        };
        
        if (!getLocalFallbackMode()) {
          try {
            await setDoc(userDocRef, {
              ...userProfile,
              createdAt: serverTimestamp()
            });
          } catch (setDocError: any) {
            const errMsg = (setDocError?.message || String(setDocError)).toLowerCase();
            const errCode = (setDocError?.code || String(setDocError?.code || '')).toLowerCase();
            if (
              errMsg.includes('quota') || 
              errMsg.includes('resource-exhausted') || 
              errMsg.includes('exhausted') || 
              errMsg.includes('quota_exceeded') ||
              errCode.includes('quota') ||
              errCode.includes('resource-exhausted') ||
              errCode.includes('quota_exceeded')
            ) {
              setLocalFallbackMode(true);
              window.dispatchEvent(new CustomEvent('nom030-db-quota-exhausted'));
            }
            console.warn('No se pudo respaldar el perfil online durante registro:', setDocError);
          }
        }

        // Save locally to localStorage so offline works instantly
        try {
          localStorage.setItem(`nom030_fallback_users_${fbUser.uid}`, JSON.stringify([userProfile]));
        } catch (e) {}

        // 3. Put user locally in Dexie database
        const dexieUserObj = {
          name: userProfile.name,
          email: userProfile.email,
          passwordHash: btoa(password),
          role: userProfile.role as 'admin' | 'user',
          createdAt: new Date()
        };

        setCurrentUser(dexieUserObj);
        setIsAdminMode(determinedRole === 'admin');

        toast.success(
          determinedRole === 'admin' 
            ? 'Cuenta de Administrador Principal creada en la nube de forma segura. ¡Bienvenido!' 
            : 'Cuenta de Asesor Técnico registrada exitosamente en la nube. ¡Bienvenido!'
        );
      }
    } catch (error: any) {
      console.error(error);
      let errorMsg = 'Ocurrió un error al procesar tu solicitud.';
      if (error.code === 'auth/operation-not-allowed') {
        setShowConfigHelp(true);
        setErrorType('auth/operation-not-allowed');
        errorMsg = 'El inicio de sesión por Correo/Contraseña aún no está activo en tu consola de Firebase. Revisa las instrucciones en pantalla.';
      } else if (error.code === 'auth/unauthorized-domain') {
        setErrorType('auth/unauthorized-domain');
        errorMsg = 'Este dominio no está autorizado para usar Firebase Auth. Sigue las instrucciones de la alerta abajo.';
      } else if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        setErrorType('auth/invalid-credential');
        errorMsg = 'Correo o contraseña incorrectos, o problemas con tus credenciales de Firebase.';
      } else if (error.code === 'auth/email-already-in-use') {
        errorMsg = 'Ya existe una cuenta con este correo electrónico en la nube.';
      } else if (error.code === 'auth/weak-password') {
        errorMsg = 'La contraseña es muy débil (debe tener al menos 6 caracteres).';
      } else if (error.code === 'auth/invalid-email') {
        errorMsg = 'El formato de correo electrónico no es válido.';
      } else {
        errorMsg = error.message || errorMsg;
      }
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleStartRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    setShowConfigHelp(false);
    setErrorType('');
    if (!recoveryEmail) {
      toast.error('Por favor ingresa un correo electrónico.');
      return;
    }

    setLoading(true);

    try {
      // Direct integration with secure native Firebase Auth reset password
      await sendPasswordResetEmail(auth, recoveryEmail.trim());
      toast.success(`Se ha enviado un correo seguro para restablecer contraseña a: ${recoveryEmail}. Revise su bandeja de entrada.`);
      setMode('login');
      setEmail(recoveryEmail);
    } catch (error: any) {
      console.error(error);
      let errorMsg = 'Ocurrió un error al enviar el correo.';
      if (error.code === 'auth/user-not-found') {
        errorMsg = 'No se encontró ninguna cuenta registrada de este correo.';
      } else if (error.code === 'auth/unauthorized-domain') {
        setErrorType('auth/unauthorized-domain');
        errorMsg = 'Este dominio no está autorizado para usar Firebase Auth. Sigue las instrucciones de la alerta abajo.';
      } else if (error.code === 'auth/operation-not-allowed') {
        setErrorType('auth/operation-not-allowed');
        setShowConfigHelp(true);
        errorMsg = 'El restablecimiento de contraseña u operaciones por correo no están permitidos en esta consola de Firebase.';
      } else {
        errorMsg = error.message || errorMsg;
      }
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 selection:bg-blue-100 selection:text-blue-900">
      <div className="bg-white rounded-3xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200 focus-within:ring-4 ring-blue-500/10 transition-shadow">
        <div className="bg-blue-600 p-8 text-center text-white">
          <div className="bg-white/20 w-16 h-16 rounded-2xl mx-auto flex items-center justify-center mb-4 backdrop-blur-md">
            <ShieldAlert className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-black tracking-tight mb-1">Diagnóstico NOM-030</h1>
          <p className="text-blue-100 text-sm font-medium">Plataforma de Cumplimiento STPS Multidispositivo</p>
        </div>

        <div className="p-8">


          {mode === 'login' || mode === 'register' ? (
            <>
              <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                {mode === 'login' ? <LogIn className="w-5 h-5 text-blue-500" /> : <UserPlus className="w-5 h-5 text-blue-500" />}
                {mode === 'login' ? 'Iniciar Sesión en la Nube' : 'Crear Cuenta en la Nube'}
              </h2>

              <form onSubmit={handleSubmit} className="space-y-4">
                {mode === 'register' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Nombre Completo</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow placeholder:text-slate-400 font-medium"
                      placeholder="Juan Pérez"
                      disabled={loading}
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Correo Electrónico</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow placeholder:text-slate-400 font-medium"
                    placeholder="juan.perez@empresa.com"
                    required
                    disabled={loading}
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest leading-none">Contraseña</label>
                    {mode === 'login' && (
                      <button
                        type="button"
                        onClick={() => {
                          setRecoveryEmail(email);
                          setMode('forgot');
                        }}
                        className="text-xs font-semibold text-blue-600 hover:text-blue-700 leading-none focus:outline-none"
                        disabled={loading}
                      >
                        ¿Olvidaste tu contraseña?
                      </button>
                    )}
                  </div>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow placeholder:text-slate-400 font-medium"
                    placeholder="••••••••"
                    required
                    disabled={loading}
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full py-6 text-sm font-bold tracking-wide uppercase bg-blue-600 hover:bg-blue-700 text-white rounded-xl mt-4 flex justify-center items-center gap-2"
                  disabled={loading}
                >
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {mode === 'login' ? 'Ingresar a Plataforma' : 'Registrar Cuenta'}
                </Button>
              </form>

              <div className="relative my-6 select-none">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200" />
                </div>
                <div className="relative flex justify-center text-xs uppercase font-bold tracking-widest text-slate-400">
                  <span className="bg-white px-3">O ingresa rápido</span>
                </div>
              </div>

              <div className="space-y-3">
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={loading}
                  className="w-full bg-white hover:bg-slate-50 text-slate-700 font-bold py-3.5 px-4 border border-slate-300 rounded-xl shadow-sm hover:shadow transition-all flex items-center justify-center gap-3 text-sm focus:ring-4 focus:ring-slate-100 disabled:opacity-50 cursor-pointer"
                >
                  <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                  Iniciar sesión con Google
                </button>

                <button
                  type="button"
                  onClick={handleLocalOnlyLogin}
                  disabled={loading}
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3.5 px-4 rounded-xl shadow-sm hover:shadow transition-all flex items-center justify-center gap-3 text-sm focus:ring-4 focus:ring-slate-100 disabled:opacity-50 cursor-pointer mt-2"
                >
                  <ShieldAlert className="w-5 h-5 text-amber-400" />
                  Acceder en Modo 100% Local (Sin Firebase)
                </button>
              </div>

              <div className="mt-8 text-center">
                <button
                  type="button"
                  onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
                  className="text-sm font-bold text-slate-500 hover:text-blue-600 transition-colors"
                  disabled={loading}
                >
                  {mode === 'login' ? '¿No tienes cuenta? Regístrate aquí' : '¿Ya tienes cuenta? Inicia sesión'}
                </button>
              </div>
            </>
          ) : (
            <>
              <h2 className="text-xl font-bold text-slate-800 mb-3 flex items-center gap-2">
                <Mail className="w-5 h-5 text-blue-500" />
                Recuperar Acceso
              </h2>
              <p className="text-slate-500 text-xs mb-6 font-medium leading-relaxed">
                Ingresa tu correo electrónico registrado y te enviaremos de inmediato un enlace para restablecer tu contraseña directamente desde Firebase.
              </p>

              <form onSubmit={handleStartRecovery} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Correo Electrónico Registrado</label>
                  <input
                    type="email"
                    value={recoveryEmail}
                    onChange={(e) => setRecoveryEmail(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow placeholder:text-slate-400 font-medium"
                    placeholder="ejemplo@correo.com"
                    required
                    disabled={loading}
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full py-6 text-sm font-bold tracking-wide uppercase bg-blue-600 hover:bg-blue-700 text-white rounded-xl mt-4 flex justify-center items-center gap-2"
                  disabled={loading}
                >
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Enviar Correo de Recuperación
                </Button>
              </form>



              <div className="mt-6 text-center">
                <button
                  onClick={() => setMode('login')}
                  className="text-sm font-bold text-slate-500 hover:text-blue-600 transition-colors flex items-center justify-center gap-1 mx-auto"
                  disabled={loading}
                >
                  <ArrowLeft className="w-4 h-4" /> Cancelar y regresar
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
