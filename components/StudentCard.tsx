import React, { useState, useRef, useMemo } from 'react';
import { 
  Plus, 
  X, 
  Check,
  Target,
  Trash2,
  GraduationCap
} from 'lucide-react';
import { Student } from '../types.ts';
import { AVAILABLE_BOOKS } from '../constants.ts';
import { Popover } from './ui/Popover.tsx';
import { getStudentLocalTime, getBKKLocalTime } from '../utils/dateUtils.ts';

interface StudentCardProps {
  student: Student;
  onViewStudent: (student: Student) => void;
  onUpdateStudent: (updatedStudent: Student) => void;
  onUpdateStudentTask: (studentId: string, task: string | null, isDone: boolean) => void;
  onDeleteStudent: (studentId: string) => void;
  getNextClassInfo: (student: Student) => { index: number; label: string; timeStr: string; dateStr: string };
}

export const StudentCard: React.FC<StudentCardProps> = ({
  student,
  onViewStudent,
  onUpdateStudent,
  onUpdateStudentTask,
  onDeleteStudent,
  getNextClassInfo
}) => {
  const [editingBooksId, setEditingBooksId] = useState<string | null>(null);
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [editingAlertId, setEditingAlertId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [tempGoal, setTempGoal] = useState(student.nextTask || '');
  const [tempAlert, setTempAlert] = useState(student.alertText || '');
  
  const booksTriggerRef = useRef<HTMLButtonElement>(null);
  const goalTriggerRef = useRef<HTMLButtonElement>(null);
  const alertTriggerRef = useRef<HTMLButtonElement>(null);

  const classInfo = useMemo(() => getNextClassInfo(student), [student, getNextClassInfo]);

  const isTrial = Object.values(student.attendance).filter(e => !e.deleted).length <= 1;

  return (
    <div 
      onClick={() => onViewStudent(student)}
      className="group p-3 border border-slate-100 bg-white rounded-xl transition-all cursor-pointer shadow-sm hover:shadow-md hover:bg-slate-50 relative"
    >
      {showDeleteConfirm ? (
        <div 
          onClick={(e) => e.stopPropagation()}
          className="absolute top-2.5 right-10 flex items-center gap-1 bg-red-600 text-white px-2 py-1 rounded-lg z-10 animate-in slide-in-from-right-2"
        >
          <span className="text-[10px] font-black uppercase">Delete?</span>
          <button 
            onClick={() => { onDeleteStudent(student.id); setShowDeleteConfirm(false); }}
            className="p-1 hover:bg-white/20 rounded"
          >
            <Check size={14} />
          </button>
          <button 
            onClick={() => setShowDeleteConfirm(false)}
            className="p-1 hover:bg-white/20 rounded"
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowDeleteConfirm(true);
          }}
          className="absolute top-2.5 right-10 p-1 text-slate-200 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all z-10 opacity-0 group-hover:opacity-100"
          title="Delete Student"
        >
          <Trash2 size={14} />
        </button>
      )}

      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 pr-6">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-baseline gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onUpdateStudent({ ...student, isPrepared: !student.isPrepared });
                }}
                className={`p-1 rounded-md border-2 transition-all flex items-center justify-center shrink-0 ${
                  student.isPrepared 
                    ? 'bg-emerald-500 border-emerald-500 text-white shadow-sm shadow-emerald-100' 
                    : 'bg-white border-slate-200 text-transparent hover:border-emerald-200'
                }`}
                title={student.isPrepared ? "Content Prepared" : "Mark as Prepared"}
              >
                <Check size={10} className={student.isPrepared ? 'opacity-100' : 'opacity-0'} />
              </button>
              <p className="font-bold text-sm text-slate-800">
                {student.name.replace(/^[- \s.·]+/, '')}
              </p>
              
              <div className="relative">
                {student.alertText ? (
                  <button
                    ref={alertTriggerRef}
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingAlertId(student.id);
                      setTempAlert(student.alertText || '');
                    }}
                    className="text-[9px] font-black text-red-600 bg-red-50 px-1.5 py-0.5 rounded border border-red-200 animate-flash-red uppercase shadow-sm cursor-pointer hover:bg-red-100 transition-colors"
                  >
                    {student.alertText}
                  </button>
                ) : (
                  <button
                    ref={alertTriggerRef}
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingAlertId(student.id);
                      setTempAlert('');
                    }}
                    className="text-[8px] font-bold text-slate-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all border border-transparent hover:border-red-100 rounded px-1"
                  >
                    + ALERT
                  </button>
                )}

                <Popover
                  isOpen={editingAlertId === student.id}
                  onClose={() => setEditingAlertId(null)}
                  triggerRef={alertTriggerRef}
                  className="w-56"
                >
                  <div className="flex justify-between items-center px-1 py-1 mb-2 border-b border-slate-50">
                    <span className="text-[10px] font-black text-red-500 uppercase tracking-widest">CRUCIAL ALERT</span>
                    <button onClick={() => setEditingAlertId(null)} className="text-slate-400 hover:text-slate-600 outline-none"><X size={12}/></button>
                  </div>
                  <div className="space-y-2">
                    <input
                      autoFocus
                      type="text"
                      value={tempAlert}
                      onChange={(e) => setTempAlert(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          onUpdateStudent({ ...student, alertText: tempAlert.trim() || '' });
                          setEditingAlertId(null);
                        }
                      }}
                      placeholder="e.g. UNPAID, NEEDS HW..."
                      className="w-full px-2 py-1.5 text-[11px] font-bold uppercase bg-red-50 border border-red-100 rounded-lg outline-none focus:ring-2 focus:ring-red-500 text-red-600 placeholder:text-red-200"
                    />
                    <div className="flex gap-1">
                      <button
                        onClick={() => {
                          onUpdateStudent({ ...student, alertText: tempAlert.trim() || '' });
                          setEditingAlertId(null);
                        }}
                        className="flex-1 py-1.5 bg-red-600 text-white rounded-lg text-[9px] font-black uppercase shadow-lg shadow-red-200"
                      >
                        Set Alert
                      </button>
                      {student.alertText && (
                        <button
                          onClick={() => {
                            onUpdateStudent({ ...student, alertText: '' });
                            setEditingAlertId(null);
                          }}
                          className="px-2 py-1.5 bg-slate-100 text-slate-400 rounded-lg text-[9px] font-black uppercase hover:bg-red-50 hover:text-red-500"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>
                </Popover>
              </div>

              {isTrial && !student.alertText && (
                <span className="text-[8px] font-black text-amber-600 bg-amber-50 px-1 py-0.5 rounded border border-amber-100 animate-flash-red">
                  TRIAL
                </span>
              )}
              {classInfo.index !== -1 && (
                <span className="text-[9px] font-bold text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100 flex items-center gap-1 shadow-sm uppercase tracking-tighter">
                  <GraduationCap size={10} /> {classInfo.label}
                </span>
              )}
            </div>

            {student.email && (
              <span className="text-[8px] font-bold text-slate-400 bg-slate-50 px-1 py-0.5 rounded border border-slate-100 truncate max-w-[150px]">
                {student.email}
              </span>
            )}

            {classInfo.timeStr && (
              <div className="flex flex-col gap-0.5 mt-1">
                <div className="flex items-center gap-1.5 text-slate-500">
                  <span className="text-xs font-black">
                    {getBKKLocalTime(classInfo.timeStr, classInfo.dateStr)}
                  </span>
                  <span className="text-[9px] font-bold text-slate-400 tracking-tighter">
                    , Bangkok (Me)
                  </span>
                </div>
                {student.timezone && student.timezone !== 'Asia/Bangkok' && (
                  <div className="flex items-center gap-1.5 text-slate-400">
                    <span className="text-xs font-black">
                      {getStudentLocalTime(classInfo.timeStr, classInfo.dateStr, student.timezone)}
                    </span>
                    <span className="text-[9px] font-bold tracking-tighter opacity-70">
                      , {student.timezone.split('/').pop()?.replace('_', ' ')} (Student)
                    </span>
                  </div>
                )}
              </div>
            )}
            
            {/* Inline Book Editor */}
            <div className="relative">
               <button 
                 ref={booksTriggerRef}
                 onClick={(e) => {
                   e.stopPropagation();
                   setEditingBooksId(editingBooksId ? null : student.id);
                   setEditingGoalId(null);
                 }}
                 className={`p-1 rounded-full transition-all ${editingBooksId ? 'bg-brand-100 text-brand-600' : 'text-slate-300 hover:text-brand-500 hover:bg-slate-100'}`}
               >
                 <Plus size={12} />
               </button>
               
               <Popover 
                 isOpen={editingBooksId === student.id} 
                 onClose={() => setEditingBooksId(null)}
                 triggerRef={booksTriggerRef}
                 className="w-56"
               >
                  <div className="flex justify-between items-center px-1 py-1 mb-1 border-b border-slate-50">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Resources</span>
                    <button onClick={() => setEditingBooksId(null)} className="text-slate-400 hover:text-slate-600 outline-none"><X size={12}/></button>
                  </div>
                  <div className="max-h-48 overflow-y-auto custom-scrollbar flex flex-col gap-1">
                    {/* Predefined books */}
                    {AVAILABLE_BOOKS.map(book => {
                      const isSelected = (student.books || []).includes(book);
                      return (
                        <button 
                          key={book}
                          onClick={() => {
                            const currentBooks = student.books || [];
                            const newBooks = isSelected 
                              ? currentBooks.filter(b => b !== book) 
                              : [...currentBooks, book];
                            onUpdateStudent({ ...student, books: newBooks });
                          }}
                          className={`flex items-center justify-between px-3 py-1.5 rounded-lg text-left text-[11px] font-bold transition-all ${isSelected ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-50'}`}
                        >
                          {book}
                          {isSelected && <Check size={10} />}
                        </button>
                      );
                    })}

                    {/* Custom books already in student list */}
                    {(student.books || []).filter(b => !AVAILABLE_BOOKS.includes(b)).map(book => (
                      <button 
                        key={book}
                        onClick={() => {
                          const newBooks = (student.books || []).filter(b => b !== book);
                          onUpdateStudent({ ...student, books: newBooks });
                        }}
                        className="flex items-center justify-between px-3 py-1.5 rounded-lg text-left text-[11px] font-bold transition-all bg-brand-50 text-brand-700 hover:bg-brand-100"
                      >
                        {book}
                        <Check size={10} />
                      </button>
                    ))}

                    {/* Add Custom Material Input */}
                    <div className="mt-1 pt-1 border-t border-slate-50">
                      <input 
                        type="text" 
                        placeholder="Add other material..." 
                        className="w-full px-2 py-1.5 text-[9px] font-bold border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-brand-500 bg-slate-50"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            const val = e.currentTarget.value.trim();
                            if (val && !(student.books || []).includes(val)) {
                              onUpdateStudent({ ...student, books: [...(student.books || []), val] });
                              e.currentTarget.value = '';
                            }
                          }
                        }}
                      />
                    </div>
                  </div>
               </Popover>
            </div>
          </div>
          
          <div className="flex items-center gap-3 mt-1.5 min-h-[16px]">
            {/* Goal Editor */}
            <div className="relative">
              <button
                ref={goalTriggerRef}
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingGoalId(editingGoalId ? null : student.id);
                  setEditingBooksId(null);
                  setTempGoal(student.nextTask || '');
                }}
                className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider transition-all rounded px-1.5 py-0.5 -ml-1.5 ${
                  student.nextTask ? 'text-slate-500 bg-slate-50 border border-slate-100 shadow-sm' : 'text-slate-400 hover:text-brand-500 hover:bg-slate-50'
                }`}
              >
                <Target size={10} />
                <span className="truncate max-w-[120px]">{student.nextTask || "Add Goal"}</span>
              </button>
              
              <Popover
                isOpen={editingGoalId === student.id}
                onClose={() => setEditingGoalId(null)}
                triggerRef={goalTriggerRef}
                className="w-64"
              >
                <div className="flex justify-between items-center px-1 py-1 mb-2 border-b border-slate-50">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Student Goal</span>
                  <button onClick={() => setEditingGoalId(null)} className="text-slate-400 hover:text-slate-600 outline-none"><X size={12}/></button>
                </div>
                <div className="space-y-3">
                  <textarea
                    autoFocus
                    value={tempGoal}
                    onChange={(e) => setTempGoal(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                        onUpdateStudentTask(student.id, tempGoal, false);
                        setEditingGoalId(null);
                      }
                    }}
                    placeholder="E.g., Master TCF Oral, Prepare for DELF B2..."
                    className="w-full p-2.5 text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-brand-500 min-h-[80px] resize-none"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        onUpdateStudentTask(student.id, tempGoal, false);
                        setEditingGoalId(null);
                      }}
                      className="flex-1 py-1.5 bg-brand-600 text-white rounded-lg text-[10px] font-black uppercase shadow-lg shadow-brand-200"
                    >
                      Save Goal
                    </button>
                    {student.nextTask && (
                      <button
                        onClick={() => {
                          onUpdateStudentTask(student.id, null, false);
                          setEditingGoalId(null);
                        }}
                        className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              </Popover>
            </div>

            {student.books && student.books.length > 0 && (
              <div className="flex items-center gap-1 overflow-hidden">
                {student.books.slice(0, 2).map((book, idx) => (
                  <span key={idx} className="text-[9px] font-black uppercase tracking-tighter text-slate-400 bg-slate-100 px-1 py-0.5 rounded border border-slate-200 whitespace-nowrap">
                    {book}
                  </span>
                ))}
                {student.books.length > 2 && (
                  <span className="text-[8px] font-black text-slate-300">+{student.books.length - 2}</span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
