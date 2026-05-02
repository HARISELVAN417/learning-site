import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, addDoc, serverTimestamp, doc, deleteDoc } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { Plus, Book, Users, Trash2, Edit, ArrowRight, Loader2, LayoutDashboard, FileText, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';

interface Course {
  id: string;
  title: string;
  description: string;
  instructorId: string;
}

export default function AdminDashboard() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newCourse, setNewCourse] = useState({ title: '', description: '' });
  const [creating, setCreating] = useState(false);

  const fetchAdminCourses = async () => {
    if (!auth.currentUser) return;
    setLoading(true);
    try {
      const q = query(collection(db, 'courses'), where('instructorId', '==', auth.currentUser.uid));
      const snapshot = await getDocs(q);
      setCourses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Course)));
    } catch (error) {
      console.error("Admin fetch error:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminCourses();
  }, [auth.currentUser?.uid]);

  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;
    setCreating(true);
    try {
      const docRef = await addDoc(collection(db, 'courses'), {
        ...newCourse,
        instructorId: auth.currentUser.uid,
        createdAt: serverTimestamp()
      });
      setCourses(prev => [...prev, { id: docRef.id, ...newCourse, instructorId: auth.currentUser!.uid }]);
      setShowCreateModal(false);
      setNewCourse({ title: '', description: '' });
    } catch (error) {
      console.error("Create error:", error);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-12 pb-24">
      {/* Admin Header */}
      <section className="bg-white p-8 md:p-10 border border-slate-100 rounded-[2.5rem] flex flex-col md:flex-row gap-8 items-center justify-between shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-64 h-64 bg-purple-50 rounded-full blur-3xl -mr-20 -mt-20"></div>
        <div className="flex items-center gap-6 relative z-10">
          <div className="w-16 h-16 bg-purple-600 rounded-3xl flex items-center justify-center shadow-lg shadow-purple-200">
            <LayoutDashboard className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
              Operations Hub
            </h1>
            <div className="flex gap-4 mt-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Privileged Access</span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600 bg-purple-50 px-3 py-0.5 rounded-full">INSTRUCTOR</span>
            </div>
          </div>
          <button 
            onClick={fetchAdminCourses}
            disabled={loading}
            className="p-2 text-slate-400 hover:text-purple-600 hover:bg-slate-50 rounded-xl transition-all"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <button 
          onClick={() => setShowCreateModal(true)}
          className="bg-[#facc15] text-black px-8 py-5 rounded-2xl font-black uppercase tracking-[0.2em] text-lg shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all flex items-center gap-3 relative z-10 active:scale-[0.98]"
        >
          <Plus className="w-6 h-6" /> Deploy Module
        </button>
      </section>

      {/* Course List */}
      <section>
        <div className="flex items-center justify-between mb-12 pb-6 border-b border-slate-100">
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Asset Management</h2>
          <span className="bg-purple-600 text-white px-4 py-1.5 rounded-full font-bold text-[10px] uppercase tracking-widest shadow-lg shadow-purple-100">
            {courses.length} ACTIVE MODULES
          </span>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
            {[1, 2].map(i => <div key={i} className="h-80 bg-gray-50 border border-gray-100 rounded-[2rem] animate-pulse"></div>)}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
            {courses.map((course, idx) => {
               const colors = ['bg-[#7c3aed]', 'bg-[#5b21b6]', 'bg-[#4c1d95]', 'bg-[#2e1065]'];
               return (
                <div key={course.id} className={`${colors[idx % colors.length]} p-8 rounded-[2rem] shadow-lg hover:shadow-xl hover:translate-y-[-4px] transition-all text-white group relative border border-white/5`}>
                  <div className="space-y-6 mb-12">
                    <div className="bg-white/10 w-12 h-12 flex items-center justify-center rounded-xl border border-white/20 font-black text-xl italic">
                      {idx + 1}
                    </div>
                    <div>
                      <h3 className="text-3xl font-black uppercase italic tracking-tighter leading-tight mb-2">{course.title}</h3>
                      <p className="text-xs font-bold leading-relaxed uppercase opacity-70 line-clamp-2 italic">{course.description}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 pt-6 border-t border-white/10">
                    <Link to={`/courses/${course.id}`} className="flex-1 text-center bg-white text-black py-4 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm hover:bg-gray-50 transition-all">
                      Configure
                    </Link>
                    <Link to={`/admin/reports/${course.id}`} className="p-4 bg-white/10 text-white rounded-xl hover:bg-white/20 transition-all" title="Review Data">
                      <Users className="w-5 h-5" />
                    </Link>
                    <button 
                      onClick={async (e) => {
                        e.preventDefault();
                        if (!window.confirm(`Delete module "${course.title}"? ALL data including lessons, activities and submissions will be lost.`)) return;
                        const path = `courses/${course.id}`;
                        try {
                          await deleteDoc(doc(db, 'courses', course.id));
                          setCourses(prev => prev.filter(c => c.id !== course.id));
                        } catch (err) {
                          handleFirestoreError(err, OperationType.DELETE, path);
                        }
                      }}
                      className="p-4 bg-white/10 text-rose-300 rounded-xl hover:bg-rose-500 hover:text-white transition-all" 
                      title="Terminate Module"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
               );
            })}
          </div>
        )}
      </section>

      {/* Create Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-white p-10 max-w-2xl w-full rounded-[2.5rem] shadow-2xl relative overflow-hidden ring-1 ring-black/5"
            >
              <div className="absolute top-0 left-0 right-0 h-2 bg-[#facc15]"></div>
              <h2 className="text-5xl font-black uppercase italic tracking-tighter mb-10 text-[#1a1a1a]">Initialize Module</h2>
              
              <form onSubmit={handleCreateCourse} className="space-y-8">
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 px-1">System Title</label>
                  <input 
                    type="text"
                    value={newCourse.title}
                    onChange={e => setNewCourse(prev => ({ ...prev, title: e.target.value }))}
                    className="w-full bg-[#f8fafc] border border-gray-200 p-5 rounded-2xl text-lg font-black uppercase italic focus:outline-none focus:ring-2 focus:ring-[#7639f5]/10 transition-all"
                    placeholder="E.G. QUANTUM COMPUTING 101"
                    required
                  />
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 px-1">Technical Specs</label>
                  <textarea 
                    value={newCourse.description}
                    onChange={e => setNewCourse(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full bg-[#f8fafc] border border-gray-200 p-5 rounded-2xl text-base font-bold focus:outline-none focus:ring-2 focus:ring-[#7639f5]/10 transition-all h-40 resize-none"
                    placeholder="Enter module operational parameters..."
                    required
                  />
                </div>
                
                <div className="flex flex-col sm:flex-row gap-4 pt-6">
                  <button 
                    type="button" 
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 bg-gray-100 py-5 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-gray-200 transition-all active:scale-[0.98]"
                  >
                    Abort
                  </button>
                  <button 
                    type="submit" 
                    disabled={creating}
                    className="flex-1 bg-[#7639f5] text-white py-5 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-[#5b21b6] shadow-md transition-all flex items-center justify-center gap-3 disabled:opacity-50 active:scale-[0.98]"
                  >
                    {creating ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Confirm Deploy'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
