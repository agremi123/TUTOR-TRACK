import React, { useState, useRef, useEffect } from 'react';
import { Send, X, Sparkles, User, Bot, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { chatWithAI } from '../services/geminiService.ts';
import { Student, Teacher } from '../types.ts';
import { Modal } from './ui/Modal.tsx';

interface Message {
  role: 'user' | 'model';
  parts: { text: string }[];
}

interface AIChatProps {
  isOpen: boolean;
  onClose: () => void;
  students: Student[];
  teachers: Teacher[];
  onUpdateData: (action: string, payload: Record<string, unknown>) => void;
}

export const AIChat: React.FC<AIChatProps> = ({ isOpen, onClose, students, teachers, onUpdateData }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: 'user', parts: [{ text: input }] };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await chatWithAI(input, messages, { students, teachers });
      const modelMessage: Message = { 
        role: 'model', 
        parts: [{ text: response.text || "I've processed your request." }] 
      };
      setMessages(prev => [...prev, modelMessage]);
      
      if (response.functionCalls) {
        response.functionCalls.forEach((call: { name: string; args: Record<string, unknown> }) => {
          onUpdateData(call.name, call.args);
        });
      }
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [...prev, { role: 'model', parts: [{ text: "Sorry, I encountered an error. Please try again." }] }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="max-w-2xl" className="h-[80vh]">
        {/* Header */}
        <div className="p-4 bg-slate-900 text-white flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center">
              <Sparkles size={18} className="text-white" />
            </div>
            <div>
              <h2 className="text-sm font-black uppercase tracking-widest">TutorTrack AI Assistant</h2>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Ask me to manage your classes</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50">
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-40">
              <Bot size={48} className="text-slate-400" />
              <p className="text-sm font-bold text-slate-500 max-w-xs">
                Hello! I can help you add students, cancel lessons, or analyze your financials. What's on your mind?
              </p>
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`flex gap-3 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center ${msg.role === 'user' ? 'bg-slate-200' : 'bg-brand-100'}`}>
                  {msg.role === 'user' ? <User size={16} className="text-slate-600" /> : <Bot size={16} className="text-brand-600" />}
                </div>
                <div className={`p-4 rounded-2xl text-sm font-medium shadow-sm ${
                  msg.role === 'user' ? 'bg-slate-900 text-white rounded-tr-none' : 'bg-white text-slate-700 rounded-tl-none border border-slate-100'
                }`}>
                  <ReactMarkdown className="prose prose-sm prose-slate max-w-none">
                    {msg.parts[0].text}
                  </ReactMarkdown>
                </div>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-lg bg-brand-100 flex items-center justify-center">
                  <Bot size={16} className="text-brand-600" />
                </div>
                <div className="bg-white p-4 rounded-2xl rounded-tl-none border border-slate-100 shadow-sm">
                  <Loader2 size={16} className="animate-spin text-brand-600" />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="p-4 bg-white border-t border-slate-100">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              placeholder="Type your request here..."
              className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500 font-medium text-sm"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className={`p-3 rounded-xl transition-all ${
                !input.trim() || isLoading ? 'bg-slate-100 text-slate-400' : 'bg-brand-600 text-white shadow-lg hover:bg-brand-700'
              }`}
            >
              <Send size={20} />
            </button>
          </div>
        </div>
    </Modal>
  );
};
