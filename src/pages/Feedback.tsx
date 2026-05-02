import { useState, useEffect } from 'react';
import { collection, query, getDocs, addDoc, serverTimestamp, doc, getDoc, setDoc, orderBy, deleteDoc } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { MessageSquare, Send, CheckCircle, Shield, ToggleLeft, ToggleRight, Trash2, Clock, User as UserIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function Feedback({ role }: { role: string }) {
  const [feedbackEnabled, setFeedbackEnabled] = useState(true);
  const [feedbackList, setFeedbackList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    async function fetchFeedbackStatus() {
      try {
        const settingsDoc = await getDoc(doc(db, 'settings', 'global'));
        if (settingsDoc.exists()) {
          setFeedbackEnabled(settingsDoc.data().feedbackEnabled ?? true);
        }
      } catch (err) {
        console.error("Settings fetch error:", err);
      }
    }

    async function fetchFeedback() {
      if (role !== 'admin') {
        setLoading(false);
        return;
      }
      const path = 'feedback';
      try {
        const q = query(collection(db, path), orderBy('submittedAt', 'desc'));
        const snapshot = await getDocs(q);
        setFeedbackList(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (err) {
        handleFirestoreError(err, OperationType.LIST, path);
      } finally {
        setLoading(false);
      }
    }

    fetchFeedbackStatus();
    fetchFeedback();
  }, [role]);

  const handleToggleFeedback = async () => {
    if (role !== 'admin') return;
    try {
      await setDoc(doc(db, 'settings', 'global'), { feedbackEnabled: !feedbackEnabled }, { merge: true });
      setFeedbackEnabled(!feedbackEnabled);
    } catch (err) {
      console.error("Toggle error:", err);
    }
  };

  const handleSubmitFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser || !message.trim()) return;
    setSubmitting(true);
    const path = 'feedback';
    try {
      await addDoc(collection(db, path), {
        userId: auth.currentUser.uid,
        userName: auth.currentUser.displayName || 'Anonymous Student',
        message: message.trim(),
        submittedAt: serverTimestamp()
      });
      setSubmitted(true);
      setMessage('');
      setTimeout(() => setSubmitted(false), 3000);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    } finally {
      setSubmitting(false);
    }
  };

  if (role === 'admin') {
    return (
      <div className="space-y-12 pb-32">
        <section className="bg-gradient-to-r from-[#7c3aed] to-[#5b21b6] text-white p-10 md:p-12 border-4 border-black rounded-[2.5rem] flex flex-col md:flex-row gap-10 items-center justify-between shadow-[16px_16px_0px_rgba(0,0,0,1)] relative overflow-hidden">
          <div className="absolute right-0 top-0 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
          <div className="flex items-center gap-8 relative z-10">
            <div className="w-28 h-28 bg-white rounded-3xl flex items-center justify-center border-4 border-black shadow-[6px_6px_0px_rgba(0,0,0,1)] rotate-6">
              <Shield className="w-16 h-16 text-[#7c3aed]" />
            </div>
            <div>
              <h1 className="text-5xl md:text-7xl font-black uppercase italic tracking-tighter leading-none drop-shadow-[2px_2px_0px_rgba(0,0,0,1)]">Voice Matrix</h1>
              <div className="flex gap-3 mt-4">
                <span className={`text-[10px] font-black uppercase tracking-[0.2em] px-3 py-1 rounded-full border-2 border-black shadow-[2px_2px_0px_rgba(0,0,0,1)] ${feedbackEnabled ? 'bg-[#10b981] text-white' : 'bg-[#f43f5e] text-white'}`}>
                  STATUS: {feedbackEnabled ? 'ACTIVE' : 'LOCKED'}
                </span>
              </div>
            </div>
          </div>

          <button 
            onClick={handleToggleFeedback}
            className={`px-8 py-5 rounded-2xl font-black uppercase tracking-[0.2em] text-sm flex items-center gap-3 border-4 border-black shadow-[8px_8px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all relative z-10 ${
              feedbackEnabled ? 'bg-[#f43f5e] text-white' : 'bg-[#10b981] text-white'
            }`}
          >
            {feedbackEnabled ? (
              <><ToggleRight className="w-6 h-6" /> LOCK CHANNELS</>
            ) : (
              <><ToggleLeft className="w-6 h-6" /> OPEN ACCESS</>
            )}
          </button>
        </section>

        <section>
          <div className="flex items-center justify-between mb-12 pb-4 border-b-8 border-black">
            <h2 className="text-4xl font-black uppercase italic tracking-tighter text-[#0f172a]">User Transmissions</h2>
            <span className="bg-[#7c3aed] text-white px-6 py-2 rounded-full font-black text-xs uppercase tracking-widest border-2 border-black shadow-[4px_4px_0px_rgba(0,0,0,1)]">
              {feedbackList.length} LOGGED
            </span>
          </div>

          {loading ? (
            <div className="text-center py-24 text-3xl font-black uppercase italic animate-pulse text-[#ec4899]">Reading Frequency...</div>
          ) : feedbackList.length === 0 ? (
            <div className="bg-white border-4 border-dashed border-black rounded-[2.5rem] p-24 text-center opacity-20">
              <MessageSquare className="w-20 h-20 mx-auto mb-6" />
              <p className="text-3xl font-black uppercase italic tracking-tight">Dead Air</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {feedbackList.map((item, idx) => {
                const colors = ['bg-[#7c3aed]', 'bg-[#5b21b6]', 'bg-[#8b5cf6]', 'bg-[#0f172a]'];
                return (
                  <motion.div 
                    key={item.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="bg-white border-4 border-black p-8 rounded-[2rem] hover:shadow-[12px_12px_0px_rgba(0,0,0,1)] transition-all flex flex-col gap-6"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 ${colors[idx % colors.length]} text-white border-4 border-black rounded-xl flex items-center justify-center text-xl font-black rotate-3`}>
                          {item.userName?.[0] || 'S'}
                        </div>
                        <div>
                          <p className="text-xl font-black uppercase italic tracking-tighter text-[#1a1a1a] leading-none mb-1">{item.userName}</p>
                          <p className="text-[10px] font-black opacity-30 uppercase tracking-widest">
                            {item.submittedAt?.toDate()?.toLocaleString() || 'RECENT'}
                          </p>
                        </div>
                      </div>
                      <button 
                        onClick={async () => {
                          if (!window.confirm("Delete this feedback?")) return;
                          const path = `feedback/${item.id}`;
                          try {
                            await deleteDoc(doc(db, 'feedback', item.id));
                            setFeedbackList(prev => prev.filter(f => f.id !== item.id));
                          } catch (err) {
                            handleFirestoreError(err, OperationType.DELETE, path);
                          }
                        }}
                        className="p-2 text-gray-300 hover:text-red-500 transition-colors"
                        title="Delete Transmission"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="bg-[#f8fafc] border-4 border-black p-6 rounded-2xl relative">
                      <div className="absolute -left-2 top-4 w-4 h-4 bg-[#f8fafc] border-l-4 border-b-4 border-black rotate-45"></div>
                      <p className="text-lg font-bold leading-tight italic text-gray-800">
                        "{item.message}"
                      </p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    );
  }

  // Student View
  return (
    <div className="max-w-3xl mx-auto py-16 px-4 space-y-12 pb-32">
      <div className="bg-[#7c3aed] text-white p-12 rounded-[2.5rem] border-4 border-black shadow-[12px_12px_0px_rgba(0,0,0,1)] relative overflow-hidden">
        <div className="absolute -right-10 -top-10 w-40 h-40 bg-white/10 rounded-full blur-2xl"></div>
        <div className="relative z-10 space-y-4">
          <h1 className="text-6xl md:text-8xl font-black uppercase italic tracking-tighter leading-none drop-shadow-[4px_4px_0px_rgba(0,0,0,1)]">Signal Out</h1>
          <p className="text-lg font-black uppercase tracking-widest opacity-80 italic">Unfiltered communication to the bridge.</p>
        </div>
      </div>

      {!feedbackEnabled ? (
        <div className="bg-white border-4 border-black p-16 text-center rounded-[2.5rem] shadow-[12px_12px_0px_rgba(0,0,0,1)] relative overflow-hidden">
          <div className="absolute inset-0 bg-[#f43f5e] opacity-5"></div>
          <Shield className="w-20 h-20 mx-auto mb-8 text-[#f43f5e]" />
          <h2 className="text-4xl font-black uppercase italic tracking-tighter mb-4 text-black">Signal Jammed</h2>
          <p className="text-xs font-black uppercase opacity-60 tracking-[0.2em] max-w-xs mx-auto leading-relaxed italic">The supervisors are not currently accepting communications. Try again when the window reopens.</p>
        </div>
      ) : (
        <div className="space-y-10">
          <AnimatePresence>
            {submitted && (
              <motion.div 
                initial={{ height: 0, opacity: 0, scale: 0.9 }}
                animate={{ height: 'auto', opacity: 1, scale: 1 }}
                exit={{ height: 0, opacity: 0, scale: 0.9 }}
                className="bg-[#10b981] text-white p-6 rounded-2xl border-4 border-black shadow-[8px_8px_0px_rgba(0,0,0,1)] flex items-center justify-between font-black uppercase tracking-widest text-xs overflow-hidden"
              >
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-6 h-6 border-2 border-white rounded-full bg-white text-[#10b981]" /> SIGNAL TRANSMITTED AND VERIFIED
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleSubmitFeedback} className="space-y-8 bg-white border-4 border-black p-10 rounded-[2.5rem] shadow-[16px_16px_0px_rgba(0,0,0,1)]">
            <div className="space-y-4">
              <label className="text-xs font-black uppercase tracking-[0.3em] text-[#7c3aed] ml-2">Input Manifest</label>
              <textarea 
                value={message}
                onChange={e => setMessage(e.target.value)}
                required
                placeholder="REPORT ISSUES, COMMANDS, OR GENERAL COGITATIONS..."
                className="w-full bg-[#f8fafc] border-4 border-black p-8 rounded-3xl text-xl font-bold h-64 focus:outline-none focus:bg-white transition-all resize-none shadow-inner italic"
              />
            </div>

            <button 
              type="submit"
              disabled={submitting || !message.trim()}
              className="w-full bg-black text-white py-6 rounded-[1.5rem] flex items-center justify-center gap-4 text-xl font-black uppercase tracking-[0.2em] hover:bg-[#7c3aed] transition-all border-4 border-black shadow-[8px_8px_0px_rgba(0,0,0,1)] active:translate-x-1 active:translate-y-1 active:shadow-none disabled:opacity-20"
            >
              {submitting ? <Clock className="w-8 h-8 animate-spin" /> : (
                <>SEND SIGNAL <Send className="w-8 h-8" /></>
              )}
            </button>
          </form>

          <div className="p-10 bg-black/5 rounded-[2rem] border-4 border-dashed border-black/20 text-center font-bold italic opacity-40 text-xs">
            TRANSCRIPT LOGGED TO PERMANENT RECORD
          </div>
        </div>
      )}
    </div>
  );
}
