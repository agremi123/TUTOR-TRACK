
import React from 'react';
import { PriorityNotes } from './PriorityNotes';
import { StickyNote, Briefcase, Zap } from 'lucide-react';

interface WorkspaceViewProps {
  userId: string;
  pinnedNote: string;
  pinnedNoteUpdatedAt: string | null;
  onUpdatePinnedNote: (val: string) => void;
  preplyNote: string;
  preplyNoteUpdatedAt: string | null;
  onUpdatePreplyNote: (val: string) => void;
}

export const WorkspaceView: React.FC<WorkspaceViewProps> = ({ 
  userId, 
  pinnedNote, 
  pinnedNoteUpdatedAt, 
  onUpdatePinnedNote,
  preplyNote,
  preplyNoteUpdatedAt,
  onUpdatePreplyNote
}) => {
  const [localNote, setLocalNote] = React.useState(pinnedNote);
  const [localPreplyNote, setLocalPreplyNote] = React.useState(preplyNote);
  const [isTyping, setIsTyping] = React.useState(false);
  const [isTypingPreply, setIsTypingPreply] = React.useState(false);
  
  const debounceTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const debounceTimerPreplyRef = React.useRef<NodeJS.Timeout | null>(null);

  // Sync from props only when not typing
  React.useEffect(() => {
    if (!isTyping) {
      setLocalNote(pinnedNote);
    }
  }, [pinnedNote, isTyping]);

  React.useEffect(() => {
    if (!isTypingPreply) {
      setLocalPreplyNote(preplyNote);
    }
  }, [preplyNote, isTypingPreply]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setLocalNote(val);
    setIsTyping(true);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      onUpdatePinnedNote(val);
      setIsTyping(false);
    }, 1500);
  };

  const handleChangePreply = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setLocalPreplyNote(val);
    setIsTypingPreply(true);

    if (debounceTimerPreplyRef.current) {
      clearTimeout(debounceTimerPreplyRef.current);
    }

    debounceTimerPreplyRef.current = setTimeout(() => {
      onUpdatePreplyNote(val);
      setIsTypingPreply(false);
    }, 1500);
  };

  // Ensure pending changes are saved on unmount
  const lastNoteRef = React.useRef(localNote);
  const lastPreplyNoteRef = React.useRef(localPreplyNote);

  React.useEffect(() => {
    lastNoteRef.current = localNote;
  }, [localNote]);

  React.useEffect(() => {
    lastPreplyNoteRef.current = localPreplyNote;
  }, [localPreplyNote]);

  React.useEffect(() => {
    return () => {
      if (isTyping) onUpdatePinnedNote(lastNoteRef.current);
      if (isTypingPreply) onUpdatePreplyNote(lastPreplyNoteRef.current);
    };
  }, [isTyping, isTypingPreply, onUpdatePinnedNote, onUpdatePreplyNote]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-slate-50">
      <div className="p-6 lg:p-8 flex-1 flex flex-col gap-6 overflow-hidden max-w-[1600px] mx-auto w-full">
        {/* Header inside Workspace */}
        <div className="flex items-center gap-3">
          <div className="p-3 bg-brand-600 text-white rounded-2xl shadow-lg shadow-brand-100">
            <Zap size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">Personal Workspace</h2>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Global Focus • Roadmap • Quick Notes</p>
          </div>
        </div>

        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 overflow-hidden">
          {/* Left Column: Priority Notes & Projects */}
          <div className="flex flex-col overflow-hidden bg-white rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-slate-100">
            <div className="p-6 border-b border-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Briefcase size={20} className="text-brand-600" />
                <span className="text-sm font-black uppercase tracking-tight text-slate-800">Strategy & Roadmap</span>
              </div>
            </div>
            <div className="flex-1 overflow-hidden">
               <PriorityNotes userId={userId} />
            </div>
          </div>

          {/* Right Column: Global Notepad Split into 2 sections */}
          <div className="flex flex-col gap-6 overflow-y-auto custom-scrollbar pr-2">
            
            {/* Section 1: Preply Students */}
            <div className="flex flex-col bg-white rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-slate-100 min-h-[300px]">
               <div className="p-6 border-b border-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <StickyNote size={20} className="text-emerald-500" />
                  <span className="text-sm font-black uppercase tracking-tight text-slate-800">Preply Students</span>
                </div>
                <div className="flex flex-col items-end">
                  {preplyNoteUpdatedAt && (
                    <span className="text-[10px] font-bold text-slate-400 uppercase">
                      Saved {new Date(preplyNoteUpdatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                  {isTypingPreply && (
                    <span className="text-[10px] font-bold text-emerald-500 animate-pulse uppercase">Saving...</span>
                  )}
                </div>
              </div>
              <div className="flex-1 flex flex-col p-6 overflow-hidden">
                 <textarea
                   value={localPreplyNote}
                   onChange={handleChangePreply}
                   placeholder="Notes about Preply students specifically..."
                   className="flex-1 p-6 text-sm font-medium leading-relaxed text-slate-700 bg-[#fdfdfd] rounded-[1.5rem] border border-slate-100 focus:border-emerald-200 focus:bg-white focus:ring-4 focus:ring-emerald-50/30 outline-none resize-none transition-all custom-scrollbar shadow-inner"
                   style={{ 
                     backgroundImage: 'radial-gradient(#ecfdf5 1px, transparent 1px)', 
                     backgroundSize: '24px 24px',
                     lineHeight: '1.8'
                   }}
                 />
              </div>
            </div>

            {/* Section 2: Everything Else */}
            <div className="flex flex-col bg-white rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-slate-100 flex-1 min-h-[300px]">
               <div className="p-6 border-b border-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <StickyNote size={20} className="text-amber-500" />
                  <span className="text-sm font-black uppercase tracking-tight text-slate-800">Everything Else</span>
                </div>
                <div className="flex flex-col items-end">
                  {pinnedNoteUpdatedAt && (
                    <span className="text-[10px] font-bold text-slate-400 uppercase">
                      Saved {new Date(pinnedNoteUpdatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                  {isTyping && (
                    <span className="text-[10px] font-bold text-brand-500 animate-pulse uppercase">Saving...</span>
                  )}
                </div>
              </div>
              <div className="flex-1 flex flex-col p-6 overflow-hidden">
                 <textarea
                   value={localNote}
                   onChange={handleChange}
                   placeholder="General thoughts, other students, and reminders..."
                   className="flex-1 p-6 text-sm font-medium leading-relaxed text-slate-700 bg-[#fdfdfd] rounded-[1.5rem] border border-slate-100 focus:border-brand-200 focus:bg-white focus:ring-4 focus:ring-brand-50/30 outline-none resize-none transition-all custom-scrollbar shadow-inner"
                   style={{ 
                     backgroundImage: 'radial-gradient(#fff7ed 1px, transparent 1px)', 
                     backgroundSize: '24px 24px',
                     lineHeight: '1.8'
                   }}
                 />
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};
