import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { ArrowLeft, User, FileText, CheckCircle, Clock } from 'lucide-react';
import { motion } from 'motion/react';
import { format } from 'date-fns';

interface Submission {
  id: string;
  userId: string;
  userName: string;
  activityId: string;
  score: number;
  totalQuestions: number;
  submitted_at: any;
  status: string;
}

interface Activity {
  id: string;
  title: string;
}

export default function CourseReports() {
  const { courseId } = useParams();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [activities, setActivities] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchReports() {
      if (!courseId) return;
      try {
        // Fetch all activities title for mapping
        const actSnap = await getDocs(collection(db, `courses/${courseId}/activities`));
        const actMap: Record<string, string> = {};
        actSnap.docs.forEach(d => actMap[d.id] = d.data().title);
        setActivities(actMap);

        // Fetch submissions for this course
        const q = query(collection(db, 'submissions'), where('courseId', '==', courseId));
        const subSnap = await getDocs(q);
        setSubmissions(subSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Submission)));
      } catch (error) {
        console.error("Reports fetch error:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchReports();
  }, [courseId]);

  if (loading) return <div>Analyzing Performance Data...</div>;

  return (
    <div className="space-y-12 pb-32">
      <div className="space-y-6">
        <Link to="/dashboard" className="inline-flex items-center gap-3 px-4 py-2 bg-white border-2 border-black rounded-xl text-xs font-black uppercase tracking-widest hover:bg-black hover:text-white transition-all shadow-[4px_4px_0px_rgba(0,0,0,1)]">
          <ArrowLeft className="w-4 h-4" /> Terminal
        </Link>
        <h1 className="text-6xl font-black uppercase italic tracking-tighter text-[#1a1a1a] drop-shadow-[4px_4px_0px_#facc15]">Performance Audit</h1>
      </div>

      <section className="bg-white border-4 border-black rounded-[2rem] overflow-hidden shadow-[16px_16px_0px_rgba(0,0,0,1)]">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-black text-white font-black text-xs uppercase tracking-[0.2em] text-left">
                <th className="p-6 border-r border-white/20 italic">Candidate</th>
                <th className="p-6 border-r border-white/20 italic">Mission / ID</th>
                <th className="p-6 border-r border-white/20 italic">Validation Score</th>
                <th className="p-6 border-r border-white/20 italic">Log Entry</th>
                <th className="p-6 italic">Protocol</th>
              </tr>
            </thead>
            <tbody className="text-xs uppercase font-black">
              {submissions.map((sub, idx) => (
                <tr key={sub.id} className="border-b-4 border-black hover:bg-[#f8fafc] transition-colors group">
                  <td className="p-6">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-[#7c3aed] text-white rounded-lg flex items-center justify-center border-2 border-black shadow-[2px_2px_0px_rgba(0,0,0,1)]">
                        <User className="w-4 h-4" />
                      </div>
                      <span className="text-lg font-black italic tracking-tighter">{sub.userName || 'Unknown'}</span>
                    </div>
                  </td>
                  <td className="p-6 font-bold">
                    <div className="space-y-1">
                      <p className="text-[#0f172a]">{activities[sub.activityId] || 'DELETED_ORPHAN'}</p>
                      <p className="text-[9px] font-mono opacity-30">ID: {sub.id.slice(0,12)}</p>
                    </div>
                  </td>
                  <td className="p-6">
                    <span className={`px-4 py-2 rounded-xl border-2 border-black font-black italic text-lg shadow-[4px_4px_0px_rgba(0,0,0,1)] ${
                      sub.score >= 40 
                        ? 'bg-[#10b981] text-white' 
                        : 'bg-[#f43f5e] text-white shadow-[4px_4px_0px_#881337]'}`}>
                      {sub.score} <span className="opacity-60 text-xs">/</span> {sub.totalQuestions}
                    </span>
                  </td>
                  <td className="p-6 font-mono opacity-50 text-[10px]">
                    {sub.submitted_at?.toDate() ? format(sub.submitted_at.toDate(), 'yyyy-MM-dd | HH:mm:ss') : 'UNAVAILABLE'}
                  </td>
                  <td className="p-6">
                    <Link to={`/submissions/${sub.id}`} className="inline-block px-5 py-2 bg-black text-white rounded-lg font-black uppercase text-[10px] tracking-widest border-2 border-black hover:bg-white hover:text-black transition-all shadow-[4px_4px_0px_rgba(0,0,0,0.1)] group-hover:shadow-[4px_4px_0px_rgba(0,0,0,1)]">
                      Review
                    </Link>
                  </td>
                </tr>
              ))}
              {submissions.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-24 text-center">
                    <div className="space-y-4 opacity-20">
                      <FileText className="w-16 h-16 mx-auto" />
                      <p className="text-3xl font-black uppercase italic tracking-tighter">NO SUBMISSION RECORDS LOGGED</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
