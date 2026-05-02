import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from './lib/firebase';
import Layout from './components/Layout';
import Home from './pages/Home';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import CourseDetails from './pages/CourseDetails';
import LessonView from './pages/LessonView';
import QuizView from './pages/QuizView';
import AdminDashboard from './pages/AdminDashboard';
import StudentManagement from './pages/StudentManagement';
import Feedback from './pages/Feedback';
import SubmissionReview from './pages/SubmissionReview';
import AddLesson from './pages/AddLesson';
import AddActivity from './pages/AddActivity';
import CourseReports from './pages/CourseReports';
import Profile from './pages/Profile';
import Announcements from './pages/Announcements';
import { FloatingBooks } from './components/FloatingBooks';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<'admin' | 'student' | null>(null);
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockReason, setBlockReason] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        // Special check for hardcoded admin email
        if (user.email === 'hariselvans96@gmail.com') {
          setRole('admin');
          setIsBlocked(false);
        }

        const path = `users/${user.uid}`;
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            // Keep admin role if it's the master email, otherwise take from DB
            if (user.email !== 'hariselvans96@gmail.com') {
              setRole(data.role);
              
              const isManuallyBlocked = !!data.blocked;
              const allowUntil = data.allowUntil?.toDate();
              const isTimedAccessExpired = allowUntil && allowUntil < new Date();
              
              setIsBlocked(isManuallyBlocked || !!isTimedAccessExpired);
              setBlockReason(isTimedAccessExpired ? 'Temporary access has expired.' : (data.blockReason || ''));
            }
          } else if (user.email !== 'hariselvans96@gmail.com') {
            // Default role for new manually added users if not the admin
            setRole('student');
            setIsBlocked(false);
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, path);
        }
      } else {
        setRole(null);
        setIsBlocked(false);
        setBlockReason('');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#F5F5F5]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black"></div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <FloatingBooks />
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/dashboard" /> : <Login />} />
        
        <Route element={<Layout user={user} role={role} isBlocked={isBlocked} blockReason={blockReason} />}>
          <Route path="/" element={<Home />} />
          <Route path="/courses/:courseId" element={<CourseDetails role={role} />} />
          
          <Route path="/dashboard" element={
            user ? (role === 'admin' ? <AdminDashboard /> : <Dashboard user={user} />) : <Navigate to="/login" />
          } />

          <Route path="/courses/:courseId/lessons/:lessonId" element={
            user ? <LessonView /> : <Navigate to="/login" />
          } />

          <Route path="/courses/:courseId/activities/:activityId" element={
            user ? <QuizView user={user} /> : <Navigate to="/login" />
          } />

          <Route path="/submissions/:submissionId" element={
            user ? <SubmissionReview /> : <Navigate to="/login" />
          } />
          
          {/* Admin Routes */}
          <Route path="/admin/courses/:courseId/lessons/new" element={
            role === 'admin' ? <AddLesson /> : <Navigate to="/" />
          } />
          <Route path="/admin/courses/:courseId/activities/new" element={
            role === 'admin' ? <AddActivity /> : <Navigate to="/" />
          } />
          <Route path="/admin/reports/:courseId" element={
            role === 'admin' ? <CourseReports /> : <Navigate to="/" />
          } />
          <Route path="/admin/students" element={
            role === 'admin' ? <StudentManagement /> : <Navigate to="/" />
          } />
          <Route path="/feedback" element={
            user ? <Feedback role={role || 'student'} /> : <Navigate to="/login" />
          } />
          <Route path="/profile" element={
            user ? <Profile user={user} /> : <Navigate to="/login" />
          } />
          <Route path="/announcements" element={
            user ? <Announcements role={role} /> : <Navigate to="/login" />
          } />
        </Route>

        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}
