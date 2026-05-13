
import React, { useMemo, useState } from 'react';
import { ChevronLeft, Clock, Save, Edit3 } from 'lucide-react';
import { Student, AttendanceEntry } from '../types.ts';
import { formatCurrency } from '../utils/dateUtils.ts';

interface StudentProfileProps {
  student: Student;
  allStudents: Student[];
  onBack: () => void;
  onUpdateFields: (studentId: string, fields: Partial<Student>) => void;
  onShowBill: (student: Student) => void;
}

export const StudentProfile: React.FC<StudentProfileProps> = ({ 
  student, 
  allStudents, 
  onBack, 
  onUpdateFields,
  onShowBill
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [studentType, setStudentType] = useState(student.studentType || '');
  const [likesExpectations, setLikesExpectations] = useState(student.likesExpectations || '');
  const [dislikes, setDislikes] = useState(student.dislikes || '');
  const [pastLesson, setPastLesson] = useState(student.pastLesson || '');
  const [nextLesson, setNextLesson] = useState(student.nextLesson || '');
  const [needsHomework, setNeedsHomework] = useState(student.needsHomework || false);
  const [needsPrep, setNeedsPrep] = useState(student.needsPrep || false);
  const [needsMaterial, setNeedsMaterial] = useState(student.needsMaterial || false);
  const [isExamPrep, setIsExamPrep] = useState(student.isExamPrep || false);
  const [isPaymentPending] = useState(student.isPaymentPending || false);

  const isGrouped = !!student.groupName;

  const currentBalance = useMemo(() => {
    const groupStudents = isGrouped 
        ? allStudents.filter(s => s.groupName === student.groupName) 
        : [student];

    let totalPaid = 0;
    let totalCost = 0;

    groupStudents.forEach(s => {
        totalPaid += s.payments.reduce((sum, p) => sum + p.amount, 0);
        totalCost += (Object.values(s.attendance) as AttendanceEntry[]).filter(e => !e.deleted).reduce((sum: number, entry: AttendanceEntry) => {
            if ((entry.status === 'confirmed' || !entry.status) && !entry.studentPaid) {
                const rate = (s.rates[entry.type as keyof typeof s.rates] as number) || 0;
                return sum + (entry.hours * rate);
            }
            return sum;
        }, 0);
    });

    return totalPaid - totalCost;
  }, [student, allStudents, isGrouped]);

  const handleSave = () => {
    onUpdateFields(student.id, {
      studentType,
      likesExpectations,
      dislikes,
      pastLesson,
      nextLesson,
      needsHomework,
      needsPrep,
      needsMaterial,
      isExamPrep,
      isPaymentPending
    });
    setIsEditing(false);
  };

  return (
    <div className="flex-1 bg-slate-50 p-4 sm:p-8 overflow-y-auto">
      <div className="max-w-4xl mx-auto space-y-6">
        <button onClick={onBack} className="flex items-center gap-2 text-slate-500 hover:text-slate-800 font-medium transition-colors"><ChevronLeft size={20} /> Back to Schedule</button>
        
        <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
          {/* Header Section */}
          <div className="p-8 pb-12 border-b border-slate-50 bg-white">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                   <h1 className="text-4xl font-black text-slate-800 tracking-tight">{student.name.replace(/^[- \s.·]+/, '')}</h1>
                   {student.groupName && (
                     <span className="px-3 py-1 bg-brand-50 text-brand-600 rounded-lg text-xs font-black uppercase border border-brand-100 shadow-sm">
                       {student.groupName}
                     </span>
                   )}
                </div>
                
                <div className="flex flex-wrap gap-4 items-center">
                  <div className="flex gap-2">
                     <button 
                       onClick={() => isEditing && setNeedsHomework(!needsHomework)} 
                       className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border ${needsHomework ? 'bg-purple-500 text-white border-purple-600' : 'bg-white text-slate-400 border-slate-200'} ${!isEditing ? 'cursor-default' : 'hover:scale-105 active:scale-95'}`}
                     >
                       Homework
                     </button>
                     <button 
                       onClick={() => isEditing && setNeedsPrep(!needsPrep)} 
                       className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border ${needsPrep ? 'bg-amber-500 text-white border-amber-600' : 'bg-white text-slate-400 border-slate-200'} ${!isEditing ? 'cursor-default' : 'hover:scale-105 active:scale-95'}`}
                     >
                       Prep
                     </button>
                     <button 
                       onClick={() => isEditing && setNeedsMaterial(!needsMaterial)} 
                       className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border ${needsMaterial ? 'bg-emerald-500 text-white border-emerald-600' : 'bg-white text-slate-400 border-slate-200'} ${!isEditing ? 'cursor-default' : 'hover:scale-105 active:scale-95'}`}
                     >
                       Materials
                     </button>
                     <button 
                       onClick={() => isEditing && setIsExamPrep(!isExamPrep)} 
                       className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border ${isExamPrep ? 'bg-red-500 text-white border-red-600' : 'bg-white text-slate-400 border-slate-200'} ${!isEditing ? 'cursor-default' : 'hover:scale-105 active:scale-95'}`}
                     >
                       Exam Prep
                     </button>
                  </div>

                  {student.groupName !== 'Preply Sync' && (
                    <div className="flex items-center gap-3">
                      <div className={`text-2xl font-black ${currentBalance < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                        {formatCurrency(currentBalance)}
                      </div>
                      <button 
                        onClick={() => onShowBill(student)}
                        className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all border border-slate-200"
                      >
                        Monthly Summary
                      </button>
                    </div>
                  )}
                  
                  {student.timezone && student.timezone !== 'Asia/Bangkok' && (
                    <div className="flex items-center gap-1.5 text-slate-400 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">
                      <Clock size={12} className="text-brand-500" />
                      <span className="text-[10px] font-bold uppercase tracking-widest">{student.timezone}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3">
                {isEditing ? (
                  <button 
                    onClick={handleSave}
                    className="flex items-center gap-2 px-6 py-3 bg-emerald-500 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-100"
                  >
                    <Save size={16} /> Save Changes
                  </button>
                ) : (
                  <button 
                    onClick={() => setIsEditing(true)}
                    className="flex items-center gap-2 px-6 py-3 bg-brand-500 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-brand-600 transition-all shadow-lg shadow-brand-100"
                  >
                    <Edit3 size={16} /> Edit Info
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* New "Big White Sheet" Section - Two Columns */}
          <div className="p-8 md:p-12 bg-white relative">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-20">
              
              {/* Left Column: Information Sheet */}
              <div className="space-y-12">
                {/* Student Type */}
                <div className="space-y-4">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-3">
                    <span className="w-8 h-[2px] bg-brand-200"></span> Student Type
                  </h3>
                  {isEditing ? (
                    <input 
                      type="text"
                      value={studentType}
                      onChange={(e) => setStudentType(e.target.value)}
                      className="w-full text-2xl font-bold text-slate-800 border-b-2 border-slate-100 focus:border-brand-500 outline-none transition-all py-2 placeholder:text-slate-200"
                      placeholder="e.g. TOEFL Student, Beginner..."
                    />
                  ) : (
                     <p className={`text-2xl font-bold ${studentType ? 'text-slate-800' : 'text-slate-200 italic'}`}>
                       {studentType || 'Specify student type...'}
                     </p>
                  )}
                </div>

                {/* Likes & Expectations */}
                <div className="space-y-4">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-3">
                    <span className="w-8 h-[2px] bg-emerald-200"></span> Likes & Expectations
                  </h3>
                  {isEditing ? (
                    <textarea 
                      value={likesExpectations}
                      onChange={(e) => setLikesExpectations(e.target.value)}
                      className="w-full text-lg font-medium text-slate-700 bg-slate-50 border-2 border-slate-50 rounded-2xl p-6 focus:bg-white focus:border-brand-500 outline-none transition-all min-h-[160px] leading-relaxed"
                      placeholder="What do they like? What are their goals?"
                    />
                  ) : (
                    <div className="bg-slate-50/50 rounded-3xl p-8 border border-slate-100 min-h-[100px]">
                      <p className={`text-lg font-medium leading-relaxed whitespace-pre-line ${likesExpectations ? 'text-slate-700' : 'text-slate-200 italic'}`}>
                        {likesExpectations || 'No expectations recorded.'}
                      </p>
                    </div>
                  )}
                </div>

                {/* Dislikes */}
                <div className="space-y-4">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-3">
                    <span className="w-8 h-[2px] bg-red-200"></span> Dislikes
                  </h3>
                  {isEditing ? (
                    <textarea 
                      value={dislikes}
                      onChange={(e) => setDislikes(e.target.value)}
                      className="w-full text-lg font-medium text-slate-700 bg-slate-50 border-2 border-slate-50 rounded-2xl p-6 focus:bg-white focus:border-brand-500 outline-none transition-all min-h-[160px] leading-relaxed"
                      placeholder="What should be avoided?"
                    />
                  ) : (
                    <div className="bg-slate-50/50 rounded-3xl p-8 border border-slate-100 min-h-[100px]">
                      <p className={`text-lg font-medium leading-relaxed whitespace-pre-line ${dislikes ? 'text-slate-700' : 'text-slate-200 italic'}`}>
                        {dislikes || 'No dislikes recorded.'}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Lesson Notes */}
              <div className="space-y-12">
                {/* Past Lesson: What we did */}
                <div className="space-y-4">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-3">
                    <span className="w-8 h-[2px] bg-slate-200"></span> Past lesson: what we did
                  </h3>
                  {isEditing ? (
                    <textarea 
                      value={pastLesson}
                      onChange={(e) => setPastLesson(e.target.value)}
                      className="w-full text-lg font-medium text-slate-700 bg-slate-50 border-2 border-slate-50 rounded-2xl p-6 focus:bg-white focus:border-brand-500 outline-none transition-all min-h-[220px] leading-relaxed"
                      placeholder="Summary of previous session..."
                    />
                  ) : (
                    <div className="bg-slate-50/50 rounded-3xl p-8 border border-slate-100 min-h-[150px]">
                      <p className={`text-lg font-medium leading-relaxed whitespace-pre-line ${pastLesson ? 'text-slate-700' : 'text-slate-200 italic'}`}>
                        {pastLesson || 'No past lesson notes.'}
                      </p>
                    </div>
                  )}
                </div>

                {/* Last lesson: what to do (Next Planning) */}
                <div className="space-y-4">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-3">
                    <span className="w-8 h-[2px] bg-brand-200"></span> Next lesson: what to do
                  </h3>
                  {isEditing ? (
                    <textarea 
                      value={nextLesson}
                      onChange={(e) => setNextLesson(e.target.value)}
                      className="w-full text-lg font-medium text-slate-700 bg-slate-50 border-2 border-slate-50 rounded-2xl p-6 focus:bg-white focus:border-brand-500 outline-none transition-all min-h-[220px] leading-relaxed font-black"
                      placeholder="Plan for the next lesson..."
                    />
                  ) : (
                    <div className="bg-brand-50/30 rounded-3xl p-8 border border-brand-100 min-h-[150px]">
                      <p className={`text-lg font-black leading-relaxed whitespace-pre-line ${nextLesson ? 'text-brand-900 shadow-brand-50' : 'text-slate-200 italic font-medium'}`}>
                        {nextLesson || 'No planning set for next time.'}
                      </p>
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
