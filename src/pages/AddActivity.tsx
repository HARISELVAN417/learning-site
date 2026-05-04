import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, addDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { ArrowLeft, Plus, Trash2, Save, Loader2, Calendar, Sparkles, Wand2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI, Type } from "@google/genai";

interface Question {
  question_text: string;
  options: string[];
  correct_answer: number;
}

export default function AddActivity() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [activity, setActivity] = useState({
    title: '',
    type: 'quiz' as 'quiz' | 'qa' | 'coding' | 'foundation',
    subType: 'quiz' as 'quiz' | 'qa',
    description: '',
    coding_template: '// Write your code here\n',
    programming_language: 'javascript' as 'javascript' | 'python' | 'java' | 'c' | 'cpp' | 'web',
    expected_output: '',
    max_score: 10,
    startTime: '',
    endTime: '',
    password: ''
  });
  const [questions, setQuestions] = useState<Question[]>([
    { question_text: '', options: ['', ''], correct_answer: 0 }
  ]);
  const [qaPrompts, setQaPrompts] = useState<string[]>(['']);
  const [isEventModule, setIsEventModule] = useState(false);

  useEffect(() => {
    async function fetchCourseMeta() {
      if (!courseId) return;
      try {
        const courseDoc = await getDoc(doc(db, 'courses', courseId));
        if (courseDoc.exists()) {
          setIsEventModule(courseDoc.data()?.moduleType === 'event');
        }
      } catch (error) {
        console.error('Course fetch error:', error);
      }
    }
    fetchCourseMeta();
  }, [courseId]);

  const generateWithAI = async () => {
    if (!aiPrompt.trim()) return;
    setAiLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Generate a quiz about: ${aiPrompt}. Include exactly the number of questions requested if specified, otherwise 5 questions.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                question_text: { type: Type.STRING },
                options: { 
                  type: Type.ARRAY,
                  items: { type: Type.STRING }
                },
                correct_answer: { type: Type.INTEGER }
              },
              required: ["question_text", "options", "correct_answer"]
            }
          }
        }
      });

      const generatedQuestions = JSON.parse(response.text);
      if (Array.isArray(generatedQuestions)) {
        setQuestions(generatedQuestions.map(q => ({
          question_text: q.question_text || '',
          options: Array.isArray(q.options) ? q.options : ['', ''],
          correct_answer: typeof q.correct_answer === 'number' ? q.correct_answer : 0
        })));
        setAiPrompt('');
      }
    } catch (error) {
      console.error("AI Generation failed:", error);
      alert("AI Generation failed. Please try again.");
    } finally {
      setAiLoading(false);
    }
  };

  const addQuestion = () => {
    setQuestions(prev => [...prev, { question_text: '', options: ['', ''], correct_answer: 0 }]);
  };

  const removeQuestion = (idx: number) => {
    setQuestions(prev => prev.filter((_, i) => i !== idx));
  };

  const updateQuestion = (idx: number, field: keyof Question, value: any) => {
    setQuestions(prev => prev.map((q, i) => i === idx ? { ...q, [field]: value } : q));
  };

  const updateOption = (qIdx: number, oIdx: number, value: string) => {
    setQuestions(prev => prev.map((q, i) => i === qIdx ? {
      ...q,
      options: q.options.map((o, j) => j === oIdx ? value : o)
    } : q));
  };

  const addOption = (qIdx: number) => {
    setQuestions(prev => prev.map((q, i) => i === qIdx ? { ...q, options: [...q.options, ''] } : q));
  };

  const addQaPrompt = () => setQaPrompts(prev => [...prev, '']);
  const updateQaPrompt = (idx: number, val: string) => setQaPrompts(prev => prev.map((p, i) => i === idx ? val : p));
  const removeQaPrompt = (idx: number) => setQaPrompts(prev => prev.filter((_, i) => i !== idx));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseId) return;
    setLoading(true);
    try {
      const activityData = {
        title: activity.title,
        type: activity.type,
        courseId,
        description: activity.description,
        max_score: activity.max_score,
        startTime: activity.startTime ? Timestamp.fromDate(new Date(activity.startTime)) : null,
        endTime: activity.endTime ? Timestamp.fromDate(new Date(activity.endTime)) : null,
        password: (isEventModule || activity.type === 'foundation') ? activity.password : null,
        createdAt: serverTimestamp()
      } as any;

      if (activity.type === 'coding') {
        activityData.coding_template = activity.coding_template;
        activityData.programming_language = activity.programming_language;
        activityData.expected_output = activity.expected_output;
      } else if (activity.type === 'qa' || (activity.type === 'foundation' && activity.subType === 'qa')) {
        activityData.qa_prompts = qaPrompts.filter(p => p.trim() !== '');
      }

      const actRef = await addDoc(collection(db, `courses/${courseId}/activities`), activityData);

      if (activity.type === 'quiz' || (activity.type === 'foundation' && activity.subType === 'quiz')) {
        for (const q of questions) {
          await addDoc(collection(db, `courses/${courseId}/activities/${actRef.id}/questions`), {
            ...q,
            activityId: actRef.id
          });
        }
      }

      navigate(`/courses/${courseId}`);
    } catch (error) {
      console.error("Activity creation error:", error);
      alert("Error creating activity.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-12 px-4 pb-32">
      <div className="mb-12">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-[10px] font-mono uppercase opacity-50 hover:opacity-100 transition-opacity mb-4">
          <ArrowLeft className="w-3 h-3" /> Back to Module
        </button>
        <h1 className="text-4xl font-black uppercase italic tracking-tighter">Assemble Activity</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-12">
        {/* Basic Config */}
        <section className="bg-white border border-[#141414] p-8 shadow-[8px_8px_0px_#141414] space-y-6">
          <div className="flex items-center gap-2 mb-4 border-b border-[#141414] pb-2">
            <Calendar className="w-4 h-4" />
            <h2 className="text-[10px] font-bold uppercase tracking-widest">Core Configuration</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2 space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-widest">Title</label>
              <input 
                type="text"
                value={activity.title}
                onChange={e => setActivity(prev => ({ ...prev, title: e.target.value }))}
                className="w-full bg-[#F5F5F5] border border-[#141414] p-3 text-sm"
                placeholder="ACTIVITY TITLE"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-widest">Activity Type</label>
              <select 
                value={activity.type}
                onChange={e => setActivity(prev => ({ ...prev, type: e.target.value as any }))}
                className="w-full bg-[#F5F5F5] border border-[#141414] p-3 text-sm uppercase font-bold"
              >
                <option value="quiz">Interactive Quiz</option>
                <option value="qa">Q&A Session</option>
                <option value="coding">Coding Lab</option>
                <option value="foundation">Foundation Exam</option>
              </select>
            </div>

            {isEventModule && activity.type !== 'foundation' && (
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-widest text-orange-600">Event Access Key (Required)</label>
                <input 
                  type="text"
                  value={activity.password}
                  onChange={e => setActivity(prev => ({ ...prev, password: e.target.value }))}
                  className="w-full bg-[#FFF5F5] border border-orange-500 p-3 text-sm font-mono placeholder:opacity-30"
                  placeholder="REQUIRED KEY FOR EVENT PARTICIPANTS"
                  required
                />
              </div>
            )}

            {activity.type === 'foundation' && (
              <>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-orange-600">Exam Architecture</label>
                  <select 
                    value={activity.subType}
                    onChange={e => setActivity(prev => ({ ...prev, subType: e.target.value as any }))}
                    className="w-full bg-[#FFF5F5] border border-orange-500 p-3 text-sm uppercase font-bold"
                  >
                    <option value="quiz">Quiz Format</option>
                    <option value="qa">Q&A Format</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-orange-600">Access Key (Password)</label>
                  <input 
                    type="text"
                    value={activity.password}
                    onChange={e => setActivity(prev => ({ ...prev, password: e.target.value }))}
                    className="w-full bg-[#FFF5F5] border border-orange-500 p-3 text-sm font-mono placeholder:opacity-30"
                    placeholder="REQUIRED KEY FOR STUDENTS"
                    required
                  />
                </div>
              </>
            )}

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-widest">Max Mark</label>
              <input 
                type="number"
                value={isNaN(activity.max_score) ? '' : activity.max_score}
                onChange={e => {
                  const val = parseInt(e.target.value);
                  setActivity(prev => ({ ...prev, max_score: isNaN(val) ? 0 : val }));
                }}
                className="w-full bg-[#F5F5F5] border border-[#141414] p-3 text-sm"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-widest">Start Time</label>
              <input 
                type="datetime-local"
                value={activity.startTime}
                onChange={e => setActivity(prev => ({ ...prev, startTime: e.target.value }))}
                className="w-full bg-[#F5F5F5] border border-[#141414] p-3 text-sm"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-widest">End Time</label>
              <input 
                type="datetime-local"
                value={activity.endTime}
                onChange={e => setActivity(prev => ({ ...prev, endTime: e.target.value }))}
                className="w-full bg-[#F5F5F5] border border-[#141414] p-3 text-sm"
                required
              />
            </div>

            <div className="md:col-span-2 space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-widest">Context / Instructions</label>
              <textarea 
                value={activity.description}
                onChange={e => setActivity(prev => ({ ...prev, description: e.target.value }))}
                className="w-full bg-[#F5F5F5] border border-[#141414] p-3 text-sm h-24 resize-none"
                placeholder="GUIDELINES FOR THIS ACTIVITY..."
              />
            </div>
          </div>
        </section>

        {/* Dynamic Content Based on Type */}
        <AnimatePresence mode="wait">
          {(activity.type === 'quiz' || (activity.type === 'foundation' && activity.subType === 'quiz')) && (
            <motion.section 
              key="quiz"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
              {/* AI Generation Widget */}
              <div className="bg-purple-50 border-2 border-purple-200 p-8 rounded-3xl space-y-6 shadow-xl shadow-purple-100/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-purple-200">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black uppercase italic tracking-tight text-purple-900">AI Quiz Architect</h2>
                    <p className="text-[10px] font-bold text-purple-400 uppercase tracking-widest">Generate interactive nodes via natural language</p>
                  </div>
                </div>

                <div className="flex flex-col md:flex-row gap-4">
                  <input 
                    type="text"
                    value={aiPrompt}
                    onChange={e => setAiPrompt(e.target.value)}
                    placeholder="e.g. 5 questions about Advanced React Patterns..."
                    className="flex-1 bg-white border-2 border-purple-100 p-4 rounded-2xl text-sm font-medium outline-none focus:border-purple-300 transition-all"
                  />
                  <button 
                    type="button"
                    onClick={generateWithAI}
                    disabled={aiLoading || !aiPrompt.trim()}
                    className="bg-purple-600 text-white px-8 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-purple-700 transition-all active:scale-95 disabled:opacity-50 shadow-lg shadow-purple-100"
                  >
                    {aiLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Wand2 className="w-5 h-5" />}
                    {aiLoading ? 'SYNTHESIZING...' : 'GENERATE'}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between border-b border-[#141414] pb-2 pt-4">
                <h2 className="font-mono text-xs uppercase tracking-[0.3em] font-bold">Question Grid [{questions.length}]</h2>
                <button type="button" onClick={addQuestion} className="bg-[#7c3aed] text-white px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg shadow-[4px_4px_0px_rgba(0,0,0,1)] border-2 border-black hover:bg-black transition-all">
                  + ADD QUESTION
                </button>
              </div>
              <div className="space-y-8">
                {questions.map((q, qIdx) => (
                  <div key={qIdx} className="bg-[#E4E3E0] border border-[#141414] p-8 space-y-6 relative">
                    <div className="absolute top-0 right-0 p-2 flex items-center bg-[#141414] text-white font-mono text-[10px]">
                      #{qIdx + 1}
                      <button type="button" onClick={() => removeQuestion(qIdx)} className="ml-4 hover:text-red-400">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                    <textarea 
                      value={q.question_text}
                      onChange={e => updateQuestion(qIdx, 'question_text', e.target.value)}
                      className="w-full bg-white border border-[#141414] p-4 text-sm"
                      placeholder="QUESTION CONTENT..."
                      required
                    />
                    <div className="grid grid-cols-1 gap-3">
                      {q.options.map((opt, oIdx) => (
                        <div key={oIdx} className="flex gap-2">
                          <input 
                            type="radio" 
                            name={`correct_${qIdx}`}
                            checked={q.correct_answer === oIdx}
                            onChange={() => updateQuestion(qIdx, 'correct_answer', oIdx)}
                            className="mt-4"
                          />
                          <input 
                            type="text"
                            value={opt}
                            onChange={e => updateOption(qIdx, oIdx, e.target.value)}
                            className="flex-1 bg-white border border-[#141414] p-3 text-sm"
                            placeholder={`OPTION ${oIdx + 1}`}
                            required
                          />
                        </div>
                      ))}
                      <button type="button" onClick={() => addOption(qIdx)} className="text-[10px] font-mono opacity-50">+ ADD OPTION</button>
                    </div>
                  </div>
                ))}
              </div>
            </motion.section>
          )}

          {(activity.type === 'qa' || (activity.type === 'foundation' && activity.subType === 'qa')) && (
            <motion.section 
              key="qa"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between border-b border-[#141414] pb-2">
                <h2 className="font-mono text-xs uppercase tracking-[0.3em] font-bold">Q&A Prompts [{qaPrompts.length}]</h2>
                <button type="button" onClick={addQaPrompt} className="bg-[#7c3aed] text-white px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg shadow-[4px_4px_0px_rgba(0,0,0,1)] border-2 border-black hover:bg-black transition-all">
                  + ADD PROMPT
                </button>
              </div>
              <div className="space-y-4">
                {qaPrompts.map((p, idx) => (
                  <div key={idx} className="flex gap-2 items-start">
                    <span className="font-mono text-xs mt-4">#{idx+1}</span>
                    <textarea 
                      value={p}
                      onChange={e => updateQaPrompt(idx, e.target.value)}
                      className="flex-1 bg-white border border-[#141414] p-4 text-sm h-24"
                      placeholder="WRITE A PROMPT FOR THE STUDENT TO ANSWER..."
                      required
                    />
                    <button type="button" onClick={() => removeQaPrompt(idx)} className="mt-4 text-red-500">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </motion.section>
          )}

          {activity.type === 'coding' && (
            <motion.section 
              key="coding"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="border-b border-[#141414] pb-2">
                <h2 className="font-mono text-xs uppercase tracking-[0.3em] font-bold">Coding Lab Environment</h2>
              </div>
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest">Programming Language</label>
                  <select 
                    value={activity.programming_language}
                    onChange={e => {
                      const lang = e.target.value;
                      let template = '// Write your code here\n';
                      if (lang === 'python') template = '# Write your Python code here\nprint("Hello World")';
                      if (lang === 'web') template = '<!-- HTML -->\n<div id="root">\n  <h1>Hello World</h1>\n</div>\n\n<style>\n  h1 { color: blue; }\n</style>\n\n<script>\n  console.log("Web loaded");\n</script>';
                      if (lang === 'java') template = 'public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello World");\n    }\n}';
                      setActivity(prev => ({ ...prev, programming_language: lang as any, coding_template: template }));
                    }}
                    className="w-full bg-[#F5F5F5] border border-[#141414] p-3 text-sm uppercase font-bold"
                  >
                    <option value="javascript">JavaScript (Node)</option>
                    <option value="python">Python</option>
                    <option value="java">Java</option>
                    <option value="c">C</option>
                    <option value="cpp">C++</option>
                    <option value="web">Web (HTML/CSS/JS)</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest">Base Code Template</label>
                  <textarea 
                    value={activity.coding_template}
                    onChange={e => setActivity(prev => ({ ...prev, coding_template: e.target.value }))}
                    className="w-full bg-[#141414] text-green-400 p-6 text-sm font-mono h-48 border border-[#141414]"
                    placeholder="// INITIAL CODE BOILERPLATE..."
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[#7c3aed]">Expected Console Output (Automatic Grading)</label>
                  <textarea 
                    value={activity.expected_output}
                    onChange={e => setActivity(prev => ({ ...prev, expected_output: e.target.value }))}
                    className="w-full bg-white border border-[#7c3aed] p-4 text-sm font-mono h-24"
                    placeholder="ENTER THE EXACT STRING OUTPUT EXPECTED FROM CONSOLE.LOG..."
                    required={activity.type === 'coding'}
                  />
                </div>
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        <button 
          type="submit"
          disabled={loading}
          className="w-full bg-[#141414] text-[#E4E3E0] py-8 flex items-center justify-center gap-3 font-bold uppercase tracking-widest text-xl hover:invert transition-all disabled:opacity-50 shadow-[12px_12px_0px_rgba(0,0,0,0.1)]"
        >
          {loading ? <Loader2 className="w-8 h-8 animate-spin" /> : 'INITIALIZE ACTIVITY'}
        </button>
      </form>
    </div>
  );
}
