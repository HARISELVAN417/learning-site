import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { ArrowLeft, Save, Loader2, Info } from 'lucide-react';
import { motion } from 'motion/react';

export default function AddLesson() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [lesson, setLesson] = useState({
    title: '',
    content: '',
    videoUrl: '',
    order: 1
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseId) return;
    setLoading(true);
    try {
      await addDoc(collection(db, `courses/${courseId}/lessons`), {
        ...lesson,
        courseId,
        createdAt: serverTimestamp()
      });
      navigate(`/courses/${courseId}`);
    } catch (error) {
      console.error("Save error:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-12 px-4">
      <div className="mb-12 flex items-center justify-between">
        <div className="space-y-4">
          <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-[10px] font-mono uppercase opacity-50 hover:opacity-100 transition-opacity">
            <ArrowLeft className="w-3 h-3" /> Back to Module
          </button>
          <h1 className="text-4xl font-black uppercase italic tracking-tighter">Draft New Lesson</h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8 bg-white border border-[#141414] p-8 shadow-[12px_12px_0px_#141414]">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="md:col-span-3 space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-widest text-[#141414]">Lesson Title</label>
            <input 
              type="text"
              value={lesson.title}
              onChange={e => setLesson(prev => ({ ...prev, title: e.target.value }))}
              className="w-full bg-[#F5F5F5] border border-[#141414] p-4 text-sm focus:outline-none focus:ring-1 focus:ring-black"
              placeholder="e.g. Introduction to React Hooks"
              required
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-widest text-[#141414]">Display Order</label>
            <input 
              type="number"
              value={lesson.order}
              onChange={e => setLesson(prev => ({ ...prev, order: parseInt(e.target.value) || 1 }))}
              className="w-full bg-[#F5F5F5] border border-[#141414] p-4 text-sm focus:outline-none focus:ring-1 focus:ring-black font-mono"
              required
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase tracking-widest text-[#141414]">Video Resource URL (YouTube/Direct)</label>
          <input 
            type="url"
            value={lesson.videoUrl}
            onChange={e => setLesson(prev => ({ ...prev, videoUrl: e.target.value }))}
            className="w-full bg-[#F5F5F5] border border-[#141414] p-4 text-sm focus:outline-none focus:ring-1 focus:ring-black"
            placeholder="https://..."
          />
        </div>

        <div className="space-y-1">
          <div className="flex justify-between items-center">
            <label className="text-[10px] font-bold uppercase tracking-widest text-[#141414]">Lesson Content (Markdown Supported)</label>
            <div className="flex items-center gap-1 text-[8px] font-mono opacity-50 uppercase tracking-widest">
              <Info className="w-3 h-3" /> Supports Bold, Code, Lists
            </div>
          </div>
          <textarea 
            value={lesson.content}
            onChange={e => setLesson(prev => ({ ...prev, content: e.target.value }))}
            className="w-full bg-[#F5F5F5] border border-[#141414] p-4 text-sm focus:outline-none focus:ring-1 focus:ring-black h-96 font-mono resize-none"
            placeholder="# Subtitle&#10;&#10;Explain the concepts here..."
            required
          />
        </div>

        <button 
          type="submit"
          disabled={loading}
          className="w-full bg-[#141414] text-[#E4E3E0] py-6 flex items-center justify-center gap-3 font-bold uppercase tracking-widest text-lg hover:invert transition-all disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : (
            <>
              Deploy Lesson Content
              <Save className="w-6 h-6" />
            </>
          )}
        </button>
      </form>
    </div>
  );
}
