
import React, { useState, useEffect, useRef } from 'react';
import { StickyNote, Clock, Trash2, Minimize2 } from 'lucide-react';

interface NotepadProps {
  initialValue?: string;
  lastUpdated?: string;
  onSave: (value: string) => void;
}

export const Notepad: React.FC<NotepadProps> = ({ initialValue = '', lastUpdated, onSave }) => {
  const [text, setText] = useState(initialValue);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setText(initialValue);
  }, [initialValue]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newVal = e.target.value;
    setText(newVal);

    // Auto-save debouncing
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsSaving(true);
    timeoutRef.current = setTimeout(() => {
      // Only save if the value has actually changed compared to the source
      if (newVal.trim() !== initialValue.trim()) {
        onSave(newVal);
      }
      setIsSaving(false);
    }, 2000); // Increased slightly for better batching
  };

  const clearNotes = () => {
    if (window.confirm('Clear all notes?')) {
      setText('');
      onSave('');
    }
  };

  return (
    <div className={`fixed bottom-6 right-6 transition-all duration-300 z-[100] ${isExpanded ? 'w-[320px] h-[400px]' : 'w-12 h-12'} group`}>
      {!isExpanded ? (
        <button 
          onClick={() => setIsExpanded(true)}
          className="w-12 h-12 bg-slate-700 hover:bg-slate-800 text-white rounded-full shadow-lg flex items-center justify-center transition-all animate-bounce hover:animate-none border-2 border-white/20"
          title="Open Notepad"
        >
          <StickyNote size={24} />
          {text.trim().length > 0 && (
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-brand-500 border border-white rounded-full"></span>
          )}
        </button>
      ) : (
        <div className="w-full h-full bg-slate-50 rounded-2xl shadow-2xl border-2 border-slate-200 flex flex-col overflow-hidden animate-in zoom-in-90 duration-200">
          <div className="p-3 bg-slate-100 flex items-center justify-between border-b border-slate-200">
            <div className="flex items-center gap-2 text-slate-800">
              <StickyNote size={16} className="font-bold" />
              <span className="text-[10px] font-black uppercase tracking-widest leading-none">Tutor Notes</span>
            </div>
            <div className="flex items-center gap-2">
              {isSaving && <div className="w-1.5 h-1.5 bg-brand-500 rounded-full animate-pulse" />}
              <button 
                onClick={() => setIsExpanded(false)} 
                className="p-1 hover:bg-slate-200 rounded-lg text-slate-500 transition-colors"
                title="Collapse"
              >
                <Minimize2 size={14} />
              </button>
            </div>
          </div>
          
          <textarea
            value={text}
            onChange={handleChange}
            placeholder="Type your notes or tasks here..."
            className="flex-1 p-4 bg-white outline-none resize-none text-[13px] leading-relaxed font-medium text-slate-700 placeholder:text-slate-300 custom-scrollbar"
          />
          
          <div className="p-2 px-3 bg-slate-50 flex items-center justify-between border-t border-slate-200">
            <div className="flex items-center gap-1.5 text-slate-400">
              <Clock size={11} />
              <span className="text-[9px] font-bold uppercase tracking-tight">
                {lastUpdated ? `Saved ${new Date(lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Draft'}
              </span>
            </div>
            <button 
              onClick={clearNotes}
              className="p-1.5 hover:bg-red-50 text-slate-300 hover:text-red-500 rounded-md transition-all"
              title="Clear all"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
