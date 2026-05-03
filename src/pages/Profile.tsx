import { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, updateDoc, collection, addDoc, serverTimestamp, getDocs, deleteDoc, query, orderBy } from 'firebase/firestore';
import { User } from 'firebase/auth';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { User as UserIcon, GraduationCap, Building2, Hash, Edit3, Save, X, Camera, CheckCircle2, ShieldAlert, Phone, Linkedin, Mail, Trash2, Plus, Users } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ProfileProps {
  user: User | null;
}

interface UserProfile {
  name: string;
  email: string;
  role: 'admin' | 'student';
  avatar?: string;
  rollNumber?: string;
  education?: string;
  department?: string;
  phone?: string;
  linkedIn?: string;
  canEditProfile?: boolean;
  certificates?: Certificate[];
}

interface Certificate {
  id: string;
  title?: string;
  url: string;
  uploadedAt?: any;
}

interface Mentor {
  id: string;
  name: string;
  email: string;
  phone: string;
  avatar: string;
  linkedIn: string;
}

export default function Profile({ user }: ProfileProps) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    education: '',
    department: '',
    phone: '',
    linkedIn: '',
    avatar: ''
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  
  // Mentors state
  const [mentors, setMentors] = useState<Mentor[]>([]);
  const [newMentor, setNewMentor] = useState({ name: '', email: '', phone: '', avatar: '', linkedIn: '' });
  const [addingMentor, setAddingMentor] = useState(false);

  useEffect(() => {
    if (user) {
      fetchProfile();
      fetchMentors();
    }
  }, [user]);

  const fetchMentors = async () => {
    try {
      const snapshot = await getDocs(query(collection(db, 'mentors'), orderBy('createdAt', 'desc')));
      setMentors(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Mentor)));
    } catch (error) {
      console.error("Mentor fetch error:", error);
    }
  };

  const handleAddMentor = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddingMentor(true);
    try {
      const docRef = await addDoc(collection(db, 'mentors'), {
        ...newMentor,
        createdAt: serverTimestamp()
      });
      setMentors(prev => [{ id: docRef.id, ...newMentor } as Mentor, ...prev]);
      setNewMentor({ name: '', email: '', phone: '', avatar: '', linkedIn: '' });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'mentors');
    } finally {
      setAddingMentor(false);
    }
  };

  const handleDeleteMentor = async (id: string) => {
    if (!confirm('Are you sure you want to remove this mentor information?')) return;
    try {
      await deleteDoc(doc(db, 'mentors', id));
      setMentors(prev => prev.filter(m => m.id !== id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `mentors/${id}`);
    }
  };

  const fetchProfile = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    const userRef = doc(db, 'users', user.uid);
    try {
      const docSnap = await getDoc(userRef);
      if (docSnap.exists()) {
        const data = docSnap.data() as UserProfile;
        const profileData: UserProfile = {
          name: data.name || user.displayName || user.email?.split('@')[0] || 'User',
          email: data.email || user.email || '',
          role: data.role || (user.email === 'hariselvans96@gmail.com' ? 'admin' : 'student'),
          avatar: data.avatar || '',
          rollNumber: data.rollNumber,
          education: data.education || '',
          department: data.department || '',
          phone: data.phone || '',
          linkedIn: data.linkedIn || '',
          canEditProfile: data.canEditProfile ?? true,
          certificates: data.certificates || []
        };

        setProfile(profileData);
        setFormData({
          name: profileData.name,
          education: profileData.education || '',
          department: profileData.department || '',
          phone: profileData.phone || '',
          linkedIn: profileData.linkedIn || '',
          avatar: profileData.avatar || ''
        });
      } else {
        const fallbackRole = user.email === 'hariselvans96@gmail.com' ? 'admin' : 'student';
        const fallbackProfile: UserProfile = {
          name: user.displayName || user.email?.split('@')[0] || 'User',
          email: user.email || '',
          role: fallbackRole,
          avatar: '',
          canEditProfile: true,
          certificates: []
        };

        setProfile(fallbackProfile);
        setFormData({
          name: fallbackProfile.name,
          education: '',
          department: '',
          phone: '',
          linkedIn: '',
          avatar: ''
        });

        if (fallbackRole === 'admin') {
          await setDoc(userRef, {
            ...fallbackProfile,
            createdAt: serverTimestamp()
          });
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
    } finally {
      setLoading(false);
    }
  };

  const formatUploadedAt = (uploadedAt?: any) => {
    if (!uploadedAt) return 'Unknown date';
    if (uploadedAt?.toDate) return uploadedAt.toDate().toLocaleDateString();
    if (uploadedAt instanceof Date) return uploadedAt.toLocaleDateString();
    return String(uploadedAt);
  };

  const certificateCount = profile?.certificates?.length ?? 0;

  const handleSave = async () => {
    if (!user || !profile) return;
    
    // Check if user is allowed to edit or is admin (though admin here means the user itself)
    if (profile.role !== 'admin' && !profile.canEditProfile) {
      setMessage({ type: 'error', text: 'Administrative permission required to edit profile.' });
      return;
    }

    setSaving(true);
    setMessage(null);

    const userRef = doc(db, 'users', user.uid);
    
    // Generate unique 8-digit roll number if not present
    let finalRollNumber = profile.rollNumber;
    if (!finalRollNumber) {
      finalRollNumber = Math.floor(10000000 + Math.random() * 90000000).toString();
    }

    const updates = {
      ...formData,
      rollNumber: finalRollNumber,
      // Admin might want to lock it again after edit? User said "once admin open the edit button... student edit and submit"
      // If admin opens it, maybe it should be one-time? 
      // User: "once the admin open the edit button that a particular student ,that student edit and submit our information."
      // So I'll auto-lock it after submission for students.
      ...(profile.role === 'student' ? { canEditProfile: false } : {})
    };

    try {
      await updateDoc(userRef, updates);
      setProfile(prev => prev ? { ...prev, ...updates } : null);
      setIsEditing(false);
      setMessage({ type: 'success', text: 'Profile operational parameters updated successfully.' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to synchronize profile data.' });
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="w-12 h-12 border-4 border-purple-100 border-t-purple-600 rounded-full animate-spin"></div>
        <p className="text-slate-500 font-medium animate-pulse">Syncing profile matrix...</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="max-w-xl mx-auto py-20 text-center text-slate-600">
        <p className="text-lg font-semibold">Profile data could not be loaded.</p>
        <p className="mt-3 text-sm">Please refresh the page or contact support if the problem persists.</p>
      </div>
    );
  }

  const canEdit = profile.role === 'admin' || profile.canEditProfile;

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Profile Card */}
      <div className="bg-white rounded-[2.5rem] shadow-xl shadow-slate-200/50 overflow-hidden border border-slate-100">
        {/* Header/Cover */}
        <div className="h-48 bg-gradient-to-r from-purple-600 to-indigo-600 relative">
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
          
          <div className="absolute -bottom-16 left-8 md:left-12 flex flex-col md:flex-row items-end gap-6">
            <div className="relative group">
              <div className="w-32 h-32 md:w-40 md:h-40 rounded-[2.5rem] bg-white p-2 shadow-2xl border-4 border-white overflow-hidden">
                {formData.avatar ? (
                  <img src={formData.avatar} alt="Avatar" className="w-full h-full object-cover rounded-[2rem]" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-full h-full bg-slate-100 rounded-[2rem] flex items-center justify-center text-slate-300">
                    <UserIcon className="w-16 h-16" />
                  </div>
                )}
              </div>
              {isEditing && (
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                   <div className="bg-black/40 backdrop-blur-sm p-4 rounded-full text-white">
                      <Camera className="w-6 h-6" />
                   </div>
                </div>
              )}
            </div>
            
            <div className="pb-4 space-y-1">
              <h1 className="text-5xl md:text-5xl font-bold text-white drop-shadow-sm">
                {profile.name}
              </h1>
              <div className="flex items-center gap-2 text-white/80 font-medium">
                <span className="bg-white/20 px-3 py-0.5 rounded-full text-xs uppercase tracking-wider backdrop-blur-md border border-white/10">
                  {profile.role}
                </span>
                {profile.rollNumber && (
                  <span className="flex items-center gap-1.5 text-sm">
                    <Hash className="w-4 h-4" /> {profile.rollNumber}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="absolute top-6 right-8">
            {!isEditing ? (
              canEdit ? (
                <button 
                  onClick={() => setIsEditing(true)}
                  className="bg-white/20 hover:bg-white/30 backdrop-blur-md text-white px-6 py-2.5 rounded-2xl font-bold text-sm flex items-center gap-2 transition-all border border-white/20 active:scale-95"
                >
                  <Edit3 className="w-4 h-4" /> Edit Profile
                </button>
              ) : (
                <div className="bg-black/20 backdrop-blur-md text-white/60 px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest border border-white/10">
                  Locked by Admin
                </div>
              )
            ) : (
              <div className="flex gap-3">
                <button 
                  onClick={() => setIsEditing(false)}
                  className="bg-white/10 hover:bg-white/20 backdrop-blur-md text-white px-4 py-2.5 rounded-2xl font-bold text-sm transition-all border border-white/20 active:scale-95"
                >
                  <X className="w-4 h-4" />
                </button>
                <button 
                  onClick={handleSave}
                  disabled={saving}
                  className="bg-white text-purple-600 hover:bg-slate-50 px-6 py-2.5 rounded-2xl font-bold text-sm flex items-center gap-2 transition-all shadow-lg active:scale-95 disabled:opacity-50"
                >
                  {saving ? 'Syncing...' : <><Save className="w-4 h-4" /> Save Details</>}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="pt-24 pb-12 px-8 md:px-12 grid grid-cols-1 md:grid-cols-3 gap-12">
          {/* Main Info */}
          <div className="md:col-span-2 space-y-10">
            <AnimatePresence mode="wait">
              {message && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className={`p-4 rounded-2xl flex items-center gap-3 border shadow-sm ${
                    message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-red-50 text-red-700 border-red-100'
                  }`}
                >
                  {message.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <ShieldAlert className="w-5 h-5" />}
                  <p className="font-semibold text-sm">{message.text}</p>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-slate-400">
                  <UserIcon className="w-4 h-4" />
                  <span className="text-[10px] font-bold uppercase tracking-widest">Full Identity Name</span>
                </div>
                {isEditing ? (
                  <input 
                    type="text"
                    value={formData.name}
                    onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl font-bold text-lg focus:ring-4 focus:ring-purple-100 focus:border-purple-200 outline-none transition-all"
                    placeholder="Enter full name"
                  />
                ) : (
                  <p className="text-xl font-bold text-slate-900">{profile.name}</p>
                )}
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-2 text-slate-400">
                  <Building2 className="w-4 h-4" />
                  <span className="text-[10px] font-bold uppercase tracking-widest">Departmental Hub</span>
                </div>
                {isEditing ? (
                  <input 
                    type="text"
                    value={formData.department}
                    onChange={e => setFormData(p => ({ ...p, department: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl font-bold text-lg focus:ring-4 focus:ring-purple-100 focus:border-purple-200 outline-none transition-all"
                    placeholder="e.g. Computer Science"
                  />
                ) : (
                  <p className="text-xl font-bold text-slate-900">{profile.department || 'Not Specified'}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-slate-400">
                  <Phone className="w-4 h-4" />
                  <span className="text-[10px] font-bold uppercase tracking-widest">Contact Phone</span>
                </div>
                {isEditing ? (
                  <input 
                    type="tel"
                    value={formData.phone}
                    onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl font-bold text-lg focus:ring-4 focus:ring-purple-100 focus:border-purple-200 outline-none transition-all"
                    placeholder="+1 234 567 890"
                  />
                ) : (
                  <p className="text-xl font-bold text-slate-900">{profile.phone || 'Not Specified'}</p>
                )}
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-2 text-slate-400">
                  <Linkedin className="w-4 h-4" />
                  <span className="text-[10px] font-bold uppercase tracking-widest">LinkedIn Profile</span>
                </div>
                {isEditing ? (
                  <input 
                    type="url"
                    value={formData.linkedIn}
                    onChange={e => setFormData(p => ({ ...p, linkedIn: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl font-bold text-lg focus:ring-4 focus:ring-purple-100 focus:border-purple-200 outline-none transition-all"
                    placeholder="https://linkedin.com/in/..."
                  />
                ) : (
                  profile.linkedIn ? (
                    <a href={profile.linkedIn} target="_blank" rel="noopener noreferrer" className="text-xl font-bold text-purple-600 hover:underline flex items-center gap-2">
                       View Profile
                    </a>
                  ) : (
                    <p className="text-xl font-bold text-slate-900">Not Specified</p>
                  )
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-2 text-slate-400">
                <GraduationCap className="w-4 h-4" />
                <span className="text-[10px] font-bold uppercase tracking-widest">Educational Trajectory</span>
              </div>
              {isEditing ? (
                <textarea 
                  value={formData.education}
                  onChange={e => setFormData(p => ({ ...p, education: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 p-6 rounded-[2rem] font-medium text-slate-600 focus:ring-4 focus:ring-purple-100 focus:border-purple-200 outline-none transition-all h-32 resize-none"
                  placeholder="Enter your current academic focus or school details..."
                />
              ) : (
                <p className="text-slate-600 bg-slate-50/50 p-6 rounded-[2rem] border border-slate-100 italic leading-relaxed">
                  {profile.education || 'Academic data not yet synchronized.'}
                </p>
              )}
            </div>

            <div className="space-y-8 p-6 bg-slate-50 border border-slate-100 rounded-[2rem]">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Certificates</p>
                  <p className="text-xl font-bold text-slate-900">{certificateCount}</p>
                </div>
                <span className="inline-flex items-center rounded-full bg-purple-100 text-purple-700 px-3 py-1 text-[10px] font-bold uppercase tracking-widest">
                  {certificateCount === 1 ? '1 certificate' : `${certificateCount} certificates`}
                </span>
              </div>

              {certificateCount === 0 ? (
                <p className="text-slate-500 text-sm">
                  No certificate images have been attached to this profile yet. Once an admin uploads a certificate link, it will appear here.
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {profile.certificates?.map(cert => (
                    <div key={cert.id} className="rounded-[1.75rem] border border-slate-200 overflow-hidden shadow-sm bg-white">
                      <div className="w-full h-40 overflow-hidden bg-slate-100">
                        <img src={cert.url} alt={cert.title || 'Certificate image'} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      </div>
                      <div className="p-4 space-y-3">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">{cert.title || 'Certificate Image'}</p>
                          <p className="text-sm font-medium text-slate-700 mt-1">Uploaded: {formatUploadedAt(cert.uploadedAt)}</p>
                        </div>
                        <a
                          href={cert.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center justify-center gap-2 w-full rounded-2xl bg-purple-600 text-white px-4 py-3 text-sm font-semibold transition hover:bg-purple-700"
                        >
                          View / Download
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {isEditing && (
              <div className="space-y-4 pt-4 border-t border-slate-100">
                <div className="flex items-center gap-2 text-slate-400">
                  <Camera className="w-4 h-4" />
                  <span className="text-[10px] font-bold uppercase tracking-widest">Visual Asset Link (Photo URL)</span>
                </div>
                <input 
                  type="url"
                  value={formData.avatar}
                  onChange={e => setFormData(p => ({ ...p, avatar: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl font-mono text-sm focus:ring-4 focus:ring-purple-100 focus:border-purple-200 outline-none transition-all"
                  placeholder="https://example.com/photo.jpg"
                />
              </div>
            )}
          </div>

          {/* Side Info */}
          <div className="space-y-8">
            <div className="bg-slate-50 rounded-[2rem] p-8 space-y-6">
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">Security Credentials</h3>
              <div className="space-y-6">
                 <div>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tight mb-1">Identity Node (Email)</p>
                    <p className="text-sm font-semibold truncate text-slate-700">{profile.email}</p>
                 </div>
                 <div>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tight mb-1">Status Protocol</p>
                    <div className="flex items-center gap-2">
                       <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                       <p className="text-xs font-bold text-emerald-600 uppercase">Operational</p>
                    </div>
                 </div>
                 <div>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tight mb-1">Assigned Access Level</p>
                    <p className="text-xs font-bold text-purple-600 uppercase tracking-wider">{profile.role}</p>
                 </div>
              </div>
            </div>

            <div className="bg-purple-50 rounded-[2rem] p-8 border border-purple-100">
               <p className="text-[9px] font-bold text-purple-400 uppercase tracking-widest mb-4">Educational Support</p>
               <p className="text-xs text-purple-800 leading-relaxed font-medium">
                  Need assistance with your institutional credentials? Contact student support services for manual override.
               </p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats/Badge Section */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
         {[
           { label: 'Learning Velocity', value: '88%', color: 'bg-indigo-500' },
           { label: 'Module Completion', value: '12/15', color: 'bg-purple-500' },
           { label: 'Academic Standing', value: 'Active', color: 'bg-emerald-500' }
         ].map((stat, i) => (
           <div key={i} className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm flex items-center justify-between group hover:shadow-md transition-all">
              <div className="space-y-1">
                 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{stat.label}</p>
                 <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
              </div>
              <div className={`w-3 h-12 rounded-full ${stat.color} opacity-20 group-hover:opacity-100 transition-opacity`}></div>
           </div>
         ))}
      </div>

      {/* Mentor Management - Admin Only */}
      {profile.role === 'admin' && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-1000 delay-300">
          <div className="flex items-center gap-3">
             <div className="w-1 bg-purple-600 h-6 rounded-full"></div>
             <h2 className="text-2xl font-bold text-slate-900">Manage Institutional Mentors</h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
             {/* Add Mentor Form */}
             <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl shadow-purple-200/10 h-fit">
                <div className="flex items-center gap-3 mb-8">
                   <div className="w-10 h-10 bg-purple-100 text-purple-600 rounded-xl flex items-center justify-center">
                      <Plus className="w-5 h-5" />
                   </div>
                   <p className="font-bold text-slate-900">Add New Mentor</p>
                </div>

                <form onSubmit={handleAddMentor} className="space-y-5">
                   <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-2">Mentor Name</label>
                      <input 
                        required
                        type="text"
                        value={newMentor.name}
                        onChange={e => setNewMentor(p => ({ ...p, name: e.target.value }))}
                        className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl focus:ring-4 focus:ring-purple-100 outline-none transition-all font-bold text-sm"
                        placeholder="e.g. Dr. Sarah Chen"
                      />
                   </div>
                   <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-2">Email Address</label>
                      <input 
                        required
                        type="email"
                        value={newMentor.email}
                        onChange={e => setNewMentor(p => ({ ...p, email: e.target.value }))}
                        className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl focus:ring-4 focus:ring-purple-100 outline-none transition-all font-medium text-sm"
                        placeholder="sarah@institution.edu"
                      />
                   </div>
                   <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-2">Phone Number</label>
                      <input 
                        type="tel"
                        value={newMentor.phone}
                        onChange={e => setNewMentor(p => ({ ...p, phone: e.target.value }))}
                        className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl focus:ring-4 focus:ring-purple-100 outline-none transition-all font-medium text-sm"
                        placeholder="+1 234 567 890"
                      />
                   </div>
                   <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-2">LinkedIn URL</label>
                      <input 
                        type="url"
                        value={newMentor.linkedIn}
                        onChange={e => setNewMentor(p => ({ ...p, linkedIn: e.target.value }))}
                        className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl focus:ring-4 focus:ring-purple-100 outline-none transition-all font-medium text-sm"
                        placeholder="https://linkedin.com/in/..."
                      />
                   </div>
                   <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-2">Photo URL</label>
                      <input 
                        type="url"
                        value={newMentor.avatar}
                        onChange={e => setNewMentor(p => ({ ...p, avatar: e.target.value }))}
                        className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl focus:ring-4 focus:ring-purple-100 outline-none transition-all font-medium text-sm"
                        placeholder="https://images.unsplash.com/..."
                      />
                   </div>

                   <button 
                     disabled={addingMentor}
                     type="submit"
                     className="w-full bg-purple-600 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-purple-100 hover:bg-purple-700 transition-all active:scale-95 disabled:opacity-50"
                   >
                     {addingMentor ? 'Processing...' : <><Plus className="w-4 h-4" /> Register Mentor</>}
                   </button>
                </form>
             </div>

             {/* Mentors List */}
             <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-6">
                {mentors.length === 0 ? (
                  <div className="col-span-full bg-slate-50 border border-slate-100 rounded-[2.5rem] p-12 text-center">
                     <Users className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                     <p className="text-slate-400 font-bold italic text-sm">No institutional mentors registered.</p>
                  </div>
                ) : (
                  mentors.map((mentor, idx) => (
                    <motion.div 
                      key={mentor.id}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: idx * 0.05 }}
                      className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm relative group hover:shadow-xl transition-all"
                    >
                       <button 
                         onClick={() => handleDeleteMentor(mentor.id)}
                         className="absolute top-4 right-4 p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                       >
                          <Trash2 className="w-4 h-4" />
                       </button>

                       <div className="flex items-center gap-5">
                          <div className="w-14 h-14 bg-slate-100 rounded-2xl overflow-hidden shrink-0">
                             {mentor.avatar ? (
                               <img src={mentor.avatar} alt={mentor.name} className="w-full h-full object-cover" />
                             ) : (
                               <div className="w-full h-full flex items-center justify-center text-slate-300">
                                  <UserIcon className="w-6 h-6" />
                               </div>
                             )}
                          </div>
                          <div className="min-w-0">
                             <h4 className="font-bold text-slate-900 truncate">{mentor.name}</h4>
                             <p className="text-[10px] font-bold text-purple-600 uppercase tracking-widest">Mentor</p>
                          </div>
                       </div>

                       <div className="mt-6 space-y-2">
                          <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                             <Mail className="w-3.5 h-3.5" /> <span className="truncate">{mentor.email}</span>
                          </div>
                          {mentor.phone && (
                            <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                               <Phone className="w-3.5 h-3.5" /> {mentor.phone}
                            </div>
                          )}
                          {mentor.linkedIn && (
                            <div className="flex items-center gap-2 text-xs font-bold text-purple-600">
                               <Linkedin className="w-3.5 h-3.5" /> <span className="truncate">Connected Profile</span>
                            </div>
                          )}
                       </div>
                    </motion.div>
                  ))
                )}
             </div>
          </div>
        </div>
      )}
    </div>
  );
}
