import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { CheckCircle, XCircle, ArrowLeft, RotateCcw } from 'lucide-react';
import { motion } from 'motion/react';

interface Submission {
  id: string;
  activityId: string;
  courseId: string;
  score: number;
  totalQuestions: number;
  answers?: Record<string, any>;
  content?: Record<string, any>;
  activityType?: string;
  submittedAt: any;
}

interface Question {
  id: string;
  question_text: string;
  options: string[];
  correct_answer: number;
}

export default function SubmissionReview() {
  const { submissionId } = useParams();
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [activityTitle, setActivityTitle] = useState('');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    async function fetchSubmission() {
      if (!submissionId) return;
      try {
        let subData: any = null;
        
        if (submissionId === 'last') {
          if (!auth.currentUser) return;
          const q = query(
            collection(db, 'submissions'), 
            where('userId', '==', auth.currentUser.uid),
            orderBy('submittedAt', 'desc'),
            limit(1)
          );
          const snap = await getDocs(q);
          if (!snap.empty) {
            subData = { id: snap.docs[0].id, ...snap.docs[0].data() };
          }
        } else {
          const snap = await getDoc(doc(db, 'submissions', submissionId));
          if (snap.exists()) {
            subData = { id: snap.id, ...snap.data() };
          }
        }

        if (subData) {
          setSubmission(subData);
          // Fetch activity title
          const actSnap = await getDoc(doc(db, `courses/${subData.courseId}/activities`, subData.activityId));
          if (actSnap.exists()) {
            setActivityTitle(actSnap.data().title);
            
            // If it's a quiz, fetch questions
            if (subData.activityType === 'quiz' || (actSnap.data().type === 'quiz')) {
               const qSnap = await getDocs(collection(db, `courses/${subData.courseId}/activities/${subData.activityId}/questions`));
               setQuestions(qSnap.docs.map(d => ({ id: d.id, ...d.data() } as Question)));
            }
          }
        }
      } catch (error) {
        console.error("Review fetch error:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchSubmission();
  }, [submissionId, auth.currentUser?.uid]);

  if (loading) return <div className="p-12 text-center animate-pulse uppercase font-mono">Calibrating Results...</div>;
  if (!submission) return <div className="p-12 text-center">No submission record found.</div>;

  const score = submission.score || 0;
  // If it's a quiz (activityType is quiz or we have fetched questions), use totalQuestions/questions.length.
  // For other activities (coding, qa, foundation without questions), we use 100 if manually graded.
  const isQuiz = submission.activityType === 'quiz' || questions.length > 0;
  const total = isQuiz 
    ? (submission.totalQuestions || questions.length || 1) 
    : 100;
  
  const percentage = total > 0 ? (score / total) * 100 : 0;
  // If it's a quiz, percentage is calculated relative to question count.
  // We want to pass if percentage >= 40.
  const isSuccess = percentage >= 40;
  const submissionContent = submission.content || submission.answers || {};

  return (
    <div className="max-w-3xl mx-auto space-y-12 pb-32">
      <div className="text-center space-y-6">
        <div className="inline-block px-6 py-2 bg-[#0f172a] text-white text-[10px] font-black uppercase tracking-[0.4em] rounded-full shadow-sm">
          POST-SESSION ANALYSIS
        </div>
        <h1 className="text-6xl md:text-8xl font-black uppercase italic tracking-tighter leading-none text-[#0f172a]">
          SCORE: {score}<span className="text-[#7c3aed] opacity-30">/</span>{total}
        </h1>
      </div>

      <section className={`p-12 text-center rounded-[3rem] shadow-2xl relative overflow-hidden ${isSuccess ? 'bg-[#10b981]' : 'bg-[#f43f5e]'}`}>
        <div className="absolute top-0 left-0 w-full h-2 bg-black/10"></div>
        <div className="absolute -right-20 -bottom-20 w-96 h-96 bg-white/10 rounded-full blur-3xl"></div>
        
        <div className="relative z-10 space-y-10 text-white">
          <div className="space-y-4">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-70">Operational Module</p>
            <h2 className="text-4xl md:text-5xl font-black uppercase italic tracking-tighter leading-tight">{activityTitle}</h2>
          </div>

          <div className="flex justify-center">
            <div className="w-48 h-48 rounded-[2.5rem] bg-white shadow-xl flex items-center justify-center rotate-3 border border-white/20">
              <span className={`text-6xl font-black italic tracking-tighter ${isSuccess ? 'text-[#10b981]' : 'text-[#f43f5e]'}`}>
                {Math.round(percentage)}%
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 pt-10 border-t border-white/20">
            <div className="text-left space-y-2">
              <p className="text-[10px] font-black uppercase opacity-60 tracking-widest">Efficiency Status</p>
              <p className="text-2xl font-black uppercase italic tracking-tighter">{isSuccess ? 'MISSION_PASSED' : 'OUT_OF_THRESHOLD'}</p>
            </div>
            <div className="text-right space-y-2">
              <p className="text-[10px] font-black uppercase opacity-60 tracking-widest">Entry Timestamp</p>
              <p className="text-2xl font-black uppercase italic tracking-tighter leading-none">
                {submission.submittedAt?.toDate() ? submission.submittedAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'RECENT'}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Submission Content Review */}
      <section className="space-y-8">
        <div className="flex items-center gap-4 border-b border-gray-100 pb-6">
          <div className="w-12 h-12 bg-[#7c3aed] text-white rounded-2xl flex items-center justify-center shadow-lg shadow-purple-500/20">
            <CheckCircle className="w-6 h-6" />
          </div>
          <h3 className="text-3xl font-black uppercase italic tracking-tighter text-[#0f172a]">Answer Manifest</h3>
        </div>

        <div className="bg-white p-8 md:p-12 rounded-[2.5rem] shadow-xl border border-gray-50">
          {questions.length > 0 ? (
            <div className="space-y-8">
              {questions.map((q, idx) => {
                const userAnswer = submissionContent[q.id];
                const isCorrect = userAnswer === q.correct_answer;
                return (
                  <div key={q.id} className="space-y-4 bg-gray-50/50 p-6 rounded-3xl border border-gray-100">
                    <div className="flex justify-between items-start">
                      <p className="text-[9px] font-black uppercase text-[#7c3aed] tracking-widest">QUERY_{idx + 1}</p>
                      <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase shadow-sm ${isCorrect ? 'bg-[#10b981] text-white' : 'bg-[#f43f5e] text-white'}`}>
                        {isCorrect ? 'VERIFIED' : 'ERROR'}
                      </span>
                    </div>
                    <p className="text-lg font-bold text-[#0f172a] leading-tight">{q.question_text}</p>
                    <div className="space-y-2">
                       {q.options.map((opt, oIdx) => (
                         <div key={oIdx} className={`p-4 rounded-2xl border text-sm font-medium transition-all ${
                           userAnswer === oIdx 
                             ? (isCorrect ? 'bg-[#10b981]/10 border-[#10b981] text-[#10b981]' : 'bg-[#f43f5e]/10 border-[#f43f5e] text-[#f43f5e]')
                             : (oIdx === q.correct_answer ? 'bg-gray-50 border-gray-200 text-gray-800' : 'bg-transparent border-gray-100 text-gray-400 opacity-60')
                         }`}>
                           {opt}
                           {userAnswer === oIdx && <span className="float-right text-[9px] font-black uppercase tracking-widest mt-1 opacity-60">YOUR_SELECTION</span>}
                           {oIdx === q.correct_answer && userAnswer !== oIdx && <span className="float-right text-[9px] font-black uppercase tracking-widest mt-1 opacity-60">EXPECTED_DATA</span>}
                         </div>
                       ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-8">
              {Object.entries(submissionContent).map(([key, val], idx) => (
                <div key={key} className="space-y-3 bg-gray-50/50 p-6 rounded-3xl border border-gray-100">
                  <p className="text-[9px] font-black uppercase text-[#7c3aed] tracking-widest">DATA_FEED_{idx + 1}</p>
                  <p className="text-[10px] font-bold text-gray-400 mb-2 uppercase tracking-wide">SOURCE: {key === 'code' ? 'INTEGRATED_TERMINAL' : key}</p>
                  <div className={`p-6 rounded-2xl font-bold text-lg text-[#0f172a] shadow-inner ${key === 'code' ? 'font-mono text-xs bg-[#0f172a] text-[#c084fc] border border-white/5' : 'bg-white italic border border-gray-100'}`}>
                    {key === 'code' ? (
                      <pre className="whitespace-pre-wrap leading-relaxed">{String(val)}</pre>
                    ) : (
                      String(val)
                    )}
                  </div>
                </div>
              ))}
              {Object.keys(submissionContent).length === 0 && (
                <div className="bg-gray-50 p-12 rounded-[2rem] font-bold italic text-lg text-gray-300 text-center uppercase tracking-widest">
                  NO_DATA_PAYLOAD_DETECTED
                </div>
              )}
            </div>
          )}
          
          <div className="mt-12 p-6 bg-gray-50 rounded-2xl border border-dashed border-gray-200 text-center">
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#7c3aed]">Read-Only Interface</p>
            <p className="text-[10px] font-medium text-gray-400 mt-1 italic">This record is sealed and cannot be modified.</p>
          </div>
        </div>
      </section>

      <div className="flex flex-col sm:flex-row gap-6 justify-center pt-8">
        <Link to="/dashboard" className="bg-[#0f172a] text-white px-10 py-5 rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center gap-3 shadow-lg hover:bg-black transition-all active:scale-95">
          <ArrowLeft className="w-5 h-5" /> Back to Terminal
        </Link>
        <Link to={`/courses/${submission.courseId}`} className="bg-white text-[#0f172a] px-10 py-5 rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center gap-3 border border-gray-100 shadow-md hover:bg-gray-50 transition-all active:scale-95">
          <RotateCcw className="w-5 h-5" /> Return to Curriculum
        </Link>
      </div>
    </div>
  );
}
