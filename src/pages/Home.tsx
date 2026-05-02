import { useState, useEffect } from 'react';
import { collection, query, getDocs, limit } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Book, Users, Clock, ArrowRight, Bot, Cpu, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';

interface Course {
  id: string;
  title: string;
  description: string;
  instructorId: string;
  createdAt: any;
}

export default function Home() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCourses() {
      const path = 'courses';
      try {
        const q = query(collection(db, path), limit(6));
        const querySnapshot = await getDocs(q);
        const fetchedCourses = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Course));
        setCourses(fetchedCourses);
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, path);
      } finally {
        setLoading(false);
      }
    }
    fetchCourses();
  }, []);

  return (
    <div className="space-y-24">
      {/* Hero Section */}
      <section className="relative py-20 px-8 md:px-16 bg-white rounded-[3rem] shadow-2xl shadow-purple-100/50 border border-slate-100 overflow-hidden">
        <div className="absolute top-0 right-0 w-1/2 h-full bg-slate-50 skew-x-12 translate-x-1/4 pointer-events-none"></div>
        
        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-8">
            <motion.div 
               initial={{ opacity: 0, x: -20 }}
               animate={{ opacity: 1, x: 0 }}
               className="inline-flex items-center gap-2 px-4 py-2 bg-purple-50 text-purple-700 rounded-full text-xs font-bold uppercase tracking-widest border border-purple-100"
            >
              <div className="w-2 h-2 rounded-full bg-purple-600 animate-pulse"></div>
              Next-Gen Learning Platform
            </motion.div>
            
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-4xl md:text-6xl font-bold tracking-tight text-slate-900 leading-[1.1]"
            >
              Master Your <br />
              <span className="text-purple-600">Future Skills</span>
            </motion.h1>
            
            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-base md:text-lg text-slate-500 leading-relaxed max-w-xl"
            >
              An inclusive professional learning environment designed for all departments and school students. Access world-class education anywhere, on any device.
            </motion.p>
            
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="flex flex-wrap gap-4 pt-4"
            >
              <Link to="/dashboard" className="bg-purple-600 text-white px-8 py-4 rounded-2xl font-bold hover:bg-purple-700 transition-all shadow-lg shadow-purple-200 flex items-center gap-3 active:scale-95">
                Explore Courses <ArrowRight className="w-5 h-5" />
              </Link>
              <Link to="/login" className="bg-slate-100 text-slate-600 px-8 py-4 rounded-2xl font-bold hover:bg-slate-200 transition-all flex items-center gap-3 active:scale-95">
                 Join Community
              </Link>
            </motion.div>
          </div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, type: 'spring' }}
            className="flex justify-center"
          >
            <div className="relative">
              <div className="w-64 h-64 md:w-80 md:h-80 bg-purple-100 rounded-[3rem] rotate-6 absolute inset-0"></div>
              <div className="w-64 h-64 md:w-80 md:h-80 bg-white border border-slate-100 shadow-2xl rounded-[3rem] flex items-center justify-center relative translate-x-4 translate-y-4">
                <Book className="w-32 h-32 text-purple-600" />
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Featured Courses */}
      <section className="px-4">
        <div className="flex flex-col md:flex-row items-start md:items-end justify-between mb-12 gap-4">
          <div className="space-y-2">
            <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Featured Learning Modules</h2>
            <p className="text-slate-500 font-medium">Specially curated tracks for your professional trajectory.</p>
          </div>
          <Link to="/dashboard" className="text-purple-600 font-bold flex items-center gap-2 hover:underline group">
            View All Courses <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white border border-slate-100 rounded-3xl h-64 animate-pulse shadow-sm"></div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {courses.map((course, idx) => (
              <motion.div
                key={course.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
              >
                <Link to={`/courses/${course.id}`} className="group bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-xl hover:border-purple-100 transition-all block h-full flex flex-col active:scale-[0.98]">
                  <div className="flex items-center justify-between mb-8">
                    <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-purple-50 group-hover:text-purple-600 transition-colors">
                      <Cpu className="w-6 h-6" />
                    </div>
                    <div className="bg-slate-50 p-2 rounded-lg text-slate-400 group-hover:bg-purple-600 group-hover:text-white transition-all transform group-hover:rotate-45">
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  </div>
                  
                  <div className="flex-1 space-y-4">
                    <h3 className="text-xl font-bold text-slate-900 group-hover:text-purple-600 transition-colors">{course.title}</h3>
                    <p className="text-slate-500 text-sm line-clamp-3 leading-relaxed font-medium">{course.description}</p>
                  </div>

                  <div className="mt-8 pt-6 border-t border-slate-50 flex items-center gap-4">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400">
                      <Users className="w-3.5 h-3.5" /> Enrolled
                    </div>
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400">
                      <Clock className="w-3.5 h-3.5" /> Self-Paced
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
            {courses.length === 0 && (
              <div className="col-span-full py-20 text-center bg-slate-50 rounded-[3rem] border border-slate-100">
                <p className="text-slate-400 font-bold italic">No active learning modules found in directory.</p>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
