import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import ReactMarkdown from 'react-markdown';
import { ArrowLeft, Play, FileText, ChevronRight, ChevronLeft } from 'lucide-react';
import { motion } from 'motion/react';

interface Lesson {
  title: string;
  content: string;
  videoUrl?: string;
  order: number;
}

export default function LessonView() {
  const { courseId, lessonId } = useParams();
  const navigate = useNavigate();
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchLesson() {
      if (!courseId || !lessonId) return;
      try {
        const lessonDoc = await getDoc(doc(db, `courses/${courseId}/lessons`, lessonId));
        if (lessonDoc.exists()) {
          setLesson(lessonDoc.data() as Lesson);
        }
      } catch (error) {
        console.error("Fetch error:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchLesson();
  }, [courseId, lessonId]);

  if (loading) return <div className="p-12 text-center font-mono uppercase animate-pulse">Retrieving Lesson Data...</div>;
  if (!lesson) return <div className="p-12 text-center">Lesson not found.</div>;

  return (
    <div className="max-w-5xl mx-auto space-y-12">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest opacity-60">
        <Link to={`/courses/${courseId}`} className="hover:underline">Module Overview</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-[#141414] font-bold">Lesson {lesson.order}</span>
      </nav>

      {/* Hero Header */}
      <section className="space-y-4">
        <h1 className="text-5xl md:text-7xl font-black uppercase italic tracking-tighter leading-none">
          {lesson.title}
        </h1>
        <div className="flex items-center gap-4 py-2 border-y border-[#141414]">
          <span className="text-[10px] font-mono uppercase tracking-[0.2em] font-bold">Session Type: Technical Briefing</span>
          <span className="text-[10px] font-mono uppercase tracking-[0.2em] opacity-40">// Order: {lesson.order}</span>
        </div>
      </section>

      {/* Video Content */}
      {lesson.videoUrl && (
        <section className="bg-[#141414] aspect-video border-4 border-[#141414] shadow-[12px_12px_0px_rgba(0,0,0,0.1)] overflow-hidden">
          {lesson.videoUrl.includes('youtube.com') || lesson.videoUrl.includes('youtu.be') ? (
             <iframe 
              className="w-full h-full"
              src={lesson.videoUrl.replace('watch?v=', 'embed/')} 
              title={lesson.title}
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
              allowFullScreen
            ></iframe>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-[#E4E3E0] space-y-4">
              <Play className="w-16 h-16 opacity-20" />
              <p className="font-mono text-xs uppercase tracking-widest">External Video Source: {lesson.videoUrl}</p>
            </div>
          )}
        </section>
      )}

      {/* Main Narrative */}
      <section className="prose prose-lg max-w-none prose-headings:font-black prose-headings:uppercase prose-headings:italic prose-headings:tracking-tighter prose-p:font-medium prose-p:leading-relaxed prose-code:bg-[#141414] prose-code:text-[#E4E3E0] prose-code:px-1 prose-pre:bg-[#141414] prose-pre:text-[#E4E3E0] prose-pre:p-6 prose-pre:border-l-4 prose-pre:border-orange-500">
        <div className="markdown-body">
          <ReactMarkdown>{lesson.content}</ReactMarkdown>
        </div>
      </section>

      {/* Footnote / Navigation */}
      <footer className="pt-12 border-t border-[#141414] flex justify-between items-center">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 font-bold uppercase tracking-widest text-xs hover:opacity-60 transition-opacity">
          <ChevronLeft className="w-4 h-4" /> Back to List
        </button>
        <div className="flex items-center gap-2 bg-[#141414] text-[#E4E3E0] px-6 py-3 font-bold uppercase tracking-widest text-xs">
          Lesson Completed
        </div>
      </footer>
    </div>
  );
}
