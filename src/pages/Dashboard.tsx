import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, getDoc, orderBy } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { User as FirebaseUser } from 'firebase/auth';
import { Book, CheckCircle, Clock, ArrowRight, User as UserIcon, RefreshCw, Megaphone, Phone, Mail, Linkedin } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';

interface Enrollment {
  courseId: string;
  joinedAt: any;
  status?: 'pending' | 'approved';
}

interface Course {
  id: string;
  title: string;
  description: string;
}

interface Submission {
  id: string;
  activityId: string;
  activityTitle: string;
  score: number;
  status: string;
  feedback?: string;
  activityType?: string;
  content?: any;
}

export default function Dashboard({ user }: { user: FirebaseUser }) {
  const [enrollments, setEnrollments] = useState<(Enrollment & { course?: Course })[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [mentors, setMentors] = useState<any[]>([]);
  const [studentProfile, setStudentProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [expandedSub, setExpandedSub] = useState<string | null>(null);

  const fetchDashboardData = async () => {
    setLoading(true);
    const enrollmentPath = 'enrollments';
    const submissionPath = 'submissions';
    try {
      // Enrolled courses
      const eq = query(collection(db, enrollmentPath), where('userId', '==', user.uid));
      const eSnapshot = await getDocs(eq);
      const enrolledData = await Promise.all(eSnapshot.docs.map(async (enrollDoc) => {
        const data = enrollDoc.data() as Enrollment;
        const courseDoc = await getDoc(doc(db, 'courses', data.courseId));
        return {
          ...data,
          course: courseDoc.exists() ? { id: courseDoc.id, ...courseDoc.data() } as Course : undefined
        };
      }));
      setEnrollments(enrolledData);

      // Activity marks
      const sq = query(collection(db, submissionPath), where('userId', '==', user.uid));
      const sSnapshot = await getDocs(sq);
      const fetchedSubmissions = sSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Submission));
      
      // Sort locally
      fetchedSubmissions.sort((a: any, b: any) => {
        const timeA = a.submittedAt?.toMillis() || 0;
        const timeB = b.submittedAt?.toMillis() || 0;
        return timeB - timeA;
      });

      setSubmissions(fetchedSubmissions);

      // Fetch Mentors
      const profileDoc = await getDoc(doc(db, 'users', user.uid));
      const profileData = profileDoc.data();
      
      if (profileData?.mentor) {
        setMentors([{ id: 'assigned', ...profileData.mentor }]);
      } else {
        // Fetch Mentors from the dedicated collection
        const mq = query(collection(db, 'mentors'), orderBy('createdAt', 'desc'));
        const mSnapshot = await getDocs(mq);
        setMentors(mSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }

    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, enrollmentPath);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [user.uid]);

  const avgGrade = submissions.length > 0 && submissions.some(s => s.status === 'graded')
    ? Math.round(submissions.filter(s => s.status === 'graded').reduce((acc, curr) => acc + (curr.score || 0), 0) / submissions.filter(s => s.status === 'graded').length) 
    : 0;

  return (
    <div className="space-y-10 pb-32">
      {/* Welcome Header */}
      <section className="bg-white p-6 md:p-10 rounded-[2rem] border border-slate-100 shadow-xl shadow-purple-200/10 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-purple-50 rounded-full blur-3xl -mr-32 -mt-32"></div>
        
        <div className="relative z-10 flex flex-col md:flex-row gap-6 items-center justify-between">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 bg-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-purple-200 shrink-0">
              <UserIcon className="w-8 h-8 text-white" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-purple-600 uppercase tracking-widest mb-0.5">Welcome Back</p>
              <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">
                {user.displayName || 'Learner'}
              </h1>
              <div className="flex gap-3 mt-2">
                <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-slate-400">
                   <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div> System Active
                </span>
                <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-slate-400 border-l border-slate-200 pl-3">
                   Student Member
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
             <Link to="/announcements" className="flex items-center gap-2 bg-amber-50 text-amber-700 px-4 py-2 rounded-xl text-xs font-bold border border-amber-100 hover:bg-amber-100 transition-colors">
                <Megaphone className="w-4 h-4" /> Announcements
             </Link>
             <div className="flex items-center gap-6 bg-slate-50 p-4 px-6 rounded-2xl border border-slate-100">
                <div className="text-center">
                   <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">Enrolled</p>
                   <p className="text-2xl font-bold text-slate-900">{enrollments.length}</p>
                </div>
                <div className="w-px h-8 bg-slate-200"></div>
                <div className="text-center">
                   <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">Performance</p>
                   <div className="flex items-center gap-1.5">
                      <p className="text-2xl font-bold text-slate-900">{avgGrade || '--'}</p>
                      <span className="text-[9px] font-bold text-emerald-500 bg-emerald-50 px-2 py-0.5 rounded-full">Avg</span>
                   </div>
                </div>
                <div className="w-px h-8 bg-slate-200"></div>
                <button 
                   onClick={fetchDashboardData}
                   disabled={loading}
                   className="p-2 text-slate-400 hover:text-purple-600 hover:bg-white rounded-xl transition-all disabled:opacity-50"
                   title="Refresh Data"
                >
                   <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
             </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* Learning Journey */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-1 bg-purple-600 h-5 rounded-full"></div>
            <h2 className="text-xl font-bold text-slate-900">Active Learning Journey</h2>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[1, 2].map(i => (
                <div key={i} className="h-64 bg-white border border-slate-100 rounded-3xl animate-pulse shadow-sm"></div>
              ))}
            </div>
          ) : enrollments.length === 0 ? (
            <div className="bg-white border border-slate-100 rounded-[2.5rem] p-16 text-center shadow-sm">
              <div className="w-20 h-20 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-6 text-slate-300">
                <Book className="w-10 h-10" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">No active enrollments</h3>
              <p className="text-slate-500 font-medium mb-8">Start your first learning module to begin your professional journey.</p>
              <Link to="/" className="inline-flex items-center gap-2 bg-purple-600 text-white px-8 py-4 rounded-2xl font-bold shadow-lg shadow-purple-100 hover:bg-purple-700 transition-all active:scale-95">
                Explore Directory <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {enrollments.map((enrollment, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-xl transition-all group flex flex-col active:scale-[0.99]"
                >
                  <div className="flex justify-between items-start mb-10">
                    <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-300 group-hover:bg-purple-50 group-hover:text-purple-600 transition-colors">
                       <CheckCircle className="w-5 h-5" />
                    </div>
                    {enrollment.status === 'pending' && (
                      <span className="bg-amber-50 text-amber-600 text-[9px] font-bold px-3 py-1.5 rounded-full uppercase tracking-wider border border-amber-100">
                        Enrollment Pending
                      </span>
                    )}
                  </div>
                  
                  <div className="flex-1 space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Module {String(idx + 1).padStart(2, '0')}</p>
                    <h3 className="text-xl font-bold text-slate-900 group-hover:text-purple-600 transition-colors leading-tight">
                      {enrollment.course?.title}
                    </h3>
                  </div>

                  <Link 
                    to={`/courses/${enrollment.courseId}`}
                    className="mt-10 w-full py-4 bg-slate-900 text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-purple-600 transition-all text-center shadow-lg shadow-slate-200"
                  >
                    {enrollment.status === 'pending' ? 'Track Status' : 'Resume Module'}
                  </Link>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Portfolio Analysis */}
        <div className="space-y-8">
          <div className="flex items-center gap-3">
            <div className="w-1 bg-emerald-500 h-6 rounded-full"></div>
            <h2 className="text-2xl font-bold text-slate-900">Portfolio Analysis</h2>
          </div>

          <div className="space-y-4">
            {submissions.map((sub, idx) => (
              <motion.div 
                key={sub.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="bg-white border border-slate-100 rounded-2xl shadow-sm hover:shadow-md transition-all overflow-hidden"
              >
                <button 
                  onClick={() => setExpandedSub(expandedSub === sub.id ? null : sub.id)}
                  className="w-full h-full text-left"
                >
                  <div className="p-5 flex justify-between items-center group">
                    <div className="space-y-1 flex-1 min-w-0 pr-4">
                      <p className="text-[9px] font-bold uppercase text-purple-600 tracking-wider">Evaluation Trace</p>
                      <h4 className="text-sm font-bold text-slate-900 truncate group-hover:text-purple-600 transition-colors">{sub.activityTitle}</h4>
                    </div>
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 flex flex-col items-center min-w-[60px] group-hover:bg-purple-50 transition-colors">
                      <p className={`text-lg font-bold leading-none ${sub.status === 'graded' ? 'text-slate-900' : 'text-amber-500'}`}>
                        {sub.score || '--'}
                      </p>
                      <p className="text-[7px] font-bold uppercase text-slate-400 mt-1 opacity-60 tracking-wider">MARX</p>
                    </div>
                  </div>

                  <AnimatePresence>
                    {expandedSub === sub.id && (
                      <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="bg-slate-50/50 border-t border-slate-50 overflow-hidden"
                      >
                        <div className="p-5 space-y-4">
                          {sub.feedback && (
                            <div className="p-4 bg-white rounded-xl border border-slate-100">
                               <p className="text-[8px] font-bold uppercase text-slate-400 tracking-widest mb-1">Feedback Report</p>
                               <p className="text-xs font-medium text-slate-600 leading-relaxed italic">{sub.feedback}</p>
                            </div>
                          )}
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-[8px] font-bold uppercase text-slate-300 tracking-widest">ID: {sub.id.slice(-8)}</span>
                            <Link to={`/submissions/${sub.id}`} className="text-[8px] font-bold uppercase text-purple-600 hover:underline">Full Analytics →</Link>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </button>
              </motion.div>
            ))}
            {submissions.length === 0 && !loading && (
              <div className="bg-slate-50 border border-slate-100 p-12 rounded-[2rem] text-center italic text-slate-400 font-medium">
                 Record history empty.
              </div>
            )}
          </div>

          {/* Mentorship Section */}
          <div className="space-y-6 pt-10">
            <div className="flex items-center gap-3">
              <div className="w-1 bg-purple-600 h-5 rounded-full"></div>
              <h2 className="text-xl font-bold text-slate-900">Mentorship Information</h2>
            </div>
            
            <div className="grid grid-cols-1 gap-4">
              {mentors.map(mentor => (
                <div key={mentor.id} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex items-center gap-5">
                   <div className="w-16 h-16 rounded-2xl overflow-hidden bg-slate-100 flex-shrink-0">
                      {mentor.avatar ? (
                        <img src={mentor.avatar} alt={mentor.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-300">
                           <UserIcon className="w-8 h-8" />
                        </div>
                      )}
                   </div>
                   <div className="flex-1 min-w-0">
                      <h4 className="text-lg font-bold text-slate-900 truncate">{mentor.name}</h4>
                      <p className="text-[10px] font-bold text-purple-600 uppercase tracking-widest mb-2">Assigned Mentor</p>
                      
                      <div className="flex flex-wrap gap-4">
                         {mentor.email && (
                           <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                              <Mail className="w-3.5 h-3.5" /> {mentor.email}
                           </div>
                         )}
                         {mentor.phone && (
                           <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                              <Phone className="w-3.5 h-3.5" /> {mentor.phone}
                           </div>
                         )}
                         {mentor.linkedIn && (
                           <a href={mentor.linkedIn} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-purple-600 font-bold hover:underline">
                              <Linkedin className="w-3.5 h-3.5" /> LinkedIn
                           </a>
                         )}
                      </div>
                   </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
