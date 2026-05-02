import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, query, where, getDocs, setDoc, deleteDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { Book, Play, FileQuestion as Quiz, FileText, CheckCircle, Lock, Unlock, ArrowRight, Trash2, Edit, Plus, Clock, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';

interface Course {
  id: string;
  title: string;
  description: string;
  instructorId: string;
}

interface Lesson {
  id: string;
  title: string;
  order: number;
}

interface Activity {
  id: string;
  title: string;
  type: 'quiz' | 'qa' | 'coding' | 'foundation';
  startTime?: any;
  endTime?: any;
}

export default function CourseDetails({ role }: { role: 'admin' | 'student' | null }) {
  const { courseId } = useParams();
  const [course, setCourse] = useState<Course | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [submissions, setSubmissions] = useState<Record<string, string>>({});
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [enrollmentStatus, setEnrollmentStatus] = useState<'pending' | 'approved' | null>(null);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    async function fetchData() {
      if (!courseId) return;
      try {
        const courseDoc = await getDoc(doc(db, 'courses', courseId));
        if (courseDoc.exists()) {
          setCourse({ id: courseDoc.id, ...courseDoc.data() } as Course);
          
          if (auth.currentUser) {
            const enrollDoc = await getDoc(doc(db, 'enrollments', `${auth.currentUser.uid}_${courseId}`));
            if (enrollDoc.exists()) {
              const data = enrollDoc.data();
              setEnrollmentStatus(data.status || 'approved'); // Existing enrollments might not have status
              setIsEnrolled(data.status === 'approved' || !data.status);
            } else {
              setEnrollmentStatus(null);
              setIsEnrolled(false);
            }

            // Fetch submissions to show status
            const sq = query(collection(db, 'submissions'), where('userId', '==', auth.currentUser.uid), where('courseId', '==', courseId));
            const sSnap = await getDocs(sq);
            const subs: Record<string, string> = {};
            sSnap.docs.forEach(d => subs[d.data().activityId] = d.id);
            setSubmissions(subs);
          }

          const lessonsSnap = await getDocs(collection(db, `courses/${courseId}/lessons`));
          setLessons(lessonsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Lesson)).sort((a,b) => a.order - b.order));

          const activitiesSnap = await getDocs(collection(db, `courses/${courseId}/activities`));
          setActivities(activitiesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Activity)));
        }
      } catch (error) {
        console.error("Fetch error:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [courseId]);

  const handleEnroll = async () => {
    if (!auth.currentUser || !courseId) return;
    setEnrolling(true);
    try {
      await setDoc(doc(db, 'enrollments', `${auth.currentUser.uid}_${courseId}`), {
        userId: auth.currentUser.uid,
        userName: auth.currentUser.displayName || auth.currentUser.email?.split('@')[0],
        courseId: courseId,
        courseTitle: course?.title,
        status: 'pending',
        joinedAt: new Date()
      });
      setEnrollmentStatus('pending');
      setIsEnrolled(false);
    } catch (error) {
      console.error("Enroll error:", error);
    } finally {
      setEnrolling(false);
    }
  };

  const handleDeleteCourse = async () => {
    if (!courseId || !window.confirm("Are you sure? This will delete the entire module and all associated data.")) return;
    const path = `courses/${courseId}`;
    try {
      await deleteDoc(doc(db, 'courses', courseId));
      navigate('/');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  const handleDeleteActivity = async (activityId: string) => {
    if (!courseId || !window.confirm("Delete this activity? All student submissions will remain but the activity itself will be removed from the curriculum.")) return;
    const path = `courses/${courseId}/activities/${activityId}`;
    try {
      await deleteDoc(doc(db, 'courses', courseId, 'activities', activityId));
      setActivities(prev => prev.filter(a => a.id !== activityId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  const handleDeleteLesson = async (lessonId: string) => {
    if (!courseId || !window.confirm("Delete this lesson?")) return;
    const path = `courses/${courseId}/lessons/${lessonId}`;
    try {
      await deleteDoc(doc(db, 'courses', courseId, 'lessons', lessonId));
      setLessons(prev => prev.filter(l => l.id !== lessonId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  const handleExtendActivity = async (activityId: string) => {
    if (!courseId) return;
    const newEndTime = new Date(Date.now() + 24 * 60 * 60 * 1000); // Extend by 24 hours from now
    const path = `courses/${courseId}/activities/${activityId}`;
    try {
      await updateDoc(doc(db, 'courses', courseId, 'activities', activityId), {
        endTime: Timestamp.fromDate(newEndTime)
      });
      setActivities(prev => prev.map(a => a.id === activityId ? { ...a, endTime: Timestamp.fromDate(newEndTime) } : a));
      alert("Terminal session resumed. Availability extended by 24 hours.");
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  if (loading) return <div>Loading course...</div>;
  if (!course) return <div>Course not found.</div>;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 pb-32">
      {/* Left Column: Content */}
      <div className="lg:col-span-2 space-y-12">
        <section className="space-y-8 bg-white/80 backdrop-blur-sm p-8 md:p-12 rounded-[2rem] border border-[#e2e8f0] shadow-sm relative overflow-hidden">
           <div className="absolute top-0 right-0 w-32 h-32 bg-[#7c3aed]/5 rounded-full blur-3xl"></div>
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <span className="font-black text-[10px] bg-[#7c3aed] text-white px-3 py-1 rounded-full uppercase tracking-[0.2em] border border-black/10">Module Core</span>
              {role === 'admin' && course.instructorId === auth.currentUser?.uid && (
                <button onClick={handleDeleteCourse} className="text-red-500 hover:scale-110 transition-transform">
                  <Trash2 className="w-5 h-5" />
                </button>
              )}
            </div>
            <h1 className="text-3xl md:text-5xl font-bold tracking-tight leading-tight text-slate-900">
              {course.title}
            </h1>
          </div>
          <p className="text-lg md:text-xl text-slate-600 leading-relaxed font-medium italic">
            {course.description}
          </p>
        </section>

        {/* Curriculum */}
        <section className="space-y-12">
          <div className="flex items-center justify-between border-b border-gray-100 pb-6">
            <h2 className="text-3xl font-bold text-slate-900 tracking-tight">The Curriculum</h2>
            {role === 'admin' && (
              <div className="flex gap-4">
                 <Link to={`/admin/courses/${courseId}/lessons/new`} className="flex items-center gap-2 bg-[#10b981] text-white px-4 py-2.5 rounded-xl font-black text-[10px] uppercase shadow-md hover:bg-[#059669] transition-all active:scale-95">
                  <Plus className="w-4 h-4" /> Add Lesson
                </Link>
                <Link to={`/admin/courses/${courseId}/activities/new`} className="flex items-center gap-2 bg-[#f59e0b] text-white px-4 py-2.5 rounded-xl font-black text-[10px] uppercase shadow-md hover:bg-[#d97706] transition-all active:scale-95">
                  <Plus className="w-4 h-4" /> Add Activity
                </Link>
              </div>
            )}
          </div>

          {/* Lessons */}
          <div className="space-y-4">
            <h3 className="font-black text-xs uppercase tracking-[0.3em] text-[#7c3aed] border-b-2 border-[#7c3aed]/10 pb-2 mb-6">
              01. Theoretical Foundation
            </h3>
            <div className="space-y-3">
              {lessons.map((lesson, idx) => (
                <Link 
                  key={lesson.id}
                  to={isEnrolled || role === 'admin' ? `/courses/${courseId}/lessons/${lesson.id}` : '#'}
                  className={`flex items-center gap-4 p-4 bg-white border border-[#e2e8f0] rounded-xl transition-all hover:bg-[#f8fafc] hover:border-[#7c3aed] group ${(!isEnrolled && role !== 'admin') && 'cursor-not-allowed opacity-50'}`}
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center border transition-colors ${
                    isEnrolled || role === 'admin' ? 'bg-[#7c3aed]/5 border-[#7c3aed]/20 text-[#7c3aed]' : 'bg-gray-50 border-gray-100 text-gray-300'
                  }`}>
                    {isEnrolled || role === 'admin' ? (
                      <div className="relative">
                        <Play className="w-5 h-5 fill-[#7c3aed]" />
                      </div>
                    ) : (
                      <Lock className="w-4 h-4" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-[10px] font-black uppercase text-[#7c3aed] opacity-40 leading-none mb-1">
                      Lesson {idx + 1 < 10 ? `0${idx + 1}` : idx + 1}
                    </p>
                    <span className="text-lg font-bold text-[#0f172a] group-hover:text-[#7c3aed] transition-colors">
                      {lesson.title}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    {role === 'admin' && (
                      <button 
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleDeleteLesson(lesson.id);
                        }}
                        className="p-2 text-gray-300 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                    <ArrowRight className="w-5 h-5 text-[#7c3aed] opacity-0 group-hover:opacity-100 transition-all translate-x-[-10px] group-hover:translate-x-0" />
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Activities */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h3 className="font-black text-xs uppercase tracking-[0.3em] text-[#f43f5e] border-b-2 border-[#f43f5e]/10 pb-2">
                02. Practical Validation
              </h3>
              {role === 'student' && activities.length > 0 && (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search activities..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#7c3aed] focus:border-transparent w-full sm:w-64"
                  />
                </div>
              )}
            </div>
            <div className="space-y-4">
              {activities
                .filter(activity => 
                  searchTerm === '' || 
                  activity.title.toLowerCase().includes(searchTerm.toLowerCase())
                )
                .map((activity) => {
                const now = new Date();
                const startTime = activity.startTime?.toDate();
                const endTime = activity.endTime?.toDate();
                const isOpen = (!startTime || now >= startTime) && (!endTime || now <= endTime);
                const isComing = startTime && now < startTime;
                const isPast = endTime && now > endTime;

                // Color mapping based on image types
                let typeColor = 'bg-[#f43f5e]'; // Pink (Assignment/Quiz)
                let Icon = Quiz;
                if (activity.type === 'foundation') {
                  typeColor = 'bg-[#0f172a]'; // Dark (Protocols)
                  Icon = Play;
                } else if (activity.type === 'coding') {
                  typeColor = 'bg-[#8b5cf6]'; // Purple
                  Icon = Clock;
                }

                return (
                  <div key={activity.id} className="bg-white border border-[#e2e8f0] rounded-2xl p-6 transition-all hover:shadow-lg hover:border-[#7c3aed]/20 group relative">
                    <div className="flex flex-col md:flex-row md:items-center gap-6">
                      {/* Icon Section */}
                      <div className={`w-12 h-12 rounded-xl border border-white/10 flex items-center justify-center text-white shadow-lg shadow-black/10 shrink-0 ${typeColor}`}>
                        <Icon className="w-6 h-6" />
                      </div>

                      {/* Content Section */}
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-3">
                          <Link 
                            to={isOpen && (isEnrolled || role === 'admin') ? `/courses/${courseId}/activities/${activity.id}` : '#'}
                            className={`text-xl font-bold transition-colors ${
                              isOpen && (isEnrolled || role === 'admin') 
                                ? 'text-[#7c3aed] hover:underline' 
                                : 'text-gray-400 cursor-not-allowed'
                            }`}
                          >
                            {activity.title}
                          </Link>
                          {submissions[activity.id] && (
                            <span className="bg-[#10b981]/10 text-[#10b981] text-[10px] font-black uppercase px-2 py-0.5 rounded border border-[#10b981]/20">
                              DONE
                            </span>
                          )}
                        </div>
                        
                        <div className="flex flex-wrap gap-x-6 gap-y-1 text-[11px] font-medium text-gray-500">
                          {startTime && (
                            <span className="flex items-center gap-1.5">
                              <span className="font-bold uppercase text-gray-400">Opened:</span> {format(startTime, 'EEEE, d MMMM yyyy, h:mm a')}
                            </span>
                          )}
                          {endTime && (
                            <span className="flex items-center gap-1.5">
                              <span className="font-bold uppercase text-gray-400">Due:</span> {format(endTime, 'EEEE, d MMMM yyyy, h:mm a')}
                            </span>
                          )}
                          {!startTime && !endTime && (
                            <span className="italic text-gray-400">Continuous Assessment Module</span>
                          )}
                        </div>

                        {/* Status overlays if locked/past */}
                        {!isOpen && !submissions[activity.id] && (
                          <div className="mt-2 text-[10px] font-black uppercase flex items-center gap-2">
                            {isComing && <span className="text-[#f59e0b] bg-[#f59e0b]/10 px-2 py-0.5 rounded">LOCKED_UNTIL_START</span>}
                            {isPast && <span className="text-[#f43f5e] bg-[#f43f5e]/10 px-2 py-0.5 rounded">AVAILABILITY_EXPIRED</span>}
                            {!isEnrolled && role !== 'admin' && <span className="text-gray-400 bg-gray-100 px-2 py-0.5 rounded">ENROLLMENT_REQUIRED</span>}
                          </div>
                        )}
                      </div>

                      {/* CTA/Admin Section */}
                      <div className="flex items-center gap-3">
                        {role === 'admin' && (
                          <div className="flex items-center gap-2">
                            {isPast && (
                              <button 
                                onClick={() => handleExtendActivity(activity.id)}
                                className="p-3 bg-purple-50 text-purple-600 hover:bg-purple-100 border border-purple-100 rounded-xl transition-all flex items-center gap-2 text-[10px] font-black uppercase tracking-widest"
                                title="Resume & Extend Time"
                              >
                                <Clock className="w-4 h-4" />
                                Resume
                              </button>
                            )}
                            <button 
                              onClick={() => handleDeleteActivity(activity.id)}
                              className="p-3 bg-[#f8fafc] text-gray-400 hover:text-red-500 hover:bg-red-50 border border-[#e2e8f0] rounded-xl transition-all"
                              title="Delete Activity"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </div>
                        )}
                        
                        {submissions[activity.id] && (
                          <Link 
                            to={`/submissions/${submissions[activity.id]}`}
                            className="px-6 py-3 bg-white text-[#7c3aed] rounded-xl font-bold text-xs uppercase tracking-widest border border-[#7c3aed] hover:bg-[#7c3aed] hover:text-white transition-all shadow-sm"
                          >
                            Review Submission
                          </Link>
                        )}

                        {isOpen && (isEnrolled || role === 'admin') && !submissions[activity.id] && (
                          <Link 
                            to={`/courses/${courseId}/activities/${activity.id}`}
                            className="px-8 py-3 bg-[#7c3aed] text-white rounded-xl font-bold text-xs uppercase tracking-widest shadow-md hover:bg-[#6d28d9] transition-all active:scale-95"
                          >
                            Enter
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              {activities.length === 0 && (
                <div className="p-12 text-center bg-white/50 border-2 border-dashed border-gray-200 rounded-3xl text-gray-400 font-bold uppercase tracking-widest text-sm italic">
                  No active learning modules.
                </div>
              )}
            </div>
          </div>
        </section>
      </div>

      {/* Right Column: Actions */}
      <div className="space-y-8">
        <div className="bg-[#8b5cf6] text-white p-10 space-y-8 border border-white/5 rounded-[2.5rem] shadow-2xl sticky top-24 overflow-hidden">
          <div className="absolute -right-20 -top-20 w-80 h-80 bg-white/10 rounded-full blur-3xl"></div>
          <div className="absolute -left-10 -bottom-10 w-40 h-40 bg-black/10 rounded-full blur-2xl"></div>
          
          <div className="space-y-6 relative z-10">
            <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-[0.3em] bg-black/20 p-2 rounded-lg border border-white/10">
              <span className="opacity-70 text-white">SYSTEM STATUS</span>
              <span className="text-[#facc15]">{isEnrolled ? 'ENROLLED' : 'IDLE'}</span>
            </div>
            <div className="text-5xl font-black italic uppercase tracking-tighter leading-none">
              GRATIS <br />
              <span className="text-[#10b981]">ACCESS</span>
            </div>
          </div>
          
          <div className="relative z-10">
            {!enrollmentStatus && role === 'student' && (
              <button 
                onClick={handleEnroll}
                disabled={enrolling}
                className="w-full bg-[#facc15] text-black py-6 rounded-2xl font-black uppercase tracking-[0.2em] text-lg shadow-xl hover:shadow-[#facc15]/20 hover:scale-[1.02] transition-all disabled:opacity-50 active:scale-95"
              >
                {enrolling ? 'PROVISIONING...' : 'ENROLL NOW'}
              </button>
            )}

            {enrollmentStatus === 'pending' && (
              <div className="bg-white/95 backdrop-blur-sm text-[#1a1a1a] p-6 rounded-2xl shadow-xl space-y-4">
                <div className="flex items-center gap-3 text-orange-500 font-black uppercase tracking-widest text-sm">
                  <Clock className="w-5 h-5" />
                  AWAITING KEY
                </div>
                <p className="text-xs font-bold leading-relaxed uppercase opacity-70 italic tracking-tighter text-gray-500">Your registration is under terminal review. Access will be authorized shortly.</p>
              </div>
            )}

            {enrollmentStatus === 'approved' && (
              <div className="bg-[#10b981]/10 backdrop-blur-sm text-[#10b981] border border-[#10b981]/20 p-6 rounded-2xl shadow-sm flex items-center gap-4">
                <CheckCircle className="w-8 h-8" />
                <span className="text-lg font-black uppercase italic tracking-tighter">Mission Authorized</span>
              </div>
            )}

            {role === 'admin' && (
              <div className="bg-white/10 backdrop-blur-sm p-6 rounded-2xl border border-white/10 text-center space-y-1">
                <div className="text-lg font-black uppercase italic tracking-tighter text-white">System Supervisor</div>
                <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">Full overrides active</div>
              </div>
            )}

            {!auth.currentUser && (
              <Link to="/login" className="block w-full bg-black text-white py-6 rounded-2xl text-center font-black uppercase tracking-[0.2em] text-lg shadow-xl hover:bg-gray-900 transition-all">
                Access Data
              </Link>
            )}
          </div>

          <div className="pt-8 border-t border-white/10 space-y-5 relative z-10">
            {[
              { label: 'Lessons', val: lessons.length, color: 'text-sky-300' },
              { label: 'Challenges', val: activities.length, color: 'text-rose-300' },
              { label: 'Skill Rank', val: 'VETERAN', color: 'text-amber-300' }
            ].map(item => (
              <div key={item.label} className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                <span className="opacity-60 text-white">{item.label}</span>
                <span className={item.color}>{item.val}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
