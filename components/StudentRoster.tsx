import React, { useMemo, useState } from 'react';
import { 
  Users, 
  Clock, 
  Calendar, 
  AlertCircle, 
  BookOpen, 
  FileEdit, 
  GraduationCap, 
  DollarSign, 
  Mail, 
  Globe,
  Hash,
  ArrowRight,
  ClipboardList,
  Search,
  X,
  Check,
  RotateCcw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Student, ExternalEvent } from '../types';
import { getThailandTodayStr, normalizeStudentName } from '../utils/dateUtils';

interface StudentRosterProps {
  students: Student[];
  externalEvents?: ExternalEvent[];
  onViewStudent: (student: Student) => void;
  onUpdateFields: (studentId: string, fields: Partial<Student>) => void;
  onImportEvent?: (event: ExternalEvent) => void;
}

export const StudentRoster: React.FC<StudentRosterProps> = ({ 
  students, 
  externalEvents = [],
  onViewStudent,
  onUpdateFields,
  onImportEvent
}) => {
  const todayStr = getThailandTodayStr();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'attention' | 'exam' | 'paying'>('all');
  
  // Helper to get relative date text
  const getRelativeDateStr = (dateStr: string) => {
    if (dateStr === todayStr) return 'Today';
    
    const today = new Date(todayStr);
    const lessonDate = new Date(dateStr);
    const diffTime = lessonDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays >= 2 && diffDays <= 7) return `In ${diffDays} days`;
    if (diffDays < 0) return 'Past due';
    return dateStr;
  };

const [completingIds, setCompletingIds] = useState<Record<string, NodeJS.Timeout>>({});

  const handleComplete = (e: React.MouseEvent, studentId: string, dateKey: string) => {
    e.stopPropagation();
    
    // Find the student to get current attendance
    const student = students.find(s => s.id === studentId);
    if (!student) return;

    // Set a timer for the undo period (5 seconds)
    const timeout = setTimeout(() => {
      const newAttendance = { ...(student.attendance || {}) };
      newAttendance[dateKey] = { 
        ...(newAttendance[dateKey] || {}), 
        status: 'confirmed',
        updatedAt: new Date().toISOString()
      };

      onUpdateFields(studentId, {
        attendance: newAttendance
      });
      setCompletingIds(prev => {
        const next = { ...prev };
        delete next[studentId];
        return next;
      });
    }, 5000);

    setCompletingIds(prev => ({ ...prev, [studentId]: timeout }));
  };

  const handleUndo = (e: React.MouseEvent, studentId: string) => {
    e.stopPropagation();
    if (completingIds[studentId]) {
      clearTimeout(completingIds[studentId]);
      setCompletingIds(prev => {
        const next = { ...prev };
        delete next[studentId];
        return next;
      });
    }
  };

  // Grouping & Priority Logic
  const categorized = useMemo(() => {
    const groups = {
      today: [] as { student: Student; lessonKey: string }[],
      tomorrow: [] as { student: Student; lessonKey: string }[],
      thisWeek: [] as { student: Student; lessonKey: string }[],
      future: [] as Student[], // Keep future/unscheduled student-centric to avoid noise
      unscheduled: [] as Student[]
    };

    const normSearch = normalizeStudentName(searchTerm).toLowerCase();

    const groupedByEventId = new Set<string>();
    students.forEach(s => {
      Object.values(s.attendance || {}).forEach(e => {
        if (e.googleEventId) groupedByEventId.add(e.googleEventId);
      });
    });

    students.forEach(student => {
      if (student.hidden || completingIds[student.id]) return;

      // Search and Filter
      const studentNameNorm = normalizeStudentName(student.name).toLowerCase();
      if (normSearch && !studentNameNorm.includes(normSearch) && !student.groupName?.toLowerCase().includes(normSearch)) {
        return;
      }

      // Active Filter
      if (activeFilter === 'attention' && !student.needsHomework && !student.needsPrep) return;
      if (activeFilter === 'exam' && !student.isExamPrep) return;
      if (activeFilter === 'paying' && !student.isPaymentPending) return;

      const attendance = student.attendance || {};
      const allLessons = Object.keys(attendance)
        .filter(d => !attendance[d].deleted)
        .sort();
      
      const pendingLessons = allLessons.filter(d => attendance[d].status !== 'confirmed' && d >= todayStr);
      
      // Flags to see if student was added to a scheduled section
      let addedToScheduled = false;

      // 1. Check all lessons for Today/Tomorrow/ThisWeek (Session-centric)
      allLessons.forEach(k => {
        const datePart = k.split('@')[0];
        // Show all lessons for this day
        
        if (datePart === todayStr) {
          groups.today.push({ student, lessonKey: k });
          addedToScheduled = true;
        } else if (datePart > todayStr) {
          const today = new Date(todayStr);
          const eventDay = new Date(datePart);
          const diffDays = Math.round((eventDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          
          if (diffDays === 1) {
            groups.tomorrow.push({ student, lessonKey: k });
            addedToScheduled = true;
          } else if (diffDays > 1 && diffDays <= 7) {
            groups.thisWeek.push({ student, lessonKey: k });
            addedToScheduled = true;
          }
        }
      });

      // 2. Fallbacks for Future/Unscheduled (Student-centric)
      if (!addedToScheduled) {
        const nextFuture = pendingLessons.find(d => {
          const datePart = d.split('@')[0];
          const today = new Date(todayStr);
          const eventDay = new Date(datePart);
          const diffDays = Math.round((eventDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          return diffDays > 7;
        });

        if (nextFuture) {
          groups.future.push(student);
        } else if (pendingLessons.length === 0) {
          // Check for ANY past session to see if they are a real student or just a placeholder
          if (Object.keys(attendance).length > 0 || student.source === 'google' || student.source === 'preply') {
            groups.unscheduled.push(student);
          }
        }
      }
    });

    // Add External Events that aren't linked to students yet
    const externalStats = { total: externalEvents.length, processed: 0, excluded: [] as string[] };

    externalEvents.forEach(event => {
      if (groupedByEventId.has(event.id)) {
        externalStats.excluded.push(`[${event.summary}] LinkExists`);
        return;
      }
      if (!event.summary) {
        externalStats.excluded.push(`[NoSummary] ${event.id}`);
        return;
      }
      if (event.summary.toLowerCase().startsWith('tutor session:')) {
        externalStats.excluded.push(`[${event.summary}] AppGenerated`);
        return;
      }

      const studentName = normalizeStudentName(event.summary);
      if (!studentName || studentName.length < 2) {
        externalStats.excluded.push(`[${event.summary}] SmallName`);
        return;
      }

      // Filter by search
      if (normSearch && !studentName.toLowerCase().includes(normSearch)) {
        externalStats.excluded.push(`[${event.summary}] SearchFilter`);
        return;
      }

      if (activeFilter !== 'all') {
        externalStats.excluded.push(`[${event.summary}] FilterActive`);
        return;
      }

      const start = event.start.dateTime || event.start.date;
      if (!start) {
        externalStats.excluded.push(`[${event.summary}] NoStart`);
        return;
      }

      // Use a consistent Thailand-local date string
      const startDateObj = new Date(start);
      const dateStr = new Intl.DateTimeFormat('en-CA', { // yyyy-mm-dd
        timeZone: 'Asia/Bangkok',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).format(startDateObj);

      if (dateStr < todayStr) {
        externalStats.excluded.push(`[${event.summary}] PastDate(${dateStr} < ${todayStr})`);
        return;
      }

      externalStats.processed++;
      // Ghost student for categorization
      const timeStr = startDateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Bangkok' });
      const lessonKey = `${dateStr}@${timeStr}`;

      const ghost: Student = {
        id: `external-${event.id}`,
        name: event.summary,
        teacherId: 'default-teacher',
        rates: { online: 0, onsite: 0, home: 0 },
        teacherRates: { online: 0, onsite: 0, home: 0 },
        defaultHours: 1,
        payments: [],
        attendance: {
          [lessonKey]: {
            hours: 1,
            startTime: timeStr,
            status: 'planned',
            type: 'online',
            googleEventId: event.id,
            source: 'google'
          }
        },
        hidden: false
      };

      if (dateStr === todayStr) {
        groups.today.push({ student: ghost, lessonKey });
      } else {
        const today = new Date(todayStr);
        const eventDay = new Date(dateStr);
        const diffDays = Math.round((eventDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        
        if (diffDays === 1) groups.tomorrow.push({ student: ghost, lessonKey });
        else if (diffDays > 1 && diffDays <= 7) groups.thisWeek.push({ student: ghost, lessonKey });
        else groups.future.push(ghost);
      }
    });

    if (externalEvents.length > 0) {
      console.log(`[Dashboard] Sync Stats:`, {
        totalCalendarEvents: externalStats.total,
        categorizedAsGhost: externalStats.processed,
        excludedReasons: externalStats.excluded
      });
    }

    // Sort within groups: by lesson key time, then by student name
    const sessionSorter = (a: { student: Student; lessonKey: string }, b: { student: Student; lessonKey: string }) => {
      if (a.lessonKey !== b.lessonKey) return a.lessonKey.localeCompare(b.lessonKey);
      return a.student.name.localeCompare(b.student.name);
    };
    
    groups.today.sort(sessionSorter);
    groups.tomorrow.sort(sessionSorter);
    groups.thisWeek.sort(sessionSorter);
    groups.future.sort((a, b) => a.name.localeCompare(b.name));
    groups.unscheduled.sort((a, b) => a.name.localeCompare(b.name));

    return groups;
  }, [students, todayStr, searchTerm, activeFilter, completingIds, externalEvents]);

  const renderStudentCard = (student: Student, lessonKey?: string) => {
    const fallbackKey = Object.keys(student.attendance || {})
        .filter(d => !student.attendance[d].deleted && d >= todayStr)
        .sort()[0];
    
    const activeKey = lessonKey || fallbackKey;
    const nextLesson = activeKey ? student.attendance[activeKey] : null;

    const timeDisplay = activeKey?.includes('@') ? activeKey.split('@')[1] : (nextLesson?.startTime || '');
    const relativeDate = activeKey ? getRelativeDateStr(activeKey.split('@')[0]) : null;
    
    const lessonCount = Object.values(student.attendance || {}).filter(e => !e.deleted && e.status === 'confirmed').length;
    
    const source = nextLesson?.source || (student.id.startsWith('google-') ? 'google' : 'app');
    const sourceIcon = source === 'preply' ? 'text-pink-500' : source === 'google' ? 'text-blue-500' : 'text-slate-400';

    // Urgency coloring
    const isExternal = student.id.startsWith('external-');
    const urgencyClass = relativeDate === 'Today' ? 'border-red-200 bg-red-50/10' : 
                         relativeDate === 'Tomorrow' ? 'border-orange-200 bg-orange-50/10' :
                         isExternal ? 'border-indigo-200 bg-indigo-50/10' :
                         'border-slate-100 bg-white';

    const isCompleting = !!completingIds[student.id];

    return (
      <motion.div 
        key={lessonKey ? `${student.id}-${lessonKey}` : student.id}
        layout
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        onClick={() => {
          if (isCompleting) return;
          if (isExternal) {
            // Find the original event
            const originalId = student.id.replace('external-', '');
            const event = externalEvents.find(e => e.id === originalId);
            if (event && onImportEvent) onImportEvent(event);
          } else {
            onViewStudent(student);
          }
        }}
        className={`group rounded-3xl border-2 ${urgencyClass} p-6 hover:shadow-2xl hover:shadow-slate-200/50 hover:border-brand-200 transition-all cursor-pointer flex flex-col gap-5 relative overflow-hidden backdrop-blur-sm ${isCompleting ? 'pointer-events-none' : ''}`}
      >
        {/* Undo Overlay */}
        <AnimatePresence>
          {isCompleting && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-50 bg-slate-900/90 flex flex-col items-center justify-center text-center p-4 backdrop-blur-sm pointer-events-auto"
            >
              <div className="w-12 h-12 rounded-full border-2 border-brand-500 border-t-transparent animate-spin mb-4" />
              <p className="text-white font-black uppercase tracking-widest text-[10px] mb-4">Lesson Validated</p>
              <button 
                onClick={(e) => handleUndo(e, student.id)}
                className="flex items-center gap-2 px-6 py-2 bg-brand-500 text-white rounded-xl font-bold text-xs hover:bg-brand-600 transition-all shadow-lg"
              >
                <RotateCcw size={14} /> Undo
              </button>
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* External Event Overlay Hint */}
        {isExternal && (
          <div className="absolute inset-0 bg-indigo-50/30 group-hover:bg-transparent transition-colors pointer-events-none" />
        )}

        {/* Source Ribbon */}
        <div className="absolute top-4 right-4 flex items-center gap-2">
           {relativeDate === 'Today' && !isExternal && (
             <button 
               onClick={(e) => handleComplete(e, student.id, activeKey)}
               className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-full text-[9px] font-black uppercase tracking-widest shadow-lg shadow-emerald-200 transition-all transform hover:scale-105"
               title="Validate Lesson"
             >
               <Check size={12} /> Complete
             </button>
           )}
           {isExternal && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-full text-[9px] font-black uppercase tracking-widest shadow-lg shadow-indigo-200">
                 <RotateCcw size={12} className="animate-pulse" /> Sync Pending
              </div>
           )}
           <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full border border-slate-100 bg-white ${sourceIcon} shadow-sm`}>
             {source}
           </span>
        </div>

        <div className="space-y-4">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                 <h4 className="text-xl font-black text-slate-800 tracking-tight group-hover:text-brand-600 transition-colors">
                   {student.name.replace(/^[- \s.·]+/, '')}
                 </h4>
                 {student.isExamPrep && <GraduationCap size={16} className="text-red-500 animate-pulse" />}
              </div>
              
              <div className="flex flex-wrap gap-2">
                {isExternal ? (
                  <span className="flex items-center gap-1 text-[9px] font-black text-indigo-600 uppercase tracking-widest bg-indigo-50 px-2 py-1 rounded-lg border border-indigo-100 italic">
                    Unsynced Event
                  </span>
                ) : (
                  <>
                    {student.groupName && (
                      <span className="flex items-center gap-1 text-[9px] font-black text-slate-500 uppercase tracking-widest bg-slate-100 px-2 py-1 rounded-lg border border-slate-200">
                        <Hash size={10} /> {student.groupName}
                      </span>
                    )}
                    <span className="flex items-center gap-1 text-[9px] font-black text-brand-600 uppercase tracking-widest bg-brand-50 px-2 py-1 rounded-lg border border-brand-100">
                      <Hash size={10} /> Lesson {lessonCount + 1}
                    </span>
                  </>
                )}
                {student.timezone && (
                   <span className="flex items-center gap-1 text-[9px] font-black text-sky-600 uppercase tracking-widest bg-sky-50 px-2 py-1 rounded-lg border border-sky-100">
                     <Globe size={10} /> {student.timezone.split('/').pop()?.replace('_', ' ')}
                   </span>
                )}
              </div>
            </div>
          </div>

          {/* Lesson Timing Dashboard */}
          {activeKey ? (
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${relativeDate === 'Today' ? 'bg-red-500 text-white shadow-lg shadow-red-200' : 'bg-white text-slate-400 shadow-sm'}`}>
                  <Clock size={20} />
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">{relativeDate}</p>
                  <p className="text-lg font-black text-slate-700 tracking-tight">{timeDisplay || 'Flexible'}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Duration</p>
                <p className="text-sm font-black text-slate-700">{nextLesson.hours}h</p>
              </div>
            </div>
          ) : (
            <div className="bg-slate-50 rounded-2xl p-4 border border-dashed border-slate-200 flex items-center justify-center">
               <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No Lesson Scheduled</p>
            </div>
          )}

          {/* Goals / Tasks Summary */}
          {(student.nextTask || student.needsHomework || student.needsPrep) && (
            <div className="space-y-2">
              {student.needsHomework && (
                <div className="flex items-center gap-2 text-purple-600 bg-purple-50/50 p-2 rounded-xl border border-purple-100">
                   <FileEdit size={14} className="shrink-0" />
                   <span className="text-[10px] font-bold">Homework Pending Check</span>
                </div>
              )}
              {student.needsPrep && (
                <div className="flex items-center gap-2 text-amber-600 bg-amber-50/50 p-2 rounded-xl border border-amber-100">
                   <AlertCircle size={14} className="shrink-0" />
                   <span className="text-[10px] font-bold">Lesson Materials Needed</span>
                </div>
              )}
              {student.nextTask && (
                <div className="flex items-start gap-2 text-slate-600 bg-white p-2 rounded-xl border border-slate-100 shadow-sm">
                   <ClipboardList size={14} className="shrink-0 mt-0.5 text-brand-500" />
                   <span className="text-[11px] font-medium leading-normal line-clamp-2">{student.nextTask}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Action Tray */}
        <div className="mt-2 flex items-center gap-2">
           <button 
             onClick={(e) => { e.stopPropagation(); onUpdateFields(student.id, { needsHomework: !student.needsHomework }); }}
             className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl transition-all border ${student.needsHomework ? 'bg-purple-600 text-white border-purple-700 shadow-lg shadow-purple-200' : 'bg-slate-50 text-slate-400 border-slate-100 hover:bg-slate-100'}`}
             title="Toggle Homework"
           >
             <FileEdit size={14} />
             <span className="text-[9px] font-black uppercase tracking-widest">HW</span>
           </button>
           <button 
             onClick={(e) => { e.stopPropagation(); onUpdateFields(student.id, { needsPrep: !student.needsPrep }); }}
             className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl transition-all border ${student.needsPrep ? 'bg-amber-500 text-white border-amber-600 shadow-lg shadow-amber-200' : 'bg-slate-50 text-slate-400 border-slate-100 hover:bg-slate-100'}`}
             title="Toggle Prep"
           >
             <AlertCircle size={14} />
             <span className="text-[9px] font-black uppercase tracking-widest">Prep</span>
           </button>
           <button 
             onClick={(e) => { e.stopPropagation(); onUpdateFields(student.id, { needsMaterial: !student.needsMaterial }); }}
             className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl transition-all border ${student.needsMaterial ? 'bg-emerald-500 text-white border-emerald-600 shadow-lg shadow-emerald-200' : 'bg-slate-50 text-slate-400 border-slate-100 hover:bg-slate-100'}`}
             title="Toggle Material"
           >
             <BookOpen size={14} />
             <span className="text-[9px] font-black uppercase tracking-widest">Mat</span>
           </button>
           {student.isPaymentPending && (
             <button 
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-rose-600 text-white rounded-xl border border-rose-700 shadow-lg shadow-rose-200 animate-pulse"
                title="Payment Pending"
             >
                <DollarSign size={14} />
                <span className="text-[9px] font-black uppercase tracking-widest">Pay</span>
             </button>
           )}
        </div>

        {/* Improved Footer */}
        <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
           <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5 text-slate-400">
                <Calendar size={14} />
                <span className="text-[10px] font-black uppercase tracking-widest">{activeKey?.split('@')[0] || 'Unscheduled'}</span>
              </div>
           </div>
           
           <div className="flex items-center gap-2">
             {student.email && (
                <a 
                  href={`mailto:${student.email}`}
                  onClick={(e) => e.stopPropagation()}
                  className="p-2 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-full transition-all"
                >
                  <Mail size={16} />
                </a>
              )}
              <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 group-hover:bg-brand-500 group-hover:text-white transition-all shadow-sm">
                <ArrowRight size={16} />
              </div>
           </div>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="flex-1 overflow-y-auto bg-white custom-scrollbar pb-64">
      {/* Dashboard Header */}
      <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-100 px-8 py-6 md:px-12">
        <div className="max-w-[1920px] mx-auto space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div>
              <h2 className="text-3xl font-black text-slate-900 tracking-tight">Student Dashboard</h2>
              <p className="text-sm font-bold text-slate-400 uppercase tracking-[0.2em] mt-1">Priority View & Action Center</p>
            </div>
            
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
               {/* Search Bar */}
               <div className="relative group min-w-[300px]">
                 <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-brand-500 transition-colors" />
                 <input 
                   type="text"
                   value={searchTerm}
                   onChange={(e) => setSearchTerm(e.target.value)}
                   placeholder="Search name or group..."
                   className="w-full pl-12 pr-10 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:bg-white focus:border-brand-500 focus:ring-4 focus:ring-brand-50 outline-none transition-all font-medium text-slate-700 placeholder:text-slate-300"
                 />
                 {searchTerm && (
                   <button 
                     onClick={() => setSearchTerm('')}
                     className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-600 transition-colors"
                   >
                     <X size={16} />
                   </button>
                 )}
               </div>

               {/* Add Student is handled by App.tsx header but redundant? Actually user wants it simple. */}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
             <button 
                onClick={() => setActiveFilter('all')}
                className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeFilter === 'all' ? 'bg-slate-900 text-white shadow-lg' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}
             >
                All Students
             </button>
             <button 
                onClick={() => setActiveFilter('attention')}
                className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeFilter === 'attention' ? 'bg-amber-500 text-white shadow-lg' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}
             >
                Needs Prep/HW
             </button>
             <button 
                onClick={() => setActiveFilter('exam')}
                className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeFilter === 'exam' ? 'bg-red-500 text-white shadow-lg' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}
             >
                Exam Prep
             </button>
             <button 
                onClick={() => setActiveFilter('paying')}
                className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeFilter === 'paying' ? 'bg-emerald-500 text-white shadow-lg' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}
             >
                Payment Due
             </button>
          </div>
        </div>
      </div>

      <div className="p-8 md:p-12 space-y-20">
      <Section title="Today's Sessions" sessions={categorized.today} icon={AlertCircle} colorClass="bg-red-500" subtitle="Urgent tasks & classes" renderStudentCard={renderStudentCard} />
      <Section title="Tomorrow" sessions={categorized.tomorrow} icon={Clock} colorClass="bg-orange-500" subtitle="Preparation window" renderStudentCard={renderStudentCard} />
      <Section title="This Week" sessions={categorized.thisWeek} icon={Calendar} colorClass="bg-brand-500" subtitle="Upcoming schedule" renderStudentCard={renderStudentCard} />
      <Section title="Future Lessons" students={categorized.future} icon={Calendar} colorClass="bg-slate-400" subtitle="Later this month" renderStudentCard={renderStudentCard} />
      <Section title="Unscheduled" students={categorized.unscheduled} icon={Users} colorClass="bg-slate-300" subtitle="Inactive or pending" renderStudentCard={renderStudentCard} />
      
      {students.length === 0 && (
        <div className="flex flex-col items-center justify-center py-48 text-center space-y-6">
           <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center text-slate-200 border-2 border-dashed border-slate-200">
             <Users size={48} />
           </div>
           <div>
             <h3 className="text-2xl font-black text-slate-800 tracking-tight">Your Dashboard is Empty</h3>
             <p className="text-slate-500 max-w-sm mx-auto mt-2">Connect your Preply or Google Calendar to sync your roster, or manually add your first student.</p>
           </div>
           <button 
             onClick={() => (window as unknown as { setIsAddModalOpen: (open: boolean) => void }).setIsAddModalOpen?.(true)}
             className="px-8 py-3 bg-slate-900 text-white rounded-2xl font-bold shadow-xl hover:bg-slate-800 transition-all uppercase tracking-widest text-xs"
           >
             Add Student
           </button>
        </div>
      )}
    </div>
  </div>
);
};

interface SectionProps {
  title: string;
  students?: Student[];
  sessions?: { student: Student; lessonKey: string }[];
  icon: React.ElementType;
  colorClass: string;
  subtitle: string;
  renderStudentCard: (student: Student, lessonKey?: string) => React.ReactNode;
}

const Section = ({ title, students = [], sessions = [], icon: Icon, colorClass, subtitle, renderStudentCard }: SectionProps) => {
  if (students.length === 0 && sessions.length === 0) return null;
  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between border-b-2 border-slate-100 pb-4">
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-2xl ${colorClass} text-white flex items-center justify-center shadow-2xl shadow-current/20`}>
            <Icon size={24} />
          </div>
          <div>
            <h3 className="text-2xl font-black text-slate-800 tracking-tight leading-none mb-1">{title}</h3>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{subtitle}</p>
          </div>
        </div>
        <div className="bg-slate-100 px-3 py-1 rounded-full">
          <span className="text-[10px] font-black text-slate-500 uppercase">{students.length + sessions.length} Total</span>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-8">
        <AnimatePresence mode="popLayout" initial={false}>
          {sessions.map(s => renderStudentCard(s.student, s.lessonKey))}
          {students.map(s => renderStudentCard(s))}
        </AnimatePresence>
      </div>
    </div>
  );
};
