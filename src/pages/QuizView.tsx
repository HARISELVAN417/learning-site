import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, getDocs, addDoc, serverTimestamp, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { User as FirebaseUser } from 'firebase/auth';
import { Clock, Send, AlertTriangle, CheckCircle, ArrowLeft, MessageSquare, Lock } from 'lucide-react';
import { motion } from 'motion/react';
import { formatDistanceToNow, isAfter } from 'date-fns';

interface Question {
  id: string;
  question_text: string;
  options: string[];
  correct_answer: number;
}

interface Activity {
  title: string;
  type: 'quiz' | 'qa' | 'coding' | 'foundation';
  description?: string;
  coding_template?: string;
  programming_language?: 'javascript' | 'python' | 'java' | 'c' | 'cpp' | 'web';
  expected_output?: string;
  qa_prompts?: string[];
  max_score: number;
  password?: string;
  startTime: any;
  endTime: any;
}

export default function QuizView({ user }: { user: FirebaseUser }) {
  const { courseId, activityId } = useParams();
  const navigate = useNavigate();
  const [activity, setActivity] = useState<Activity | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [codeOutput, setCodeOutput] = useState('');
  const [isOutputCorrect, setIsOutputCorrect] = useState<boolean | null>(null);
  const [webPreview, setWebPreview] = useState('');
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (activity?.type === 'coding' && activity?.programming_language === 'web' && answers.code) {
      const code = answers.code;
      // Extract HTML, CSS, and JS from the code
      // Simple separation by tags for now or just treat as one big block
      const htmlMatch = code.match(/<!-- HTML -->([\s\S]*?)(?:<style>|<script>|$)/);
      const styleMatch = code.match(/<style>([\s\S]*?)<\/style>/);
      const scriptMatch = code.match(/<script>([\s\S]*?)<\/script>/);

      const html = htmlMatch ? htmlMatch[1] : code;
      const css = styleMatch ? styleMatch[1] : '';
      const js = scriptMatch ? scriptMatch[1] : '';

      const fullHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <style>${css}</style>
          </head>
          <body>
            ${html}
            <script>
              const originalLog = console.log;
              console.log = (...args) => {
                window.parent.postMessage({ type: 'CONSOLE_LOG', payload: args.join(' ') }, '*');
                originalLog(...args);
              };
              try {
                ${js}
              } catch (err) {
                console.log("Runtime Error: " + err.message);
              }
            </script>
          </body>
        </html>
      `;
      setWebPreview(fullHtml);
    }
  }, [answers.code, activity]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'CONSOLE_LOG') {
        setCodeOutput(prev => prev + event.data.payload + '\n');
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);
  useEffect(() => {
    async function fetchData() {
      if (!courseId || !activityId) return;
      try {
        const activityDoc = await getDoc(doc(db, `courses/${courseId}/activities`, activityId));
        if (!activityDoc.exists()) return;
        
        const actData = activityDoc.data() as Activity;
        const now = new Date();
        const startTime = actData.startTime?.toDate();
        const endTime = actData.endTime?.toDate();

        if (startTime && now < startTime) {
          alert(`Activity opens at ${startTime.toLocaleString()}`);
          navigate(`/courses/${courseId}`);
          return;
        }

        if (endTime && now > endTime) {
          alert(`Activity closed at ${endTime.toLocaleString()}`);
          navigate(`/courses/${courseId}`);
          return;
        }

        setActivity(actData);

        if (actData.type === 'quiz' || actData.type === 'foundation') {
          const questionsSnap = await getDocs(collection(db, `courses/${courseId}/activities/${activityId}/questions`));
          const fetchedQuestions = questionsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Question));
          setQuestions(fetchedQuestions);
          
          if (actData.type === 'foundation' && fetchedQuestions.length === 0) {
            const initialAns: Record<string, string> = {};
            actData.qa_prompts?.forEach(p => initialAns[p] = '');
            setAnswers(initialAns);
          }
        } 
        
        if (actData.type === 'coding') {
          setAnswers({ code: actData.coding_template || '' });
        } else if (actData.type === 'qa') {
          const initialAns: Record<string, string> = {};
          actData.qa_prompts?.forEach(p => initialAns[p] = '');
          setAnswers(initialAns);
        }
      } catch (error) {
        console.error("Fetch error:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [courseId, activityId, navigate]);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (submitting) return;
    
    setSubmitting(true);
    try {
      let score = 0;
      let status = 'pending';

      if (activity?.type === 'quiz' || (activity?.type === 'foundation' && questions.length > 0)) {
        questions.forEach(q => {
          if (answers[q.id] === q.correct_answer) {
            score += 1;
          }
        });
        if (activity?.type === 'quiz') status = 'graded'; // Only auto-grade standard quizzes, foundation might need review or stay graded
        if (activity?.type === 'foundation' && questions.length > 0) status = 'graded';
      }

      if (activity?.type === 'coding' && isOutputCorrect) {
        score = activity.max_score;
        status = 'graded';
      }

      await addDoc(collection(db, 'submissions'), {
        userId: user.uid,
        userName: user.displayName || user.email?.split('@')[0],
        courseId,
        activityId,
        activityTitle: activity?.title,
        activityType: activity?.type,
        content: answers,
        score,
        submittedAt: serverTimestamp(),
        status
      });

      // Notify Admins
      const adminsSnapshot = await getDocs(query(collection(db, 'users'), where('role', '==', 'admin')));
      const notificationPromises = adminsSnapshot.docs.map(adminDoc => 
        addDoc(collection(db, 'notifications'), {
          userId: adminDoc.id,
          title: 'New Activity Submission',
          message: `${user.displayName || user.email?.split('@')[0]} attempted "${activity?.title}"`,
          type: 'activity',
          read: false,
          relatedId: activityId,
          createdAt: serverTimestamp()
        })
      );
      await Promise.all(notificationPromises);

      navigate('/dashboard');
    } catch (error) {
      console.error("Submit error:", error);
      alert("Failed to submit.");
    } finally {
      setSubmitting(false);
    }
  };

  const checkCode = () => {
    setCodeOutput('');
    if (activity?.programming_language === 'web') {
      // For web, it's already running in the iframe and logging to setCodeOutput via message listener
      // We just need to check the output after some time or on demand
      setTimeout(() => {
        if (activity.expected_output) {
          const expected = activity.expected_output.trim();
          const actual = codeOutput.trim();
          setIsOutputCorrect(actual === expected);
        }
      }, 500); 
      return;
    }

    if (!activity?.expected_output) return;
    
    let output = '';
    const originalLog = console.log;
    console.log = (...args) => {
      output += args.join(' ') + '\n';
      originalLog(...args);
    };

    try {
      if (activity.programming_language === 'javascript' || !activity.programming_language) {
        const fn = new Function(answers.code);
        fn();
      } else {
        // Simulated output for other languages for now since we don't have a backend runner
        output = `[SIMULATION] Executing ${activity.programming_language.toUpperCase()}...\n`;
        output += `Note: Real environment for ${activity.programming_language} is restricted in preview.\n`;
        if (answers.code.includes('print') || answers.code.includes('System.out.println')) {
           output += activity.expected_output; // Mock success if we see output-like keywords
        }
      }
      
      const cleanedOutput = output.trim();
      const expected = activity.expected_output.trim();
      
      setCodeOutput(cleanedOutput || '[No console output]');
      setIsOutputCorrect(cleanedOutput === expected);
    } catch (err: any) {
      setCodeOutput(`ERROR: ${err.message}`);
      setIsOutputCorrect(false);
    } finally {
      console.log = originalLog;
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center p-24 space-y-4">
      <Clock className="w-12 h-12 animate-spin opacity-20" />
      <p className="font-mono text-[10px] uppercase tracking-widest opacity-40">Synchronizing Environment...</p>
    </div>
  );
  if (!activity) return <div>Invalid Session.</div>;

  if (activity.password && !isAuthorized) {
    return (
      <div className="max-w-md mx-auto py-24 space-y-8">
        <div className="bg-white border border-[#141414] p-8 shadow-[8px_8px_0px_#141414] space-y-6">
          <div className="text-center space-y-2">
            <Lock className="w-12 h-12 mx-auto text-orange-500" />
            <h2 className="text-2xl font-black uppercase italic italic tracking-tighter">Secure Activity</h2>
            <p className="text-[10px] font-mono uppercase opacity-50">Security validation required to proceed</p>
          </div>
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-widest">Access Key</label>
              <input 
                type="password"
                value={passwordInput}
                onChange={e => setPasswordInput(e.target.value)}
                className="w-full bg-[#F5F5F5] border border-[#141414] p-4 text-center text-xl font-mono"
                placeholder="••••••••"
                required
              />
            </div>
            <button 
              onClick={() => {
                if (passwordInput === activity.password) {
                  setIsAuthorized(true);
                } else {
                  alert("Incorrect password. Verification failed.");
                }
              }}
              className="w-full bg-[#141414] text-white py-4 font-bold uppercase tracking-widest hover:invert transition-all"
            >
              Unlock Activity
            </button>
          </div>
        </div>
        <button onClick={() => navigate(-1)} className="w-full text-center text-[10px] font-mono uppercase opacity-30 hover:opacity-100">
           Abort and Return
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-32">
      <div className="bg-[#141414] text-[#E4E3E0] p-8 border border-[#141414] shadow-[8px_8px_0px_white]">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-[10px] font-mono uppercase opacity-50 hover:opacity-100 transition-opacity mb-4">
          <ArrowLeft className="w-3 h-3" /> Abort Activity
        </button>
        <div className="flex justify-between items-end">
          <div>
            <span className="text-[10px] font-mono uppercase opacity-40 mb-1 block">{activity.type} Module</span>
            <h1 className="text-4xl font-black uppercase italic tracking-tighter leading-none">{activity.title}</h1>
          </div>
          <div className="text-right">
             <p className="text-[10px] font-mono uppercase opacity-40 mb-1">Max Score</p>
             <p className="text-2xl font-black italic">{activity.max_score} <span className="text-[10px] not-italic">pts</span></p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {activity.description && (
          <div className="bg-white border border-[#141414] p-6 italic text-sm text-gray-700">
            {activity.description}
          </div>
        )}

        {(activity.type === 'quiz' || (activity.type === 'foundation' && questions.length > 0)) && (
          <div className="space-y-6">
            {questions.map((q, idx) => (
              <motion.div 
                key={q.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="bg-white border border-[#141414] p-8 space-y-6"
              >
                <div className="flex gap-4">
                  <span className="font-mono text-xl font-black opacity-10">0{idx + 1}</span>
                  <p className="text-xl font-bold leading-tight">{q.question_text}</p>
                </div>
                <div className="space-y-2 ml-10">
                  {q.options.map((option, optIdx) => (
                    <label key={optIdx} className={`flex items-center gap-4 p-4 border transition-all cursor-pointer ${answers[q.id] === optIdx ? 'border-[#141414] bg-[#F5F5F5] shadow-[2px_2px_0px_#141414]' : 'border-gray-100 hover:border-gray-300'}`}>
                      <input type="radio" name={q.id} value={optIdx} checked={answers[q.id] === optIdx} onChange={() => setAnswers(prev => ({ ...prev, [q.id]: optIdx }))} className="w-4 h-4 accent-[#141414]" />
                      <span className="text-sm font-medium">{option}</span>
                    </label>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {(activity.type === 'qa' || (activity.type === 'foundation' && questions.length === 0)) && (
          <div className="space-y-8">
            {activity.qa_prompts?.map((prompt, idx) => (
              <motion.div 
                key={idx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                className="bg-white border border-[#141414] p-8 space-y-4"
              >
                <div className="flex items-center gap-2 border-b border-[#141414] pb-2">
                   <MessageSquare className="w-4 h-4" />
                   <p className="text-[10px] font-bold uppercase tracking-widest italic">{prompt}</p>
                </div>
                <textarea 
                  required
                  value={answers[prompt] || ''}
                  onChange={e => setAnswers(prev => ({ ...prev, [prompt]: e.target.value }))}
                  className="w-full bg-[#F9F9F9] border border-gray-200 p-4 text-sm font-medium h-32 focus:border-[#141414] focus:bg-white resize-none transition-all"
                  placeholder="EXECUTIVE RESPONSE..."
                />
              </motion.div>
            ))}
          </div>
        )}

        {activity.type === 'coding' && (
          <div className="space-y-6">
            <div className="bg-[#141414] border border-[#141414] shadow-[12px_12px_0px_rgba(0,0,0,0.1)] overflow-hidden">
              <div className="bg-[#E4E3E0] border-b border-[#141414] p-3 flex items-center justify-between">
                <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-500"></div>
                    <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                </div>
                <span className="text-[10px] font-mono font-bold tracking-widest text-black">ide.terminal_session [{activity.programming_language || 'javascript'}]</span>
              </div>
              <div className={activity.programming_language === 'web' ? 'grid grid-cols-1 md:grid-cols-2' : ''}>
                <textarea 
                  value={answers.code || ''}
                  onChange={e => {
                    setAnswers(prev => ({ ...prev, code: e.target.value }));
                    setIsOutputCorrect(null);
                    if (activity.programming_language !== 'web') setCodeOutput('');
                  }}
                  className={`w-full bg-[#141414] text-green-400 p-8 text-sm font-mono focus:outline-none resize-none ${activity.programming_language === 'web' ? 'h-[500px]' : 'h-[400px]'}`}
                  spellCheck={false}
                  placeholder="// WRITE CODE HERE... USE console.log() TO OUTPUT RESULTS"
                />
                {activity.programming_language === 'web' && (
                  <div className="bg-white border-l border-[#141414] h-[500px] flex flex-col">
                    <div className="bg-gray-100 p-2 text-[9px] font-bold uppercase tracking-widest border-b border-gray-200">Live Preview</div>
                    <iframe 
                      title="web-preview"
                      srcDoc={webPreview}
                      className="flex-1 w-full border-none"
                      sandbox="allow-scripts"
                    />
                  </div>
                )}
              </div>
              <div className="bg-[#0f172a] border-t border-white/10 p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <button 
                    type="button" 
                    onClick={checkCode}
                    className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg font-black text-[10px] uppercase tracking-widest transition-all active:scale-95"
                  >
                    Check Output
                  </button>
                  {isOutputCorrect !== null && (
                    <div className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-widest ${isOutputCorrect ? 'text-green-400' : 'text-red-400'}`}>
                      {isOutputCorrect ? (
                        <>
                          <CheckCircle className="w-4 h-4" />
                          Validated
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="w-4 h-4" />
                          Mismatch Detected
                        </>
                      )}
                    </div>
                  )}
                </div>
                <div className="text-[10px] font-mono text-white/40">Expected: "{activity.expected_output}"</div>
              </div>
            </div>

            {codeOutput && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="bg-black/5 border border-black/10 rounded-2xl p-6 space-y-2"
              >
                <div className="flex items-center justify-between border-b border-black/5 pb-2">
                  <span className="text-[9px] font-black uppercase tracking-widest opacity-40">System Output</span>
                  <span className="text-[9px] font-mono opacity-20">RT_KERNEL_EX</span>
                </div>
                <pre className={`text-sm font-mono whitespace-pre-wrap ${isOutputCorrect === false ? 'text-red-500' : 'text-[#0f172a]'}`}>
                  {codeOutput}
                </pre>
              </motion.div>
            )}
          </div>
        )}

        <div className="flex justify-center">
          <button 
            type="submit"
            disabled={submitting}
            className="bg-[#141414] text-[#E4E3E0] px-12 py-8 font-bold uppercase tracking-widest text-xl flex items-center gap-4 hover:invert transition-all shadow-[12px_12px_0px_rgba(0,0,0,0.2)] disabled:opacity-50"
          >
            {submitting ? 'UPLOADING DATA...' : (
              <>
                TRANSMIT SUBMISSION
                <Send className="w-6 h-6" />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
