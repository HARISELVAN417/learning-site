import { useState } from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import { User } from 'firebase/auth';
import { LogOut, BookOpen, LayoutDashboard, Search, User as UserIcon, ShieldAlert } from 'lucide-react';
import { auth } from '../lib/firebase';
import { ChatBot } from './ChatBot';

interface LayoutProps {
  user: User | null;
  role: 'admin' | 'student' | null;
  isBlocked?: boolean;
  blockReason?: string;
}

export default function Layout({ user, role, isBlocked, blockReason }: LayoutProps) {
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleLogout = async () => {
    await auth.signOut();
    navigate('/login');
  };

  if (role === 'student' && isBlocked) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 md:p-12 text-center space-y-6">
          <div className="w-20 h-20 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mx-auto">
            <ShieldAlert className="w-10 h-10" />
          </div>
          
          <h1 className="text-3xl font-bold text-slate-900">
            Account Suspended
          </h1>
          
          <div className="p-6 bg-slate-50 rounded-2xl text-left border border-slate-100">
            <p className="text-sm font-semibold text-red-600 mb-2">Message from Admin:</p>
            <p className="text-slate-600 leading-relaxed">
              {blockReason || 'Your access has been suspended. Please contact the administration for details.'}
            </p>
          </div>
          
          <button 
            onClick={handleLogout}
            className="w-full bg-slate-900 text-white py-4 rounded-xl font-semibold hover:bg-slate-800 transition-colors flex items-center justify-center gap-2"
          >
            <LogOut className="w-5 h-5" /> Sign Out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link to="/" className="flex items-center gap-2 group">
                <div className="bg-purple-600 p-1.5 rounded-lg text-white group-hover:scale-110 transition-transform">
                  <BookOpen className="w-5 h-5" />
                </div>
                <span className="font-bold text-xl tracking-tight text-slate-900">LearnStack</span>
              </Link>
              
              <div className="hidden md:ml-10 md:flex md:space-x-8">
                <Link to="/" className="text-slate-600 hover:text-purple-600 px-1 pt-1 text-sm font-medium transition-colors">Courses</Link>
                {user && (
                  <>
                    <Link to="/dashboard" className="text-slate-600 hover:text-purple-600 px-1 pt-1 text-sm font-medium transition-colors">Dashboard</Link>
                    {role === 'admin' && (
                      <Link to="/admin/students" className="text-slate-600 hover:text-purple-600 px-1 pt-1 text-sm font-medium transition-colors">Students</Link>
                    )}
                    <Link to="/announcements" className="text-slate-600 hover:text-purple-600 px-1 pt-1 text-sm font-medium transition-colors">Announcements</Link>
                    <Link to="/feedback" className="text-slate-600 hover:text-purple-600 px-1 pt-1 text-sm font-medium transition-colors">Feedback</Link>
                  </>
                )}
              </div>
            </div>

            <div className="hidden md:flex md:items-center md:gap-4">
              {user ? (
                <div className="flex items-center gap-4">
                  <Link to="/profile" className="flex items-center gap-3 hover:bg-slate-50 p-2 rounded-lg transition-colors group">
                    <div className="text-right">
                      <p className="text-xs font-bold text-slate-900 leading-none">{user.displayName || user.email?.split('@')[0]}</p>
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mt-1">{role}</p>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 group-hover:bg-purple-200 transition-colors">
                      <UserIcon className="w-4 h-4" />
                    </div>
                  </Link>
                  <button 
                    onClick={handleLogout}
                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                    title="Logout"
                  >
                    <LogOut className="w-5 h-5" />
                  </button>
                </div>
              ) : (
                <Link to="/login" className="bg-purple-600 text-white px-6 py-2 rounded-xl text-sm font-semibold hover:bg-purple-700 transition-all shadow-sm">
                  Login
                </Link>
              )}
            </div>

            {/* Mobile menu button */}
            <div className="flex items-center md:hidden">
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="inline-flex items-center justify-center p-2 rounded-md text-slate-400 hover:text-slate-500 hover:bg-slate-100 focus:outline-none"
              >
                <div className="space-y-1.5">
                  <div className={`w-6 h-0.5 bg-current transition-all ${isMenuOpen ? 'rotate-45 translate-y-2' : ''}`}></div>
                  <div className={`w-6 h-0.5 bg-current transition-all ${isMenuOpen ? 'opacity-0' : ''}`}></div>
                  <div className={`w-6 h-0.5 bg-current transition-all ${isMenuOpen ? '-rotate-45 -translate-y-2' : ''}`}></div>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        <div className={`md:hidden overflow-hidden transition-all duration-300 ${isMenuOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
          <div className="px-2 pt-2 pb-3 space-y-1 bg-white border-t border-slate-100">
            <Link to="/" className="block px-3 py-2 rounded-md text-base font-medium text-slate-700 hover:text-purple-600 hover:bg-slate-50" onClick={() => setIsMenuOpen(false)}>Courses</Link>
            {user && (
              <>
                <Link to="/dashboard" className="block px-3 py-2 rounded-md text-base font-medium text-slate-700 hover:text-purple-600 hover:bg-slate-50" onClick={() => setIsMenuOpen(false)}>Dashboard</Link>
                {role === 'admin' && (
                  <Link to="/admin/students" className="block px-3 py-2 rounded-md text-base font-medium text-slate-700 hover:text-purple-600 hover:bg-slate-50" onClick={() => setIsMenuOpen(false)}>Students</Link>
                )}
                <Link to="/announcements" className="block px-3 py-2 rounded-md text-base font-medium text-slate-700 hover:text-purple-600 hover:bg-slate-50" onClick={() => setIsMenuOpen(false)}>Announcements</Link>
                <Link to="/feedback" className="block px-3 py-2 rounded-md text-base font-medium text-slate-700 hover:text-purple-600 hover:bg-slate-50" onClick={() => setIsMenuOpen(false)}>Feedback</Link>
                <Link to="/profile" className="block px-3 py-2 rounded-md text-base font-medium text-slate-700 hover:text-purple-600 hover:bg-slate-50" onClick={() => setIsMenuOpen(false)}>My Profile</Link>
                <button 
                  onClick={handleLogout}
                  className="w-full text-left block px-3 py-2 rounded-md text-base font-medium text-red-600 hover:bg-red-50"
                >
                  Logout
                </button>
              </>
            )}
            {!user && (
              <Link to="/login" className="block px-3 py-2 rounded-md text-base font-medium text-purple-600 hover:bg-purple-50" onClick={() => setIsMenuOpen(false)}>Login</Link>
            )}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        <Outlet />
      </main>

      {user && <ChatBot />}

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 mt-20 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest italic">
            &copy; {new Date().getFullYear()} LearnStack — Professional Learning Hub
          </p>
        </div>
      </footer>
    </div>
  );
}
