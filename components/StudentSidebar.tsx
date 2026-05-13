
import React, { useState, useMemo } from 'react';
import { Search, User, RefreshCw, Calendar, Clock } from 'lucide-react';
import { Student } from '../types.ts';
import { getThailandNow, getThailandTodayStr, getMinutesUntil } from '../utils/dateUtils.ts';
import { StudentCard } from './StudentCard.tsx';

interface StudentSidebarProps {
  students: Student[];
  onViewStudent: (student: Student) => void;
  onUpdateStudentTask: (studentId: string, task: string | null, isDone: boolean) => void;
  onUpdateStudent: (updatedStudent: Student) => void;
  onDeleteStudent: (studentId: string) => void;
  onRefreshFromGoogle: () => void;
  isSyncing: boolean;
}

export const StudentSidebar: React.FC<StudentSidebarProps> = ({ 
  students, 
  onViewStudent, 
  onUpdateStudentTask,
  onUpdateStudent,
  onDeleteStudent,
  onRefreshFromGoogle,
  isSyncing
}) => {
  const [search, setSearch] = useState('');

  const getNextClassInfo = useMemo(() => (student: Student) => {
    let minTime = Infinity;
    let nextDateStr = '';
    const nowTime = getThailandNow().getTime();
    
    const validEntries = Object.entries(student.attendance || {})
      .filter(([, entry]) => !entry.deleted)
      .sort((a, b) => a[0].localeCompare(b[0]));

    let nextIndex = -1;
    let nextTimeStr = '';
    let attendanceKey = '';
    
    validEntries.forEach(([key], idx) => {
      const [datePart, timePart] = key.split('@');
      if (!timePart) return;
      const [h, m] = timePart.split(':').map(Number);
      const d = new Date(datePart + 'T00:00:00'); 
      d.setHours(h, m, 0, 0);
      const t = d.getTime();
      if (t >= nowTime && t < minTime) {
        minTime = t;
        nextDateStr = datePart;
        nextTimeStr = timePart;
        attendanceKey = key;
        nextIndex = idx + 1;
      }
    });

    let label = "";
    if (nextIndex !== -1) {
      if (nextIndex === 1) label = "Trial lesson";
      else {
        const n = nextIndex;
        const lastDigit = n % 10;
        const lastTwoDigits = n % 100;
        let suffix = "th";
        if (lastTwoDigits < 11 || lastTwoDigits > 13) {
          if (lastDigit === 1) suffix = "st";
          else if (lastDigit === 2) suffix = "nd";
          else if (lastDigit === 3) suffix = "rd";
        }
        label = `${n}${suffix} lesson`;
      }
    }

    return { time: minTime, dateStr: nextDateStr, timeStr: nextTimeStr, attendanceKey, index: nextIndex, label };
  }, []);

  const filteredStudents = useMemo(() => {
    return students.filter(s => 
      !s.hidden && s.name.toLowerCase().includes(search.toLowerCase())
    ).sort((a, b) => {
      const infoA = getNextClassInfo(a);
      const infoB = getNextClassInfo(b);
      
      if (infoA.time !== infoB.time) return infoA.time - infoB.time;
      return a.name.localeCompare(b.name);
    });
  }, [students, search, getNextClassInfo]);

  const dateGroups = useMemo(() => {
    const groups: Record<string, { label: string, students: Student[], color: string, order: number, nextLessonTime?: number }> = {};
    const todayStr = getThailandTodayStr();
    
    filteredStudents.forEach(s => {
       const info = getNextClassInfo(s);
       const groupKey = info.dateStr || 'none';
       let label = '';
       let color = '';
       let order = 0;
       
       if (groupKey === 'none') {
         label = 'No Class Scheduled';
         color = 'bg-slate-100 text-slate-400 border-slate-200';
         order = 9999;
       } else {
         const d1 = new Date(groupKey + 'T00:00:00');
         const d2 = new Date(todayStr + 'T00:00:00');
         const diffDays = Math.round((d1.getTime() - d2.getTime()) / (1000 * 60 * 60 * 24));
         
         if (diffDays === 0) {
           label = 'Today';
           color = 'bg-sky-50 text-sky-600 border-sky-100';
           order = 0;
         } else if (diffDays === 1) {
           label = 'Tomorrow';
           color = 'bg-slate-50 text-slate-500 border-slate-100';
           order = 1;
         } else if (diffDays < 7) {
            label = d1.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
            if (diffDays === 2) {
              color = 'bg-amber-50 text-amber-600 border-amber-100';
            } else if (diffDays === 3) {
              color = 'bg-yellow-50 text-yellow-600 border-yellow-100';
            } else {
              color = 'bg-lime-50 text-lime-600 border-lime-100';
            }
            order = diffDays;
         } else {
            label = d1.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            color = 'bg-emerald-50 text-emerald-600 border-emerald-100';
            order = diffDays;
         }
       }
       
       if (!groups[groupKey]) {
         groups[groupKey] = { label, students: [], color, order };
       }
       groups[groupKey].students.push(s);
       
       // For 'Today', track the earliest upcoming lesson time
       if (label === 'Today' && info.time !== Infinity && info.time > getThailandNow().getTime()) {
         if (!groups[groupKey].nextLessonTime || info.time < groups[groupKey].nextLessonTime!) {
           groups[groupKey].nextLessonTime = info.time;
         }
       }
    });
    
    return Object.values(groups).sort((a, b) => a.order - b.order);
  }, [filteredStudents, getNextClassInfo]);

  return (
    <div className="w-80 h-full bg-white border-r border-slate-200 flex flex-col shadow-xl z-30">
      <div className="p-4 border-b border-slate-100 bg-slate-50/50">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
            <User size={16} className="text-brand-600" /> Student Roster
          </h2>
          <button 
            onClick={onRefreshFromGoogle}
            disabled={isSyncing}
            className="p-2 text-slate-400 hover:text-brand-600 transition-colors"
            title="Sync from Google"
          >
            <RefreshCw size={16} className={isSyncing ? 'animate-spin' : ''} />
          </button>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input 
            type="text" 
            placeholder="Search students..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500 transition-all text-sm font-medium shadow-inner"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-8">
        {dateGroups.map((group) => (
          <div key={group.label} className="space-y-3">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${group.color} shadow-sm inline-flex mb-1`}>
              <Calendar size={12} />
              <h3 className="text-[10px] font-black uppercase tracking-widest">{group.label}</h3>
              {group.label === 'Today' && group.nextLessonTime && (() => {
                 const mins = getMinutesUntil(group.nextLessonTime);
                 if (mins > 0 && mins < 600) { // Only show if lesson is soon-ish (within 10hrs)
                   return (
                     <div className="flex items-center gap-1 ml-2 pl-2 border-l border-red-200 text-red-500 animate-pulse">
                        <Clock size={10} />
                        <span className="text-[9px] font-black">Next in {mins}m</span>
                     </div>
                   );
                 }
                 return null;
              })()}
            </div>
            
            <div className="space-y-2">
              {group.students.map(student => (
                <StudentCard
                  key={student.id}
                  student={student}
                  onViewStudent={onViewStudent}
                  onUpdateStudent={onUpdateStudent}
                  onUpdateStudentTask={onUpdateStudentTask}
                  onDeleteStudent={onDeleteStudent}
                  getNextClassInfo={getNextClassInfo}
                />
              ))}
            </div>
          </div>
        ))}
        {filteredStudents.length === 0 && (
          <div className="text-center py-12">
            <User size={32} className="mx-auto text-slate-100 mb-2" />
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No students found</p>
          </div>
        )}
      </div>
    </div>
  );
};

