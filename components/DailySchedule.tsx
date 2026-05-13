
import React, { useMemo } from 'react';
import { Clock, Calendar as CalendarIcon, Target } from 'lucide-react';
import { Student, ClassType, ExternalEvent, Teacher } from '../types.ts';
import { getDaysInCurrentWeek, getThailandDateStr, normalizeStudentName } from '../utils/dateUtils.ts';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

interface DailyScheduleProps {
  students: Student[];
  teachers: Teacher[];
  externalEvents?: ExternalEvent[];
}

interface ScheduleItem {
  studentName?: string;
  summary?: string;
  startTime: string;
  endTime?: string;
  hours?: number;
  type?: ClassType;
  dateStr: string;
  isExternal?: boolean;
  isPreply?: boolean;
  description?: string;
  status?: string;
  isVerified?: boolean;
  teacherId?: string;
  nextTask?: string;
}

export const DailySchedule: React.FC<DailyScheduleProps> = ({ students, teachers, externalEvents = [] }) => {
  const currentWeekDays = useMemo(() => getDaysInCurrentWeek(), []);

  const scheduleByDay = useMemo(() => {
    const schedule: Record<string, ScheduleItem[]> = {};
    const syncedGoogleEventIds = new Set<string>();
    
    // Create a set of date strings in the current week for fast filtering
    const weekDateStrSet = new Set(currentWeekDays.map(d => d.dateStr));

    // Add student lessons
    students.forEach(student => {
      Object.entries(student.attendance).forEach(([key, entry]) => {
        if (entry.deleted) return;
        const dateStr = key.split('@')[0];
        
        // ONLY process if it's in the current week to save memory/cpu
        if (!weekDateStrSet.has(dateStr)) return;

        if (!schedule[dateStr]) schedule[dateStr] = [];
        
        if (entry.googleEventId) {
          syncedGoogleEventIds.add(entry.googleEventId);
        }

        const startTime = entry.startTime || 'All Day';
        let endTime = '';

        if (entry.startTime) {
          // Calculate end time for lessons
          const [h, m] = entry.startTime.split(':').map(Number);
          const startMinutes = h * 60 + m;
          const endMinutes = startMinutes + (entry.hours * 60);
          const endH = Math.floor(endMinutes / 60) % 24;
          const endM = endMinutes % 60;
          endTime = `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`;
        }

        schedule[dateStr].push({
          studentName: student.name,
          startTime,
          endTime,
          hours: entry.hours,
          type: entry.type,
          dateStr,
          status: entry.status,
          isVerified: entry.studentPaid, // Using studentPaid as a proxy for verification for now
          teacherId: student.teacherId,
          nextTask: student.nextTask,
          isPreply: student.groupName === 'Preply Sync' || student.groupName === 'Class Sync'
        });
      });
    });

    // Add external events
    externalEvents.forEach(event => {
      // Filter out events created by TutorTrack to avoid duplicates in the UI
      if (event.summary?.startsWith('Tutor Session:')) return;
      
      const start = event.start.dateTime || event.start.date;
      if (!start) return;
      
      const startDate = new Date(start);
      const dateStr = getThailandDateStr(startDate);

      // ONLY process if it's in the current week
      if (!weekDateStrSet.has(dateStr)) return;

      const summary = (event.summary || '').toLowerCase();
      const description = (event.description || '').toLowerCase();
      const organizerEmail = (event.organizer?.email || '').toLowerCase();
      const organizerName = (event.organizer?.displayName || '').toLowerCase();

      const isPreplyOrClass = 
        summary.includes('preply') || 
        summary.includes('class') ||
        summary.startsWith('lesson:') ||
        summary.includes('tutor') ||
        description.includes('preply') ||
        description.includes('class') ||
        organizerEmail.includes('preply') ||
        organizerName.includes('preply');

      // If it's not a Preply/Class event AND not from our specific TutorTrack calendar, 
      // we might want to hide it if the user wants a "filtered" view.
      // But for now, let's show it if it's not a Tutor Session duplicate.
      if (!isPreplyOrClass && event.calendarId === 'primary' && !event.summary?.toLowerCase().includes('tutor')) {
        // Optional: could return here if we want strict filtering
        // return; 
      }
      // Filter out events that are already imported as student lessons
      if (event.id && syncedGoogleEventIds.has(event.id)) return;

      const startTime = event.start.dateTime 
        ? startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Bangkok' })
        : 'All Day';

      let endTime = '';
      if (event.end?.dateTime) {
        endTime = new Date(event.end.dateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Bangkok' });
      } else if (event.end?.date) {
        endTime = 'End of Day';
      }

      // Rule: Skip events that don't have a recognizable student name for a "lesson" view
      if (!normalizeStudentName(summary)) return;

      if (!schedule[dateStr]) schedule[dateStr] = [];
      schedule[dateStr].push({
        summary: event.summary,
        startTime,
        endTime,
        dateStr,
        isExternal: true,
        isPreply: isPreplyOrClass,
        description: event.description
      });
    });

    // Sort each day's items by start time
    Object.keys(schedule).forEach(dateStr => {
      schedule[dateStr].sort((a, b) => {
        if (a.startTime === 'All Day') return -1;
        if (b.startTime === 'All Day') return 1;
        return a.startTime.localeCompare(b.startTime);
      });
    });

    return schedule;
  }, [students, externalEvents, currentWeekDays]);

  return (
    <div className="mt-12 space-y-8">
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-brand-100 text-brand-600 rounded-2xl">
            <Clock size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">Weekly Schedule</h2>
            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">TutorTrack & Google Calendar</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {externalEvents.length > 0 && (
            <div className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100">
              <CalendarIcon size={16} />
              <span className="text-xs font-black uppercase tracking-wider">Google Synced</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex lg:flex-row overflow-x-auto lg:overflow-x-visible gap-2 pb-8 snap-x snap-mandatory custom-scrollbar">
        {currentWeekDays.map(day => {
          const dayItems = scheduleByDay[day.dateStr] || [];
          
          return (
            <div key={day.dateStr} className={`flex-shrink-0 w-[200px] sm:w-[220px] lg:flex-1 lg:min-w-0 snap-start bg-white rounded-[1.5rem] shadow-sm border border-slate-100 overflow-hidden flex flex-col min-h-[450px] ${day.isToday ? 'ring-2 ring-brand-500 ring-offset-2' : day.isTomorrow ? 'ring-2 ring-orange-400 ring-offset-2' : ''}`}>
              <div className={`p-4 border-b border-slate-50 flex justify-between items-center ${day.isToday ? 'bg-brand-50' : day.isTomorrow ? 'bg-orange-50' : 'bg-slate-50/50'}`}>
                <div className="flex flex-col">
                  <span className={`text-[10px] font-black uppercase tracking-widest ${day.isToday ? 'text-brand-600' : day.isTomorrow ? 'text-orange-600' : 'text-slate-400'}`}>{day.dayName}</span>
                  <span className="text-base font-black text-slate-800">{day.dayNum} {day.date.toLocaleDateString([], { month: 'short' })}</span>
                </div>
                {day.isToday && <span className="px-2 py-0.5 bg-brand-600 text-white text-[8px] font-black rounded-full uppercase tracking-widest">Today</span>}
                {day.isTomorrow && <span className="px-2 py-0.5 bg-orange-500 text-white text-[8px] font-black rounded-full uppercase tracking-widest">Tomorrow</span>}
              </div>
              
              <div className="p-0 flex-1 relative">
                {dayItems.length > 0 ? (
                  <>
                    <div className="absolute left-[1.5rem] top-0 bottom-0 w-0.5 bg-slate-100" />
                    <div className="py-4 space-y-4 relative">
                      {dayItems.map((item, idx) => (
                        <div key={`${item.studentName || item.summary}-${idx}`} className="flex gap-1.5 px-1.5 group">
                          <div className="w-8 pt-1 flex flex-col items-end">
                            <span className="text-[8px] font-black text-slate-400 whitespace-nowrap">{item.startTime}</span>
                          </div>

                          <div className="relative z-10 mt-2">
                            <div className={`w-2.5 h-2.5 rounded-full border-2 transition-transform group-hover:scale-125 ${
                              item.isExternal ? 'border-indigo-500' : 'border-brand-500'
                            } ${
                              item.status === 'confirmed' || item.isExternal ? (item.isExternal ? 'bg-indigo-500' : 'bg-brand-500') : 'bg-white'
                            }`} />
                          </div>

                          <div className={`flex-1 p-2 rounded-xl border transition-all ${
                            item.isExternal ? 'bg-indigo-50/50 border-indigo-100 hover:border-indigo-300' : 
                            item.status === 'planned' ? 'bg-amber-50/30 border-amber-200 border-dashed hover:border-amber-400' :
                            'bg-slate-50 border-slate-100 hover:border-brand-200'
                          }`}>
                            <div className="flex justify-between items-start mb-0.5">
                              <span className={`font-black text-[10px] leading-tight line-clamp-2 ${
                                item.isExternal ? 'text-indigo-900' : 
                                item.status === 'planned' ? 'text-amber-800' : 'text-slate-800'
                              }`}>
                                {item.studentName || item.summary}
                                {item.status === 'planned' && <span className="ml-2 text-[8px] opacity-60 italic">(Planned)</span>}
                                {item.isPreply && <span className="ml-2 px-1.5 py-0.5 bg-indigo-100 text-indigo-600 text-[7px] font-black rounded uppercase tracking-tighter">Preply/Class</span>}
                              </span>
                              {item.isExternal && <CalendarIcon size={10} className="text-indigo-400 flex-shrink-0" />}
                            </div>
                            
                            {item.nextTask && (
                              <div className="flex items-center gap-1 mt-0.5 mb-1 px-1 py-0.5 bg-brand-50 text-brand-600 text-[8px] font-bold rounded border border-brand-100/50">
                                <Target size={8} className="shrink-0" />
                                <span className="truncate">{item.nextTask}</span>
                              </div>
                            )}

                            {item.description && (
                              <p className="text-[9px] text-indigo-600/70 font-medium line-clamp-1 mb-0.5">{item.description}</p>
                            )}

                            {!item.isExternal && (
                              <div className="flex items-center justify-between mt-1">
                                <div className="flex items-center gap-1 text-brand-600">
                                  <span className="text-[8px] font-black uppercase tracking-wider">{item.hours}h</span>
                                  {item.type && (
                                    <span className="text-[8px] font-bold text-slate-400 uppercase">({item.type})</span>
                                  )}
                                </div>
                                {(() => {
                                  const teacher = teachers.find(t => t.id === item.teacherId);
                                  const isRemi = teacher?.name.toLowerCase() === 'rémi';
                                  if (!isRemi && !item.isVerified) {
                                    return (
                                      <div className="flex items-center gap-1 text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-md border border-amber-100" title="Missing Receipt">
                                        <AlertCircle size={10} />
                                        <span className="text-[7px] font-black uppercase">Unverified</span>
                                      </div>
                                    );
                                  } else if (!isRemi && item.isVerified) {
                                    return (
                                      <div className="flex items-center gap-1 text-emerald-600" title="Verified">
                                        <CheckCircle2 size={10} />
                                      </div>
                                    );
                                  }
                                  return null;
                                })()}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center p-6 text-center">
                    <div className="w-10 h-10 bg-slate-50 rounded-full flex items-center justify-center mb-2">
                      <Clock size={16} className="text-slate-300" />
                    </div>
                    <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">No plans</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
