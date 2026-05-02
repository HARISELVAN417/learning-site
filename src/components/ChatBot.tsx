import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageSquare, X, Send, Loader2, Sparkles, Navigation, GraduationCap } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export function ChatBot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: "Hi! I'm LearnBot, your Lumina AI assistant. How can I help you today? You can ask me questions about courses or even say 'I want to see announcements' to jump there!" }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isOpen]);

  const navigateToPage = (page: string) => {
    const routes: Record<string, string> = {
      'announcements': '/announcements',
      'dashboard': '/dashboard',
      'profile': '/profile',
      'feedback': '/feedback',
      'courses': '/',
      'home': '/',
    };
    
    const target = routes[page.toLowerCase()];
    if (target) {
      navigate(target);
      return `Sure! Navigating you to the ${page} page now.`;
    }
    return `I'm sorry, I couldn't find a page named "${page}".`;
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      const navigateTool: FunctionDeclaration = {
        name: "navigate_to_page",
        description: "Redirect the user to a specific page on the platform.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            page: {
              type: Type.STRING,
              description: "The name of the page to redirect to. Possible values: announcements, dashboard, profile, feedback, courses, home.",
            }
          },
          required: ["page"]
        }
      };

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: messages.map(m => ({ 
          role: m.role === 'user' ? 'user' : 'model', 
          parts: [{ text: m.content }] 
        })).concat([{ role: 'user', parts: [{ text: userMessage }] }]),
        config: {
          systemInstruction: "You are LearnBot, a friendly and professional AI assistant for the Lumina Learning Management System. Help students solve problems, explain concepts, and use the 'navigate_to_page' tool if they want to go to a specific section of the site. Keep responses concise and helpful.",
          tools: [{ functionDeclarations: [navigateTool] }]
        }
      });

      const functionCalls = response.functionCalls;
      if (functionCalls && functionCalls.length > 0) {
        const call = functionCalls[0];
        if (call.name === 'navigate_to_page') {
          const page = (call.args as any).page;
          const resultText = navigateToPage(page);
          setMessages(prev => [...prev, { role: 'assistant', content: resultText }]);
          // Close after navigation if it's a redirect
          setTimeout(() => setIsOpen(false), 2000);
        }
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: response.text || "I'm not sure how to respond to that." }]);
      }
    } catch (error) {
      console.error("AI Chat failed:", error);
      setMessages(prev => [...prev, { role: 'assistant', content: "Sorry, I hit a snag. Please try again or check your connection." }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col items-end">
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="mb-4 w-[350px] sm:w-[400px] h-[500px] bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="bg-slate-900 p-5 flex items-center justify-between text-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-purple-900/20">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-sm">LearnBot AI</h3>
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Online & Ready</span>
                  </div>
                </div>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                className="p-2 hover:bg-white/10 rounded-xl transition-colors"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            {/* Messages */}
            <div 
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-5 space-y-4 bg-slate-50"
            >
              {messages.map((m, i) => (
                <div 
                  key={i}
                  className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[85%] p-4 rounded-2xl text-sm leading-relaxed shadow-sm ${
                    m.role === 'user' 
                      ? 'bg-purple-600 text-white rounded-tr-none' 
                      : 'bg-white text-slate-700 border border-slate-200 rounded-tl-none'
                  }`}>
                    {m.content}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-white p-4 rounded-2xl border border-slate-200 rounded-tl-none flex gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Processing...</span>
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <div className="p-4 bg-white border-t border-slate-100">
              <div className="relative flex items-center">
                <input 
                  type="text"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSend()}
                  placeholder="Ask me anything..."
                  className="w-full bg-slate-50 p-4 pr-14 rounded-2xl text-sm font-medium border border-slate-200 focus:outline-none focus:ring-4 focus:ring-purple-100 focus:border-purple-200 transition-all"
                />
                <button 
                  onClick={handleSend}
                  disabled={!input.trim() || isLoading}
                  className="absolute right-2 p-2.5 bg-slate-900 text-white rounded-xl hover:bg-slate-800 disabled:opacity-50 transition-all"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
              <div className="mt-3 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                <button onClick={() => setInput('Show announcements')} className="whitespace-nowrap px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-[10px] font-bold text-slate-600 uppercase tracking-wider transition-colors flex items-center gap-1.5">
                  <Navigation className="w-3 h-3" /> Navigation
                </button>
                <button onClick={() => setInput('Help with courses')} className="whitespace-nowrap px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-[10px] font-bold text-slate-600 uppercase tracking-wider transition-colors flex items-center gap-1.5">
                  <GraduationCap className="w-3 h-3" /> Courses
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-2xl transition-all active:scale-90 relative ${
          isOpen ? 'bg-slate-900' : 'bg-purple-600 hover:bg-purple-700'
        }`}
      >
        {isOpen ? <X className="w-6 h-6" /> : (
          <>
            <MessageSquare className="w-6 h-6" />
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-white"></div>
          </>
        )}
      </button>
    </div>
  );
}
