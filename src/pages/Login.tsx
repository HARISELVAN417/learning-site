import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { Mail, Lock, ArrowRight, Loader2, User as UserIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function Login() {
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (isRegister) {
        if (!name.trim()) throw new Error('Name is required for registration');
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCredential.user, { displayName: name });
        
        // Create user document
        await setDoc(doc(db, 'users', userCredential.user.uid), {
          name: name,
          email: email,
          role: 'student',
          createdAt: serverTimestamp()
        });
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex flex-col justify-center max-w-md mx-auto py-12">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-[#E4E3E0] border border-[#141414] p-8 shadow-[8px_8px_0px_#141414]"
      >
        <div className="mb-8">
          <h1 className="text-4xl font-black uppercase italic tracking-tighter mb-2">
            {isRegister ? 'Enlist' : 'Login'}
          </h1>
          <p className="text-xs font-mono opacity-50 uppercase tracking-widest">
            {isRegister ? 'Join the institutional pipeline' : 'Access your mission control'}
          </p>
        </div>

        {error && (
          <div className="bg-[#141414] text-[#E4E3E0] p-4 mb-6 text-xs font-mono uppercase tracking-tight border border-[#141414]">
            [ERROR] {error}
          </div>
        )}

        <form onSubmit={handleAuth} className="space-y-6">
          <AnimatePresence mode="wait">
            {isRegister && (
              <motion.div 
                key="name-field"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="space-y-1 overflow-hidden"
              >
                <label className="text-[10px] font-bold uppercase tracking-widest text-[#141414]">Identity Name</label>
                <div className="relative group">
                  <UserIcon className="absolute left-3 top-3 w-4 h-4 opacity-40 group-focus-within:opacity-100 transition-opacity" />
                  <input 
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-white border border-[#141414] pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-black placeholder:opacity-30"
                    placeholder="FULL NAME"
                    required={isRegister}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-widest text-[#141414]">Email Address</label>
            <div className="relative group">
              <Mail className="absolute left-3 top-3 w-4 h-4 opacity-40 group-focus-within:opacity-100 transition-opacity" />
              <input 
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-white border border-[#141414] pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-black placeholder:opacity-30"
                placeholder="developer@lumina.io"
                required
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-widest text-[#141414]">Password</label>
            <div className="relative group">
              <Lock className="absolute left-3 top-3 w-4 h-4 opacity-40 group-focus-within:opacity-100 transition-opacity" />
              <input 
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white border border-[#141414] pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-black placeholder:opacity-30"
                placeholder="********"
                required
              />
            </div>
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-[#141414] text-[#E4E3E0] py-4 flex items-center justify-center gap-2 font-bold uppercase tracking-widest text-sm hover:translate-x-1 hover:-translate-y-1 transition-all disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
              <>
                {isRegister ? 'Create Account' : 'Initiate Session'}
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button 
            onClick={() => setIsRegister(!isRegister)}
            className="text-[10px] font-bold uppercase tracking-widest opacity-60 hover:opacity-100 transition-opacity"
          >
            {isRegister ? 'Already registered? Login here' : 'New student? Enlist profile'}
          </button>
        </div>

        <div className="mt-8 pt-6 border-t border-[#141414] text-center text-[10px] font-bold uppercase tracking-widest opacity-20">
          Lumina Institutional Access
        </div>
      </motion.div>
    </div>
  );
}
