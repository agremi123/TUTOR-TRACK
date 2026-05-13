
import React, { useState, useRef, useMemo } from 'react';
import { Coins, Wifi, Building2, Home, X, Pencil, EyeOff, Users, GraduationCap, Paperclip, Receipt, Trash2, Target, FileText, Check } from 'lucide-react';
import { Student, DayInfo, ClassType, AttendanceEntry, Teacher, Attachment, AttendanceStatus } from '../types.ts';
import { formatCurrency } from '../utils/dateUtils.ts';
import { Modal } from './ui/Modal.tsx';
import { Popover } from './ui/Popover.tsx';

interface StudentRowProps {
  student: Student;
  allStudents: Student[];
  days: DayInfo[];
  teachers: Teacher[];
  onUpdateAttendance: (studentId: string, dateStr: string, data: AttendanceEntry | null) => void;
  onOpenPaymentModal: (student: Student) => void;
  onEditStudent: (student: Student) => void;
  onViewStudent: (student: Student) => void;
  onSettleDebt: (student: Student, amount: number) => void;
  onToggleVisibility: (studentId: string) => void;
  onUpdateStudent: (student: Student) => void;
  onUpdateStudentTask: (studentId: string, task: string | null, isDone: boolean) => void;
  onDeleteStudent: (studentId: string) => void;
  onShowBill: (student: Student) => void;
}

export const StudentRow: React.FC<StudentRowProps> = ({
  student,
  allStudents,
  days,
  teachers,
  onUpdateAttendance,
  onOpenPaymentModal,
  onEditStudent,
  onViewStudent,
  onSettleDebt,
  onToggleVisibility,
  onUpdateStudent,
  onUpdateStudentTask,
  onDeleteStudent,
  onShowBill
}) => {
  const [activeCellDate, setActiveCellDate] = useState<string | null>(null);
  const [editingAlertId, setEditingAlertId] = useState<string | null>(null);
  const [tempAlert, setTempAlert] = useState(student.alertText || '');
  const [editHours, setEditHours] = useState<number | null>(null);
  const [editStatus, setEditStatus] = useState<AttendanceStatus | null>(null);
  const [editSummary, setEditSummary] = useState<string>('');
  const [editNextGoal, setEditNextGoal] = useState<string>('');
  const [editTeacherPaid, setEditTeacherPaid] = useState<boolean>(false);
  const [editStudentPaid, setEditStudentPaid] = useState<boolean>(false);
  const [editTeacherId, setEditTeacherId] = useState<string>(student.teacherId);
  const [editWage, setEditWage] = useState<number>(0);
  const [editStartTime, setEditStartTime] = useState<string>('');
  const [selectedType, setSelectedType] = useState<ClassType | null>(null);
  const [editAttachments, setEditAttachments] = useState<Attachment[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showStudentDeleteConfirm, setShowStudentDeleteConfirm] = useState(false);
  
  const mouseMoveRef = useRef({ x: 0, y: 0 });

  const isGrouped = !!student.groupName;

  // Monthly statistics for this student in the current view
  const monthlyRowStats = useMemo(() => {
    return days.reduce(
      (acc, day) => {
        const dayEntries = Object.entries(student.attendance)
          .filter(([key]) => key.startsWith(day.dateStr))
          .map(([, entry]) => entry);

        dayEntries.forEach(entry => {
          if (entry && (entry.status === 'confirmed' || !entry.status)) {
            const sRate = (student.rates[entry.type as keyof typeof student.rates] as number) || 0;
            const tId = entry.teacherId || student.teacherId;
            const tWage = tId === 'default-teacher' ? 0 : (entry.wage !== undefined ? entry.wage : (student.teacherRates[entry.type as keyof typeof student.teacherRates] || 0));
            
            acc.count += 1;
            acc.hours += entry.hours;
            acc.billed += entry.hours * sRate;
            acc.wage += entry.hours * tWage;
            acc.profit += (entry.hours * sRate) - (entry.hours * tWage);
          }
        });
        return acc;
      },
      { billed: 0, wage: 0, profit: 0, count: 0, hours: 0 }
    );
  }, [student, days]);

  const groupStudents = useMemo(() => isGrouped ? allStudents.filter(s => s.groupName === student.groupName) : [student], [isGrouped, allStudents, student]);
  
  // Calculate Wallet Balance
  const currentBalance = useMemo(() => {
    let totalPaid = 0;
    let totalCost = 0;

    groupStudents.forEach(s => {
      totalPaid += s.payments.reduce((sum, p) => sum + p.amount, 0);
      const entries = (Object.values(s.attendance) as AttendanceEntry[]).filter(e => !e.deleted);
      totalCost += entries.reduce((sum: number, entry: AttendanceEntry) => {
        if ((entry.status === 'confirmed' || !entry.status) && !entry.studentPaid) {
            const rate = (s.rates[entry.type as keyof typeof s.rates] as number) || 0;
            return sum + (entry.hours * rate);
        }
        return sum;
      }, 0);
    });
    return totalPaid - totalCost;
  }, [groupStudents]);

  const totalHoursAllTime = useMemo(() => {
    return groupStudents.reduce((acc, s) => {
        return acc + (Object.values(s.attendance) as AttendanceEntry[]).filter(e => !e.deleted).reduce((sum, entry) => {
            if (entry.status === 'confirmed' || !entry.status) return sum + entry.hours;
            return sum;
        }, 0);
    }, 0);
  }, [groupStudents]);
  
  const primaryRate = student.rates.onsite || student.rates.online || student.rates.home || 0;
  const hoursLeft = primaryRate > 0 ? (currentBalance / primaryRate) : 0;
  const isTrial = Object.values(student.attendance).filter(e => !e.deleted).length <= 1;

  const alertTriggerRef = useRef<HTMLButtonElement>(null);

  const handleCellClick = (e: React.MouseEvent, dateStr: string, key?: string) => {
    const deltaX = Math.abs(e.clientX - mouseMoveRef.current.x), deltaY = Math.abs(e.clientY - mouseMoveRef.current.y);
    if (deltaX > 10 || deltaY > 10) return;

    const targetKey = key || dateStr;
    const existing = student.attendance[targetKey];
    setShowDeleteConfirm(false);
    if (existing) {
        setEditHours(existing.hours);
        setEditStatus(existing.status || 'confirmed');
        setSelectedType(existing.type as ClassType);
        setEditSummary(existing.summary || '');
        setEditNextGoal(existing.nextGoal || '');
        setEditTeacherPaid(existing.teacherPaid || false);
        setEditStudentPaid(existing.studentPaid || false);
        setEditTeacherId(existing.teacherId || student.teacherId);
        setEditWage(existing.wage !== undefined ? existing.wage : (student.teacherRates[existing.type as ClassType] || 0));
        setEditStartTime(existing.startTime || '');
        setEditAttachments(existing.attachments || []);
    } else {
        setEditHours(null);
        setEditStatus(null);
        setSelectedType(null);
        setEditSummary('');
        setEditNextGoal('');
        setEditTeacherPaid(false);
        setEditStudentPaid(false);
        setEditTeacherId(student.teacherId);
        setEditWage(0);
        setEditStartTime('');
        setEditAttachments([]);
    }
    setActiveCellDate(targetKey);
  };

  const handleTypeSelect = (type: ClassType) => {
    setSelectedType(type);
    const rate = student.teacherRates[type] || 0;
    setEditWage(rate);
  };

  const handleSaveCell = () => {
    if (activeCellDate && selectedType && editHours && editHours > 0 && editStatus) {
      onUpdateAttendance(student.id, activeCellDate, {
        hours: editHours,
        type: selectedType,
        status: editStatus,
        summary: editSummary,
        nextGoal: editNextGoal,
        teacherPaid: editTeacherId === 'default-teacher' ? true : editTeacherPaid,
        studentPaid: editStudentPaid,
        teacherId: editTeacherId,
        wage: editWage,
        startTime: editStartTime,
        attachments: editAttachments
      });
      
      // If a next goal is set, update the student's persistent next task
      if (editNextGoal && editNextGoal.trim() !== '') {
        onUpdateStudentTask(student.id, editNextGoal, false);
      }
      
      setActiveCellDate(null);
    }
  };

  const handleDeleteCell = () => {
    onUpdateAttendance(student.id, activeCellDate!, null);
    setActiveCellDate(null);
    setShowDeleteConfirm(false);
  };

  const isValid = !!(activeCellDate && selectedType && editHours && editHours > 0 && editStatus);

  return (
    <>
      <tr className="hover:bg-slate-50 transition-colors border-b border-slate-100 group">
        <td className="sticky left-0 z-20 bg-white group-hover:bg-slate-50 p-0 border-r border-slate-200 shadow-[1px_0_4px_rgba(0,0,0,0.02)]">
          <div className="flex items-center justify-between p-3 min-w-[240px]">
            <div className="select-text">
              <div className="flex items-center gap-2 flex-wrap min-w-0">
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
                <button onClick={() => onViewStudent(student)} className="font-semibold hover:underline text-left flex items-center gap-1.5 text-slate-800 shrink-0">
                    {student.name.replace(/^[- \s.·]+/, '')}
                    {isGrouped && <Users size={12} className="text-slate-400" />}
                </button>

                <div className="relative shrink-0">
                  {student.alertText ? (
                    <button
                      ref={alertTriggerRef}
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingAlertId(student.id);
                        setTempAlert(student.alertText || '');
                      }}
                      className="text-[7px] font-black text-red-600 bg-red-50 px-1 py-0.5 rounded border border-red-200 animate-flash-red uppercase hover:bg-red-100 transition-colors"
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
                      className="text-[7px] font-bold text-slate-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all border border-transparent hover:border-red-100 rounded px-1"
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
                  <span className="text-[7px] font-black text-amber-600 bg-amber-50 px-1 py-0.5 rounded border border-amber-100 animate-flash-red">
                    TRIAL
                  </span>
                )}
                {(() => {
                  const validEntriesCount = Object.values(student.attendance).filter(e => !e.deleted).length;
                  if (validEntriesCount === 0) return null;
                  
                  const n = validEntriesCount;
                  let label = "";
                  if (n === 1) label = "Trial";
                  else {
                    const lastDigit = n % 10;
                    const lastTwoDigits = n % 100;
                    let suffix = "th";
                    if (lastTwoDigits < 11 || lastTwoDigits > 13) {
                      if (lastDigit === 1) suffix = "st";
                      else if (lastDigit === 2) suffix = "nd";
                      else if (lastDigit === 3) suffix = "rd";
                    }
                    label = `${n}${suffix}`;
                  }
                  
                  return (
                    <span className="inline-flex items-center gap-0.5 px-1 py-0.5 bg-slate-100 text-slate-500 rounded text-[8px] font-black uppercase tracking-tighter transition-all group-hover:bg-brand-50 group-hover:text-brand-600">
                      <GraduationCap size={8} /> {label}
                    </span>
                  );
                })()}

                <div className="flex items-center gap-1.5 ml-auto sm:ml-0">
                  {student.groupName !== 'Preply Sync' && (
                    <button onClick={() => onShowBill(student)} className="text-slate-400 hover:text-slate-600 transition-colors" title="Generate Monthly Bill"><FileText size={12}/></button>
                  )}
                  <button onClick={() => onEditStudent(student)} className="text-slate-300 hover:text-brand-600 transition-colors opacity-0 group-hover:opacity-100"><Pencil size={12}/></button>
                  <button onClick={() => onToggleVisibility(student.id)} className="text-slate-300 hover:text-amber-600 transition-colors opacity-0 group-hover:opacity-100 ml-1" title="Hide student"><EyeOff size={12}/></button>
                  {showStudentDeleteConfirm ? (
                      <div className="inline-flex items-center gap-1 bg-red-50 px-1.5 py-0.5 rounded border border-red-100 ml-1 animate-in slide-in-from-left-2">
                          <button onClick={() => { onDeleteStudent(student.id); setShowStudentDeleteConfirm(false); }} className="text-[8px] font-black text-red-600 uppercase">Delete?</button>
                          <button onClick={() => setShowStudentDeleteConfirm(false)} className="text-[8px] font-black text-slate-400 uppercase">No</button>
                      </div>
                  ) : (
                      <button onClick={() => setShowStudentDeleteConfirm(true)} className="text-slate-300 hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100 ml-1" title="Delete Student"><Trash2 size={12}/></button>
                  )}
                </div>
              </div>
              <div className="flex gap-2 mt-1 text-[10px] text-slate-500">
                  {student.rates.online !== null && <span className="flex items-center gap-1"><Wifi size={10} /> {student.rates.online}</span>}
                  {student.rates.onsite !== null && <span className="flex items-center gap-1"><Building2 size={10} /> {student.rates.onsite}</span>}
                  {student.rates.home !== null && <span className="flex items-center gap-1"><Home size={10} /> {student.rates.home}</span>}
              </div>
              {student.nextTask && (
                <div className="mt-1 flex items-center gap-1 text-[10px] text-slate-500 font-bold bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100/50 truncate max-w-[200px]">
                  <Target size={10} className="shrink-0" />
                  <span className="truncate">{student.nextTask}</span>
                </div>
              )}
            </div>
            <button onClick={() => onOpenPaymentModal(student)} className={`px-2 py-1.5 rounded-md flex items-center gap-1.5 text-xs font-medium border ${currentBalance < 0 ? 'bg-red-50 text-red-600 border-red-100' : currentBalance < 1000 ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}><Coins size={12} /> {formatCurrency(currentBalance)}</button>
          </div>
        </td>

        {days.map((day) => {
          const dayEntries = Object.entries(student.attendance)
            .filter(([key, entry]) => key.startsWith(day.dateStr) && !entry.deleted)
            .map(([key, entry]) => ({ key, ...entry }));
          
          const isSuggested = dayEntries.length === 0 && student.suggestedDays?.includes(day.dateStr);
          
          return (
            <td 
              key={day.dateStr} 
              onMouseDown={e => mouseMoveRef.current = { x: e.clientX, y: e.clientY }} 
              onClick={(e) => handleCellClick(e, day.dateStr)} 
              className={`attendance-cell p-0 min-w-[48px] text-center border-r border-slate-200 cursor-pointer relative transition-colors ${
                isSuggested ? 'bg-emerald-50/50 border-emerald-100' : 
                day.isToday ? 'bg-brand-50/70 border-x-2 border-brand-200/50 relative z-10 shadow-[inset_0_0_0_1px_rgba(37,99,235,0.05)]' :
                day.isHighlighted ? 'bg-brand-50/50 border-x border-brand-200/50' : 'bg-transparent'
              } hover:bg-brand-50/60 group/day`}
            >
              <div className="w-full h-11 flex items-center justify-center relative">
                {dayEntries.length > 0 ? (
                    <div className="flex -space-x-2 hover:space-x-1 transition-all duration-300">
                      {dayEntries.map((entry) => {
                        const hasFiles = entry.attachments && entry.attachments.length > 0;
                        const isPlanned = entry.status === 'planned';
                        const sPaid = entry.studentPaid;
                        const isConfirmed = entry.status === 'confirmed' || !entry.status;
                        
                        return (
                          <div 
                            key={entry.key}
                            onClick={(e) => {
                                e.stopPropagation();
                                handleCellClick(e, day.dateStr, entry.key);
                            }}
                            className={`w-8 h-8 rounded-full flex items-center justify-center border text-[10px] font-bold shadow-sm relative transition-all pointer-events-auto hover:scale-110 hover:z-20 ${
                                isPlanned ? 'border-dashed border-2' : 'border-solid'
                            } ${
                                entry.type === 'online' ? (isPlanned ? 'text-sky-600 bg-white border-sky-300' : 'bg-sky-50 text-sky-700 border-sky-100 shadow-sky-100') : 
                                entry.type === 'onsite' ? (isPlanned ? 'text-purple-600 bg-white border-purple-300' : 'bg-purple-50 text-purple-700 border-purple-100 shadow-purple-100') : 
                                (isPlanned ? 'text-orange-600 bg-white border-orange-300' : 'bg-orange-50 text-orange-700 border-orange-100 shadow-orange-100')
                            }`}
                          >
                            <span className={isPlanned ? 'italic opacity-70' : ''}>{entry.hours}</span>
                            {!sPaid && isConfirmed && currentBalance < 0 && (
                              <div className="absolute -top-1 -left-1 w-2.5 h-2.5 bg-red-500 rounded-full border border-white flex items-center justify-center shadow-sm">
                                  <X size={8} className="text-white font-black" />
                              </div>
                            )}
                            {(entry.summary || entry.nextGoal) && <div className="absolute -top-1 -right-1 w-2 h-2 bg-yellow-400 rounded-full border border-white" />}
                            {hasFiles && <Paperclip size={8} className="absolute -bottom-1 -left-1 text-slate-500 bg-white rounded-full p-0.5 border border-slate-100" />}
                          </div>
                        );
                      })}
                    </div>
                ) : (
                  <div className="relative flex items-center justify-center pointer-events-none">
                    <div className={`w-1 h-1 rounded-full ${day.isToday ? 'bg-brand-400 scale-[2.5]' : 'bg-slate-300 opacity-50'}`} />
                    {isSuggested && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-6 h-6 rounded-lg bg-emerald-100/30 border border-emerald-200/50" />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </td>
          );
        })}

        <td className="sticky right-0 z-20 bg-white group-hover:bg-slate-50 p-0 border-l border-slate-200 shadow-[-1px_0_4px_rgba(0,0,0,0.02)]">
            <div className="grid grid-cols-3 h-full divide-x divide-slate-100 items-center text-center">
                <div className="flex flex-col justify-center px-1">
                    <span className="text-xs font-black text-slate-700">{monthlyRowStats.hours}h</span>
                </div>
                <div className="flex flex-col justify-center px-1">
                    <span className="text-xs font-black text-slate-500">{totalHoursAllTime}h</span>
                </div>
                <div className="flex flex-col justify-center px-1 relative group/balance">
                    <span className={`text-xs font-black ${hoursLeft < 2 ? 'text-red-500' : 'text-emerald-600'}`}>
                        {hoursLeft.toFixed(1)}h
                    </span>
                    {currentBalance < 0 && (
                        <button onClick={() => onSettleDebt(student, Math.abs(currentBalance))} className="absolute inset-0 bg-red-100/90 text-red-700 flex items-center justify-center opacity-0 group-hover/balance:opacity-100 transition-opacity font-black text-[9px] uppercase tracking-tighter">Settle</button>
                    )}
                </div>
            </div>
        </td>
      </tr>

      <Modal 
        isOpen={!!activeCellDate} 
        onClose={() => setActiveCellDate(null)} 
        maxWidth="max-w-md"
      >
        <div className="p-6 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-brand-600 uppercase tracking-[0.2em] mb-0.5">Lesson Ledger</span>
            <h3 className="text-xl font-black text-slate-800 tracking-tight">{student.name}</h3>
            <span className="text-xs font-bold text-slate-400">{activeCellDate}</span>
          </div>
          <button onClick={() => setActiveCellDate(null)} className="p-3 hover:bg-slate-200 rounded-full text-slate-400 transition-colors">
            <X size={24} />
          </button>
        </div>
        
        <div className="p-8 space-y-8 overflow-y-auto max-h-[65vh] custom-scrollbar">
              <div className="space-y-4">
                 <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <GraduationCap size={14}/> Assigned Teacher
                 </label>
                 <select 
                    value={editTeacherId} 
                    onChange={(e) => setEditTeacherId(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-brand-500 focus:bg-white transition-all text-sm font-bold"
                 >
                    {teachers.map(t => (
                        <option key={t.id} value={t.id}>{t.name} {t.id === 'default-teacher' ? '(Me)' : ''}</option>
                    ))}
                 </select>
              </div>

              <div className="space-y-4">
                 <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    1. Select Class Type {!selectedType && <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-ping"/>}
                 </label>
                 <div className="grid grid-cols-3 gap-3">
                    <button onClick={() => handleTypeSelect('online')} className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all active:scale-95 ${selectedType === 'online' ? 'bg-sky-50 border-sky-500 text-sky-700 shadow-lg' : 'bg-white border-slate-100 text-slate-400'}`}>
                        <Wifi size={24} /> <span className="text-[10px] font-black uppercase">Online</span>
                    </button>
                    <button onClick={() => handleTypeSelect('onsite')} className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all active:scale-95 ${selectedType === 'onsite' ? 'bg-purple-50 border-purple-500 text-purple-700 shadow-lg' : 'bg-white border-slate-100 text-slate-400'}`}>
                        <Building2 size={24} /> <span className="text-[10px] font-black uppercase">Onsite</span>
                    </button>
                    <button onClick={() => handleTypeSelect('home')} className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all active:scale-95 ${selectedType === 'home' ? 'bg-orange-50 border-orange-500 text-orange-700 shadow-lg' : 'bg-white border-slate-100 text-slate-400'}`}>
                        <Home size={24} /> <span className="text-[10px] font-black uppercase">Home</span>
                    </button>
                 </div>
              </div>

              <div className="space-y-4">
                 <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    2. Status {!editStatus && <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-ping"/>}
                 </label>
                 <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => setEditStatus('planned')} className={`py-3 rounded-xl border-2 font-black text-sm transition-all ${editStatus === 'planned' ? 'bg-amber-50 border-amber-500 text-amber-700 shadow-md' : 'bg-white border-slate-100 text-slate-400'}`}>
                        Planned
                    </button>
                    <button onClick={() => setEditStatus('confirmed')} className={`py-3 rounded-xl border-2 font-black text-sm transition-all ${editStatus === 'confirmed' ? 'bg-emerald-50 border-emerald-500 text-emerald-700 shadow-md' : 'bg-white border-slate-100 text-slate-400'}`}>
                        Confirmed
                    </button>
                 </div>
              </div>

              <div className="space-y-4">
                 <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    3. Duration {!editHours && <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-ping"/>}
                 </label>
                 <div className="grid grid-cols-4 gap-2">
                    {[1, 1.5, 2, 3].map(h => (
                        <button key={h} onClick={() => setEditHours(h)} className={`py-3 rounded-xl border-2 font-black text-sm ${editHours === h ? 'bg-slate-900 border-slate-900 text-white' : 'bg-white border-slate-100'}`}>
                            {h}h
                        </button>
                    ))}
                 </div>
              </div>

              <div className="space-y-4">
                 <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    4. Start Time
                 </label>
                 <input 
                    type="time" 
                    value={editStartTime} 
                    onChange={(e) => setEditStartTime(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-brand-500 focus:bg-white transition-all text-sm font-bold"
                 />
              </div>

              <div className="space-y-4">
                 <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    5. Task for Next Lesson
                 </label>
                 <textarea 
                    value={editNextGoal} 
                    onChange={(e) => setEditNextGoal(e.target.value)}
                    placeholder="What needs to be done next time?"
                    className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-brand-500 focus:bg-white transition-all text-sm font-bold min-h-[80px]"
                 />
              </div>

              <div className="space-y-4 pt-4 border-t border-slate-100">
                <h4 className="text-[11px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <Receipt size={14} /> Student Payment
                </h4>
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-200">
                    <div className="flex flex-col">
                        <span className="text-[10px] font-black text-slate-600 uppercase">Settlement Method</span>
                    </div>
                    <button 
                        onClick={() => setEditStudentPaid(!editStudentPaid)}
                        className={`flex flex-col items-end px-3 py-1 rounded-xl border ${editStudentPaid ? 'bg-emerald-100 border-emerald-500' : 'bg-white border-slate-300'}`}
                    >
                            <span className={`text-sm font-black flex items-center gap-2 ${editStudentPaid ? 'text-emerald-700' : 'text-slate-400'}`}>
                                {editStudentPaid ? 'Paid Direct' : 'Wallet Deduct'}
                            </span>
                    </button>
                </div>
              </div>
            </div>

            <div className="p-8 bg-slate-50 border-t border-slate-100 flex gap-3">
              {student.attendance[activeCellDate] ? (
                <>
                  {showDeleteConfirm ? (
                    <div className="flex-1 flex gap-2">
                      <button 
                        onClick={handleDeleteCell} 
                        className="flex-1 py-5 rounded-3xl bg-red-600 text-white hover:bg-red-700 transition-all font-black text-[10px] uppercase tracking-widest"
                      >
                        Confirm Cancel
                      </button>
                      <button 
                        onClick={() => setShowDeleteConfirm(false)} 
                        className="px-4 py-5 rounded-3xl bg-white border-2 border-slate-200 text-slate-400 hover:bg-slate-50 transition-all font-black text-[10px] uppercase tracking-widest"
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <button 
                      onClick={() => setShowDeleteConfirm(true)} 
                      className="flex-1 py-5 rounded-3xl bg-white border-2 border-red-100 text-red-600 hover:bg-red-50 transition-all font-black text-sm uppercase tracking-widest"
                    >
                      Cancel Lesson
                    </button>
                  )}
                </>
              ) : (
                <button 
                  onClick={() => setActiveCellDate(null)} 
                  className="flex-1 py-5 rounded-3xl bg-white border-2 border-slate-200 text-slate-400 hover:bg-slate-50 transition-all font-black text-sm uppercase tracking-widest"
                >
                  Discard
                </button>
              )}
              
              {!showDeleteConfirm && (
                <button 
                  onClick={handleSaveCell} 
                  disabled={!isValid} 
                  className={`flex-[2] py-5 rounded-3xl transition-all ${isValid ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
                >
                  <span className="font-black text-sm uppercase tracking-widest">
                    {student.attendance[activeCellDate] ? 'Update Lesson' : 'Log Lesson'}
                  </span>
                </button>
              )}
            </div>
      </Modal>
    </>
  );
};
