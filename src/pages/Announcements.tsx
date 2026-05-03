import { useState, useEffect } from 'react';
import { collection, query, orderBy, getDocs, addDoc, serverTimestamp, doc, where, deleteDoc, updateDoc } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { Megaphone, Calendar, User, Image as ImageIcon, Send, Plus, X, Trash2 } from 'lucide-react';
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
  type?: 'announcement' | 'event';
  venue?: string;
  eventDate?: any;
  maxAttendees?: number;
  bookingOpen?: any;
  bookingClose?: any;
  eventPassword?: string;
}

interface AnnouncementsProps {
  role: 'admin' | 'student' | null;
}

export default function Announcements({ role }: AnnouncementsProps) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [registrationsByEvent, setRegistrationsByEvent] = useState<Record<string, any[]>>({});
  const [loadingRegistrationIds, setLoadingRegistrationIds] = useState<Record<string, boolean>>({});
  const [eventPasswords, setEventPasswords] = useState<Record<string, string>>({});
  const [updatingPasswordIds, setUpdatingPasswordIds] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newAnnouncement, setNewAnnouncement] = useState({
    title: '',
    content: '',
    imageUrl: '',
    expiresAt: '',
    type: 'announcement',
    venue: '',
    eventDate: '',
    maxAttendees: '',
    bookingOpen: '',
    bookingClose: ''
  });
  const [submitting, setSubmitting] = useState(false);

  const isAdmin = role === 'admin';

  useEffect(() => {
    fetchAnnouncements();
  }, [role]);

  const parseDateValue = (value: any) => {
    if (!value) return null;
    return value.toDate ? value.toDate() : new Date(value);
  };

  const formatDate = (value: any) => {
    const date = parseDateValue(value);
    return date ? date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'Not set';
  };

  const getEventStatus = (ann: Announcement) => {
    if (ann.type !== 'event') return null;
    const now = new Date();
    const open = parseDateValue(ann.bookingOpen);
    const close = parseDateValue(ann.bookingClose);
    if (open && now < open) return `Booking opens ${open.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}`;
    if (close && now > close) return 'Registration closed';
    return 'Registration open';
  };

  const isWithinBookingWindow = (ann: Announcement) => {
    if (ann.type !== 'event') return false;
    const now = new Date();
    const open = parseDateValue(ann.bookingOpen);
    const close = parseDateValue(ann.bookingClose);
    if (open && now < open) return false;
    if (close && now > close) return false;
    return true;
  };

  const getRegisteredStudents = (eventId: string) => registrationsByEvent[eventId] || [];

  const getStudentRegistration = (eventId: string) => {
    const userId = auth.currentUser?.uid;
    return getRegisteredStudents(eventId).find(reg => reg.studentId === userId);
  };

  const isEventFull = (ann: Announcement) => {
    if (!ann.maxAttendees) return false;
    return getRegisteredStudents(ann.id).length >= ann.maxAttendees;
  };

  const fetchEventRegistrations = async (eventIds: string[]) => {
    const results: Record<string, any[]> = {};
    await Promise.all(eventIds.map(async (eventId) => {
      try {
        const regsSnapshot = await getDocs(collection(db, 'announcements', eventId, 'registrations'));
        results[eventId] = regsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      } catch (error) {
        console.warn(`Unable to load registrations for event ${eventId}:`, error);
        results[eventId] = [];
      }
    }));
    setRegistrationsByEvent(results);
  };

  const fetchAnnouncements = async () => {
    setLoading(true);
    const path = 'announcements';
    try {
      const q = query(collection(db, path), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const all = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Announcement));

      const visibleAnnouncements = isAdmin ? all : all.filter(ann => {
        if (!ann.expiresAt) return true;
        const expiry = parseDateValue(ann.expiresAt);
        return expiry ? expiry > new Date() : true;
      });

      setAnnouncements(visibleAnnouncements);

      const eventIds = visibleAnnouncements.filter(ann => ann.type === 'event').map(ann => ann.id);
      if (eventIds.length) {
        await fetchEventRegistrations(eventIds);
      } else {
        setRegistrationsByEvent({});
      }

      // Initialize event passwords
      const passwords: Record<string, string> = {};
      visibleAnnouncements.forEach(ann => {
        if (ann.type === 'event' && ann.eventPassword) {
          passwords[ann.id] = ann.eventPassword;
        }
      });
      setEventPasswords(passwords);
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
      setRegistrationsByEvent(prev => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });
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
        type: newAnnouncement.type,
        venue: newAnnouncement.type === 'event' ? newAnnouncement.venue : null,
        eventDate: newAnnouncement.type === 'event' && newAnnouncement.eventDate ? new Date(newAnnouncement.eventDate) : null,
        maxAttendees: newAnnouncement.type === 'event' && newAnnouncement.maxAttendees ? Number(newAnnouncement.maxAttendees) : null,
        bookingOpen: newAnnouncement.type === 'event' && newAnnouncement.bookingOpen ? new Date(newAnnouncement.bookingOpen) : null,
        bookingClose: newAnnouncement.type === 'event' && newAnnouncement.bookingClose ? new Date(newAnnouncement.bookingClose) : null,
        eventPassword: null, // Initialize as null, admin can set later
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
          title: newAnnouncement.type === 'event' ? 'New Event Posted' : 'New Announcement',
          message: newAnnouncement.title,
          type: newAnnouncement.type === 'event' ? 'event' : 'announcement',
          read: false,
          relatedId: docRef.id,
          createdAt: serverTimestamp()
        })
      );
      await Promise.all(notificationPromises);
      await fetchAnnouncements();
      setShowAddModal(false);
      setNewAnnouncement({ title: '', content: '', imageUrl: '', expiresAt: '', type: 'announcement', venue: '', eventDate: '', maxAttendees: '', bookingOpen: '', bookingClose: '' });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'announcements');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegister = async (eventAnn: Announcement) => {
    if (!auth.currentUser) return;
    if (eventAnn.type !== 'event') return;
    const now = new Date();
    const bookingOpen = parseDateValue(eventAnn.bookingOpen);
    const bookingClose = parseDateValue(eventAnn.bookingClose);
    const registrations = getRegisteredStudents(eventAnn.id);
    const alreadyRegistered = registrations.some(reg => reg.studentId === auth.currentUser?.uid);

    if (alreadyRegistered) {
      alert('You are already registered for this event.');
      return;
    }
    if (bookingOpen && now < bookingOpen) {
      alert('Registration has not opened yet.');
      return;
    }
    if (bookingClose && now > bookingClose) {
      alert('Registration is closed.');
      return;
    }
    if (eventAnn.maxAttendees && registrations.length >= eventAnn.maxAttendees) {
      alert('This event is fully booked.');
      return;
    }

    setLoadingRegistrationIds(prev => ({ ...prev, [eventAnn.id]: true }));
    try {
      const registrationData = {
        studentId: auth.currentUser.uid,
        studentName: auth.currentUser.displayName || 'Student',
        studentEmail: auth.currentUser.email || '',
        registeredAt: serverTimestamp(),
        passwordSent: false
      };
      const registrationRef = await addDoc(collection(db, 'announcements', eventAnn.id, 'registrations'), registrationData);
      setRegistrationsByEvent(prev => ({
        ...prev,
        [eventAnn.id]: [...(prev[eventAnn.id] || []), { id: registrationRef.id, ...registrationData, registeredAt: new Date() }]
      }));
      alert('Registration successful. The administrator will send your access password manually.');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `announcements/${eventAnn.id}/registrations`);
    } finally {
      setLoadingRegistrationIds(prev => ({ ...prev, [eventAnn.id]: false }));
    }
  };

  const handlePasswordSentToggle = async (eventId: string, regId: string, current: boolean) => {
    setLoadingRegistrationIds(prev => ({ ...prev, [regId]: true }));
    try {
      await updateDoc(doc(db, 'announcements', eventId, 'registrations', regId), { passwordSent: !current });
      setRegistrationsByEvent(prev => ({
        ...prev,
        [eventId]: prev[eventId].map(reg => reg.id === regId ? { ...reg, passwordSent: !current } : reg)
      }));
    } catch (error) {
      console.warn('Unable to update password sent status:', error);
    } finally {
      setLoadingRegistrationIds(prev => ({ ...prev, [regId]: false }));
    }
  };

  const handleUpdateEventPassword = async (eventId: string, password: string) => {
    setUpdatingPasswordIds(prev => ({ ...prev, [eventId]: true }));
    try {
      await updateDoc(doc(db, 'announcements', eventId), { eventPassword: password });
      setAnnouncements(prev => prev.map(ann =>
        ann.id === eventId ? { ...ann, eventPassword: password } : ann
      ));
      setEventPasswords(prev => ({ ...prev, [eventId]: password }));
    } catch (error) {
      console.warn('Unable to update event password:', error);
    } finally {
      setUpdatingPasswordIds(prev => ({ ...prev, [eventId]: false }));
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
                    <div className="flex flex-wrap gap-2 px-2">
                      <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        {ann.type === 'event' ? 'Event' : 'Announcement'}
                      </span>
                      <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${ann.expiresAt ? (((ann.expiresAt.toDate ? ann.expiresAt.toDate() : new Date(ann.expiresAt)) > new Date()) ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700') : 'bg-purple-100 text-purple-700'}`}>
                        {ann.expiresAt ? (((ann.expiresAt.toDate ? ann.expiresAt.toDate() : new Date(ann.expiresAt)) > new Date()) ? 'Active' : 'Expired') : 'Permanent'}
                      </span>
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-xl font-bold text-slate-900 leading-tight group-hover:text-purple-600 transition-colors">{ann.title}</h3>
                      {ann.type === 'event' && (
                        <div className="grid gap-3 text-sm text-slate-600 rounded-3xl bg-slate-50 p-4 border border-slate-100">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold">Event Date</span>
                            <span>{formatDate(ann.eventDate)}</span>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold">Venue</span>
                            <span>{ann.venue || 'Not set'}</span>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold">Booking window</span>
                            <span>{ann.bookingOpen ? formatDate(ann.bookingOpen) : 'Open now'} → {ann.bookingClose ? formatDate(ann.bookingClose) : 'No deadline'}</span>
                          </div>
                          {ann.maxAttendees ? (
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-bold">Capacity</span>
                              <span>{getRegisteredStudents(ann.id).length}/{ann.maxAttendees}</span>
                            </div>
                          ) : null}
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold">Status</span>
                            <span>{getEventStatus(ann)}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                <p className="text-slate-500 font-medium leading-relaxed line-clamp-4">
                  {ann.content}
                </p>

                {ann.type === 'event' && (
                  <div className="space-y-4 pt-2">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-bold text-slate-700">Event registration</span>
                      <span className="text-xs uppercase tracking-[0.25em] text-slate-400">{getRegisteredStudents(ann.id).length} registered</span>
                    </div>
                    {!isAdmin && (
                      <div className="space-y-3">
                        <button
                          type="button"
                          onClick={() => handleRegister(ann)}
                          disabled={!isWithinBookingWindow(ann) || !!getStudentRegistration(ann.id) || isEventFull(ann) || loadingRegistrationIds[ann.id]}
                          className="w-full bg-purple-600 text-white py-4 rounded-2xl font-bold hover:bg-purple-700 transition-all disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600"
                        >
                          {getStudentRegistration(ann.id)
                            ? 'Already registered'
                            : isEventFull(ann)
                              ? 'Event fully booked'
                              : !isWithinBookingWindow(ann)
                                ? getEventStatus(ann)
                                : loadingRegistrationIds[ann.id]
                                  ? 'Registering...'
                                  : 'Register for event'}
                        </button>

                        {getStudentRegistration(ann.id) && ann.eventPassword && (
                          <div className="rounded-3xl border border-emerald-100 bg-emerald-50 p-4 text-sm">
                            <p className="text-emerald-700 font-bold mb-2">Event Access Password</p>
                            <p className="text-emerald-900 font-mono bg-white px-3 py-2 rounded-lg border border-emerald-200 text-center text-lg font-bold tracking-wider">
                              {ann.eventPassword}
                            </p>
                            <p className="text-xs text-emerald-600 mt-2 italic">Use this password to access the event</p>
                          </div>
                        )}
                      </div>
                    )}

                    {isAdmin && (
                      <div className="space-y-3 rounded-3xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-700">
                        <div className="space-y-3">
                          <label className="text-xs font-bold uppercase tracking-widest text-slate-400 ml-2">Event Access Password</label>
                          <div className="flex gap-3">
                            <input
                              type="text"
                              value={eventPasswords[ann.id] || ''}
                              onChange={(e) => setEventPasswords(prev => ({ ...prev, [ann.id]: e.target.value }))}
                              placeholder="Enter password for registered students"
                              className="flex-1 bg-white border border-slate-200 p-3 rounded-2xl outline-none focus:ring-4 focus:ring-purple-100 focus:border-purple-200 transition-all"
                            />
                            <button
                              type="button"
                              onClick={() => handleUpdateEventPassword(ann.id, eventPasswords[ann.id] || '')}
                              disabled={updatingPasswordIds[ann.id]}
                              className="bg-purple-600 text-white px-4 py-3 rounded-2xl font-bold hover:bg-purple-700 transition-all disabled:opacity-50"
                            >
                              {updatingPasswordIds[ann.id] ? 'Updating...' : 'Update'}
                            </button>
                          </div>
                          {ann.eventPassword && (
                            <p className="text-xs text-slate-500 italic">Current password: <span className="font-mono bg-slate-100 px-2 py-1 rounded">{ann.eventPassword}</span></p>
                          )}
                        </div>

                        <p className="text-slate-500">Students register here and the admin can manually send the access password afterward.</p>
                        {getRegisteredStudents(ann.id).length === 0 ? (
                          <p className="text-slate-500 italic">No registrations yet.</p>
                        ) : (
                          <div className="space-y-3">
                            {getRegisteredStudents(ann.id).map(reg => (
                              <div key={reg.id} className="rounded-3xl bg-white p-4 border border-slate-100">
                                <div className="flex items-center justify-between gap-3">
                                  <div>
                                    <p className="font-bold text-slate-900">{reg.studentName}</p>
                                    <p className="text-xs text-slate-500">{reg.studentEmail}</p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handlePasswordSentToggle(ann.id, reg.id, !!reg.passwordSent)}
                                    disabled={loadingRegistrationIds[reg.id]}
                                    className={`rounded-full px-3 py-2 text-xs font-bold uppercase transition ${reg.passwordSent ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                                  >
                                    {reg.passwordSent ? 'Password sent' : 'Mark password sent'}
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
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

                  <div className="space-y-4">
                    <label className="text-xs font-bold uppercase tracking-widest text-slate-400 ml-2">Post Type</label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setNewAnnouncement(p => ({ ...p, type: 'announcement' }))}
                        className={`rounded-2xl border p-4 text-sm font-bold transition ${newAnnouncement.type === 'announcement' ? 'border-purple-600 bg-purple-50 text-purple-700' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}
                      >
                        Announcement
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewAnnouncement(p => ({ ...p, type: 'event' }))}
                        className={`rounded-2xl border p-4 text-sm font-bold transition ${newAnnouncement.type === 'event' ? 'border-purple-600 bg-purple-50 text-purple-700' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}
                      >
                        Event
                      </button>
                    </div>

                    {newAnnouncement.type === 'event' && (
                      <div className="space-y-4 rounded-[2rem] border border-slate-100 bg-slate-50 p-5">
                        <div className="space-y-2">
                          <label className="text-xs font-bold uppercase tracking-widest text-slate-400 ml-2">Event Venue</label>
                          <input
                            type="text"
                            value={newAnnouncement.venue}
                            onChange={e => setNewAnnouncement(p => ({ ...p, venue: e.target.value }))}
                            className="w-full bg-white border border-slate-200 p-4 rounded-2xl outline-none focus:ring-4 focus:ring-purple-100 focus:border-purple-200 transition-all"
                            placeholder="e.g. Hall A, Library Auditorium"
                            required={newAnnouncement.type === 'event'}
                          />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="text-xs font-bold uppercase tracking-widest text-slate-400 ml-2">Event Date / Time</label>
                            <input
                              type="datetime-local"
                              value={newAnnouncement.eventDate}
                              onChange={e => setNewAnnouncement(p => ({ ...p, eventDate: e.target.value }))}
                              className="w-full bg-white border border-slate-200 p-4 rounded-2xl outline-none focus:ring-4 focus:ring-purple-100 focus:border-purple-200 transition-all"
                              required={newAnnouncement.type === 'event'}
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-xs font-bold uppercase tracking-widest text-slate-400 ml-2">Maximum Attendees</label>
                            <input
                              type="number"
                              min={1}
                              value={newAnnouncement.maxAttendees}
                              onChange={e => setNewAnnouncement(p => ({ ...p, maxAttendees: e.target.value }))}
                              className="w-full bg-white border border-slate-200 p-4 rounded-2xl outline-none focus:ring-4 focus:ring-purple-100 focus:border-purple-200 transition-all"
                              placeholder="e.g. 50"
                              required={newAnnouncement.type === 'event'}
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="text-xs font-bold uppercase tracking-widest text-slate-400 ml-2">Booking Open</label>
                            <input
                              type="datetime-local"
                              value={newAnnouncement.bookingOpen}
                              onChange={e => setNewAnnouncement(p => ({ ...p, bookingOpen: e.target.value }))}
                              className="w-full bg-white border border-slate-200 p-4 rounded-2xl outline-none focus:ring-4 focus:ring-purple-100 focus:border-purple-200 transition-all"
                              required={newAnnouncement.type === 'event'}
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-xs font-bold uppercase tracking-widest text-slate-400 ml-2">Booking Close</label>
                            <input
                              type="datetime-local"
                              value={newAnnouncement.bookingClose}
                              onChange={e => setNewAnnouncement(p => ({ ...p, bookingClose: e.target.value }))}
                              className="w-full bg-white border border-slate-200 p-4 rounded-2xl outline-none focus:ring-4 focus:ring-purple-100 focus:border-purple-200 transition-all"
                              required={newAnnouncement.type === 'event'}
                            />
                          </div>
                        </div>

                        <p className="text-[10px] text-slate-500 italic">Registered students appear below and the admin may send passwords manually after registration.</p>
                      </div>
                    )}
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
