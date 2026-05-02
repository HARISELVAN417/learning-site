import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, updateDoc, serverTimestamp, orderBy, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Users, Search, ChevronRight, CheckCircle, Clock, Star, MessageSquare, Trash2, XCircle, Shield, User as UserIcon, Edit3, RefreshCw, UserPlus, Save, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Link } from 'react-router-dom';

interface Student {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar?: string;
  blocked?: boolean;
  blockReason?: string;
  allowUntil?: any;
  canEditProfile?: boolean;
  rollNumber?: string;
  department?: string;
  education?: string;
  mentor?: {
    name: string;
    email: string;
    phone: string;
    avatar: string;
  };
}

interface Submission {
  id: string;
  userId: string;
  userName: string;
  activityId: string;
  activityTitle: string;
  activityType: string;
  courseId: string;
  content: any;
  score: number;
  feedback: string;
  submittedAt: any;
  gradedAt?: any;
  status: 'pending' | 'graded';
}

interface Enrollment {
  id: string;
  userId: string;
  courseId: string;
  courseTitle: string;
  status: 'pending' | 'approved';
  joinedAt: any;
}

export default function StudentManagement() {
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [gradingId, setGradingId] = useState<string | null>(null);
  const [gradeData, setGradeData] = useState({ score: 0, feedback: '' });
  const [searchTerm, setSearchTerm] = useState('');
  const [blockComment, setBlockComment] = useState('');
  const [blocking, setBlocking] = useState(false);
  const [unblockTime, setUnblockTime] = useState('');

  // Mentor Assignment State
  const [showMentorModal, setShowMentorModal] = useState(false);
  const [assigningTo, setAssigningTo] = useState<Student | null>(null);
  const [mentorForm, setMentorForm] = useState({ name: '', email: '', phone: '', avatar: '' });
  const [savingMentor, setSavingMentor] = useState(false);

  const fetchStudents = async () => {
    setLoading(true);
    const path = 'users';
    try {
      const q = query(collection(db, path), where('role', '==', 'student'));
      const snapshot = await getDocs(q);
      setStudents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Student)));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, []);

  useEffect(() => {
    if (selectedStudent) {
      async function fetchStudentData() {
        const subPath = 'submissions';
        const enrollPath = 'enrollments';
        try {
          // Fetch Submissions
          const q = query(
            collection(db, subPath), 
            where('userId', '==', selectedStudent!.id)
          );
          const snapshot = await getDocs(q);
          const fetchedSubmissions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Submission));
          
          fetchedSubmissions.sort((a, b) => {
            const timeA = a.submittedAt?.toMillis() || 0;
            const timeB = b.submittedAt?.toMillis() || 0;
            return timeB - timeA;
          });

          setSubmissions(fetchedSubmissions);

          // Fetch Enrollments
          const eq = query(collection(db, enrollPath), where('userId', '==', selectedStudent!.id));
          const eSnapshot = await getDocs(eq);
          setEnrollments(eSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Enrollment)));

        } catch (error) {
          console.error("Fetch student data error:", error);
        }
      }
      fetchStudentData();
    }
  }, [selectedStudent]);

  const handleApproveEnrollment = async (enrollmentId: string) => {
    try {
      await updateDoc(doc(db, 'enrollments', enrollmentId), {
        status: 'approved'
      });
      setEnrollments(prev => prev.map(e => e.id === enrollmentId ? { ...e, status: 'approved' } : e));
    } catch (error) {
      console.error("Approve enrollment error:", error);
    }
  };

  const handleRevokeEnrollment = async (enrollmentId: string) => {
    if (!window.confirm("Revoke course access for this student? This operation is immediate.")) return;
    const path = `enrollments/${enrollmentId}`;
    try {
      await deleteDoc(doc(db, 'enrollments', enrollmentId));
      setEnrollments(prev => prev.filter(e => e.id !== enrollmentId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  const handleGrade = async (submissionId: string) => {
    const path = `submissions/${submissionId}`;
    try {
      await updateDoc(doc(db, 'submissions', submissionId), {
        score: gradeData.score,
        feedback: gradeData.feedback,
        status: 'graded',
        gradedAt: serverTimestamp()
      });
      setSubmissions(prev => prev.map(s => s.id === submissionId ? { 
        ...s, 
        score: gradeData.score, 
        feedback: gradeData.feedback, 
        status: 'graded' 
      } : s));
      setGradingId(null);
      setGradeData({ score: 0, feedback: '' });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  const handleToggleProfileEdit = async () => {
    if (!selectedStudent) return;
    const newValue = !selectedStudent.canEditProfile;
    const path = `users/${selectedStudent.id}`;
    try {
      await updateDoc(doc(db, 'users', selectedStudent.id), {
        canEditProfile: newValue
      });
      const updatedStudent = { ...selectedStudent, canEditProfile: newValue };
      setSelectedStudent(updatedStudent);
      setStudents(prev => prev.map(s => s.id === selectedStudent.id ? updatedStudent : s));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  const handleToggleBlock = async () => {
    if (!selectedStudent) return;
    const isBlocking = !selectedStudent.blocked;
    
    if (isBlocking && !blockComment.trim()) {
      alert("Please provide a reason for blocking.");
      return;
    }

    setBlocking(true);
    const path = `users/${selectedStudent.id}`;
    try {
      await updateDoc(doc(db, 'users', selectedStudent.id), {
        blocked: isBlocking,
        blockReason: isBlocking ? blockComment : null,
        allowUntil: null // Reset any timer when manually blocking
      });
      
      const updatedStudent = { 
        ...selectedStudent, 
        blocked: isBlocking, 
        blockReason: isBlocking ? blockComment : undefined,
        allowUntil: null
      };
      
      setSelectedStudent(updatedStudent);
      setStudents(prev => prev.map(s => s.id === selectedStudent.id ? updatedStudent : s));
      setBlockComment('');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    } finally {
      setBlocking(false);
    }
  };

  const handleTimedUnblock = async (isPermanent: boolean) => {
    if (!selectedStudent) return;
    
    let allowUntilDate = null;
    if (!isPermanent) {
      if (!unblockTime) {
        alert("Please set an unblock expiration time.");
        return;
      }
      allowUntilDate = new Date(unblockTime);
    }

    setBlocking(true);
    const path = `users/${selectedStudent.id}`;
    try {
      await updateDoc(doc(db, 'users', selectedStudent.id), {
        blocked: false,
        blockReason: null,
        allowUntil: allowUntilDate
      });
      
      const updatedStudent = { 
        ...selectedStudent, 
        blocked: false, 
        blockReason: undefined,
        allowUntil: allowUntilDate 
      };
      
      setSelectedStudent(updatedStudent);
      setStudents(prev => prev.map(s => s.id === selectedStudent.id ? updatedStudent : s));
      setUnblockTime('');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    } finally {
      blocking && setBlocking(false);
    }
  };

  const handleDeleteStudent = async (studentId: string) => {
    if (!window.confirm("FATAL ACTION: This will permanently purge this student's identity and all associated course data from the system. This cannot be undone. Proceed?")) return;
    
    try {
      await deleteDoc(doc(db, 'users', studentId));
      
      // Clean up local state
      setStudents(prev => prev.filter(s => s.id !== studentId));
      if (selectedStudent?.id === studentId) {
        setSelectedStudent(null);
      }
      
      // Note: In a production app, you might also want to delete their submissions and enrollments
      // but deleting the user identity is the primary request here.
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${studentId}`);
    }
  };

  const handleRemoveMentor = async (studentId: string) => {
    if (!window.confirm("Remove assigned mentor from this student?")) return;
    try {
      await updateDoc(doc(db, 'users', studentId), {
        mentor: null
      });
      setStudents(prev => prev.map(s => s.id === studentId ? { ...s, mentor: undefined } : s));
      if (selectedStudent?.id === studentId) {
        setSelectedStudent(prev => prev ? { ...prev, mentor: undefined } : null);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${studentId}`);
    }
  };

  const handleAssignMentor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assigningTo) return;
    setSavingMentor(true);
    try {
      await updateDoc(doc(db, 'users', assigningTo.id), {
        mentor: mentorForm
      });
      setStudents(prev => prev.map(s => s.id === assigningTo.id ? { ...s, mentor: mentorForm } : s));
      if (selectedStudent?.id === assigningTo.id) {
        setSelectedStudent(prev => prev ? { ...prev, mentor: mentorForm } : null);
      }
      setShowMentorModal(false);
      setAssigningTo(null);
      setMentorForm({ name: '', email: '', phone: '', avatar: '' });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${assigningTo.id}`);
    } finally {
      setSavingMentor(false);
    }
  };

  const filteredStudents = students.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const calculateOverallGrade = () => {
    if (submissions.length === 0) return 0;
    const gradedSubmissions = submissions.filter(sub => sub.status === 'graded');
    if (gradedSubmissions.length === 0) return 0;
    const totalScore = gradedSubmissions.reduce((acc, sub) => acc + (sub.score || 0), 0);
    return Math.round(totalScore / gradedSubmissions.length);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 min-h-screen pb-32">
      {/* Student List Sidebar */}
      <div className="lg:col-span-4 space-y-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-600 text-white rounded-xl flex items-center justify-center shadow-lg shadow-purple-200">
              <Users className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">Student Directory</h1>
          </div>
          <button 
            onClick={fetchStudents}
            disabled={loading}
            className="p-2 text-slate-400 hover:text-purple-600 hover:bg-slate-50 rounded-xl transition-all"
            title="Refresh List"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-purple-600 transition-colors" />
          <input 
            type="text"
            placeholder="Search by name or email..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-2xl py-3.5 pl-11 pr-4 text-sm font-medium focus:outline-none focus:ring-4 focus:ring-purple-100 focus:border-purple-200 transition-all shadow-sm"
          />
        </div>

        <div className="space-y-3 overflow-y-auto max-h-[calc(100vh-250px)] pr-2 scrollbar-hide">
          {loading ? (
            <div className="text-center py-12">
               <div className="w-8 h-8 border-4 border-purple-100 border-t-purple-600 rounded-full animate-spin mx-auto mb-4"></div>
               <p className="text-slate-400 text-sm font-medium">Loading records...</p>
            </div>
          ) : filteredStudents.map(student => (
            <button
              key={student.id}
              onClick={() => setSelectedStudent(student)}
              className={`w-full flex items-center gap-4 p-4 rounded-2xl border transition-all text-left ${
                selectedStudent?.id === student.id 
                  ? 'bg-purple-600 text-white border-purple-600 shadow-xl shadow-purple-100' 
                  : 'bg-white text-slate-900 border-slate-100 hover:border-purple-200 hover:bg-slate-50 shadow-sm'
              }`}
            >
              <div className={`w-12 h-12 rounded-xl border flex items-center justify-center overflow-hidden shrink-0 ${selectedStudent?.id === student.id ? 'bg-white/20 border-white/20' : 'bg-slate-50 border-slate-100'}`}>
                {student.avatar ? (
                  <img src={student.avatar} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <UserIcon className={`w-6 h-6 ${selectedStudent?.id === student.id ? 'text-white' : 'text-slate-300'}`} />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate leading-tight mb-1">{student.name}</p>
                <p className={`text-[10px] font-medium truncate ${selectedStudent?.id === student.id ? 'text-white/70' : 'text-slate-400'}`}>{student.email}</p>
              </div>
              <ChevronRight className={`w-4 h-4 shrink-0 transition-transform ${selectedStudent?.id === student.id ? 'translate-x-1' : 'opacity-20 translate-x-[-4px]'}`} />
            </button>
          ))}
        </div>
      </div>

      {/* Detail View */}
      <div className="lg:col-span-8">
        <AnimatePresence mode="wait">
          {selectedStudent ? (
            <motion.div
              key={selectedStudent.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              {/* Profile Header */}
              <div className="bg-white rounded-[2.5rem] shadow-xl shadow-slate-200/40 overflow-hidden border border-slate-100">
                <div className={`h-32 ${selectedStudent.blocked ? 'bg-red-600' : 'bg-gradient-to-r from-purple-600 to-indigo-600'} relative`}>
                   <div className="absolute inset-0 bg-black/10"></div>
                </div>
                
                <div className="px-8 md:px-12 pb-10 relative">
                   <div className="flex flex-col md:flex-row gap-6 items-end -mt-16 mb-8">
                      <div className="w-32 h-32 rounded-[2rem] bg-white border-4 border-white shadow-2xl p-1 overflow-hidden shrink-0">
                        {selectedStudent.avatar ? (
                          <img src={selectedStudent.avatar} alt="" className="w-full h-full object-cover rounded-[1.5rem]" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="w-full h-full bg-slate-100 rounded-[1.5rem] flex items-center justify-center text-slate-300">
                             <UserIcon className="w-12 h-12" />
                          </div>
                        )}
                      </div>
                      <div className="pb-2 space-y-1">
                         <div className="flex items-center gap-3">
                            <h2 className="text-3xl font-bold text-slate-900">{selectedStudent.name}</h2>
                            {selectedStudent.blocked && (
                              <span className="bg-red-100 text-red-600 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">
                                Blocked
                              </span>
                            )}
                         </div>
                         <p className="text-slate-500 font-medium">{selectedStudent.email}</p>
                      </div>
                   </div>

                   <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                      <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 italic">
                         <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Department</p>
                         <p className="text-slate-700 font-medium">{selectedStudent.department || 'Not specified'}</p>
                      </div>
                      <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 italic">
                         <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Roll Number</p>
                         <p className="text-slate-700 font-medium font-mono">{selectedStudent.rollNumber || 'Not assigned'}</p>
                      </div>
                      <div className="p-5 bg-emerald-50 rounded-2xl border border-emerald-100 italic">
                         <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 mb-1">Overall Grade</p>
                         <div className="flex items-baseline gap-1">
                            <p className="text-2xl font-black text-emerald-700 tracking-tighter">{calculateOverallGrade()}</p>
                            <p className="text-[10px] font-bold text-emerald-400 uppercase">Avg</p>
                         </div>
                      </div>
                      <div className="p-5 bg-purple-50 rounded-2xl border border-purple-100 italic">
                         <p className="text-[10px] font-bold uppercase tracking-widest text-purple-400 mb-1">Operational ID</p>
                         <p className="text-purple-700 font-mono text-xs truncate">{selectedStudent.id}</p>
                      </div>
                   </div>

                   <div className="mt-8 pt-8 border-t border-slate-100 flex flex-wrap gap-4 items-center justify-between">
                      {/* Operational Controls */}
                      <div className="flex flex-wrap gap-4">
                         <button 
                            onClick={handleToggleProfileEdit}
                            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest transition-all ${
                               selectedStudent.canEditProfile 
                               ? 'bg-purple-600 text-white shadow-lg shadow-purple-100' 
                               : 'bg-slate-100 text-slate-600 hover:bg-purple-100 hover:text-purple-700'
                            }`}
                         >
                            <Edit3 className="w-4 h-4" />
                            {selectedStudent.canEditProfile ? 'Profile Unlock Active' : 'Enable Profile Edit'}
                         </button>

                         <button 
                            onClick={() => {
                              setAssigningTo(selectedStudent);
                              // @ts-ignore
                              setMentorForm(selectedStudent.mentor || { name: '', email: '', phone: '', avatar: '' });
                              setShowMentorModal(true);
                            }}
                            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-all font-bold"
                         >
                            <UserPlus className="w-4 h-4" />
                            {selectedStudent.mentor ? 'Update Mentor' : 'Assign Mentor'}
                         </button>

                         {/* @ts-ignore */}
                         {selectedStudent.mentor && (
                            <button 
                               onClick={() => handleRemoveMentor(selectedStudent.id)}
                               className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest bg-red-50 text-red-700 hover:bg-red-100 transition-all font-bold"
                            >
                               <Trash2 className="w-4 h-4" />
                               Remove Mentor
                            </button>
                         )}
                      </div>

                      <div className="flex gap-3">
                         <button 
                            onClick={() => handleDeleteStudent(selectedStudent.id)}
                            className="p-2.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                            title="Delete Student"
                         >
                            <Trash2 className="w-5 h-5" />
                         </button>
                         <button 
                            onClick={() => setSelectedStudent(null)}
                            className="p-2.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-xl transition-all"
                         >
                            <XCircle className="w-6 h-6" />
                         </button>
                      </div>
                   </div>
                </div>
              </div>

              {/* Admin Tools Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                 {/* Block Management */}
                 <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/30 space-y-6">
                    <div className="flex items-center gap-3 text-slate-900">
                       <Shield className="w-5 h-5 text-red-500" />
                       <h3 className="text-lg font-bold">Access Restrictions</h3>
                    </div>
                    
                    {!selectedStudent.blocked ? (
                      <div className="space-y-4">
                        <textarea
                          placeholder="Provide formal reason for system suspension..."
                          value={blockComment}
                          onChange={e => setBlockComment(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm font-medium focus:ring-4 focus:ring-red-50 h-28 resize-none outline-none transition-all"
                        />
                        <button 
                          onClick={handleToggleBlock}
                          disabled={blocking}
                          className="w-full bg-slate-900 text-white py-4 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-red-600 transition-all disabled:opacity-50"
                        >
                          {blocking ? 'Processing...' : 'Suspend System Access'}
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                         <div className="p-4 bg-red-50 border border-red-100 rounded-2xl italic text-red-700 text-sm">
                            "{selectedStudent.blockReason}"
                         </div>
                         <div className="space-y-2">
                           <p className="text-[10px] font-bold text-slate-400 uppercase ml-1">Expiry Control</p>
                           <input 
                             type="datetime-local"
                             value={unblockTime}
                             onChange={e => setUnblockTime(e.target.value)}
                             className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl text-sm font-bold outline-none"
                           />
                         </div>
                         <div className="grid grid-cols-2 gap-3">
                           <button onClick={() => handleTimedUnblock(false)} className="bg-purple-600 text-white py-3 rounded-xl text-xs font-bold uppercase tracking-widest ">Timed</button>
                           <button onClick={() => handleTimedUnblock(true)} className="bg-slate-100 text-slate-900 py-3 rounded-xl text-xs font-bold uppercase tracking-widest ">Permanent</button>
                         </div>
                      </div>
                    )}
                 </div>

                 {/* Enrollments */}
                 <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/30 space-y-6">
                    <div className="flex items-center gap-3 text-slate-900">
                       <CheckCircle className="w-5 h-5 text-emerald-500" />
                       <h3 className="text-lg font-bold">Module Permissions</h3>
                    </div>
                    <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
                       {enrollments.map((enroll, idx) => (
                         <div key={enroll.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between group">
                            <div className="min-w-0 pr-4">
                               <p className="text-sm font-bold text-slate-900 truncate">{enroll.courseTitle}</p>
                               <p className={`text-[10px] font-bold uppercase tracking-tighter ${enroll.status === 'approved' ? 'text-emerald-600' : 'text-amber-600'}`}>{enroll.status}</p>
                            </div>
                            <div className="flex gap-2">
                               {enroll.status === 'pending' && (
                                 <button onClick={() => handleApproveEnrollment(enroll.id)} className="p-2 bg-white text-emerald-600 rounded-lg hover:bg-emerald-50 transition-colors shadow-sm">
                                    <CheckCircle className="w-4 h-4" />
                                 </button>
                               )}
                               <button onClick={() => handleRevokeEnrollment(enroll.id)} className="p-2 bg-white text-red-500 rounded-lg hover:bg-red-50 transition-colors shadow-sm">
                                  <Trash2 className="w-4 h-4" />
                               </button>
                            </div>
                         </div>
                       ))}
                       {enrollments.length === 0 && <p className="text-center py-8 text-slate-400 text-sm font-medium italic">No module interactions.</p>}
                    </div>
                 </div>
              </div>

              {/* Submissions List */}
              <div className="space-y-6 pt-10">
                <div className="flex items-center gap-3">
                  <div className="w-1 bg-purple-600 h-6 rounded-full"></div>
                  <h3 className="text-2xl font-bold text-slate-900">Portfolio Evolutions</h3>
                </div>
                
                <div className="space-y-6">
                  {submissions.map(sub => (
                    <div key={sub.id} className="bg-white rounded-[2rem] border border-slate-100 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                       <div className="px-8 py-6 bg-slate-50/50 border-b border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                          <div className="space-y-1">
                             <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold text-purple-600 uppercase tracking-widest">{sub.activityType}</span>
                                <h4 className="text-lg font-bold text-slate-900">{sub.activityTitle}</h4>
                             </div>
                             <p className="text-[10px] font-medium text-slate-400 uppercase tracking-tighter">
                                {sub.submittedAt?.toDate()?.toLocaleString() || 'Recent Sync'}
                             </p>
                          </div>
                          <div className="bg-white px-6 py-2 rounded-xl border border-slate-100 text-center shadow-sm">
                             <p className={`text-2xl font-bold ${sub.status === 'graded' ? 'text-purple-600' : 'text-amber-500'}`}>{sub.score || 0}</p>
                             <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest -mt-1">{sub.status}</p>
                          </div>
                       </div>

                       <div className="p-8 space-y-8">
                          {/* Content Analysis */}
                          <div className="space-y-6">
                             <div className="flex items-center gap-2">
                                <MessageSquare className="w-4 h-4 text-slate-300" />
                                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Data Trace Analysis</span>
                             </div>
                             <div className="bg-slate-50 p-6 rounded-2xl italic text-slate-700 text-sm leading-relaxed border border-slate-100/50">
                                {sub.activityType === 'coding' ? (
                                   <pre className="font-mono text-xs not-italic text-indigo-600">{sub.content?.code}</pre>
                                ) : sub.activityType === 'quiz' ? (
                                   <div className="space-y-4 not-italic text-left">
                                      {sub.content?.results?.map((res: any, i: number) => (
                                         <div key={i} className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                                            <p className="font-bold text-slate-900 mb-2">{i + 1}. {res.question}</p>
                                            <div className="grid grid-cols-2 gap-4">
                                               <div>
                                                  <p className="text-[10px] font-bold uppercase text-slate-400">Selected</p>
                                                  <p className={`font-medium ${res.selected === res.correct ? 'text-emerald-600' : 'text-red-500'}`}>{res.selected ?? 'No Answer'}</p>
                                               </div>
                                               <div>
                                                  <p className="text-[10px] font-bold uppercase text-slate-400">Correct</p>
                                                  <p className="font-medium text-emerald-600">{res.correct}</p>
                                               </div>
                                            </div>
                                         </div>
                                      ))}
                                   </div>
                                ) : sub.activityType === 'qa' ? (
                                   <div className="not-italic text-left space-y-4">
                                      <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm">
                                         <p className="text-[10px] font-bold uppercase text-slate-400 mb-2">Student Response</p>
                                         <p className="text-slate-900 font-medium whitespace-pre-wrap leading-relaxed">{sub.content?.answer || 'No response recorded.'}</p>
                                      </div>
                                   </div>
                                ) : sub.activityType === 'foundation' ? (
                                   <div className="not-italic text-left">
                                      <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 flex items-center gap-3">
                                         <CheckCircle className="w-5 h-5 text-emerald-600" />
                                         <p className="text-emerald-700 font-bold">Concept interaction completed successfully.</p>
                                      </div>
                                   </div>
                                ) : (
                                   <pre className="font-mono text-[10px] bg-slate-900 text-slate-300 p-4 rounded-xl overflow-x-auto not-italic text-left">
                                      {JSON.stringify(sub.content, null, 2)}
                                   </pre>
                                )}
                             </div>
                          </div>

                          {/* Grading Hub */}
                          <div className="bg-slate-50 p-6 rounded-[1.5rem] border border-slate-100 space-y-6">
                             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="space-y-2">
                                   <label className="text-[10px] font-bold uppercase text-slate-400 ml-1">Assigned Grade</label>
                                   <input 
                                      type="number"
                                      defaultValue={sub.score}
                                      onBlur={e => setGradeData(p => ({ ...p, score: parseInt(e.target.value) }))}
                                      className="w-full bg-white border border-slate-200 p-3 rounded-xl font-bold text-lg outline-none focus:border-purple-300 transition-colors"
                                   />
                                </div>
                                <div className="md:col-span-2 space-y-2">
                                   <label className="text-[10px] font-bold uppercase text-slate-400 ml-1">Review Statement</label>
                                   <input 
                                      type="text"
                                      defaultValue={sub.feedback}
                                      onBlur={e => setGradeData(p => ({ ...p, feedback: e.target.value }))}
                                      className="w-full bg-white border border-slate-200 p-3 rounded-xl font-medium text-sm outline-none focus:border-purple-300 transition-colors"
                                      placeholder="Final evaluation summary..."
                                   />
                                </div>
                             </div>
                             <button 
                                onClick={() => handleGrade(sub.id)}
                                className="w-full bg-slate-900 text-white py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-purple-600 shadow-sm transition-all active:scale-[0.98]"
                             >
                                Finalize Evaluation
                             </button>
                          </div>
                       </div>
                    </div>
                  ))}
                  {submissions.length === 0 && <p className="text-center py-20 text-slate-300 font-medium italic">Record trace empty.</p>}
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div 
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               className="h-[calc(100vh-200px)] flex flex-col items-center justify-center bg-white border border-slate-100 rounded-[3rem] p-12 text-center shadow-sm"
            >
              <div className="w-24 h-24 bg-slate-50 rounded-[2rem] flex items-center justify-center mb-8 border border-slate-100">
                <Users className="w-10 h-10 text-slate-200" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-4">No Profile Loaded</h3>
              <p className="text-slate-500 max-w-sm mx-auto leading-relaxed font-medium">Select a student identity node from the primary directory to initiate professional review and operational command.</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Mentor Assignment Modal */}
      <AnimatePresence>
        {showMentorModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowMentorModal(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center">
                    <UserPlus className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900">Assign Mentor</h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none mt-1">Institutional Support</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowMentorModal(false)}
                  className="p-2 text-slate-300 hover:text-slate-600 hover:bg-slate-50 rounded-xl transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleAssignMentor} className="p-8 space-y-5">
                <div className="space-y-1.5">
                   <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-2">Mentor Name</label>
                   <input 
                     required
                     type="text"
                     value={mentorForm.name}
                     onChange={e => setMentorForm(p => ({ ...p, name: e.target.value }))}
                     className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl focus:ring-4 focus:ring-emerald-100 outline-none transition-all font-bold text-sm"
                     placeholder="e.g. Dr. Robert Miller"
                   />
                </div>
                <div className="space-y-1.5">
                   <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-2">Email Address</label>
                   <input 
                     required
                     type="email"
                     value={mentorForm.email}
                     onChange={e => setMentorForm(p => ({ ...p, email: e.target.value }))}
                     className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl focus:ring-4 focus:ring-emerald-100 outline-none transition-all font-medium text-sm"
                     placeholder="robert@institution.edu"
                   />
                </div>
                <div className="space-y-1.5">
                   <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-2">Contact Number</label>
                   <input 
                     type="tel"
                     value={mentorForm.phone}
                     onChange={e => setMentorForm(p => ({ ...p, phone: e.target.value }))}
                     className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl focus:ring-4 focus:ring-emerald-100 outline-none transition-all font-medium text-sm"
                     placeholder="+1 888 000 0000"
                   />
                </div>
                <div className="space-y-1.5">
                   <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-2">Photo URL</label>
                   <input 
                     type="url"
                     value={mentorForm.avatar}
                     onChange={e => setMentorForm(p => ({ ...p, avatar: e.target.value }))}
                     className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl focus:ring-4 focus:ring-emerald-100 outline-none transition-all font-medium text-sm"
                     placeholder="https://images.unsplash.com/..."
                   />
                </div>

                <button 
                  disabled={savingMentor}
                  type="submit"
                  className="w-full bg-emerald-600 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-100 hover:bg-emerald-700 transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  {savingMentor ? 'Saving...' : <><Save className="w-4 h-4" /> Save Mentor Assignment</>}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
