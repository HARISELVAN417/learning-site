import { useState, useEffect } from 'react';
import { collection, query, orderBy, getDocs, addDoc, serverTimestamp, doc, where, deleteDoc } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { Megaphone, Calendar, User, Image as ImageIcon, Send, Plus, X, Bell, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Announcement {
  id: string;
  title: string;
  content: string;
  imageUrl?: string;
  expiresAt?: any;
  authorName: string;
  authorId: string;
  createdAt: any;
}

interface AnnouncementsProps {
  role: 'admin' | 'student' | null;
}

export default function Announcements({ role }: AnnouncementsProps) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newAnnouncement, setNewAnnouncement] = useState({ title: '', content: '', imageUrl: '', expiresAt: '' });
  const [submitting, setSubmitting] = useState(false);

  const isAdmin = role === 'admin';

  useEffect(() => {
    fetchAnnouncements();
  }, [role]);

  const fetchAnnouncements = async () => {
    setLoading(true);
    const path = 'announcements';
    try {
      const q = query(collection(db, path), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const all = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Announcement));

      if (isAdmin) {
        setAnnouncements(all);
      } else {
        const now = new Date();
        const active = all.filter(ann => {
          if (!ann.expiresAt) return true;
          const expiry = ann.expiresAt.toDate ? ann.expiresAt.toDate() : new Date(ann.expiresAt);
          return expiry > now;
        });
        setAnnouncements(active);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!isAdmin) return;
    if (!confirm('Are you sure you want to delete this announcement?')) return;
    try {
      await deleteDoc(doc(db, 'announcements', id));
      setAnnouncements(prev => prev.filter(ann => ann.id !== id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `announcements/${id}`);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser || !isAdmin) return;
    setSubmitting(true);
    try {
      const announcementData = {
        title: newAnnouncement.title,
        content: newAnnouncement.content,
        imageUrl: newAnnouncement.imageUrl,
        expiresAt: newAnnouncement.expiresAt ? new Date(newAnnouncement.expiresAt) : null,
        authorId: auth.currentUser.uid,
        authorName: auth.currentUser.displayName || 'Administrator',
        createdAt: serverTimestamp()
      };
      
      const docRef = await addDoc(collection(db, 'announcements'), announcementData);
      
      // Notify all students
      const studentsSnapshot = await getDocs(query(collection(db, 'users'), where('role', '==', 'student')));
      const notificationPromises = studentsSnapshot.docs.map(studentDoc => 
        addDoc(collection(db, 'notifications'), {
          userId: studentDoc.id,
          title: 'New Announcement',
          message: newAnnouncement.title,
          type: 'announcement',
          read: false,
          relatedId: docRef.id,
          createdAt: serverTimestamp()
        })
      );
      await Promise.all(notificationPromises);
      
      setAnnouncements(prev => [{ id: docRef.id, ...announcementData, createdAt: { toDate: () => new Date() }, expiresAt: announcementData.expiresAt } as any, ...prev]);
      setShowAddModal(false);
      setNewAnnouncement({ title: '', content: '', imageUrl: '', expiresAt: '' });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'announcements');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-12 pb-32">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-purple-200">
              <Megaphone className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Institutional Announcements</h1>
          </div>
          <p className="text-slate-500 font-medium">Stay updated with the latest news and broadcasts from the administration.</p>
        </div>

        {isAdmin && (
          <button 
            onClick={() => setShowAddModal(true)}
            className="bg-purple-600 text-white px-6 py-4 rounded-2xl font-bold flex items-center gap-2 shadow-lg shadow-purple-100 hover:bg-purple-700 transition-all active:scale-95"
          >
            <Plus className="w-5 h-5" /> Add Post
          </button>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-64 bg-white border border-slate-100 rounded-[2rem] animate-pulse shadow-sm"></div>
          ))}
        </div>
      ) : announcements.length === 0 ? (
        <div className="bg-slate-50 border border-slate-100 rounded-[3rem] py-24 text-center">
            <Megaphone className="w-16 h-16 text-slate-300 mx-auto mb-6" />
            <p className="text-slate-500 font-bold italic">No broadcasts recorded in the system.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {announcements.map((ann, idx) => (
            <motion.div
              key={ann.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-xl transition-all overflow-hidden flex flex-col group"
            >
              {ann.imageUrl && (
                <div className="h-48 overflow-hidden relative">
                  <img src={ann.imageUrl} alt={ann.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" referrerPolicy="no-referrer" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                  <div className="absolute bottom-4 left-6">
                     <span className="bg-purple-600 text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest">Broadcast</span>
                  </div>
                </div>
              )}
              
              <div className="p-8 flex-1 flex flex-col space-y-4">
                <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5" />
                    {ann.createdAt?.toDate ? ann.createdAt.toDate().toLocaleDateString() : 'Just now'}
                  </div>
                  <div className="flex items-center gap-2">
                    {isAdmin && (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(ann.id);
                        }}
                        className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all mr-2"
                        title="Delete Announcement"
                      >
                         <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                    <User className="w-3.5 h-3.5" />
                    {ann.authorName}
                  </div>
                </div>
                
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 px-2">
                       <span className={`w-2 h-2 rounded-full ${ann.expiresAt ? ( (ann.expiresAt.toDate ? ann.expiresAt.toDate() : new Date(ann.expiresAt)) > new Date() ? 'bg-emerald-500' : 'bg-red-500' ) : 'bg-purple-500'}`}></span>
                       <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                          {ann.expiresAt ? ( (ann.expiresAt.toDate ? ann.expiresAt.toDate() : new Date(ann.expiresAt)) > new Date() ? 'Active' : 'Expired' ) : 'Permanent'}
                       </span>
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 leading-tight group-hover:text-purple-600 transition-colors">{ann.title}</h3>
                  </div>
                
                <p className="text-slate-500 font-medium leading-relaxed line-clamp-4">
                  {ann.content}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Add Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white w-full max-w-xl rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8 md:p-10">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-2xl font-bold text-slate-900">Broadcast New Message</h2>
                  <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                    <X className="w-6 h-6 text-slate-400" />
                  </button>
                </div>

                <form onSubmit={handleCreate} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-slate-400 ml-2">Announcement Title</label>
                    <input 
                      required
                      type="text"
                      value={newAnnouncement.title}
                      onChange={e => setNewAnnouncement(p => ({ ...p, title: e.target.value }))}
                      className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl focus:ring-4 focus:ring-purple-100 focus:border-purple-200 outline-none transition-all font-bold"
                      placeholder="e.g. Upcoming Workshop Details"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-slate-400 ml-2">Image URL (Optional)</label>
                    <div className="relative">
                      <ImageIcon className="absolute left-4 top-4 w-5 h-5 text-slate-300" />
                      <input 
                        type="url"
                        value={newAnnouncement.imageUrl}
                        onChange={e => setNewAnnouncement(p => ({ ...p, imageUrl: e.target.value }))}
                        className="w-full bg-slate-50 border border-slate-200 p-4 pl-12 rounded-2xl focus:ring-4 focus:ring-purple-100 focus:border-purple-200 outline-none transition-all font-medium text-sm"
                        placeholder="https://images.unsplash.com/..."
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-slate-400 ml-2">Message Content</label>
                    <textarea 
                      required
                      value={newAnnouncement.content}
                      onChange={e => setNewAnnouncement(p => ({ ...p, content: e.target.value }))}
                      className="w-full bg-slate-50 border border-slate-200 p-6 rounded-[2rem] focus:ring-4 focus:ring-purple-100 focus:border-purple-200 outline-none transition-all h-40 resize-none font-medium text-slate-600"
                      placeholder="Type your announcement content here..."
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-slate-400 ml-2">Display Duration (Optional Expiry)</label>
                    <input 
                      type="datetime-local"
                      value={newAnnouncement.expiresAt}
                      onChange={e => setNewAnnouncement(p => ({ ...p, expiresAt: e.target.value }))}
                      className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl focus:ring-4 focus:ring-purple-100 focus:border-purple-200 outline-none transition-all font-medium text-sm"
                    />
                    <p className="text-[10px] text-slate-400 font-medium ml-2 italic">Post will be hidden from students after this time.</p>
                  </div>

                  <button 
                    disabled={submitting}
                    type="submit"
                    className="w-full bg-purple-600 text-white py-5 rounded-2xl font-bold flex items-center justify-center gap-3 shadow-lg shadow-purple-100 hover:bg-purple-700 transition-all active:scale-95 disabled:opacity-50"
                  >
                    {submitting ? 'Broadcasting...' : <><Send className="w-5 h-5" /> Dispatch Announcement</>}
                  </button>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
