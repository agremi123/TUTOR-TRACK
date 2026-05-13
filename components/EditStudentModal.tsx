
import React, { useState } from 'react';
import { X, GraduationCap, Wifi, Building2, Users, BookMarked, Clock } from 'lucide-react';
import { Student, Teacher } from '../types.ts';
import { AVAILABLE_BOOKS, TIMEZONES } from '../constants.ts';

interface EditStudentModalProps {
  student: Student;
  teachers: Teacher[];
  existingGroups: string[];
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedStudent: Student) => void;
  onDelete: (studentId: string) => void;
}

import { Modal } from './ui/Modal.tsx';

export const EditStudentModal: React.FC<EditStudentModalProps> = ({
  student,
  teachers,
  existingGroups,
  isOpen,
  onClose,
  onSave,
  onDelete
}) => {
  const [name, setName] = useState(student.name);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [teacherId, setTeacherId] = useState(student.teacherId);
  const [groupName, setGroupName] = useState(student.groupName || '');
  const [notes, setNotes] = useState(student.notes || '');
  const [selectedBooks, setSelectedBooks] = useState<string[]>(student.books || []);
  const [timezone, setTimezone] = useState(student.timezone || 'Asia/Bangkok');
  const [email, setEmail] = useState(student.email || '');
  const [alertText, setAlertText] = useState(student.alertText || '');
  const [nextTask, setNextTask] = useState(student.nextTask || '');
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
  const [isSaving, setIsSaving] = useState(false);
  
  const [rateOnline, setRateOnline] = useState(student.rates.online?.toString() || '');
  const [rateOnsite, setRateOnsite] = useState(student.rates.onsite?.toString() || '');
  const [rateHome, setRateHome] = useState(student.rates.home?.toString() || '');
  
  const [twOnline, setTwOnline] = useState(student.teacherRates.online?.toString() || '');
  const [twOnsite, setTwOnsite] = useState(student.teacherRates.onsite?.toString() || '');
  const [twHome, setTwHome] = useState(student.teacherRates.home?.toString() || '');

  const [enableOnline, setEnableOnline] = useState(student.rates.online !== null);
  const [enableOnsite, setEnableOnsite] = useState(student.rates.onsite !== null);
  const [enableHome, setEnableHome] = useState(student.rates.home !== null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    
    setIsSaving(true);
    try {
      if (!name.trim()) {
        alert('Name is required');
        setIsSaving(false);
        return;
      }
      const safeParse = (val: string) => {
        const p = parseFloat(val);
        return isNaN(p) ? 0 : p;
      };

      const updatedData: Student = {
        ...student,
        name: name.trim(),
        teacherId,
        groupName: groupName.trim() || '',
        notes: notes.trim() || '',
        studentType: studentType.trim() || '',
        likesExpectations: likesExpectations.trim() || '',
        dislikes: dislikes.trim() || '',
        pastLesson: pastLesson.trim() || '',
        nextLesson: nextLesson.trim() || '',
        needsHomework,
        needsPrep,
        needsMaterial,
        isExamPrep,
        isPaymentPending,
        books: selectedBooks || [],
        timezone: timezone || 'Asia/Bangkok',
        email: email.trim() || '',
        alertText: alertText.trim() || '',
        nextTask: nextTask.trim() || '',
        rates: {
          online: enableOnline ? safeParse(rateOnline) : null,
          onsite: enableOnsite ? safeParse(rateOnsite) : null,
          home: enableHome ? safeParse(rateHome) : null
        },
        teacherRates: {
          online: safeParse(twOnline),
          onsite: safeParse(twOnsite),
          home: safeParse(twHome)
        }
      };

      // Ensure no undefined values are sent
      (Object.keys(updatedData) as (keyof typeof updatedData)[]).forEach(key => {
        if (updatedData[key] === undefined) {
          delete updatedData[key];
        }
      });

      console.log('[Firestore] Updating student payload (Modal):', JSON.stringify(updatedData, null, 2));
      await onSave(updatedData);
    } catch (err) {
      console.error("Error in EditStudentModal handleSubmit:", err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="max-w-md">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-slate-800">Edit Student</h2>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors">
              <X size={24} />
            </button>
          </div>
          
          <form onSubmit={handleSubmit} noValidate className="space-y-5 max-h-[70vh] overflow-y-auto px-1 custom-scrollbar">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Student Identity</label>
              <input 
                type="text" 
                required 
                value={name} 
                onChange={e => setName(e.target.value)} 
                className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none font-medium" 
                placeholder="Full Student Name" 
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-1">
                  <GraduationCap size={14}/> Primary Teacher
                </label>
                <select 
                  value={teacherId} 
                  onChange={e => setTeacherId(e.target.value)} 
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none font-medium bg-slate-50"
                >
                  {teachers.map(t => (
                    <option key={t.id} value={t.id}>{t.name} {t.id === 'default-teacher' ? '(Me)' : ''}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-4">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest text-center">Pricing & Teacher Wages (THB)</label>
              <div className="grid grid-cols-1 gap-2">
                {/* Online */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="flex items-center gap-2 mb-2">
                    <input type="checkbox" checked={enableOnline} onChange={e => setEnableOnline(e.target.checked)} />
                    <Wifi size={14}/>
                    <span className="text-[10px] font-bold">ONLINE</span>
                  </div>
                  <div className={`grid grid-cols-2 gap-2 ${!enableOnline && 'opacity-50'}`}>
                    <div>
                      <span className="text-[9px] text-slate-400 font-bold block ml-1 uppercase">Student Pays</span>
                      <input 
                        type="number" 
                        disabled={!enableOnline} 
                        value={rateOnline} 
                        onChange={e => setRateOnline(e.target.value)} 
                        className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded-lg outline-none" 
                        placeholder="0" 
                      />
                    </div>
                    {teacherId !== 'default-teacher' && (
                      <div>
                        <span className="text-[9px] text-emerald-500 font-bold block ml-1 uppercase">Teacher Wage</span>
                        <input 
                          type="number" 
                          disabled={!enableOnline} 
                          value={twOnline} 
                          onChange={e => setTwOnline(e.target.value)} 
                          className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded-lg text-emerald-600 outline-none" 
                          placeholder="0" 
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Onsite */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="flex items-center gap-2 mb-2">
                    <input type="checkbox" checked={enableOnsite} onChange={e => setEnableOnsite(e.target.checked)} />
                    <Building2 size={14}/>
                    <span className="text-[10px] font-bold">FACE-TO-FACE</span>
                  </div>
                  <div className={`grid grid-cols-2 gap-2 ${!enableOnsite && 'opacity-50'}`}>
                    <div>
                      <span className="text-[9px] text-slate-400 font-bold block ml-1 uppercase">Student Pays</span>
                      <input 
                        type="number" 
                        disabled={!enableOnsite} 
                        value={rateOnsite} 
                        onChange={e => setRateOnsite(e.target.value)} 
                        className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded-lg outline-none" 
                        placeholder="0" 
                      />
                    </div>
                    {teacherId !== 'default-teacher' && (
                      <div>
                        <span className="text-[9px] text-emerald-500 font-bold block ml-1 uppercase">Teacher Wage</span>
                        <input 
                          type="number" 
                          disabled={!enableOnsite} 
                          value={twOnsite} 
                          onChange={e => setTwOnsite(e.target.value)} 
                          className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded-lg text-emerald-600 outline-none" 
                          placeholder="0" 
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Home */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="flex items-center gap-2 mb-2">
                    <input type="checkbox" checked={enableHome} onChange={e => setEnableHome(e.target.checked)} />
                    <span className="text-[10px] font-bold">HOME</span>
                  </div>
                  <div className={`grid grid-cols-2 gap-2 ${!enableHome && 'opacity-50'}`}>
                    <div>
                      <span className="text-[9px] text-slate-400 font-bold block ml-1 uppercase">Student Pays</span>
                      <input 
                        type="number" 
                        disabled={!enableHome} 
                        value={rateHome} 
                        onChange={e => setRateHome(e.target.value)} 
                        className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded-lg outline-none" 
                        placeholder="0" 
                      />
                    </div>
                    {teacherId !== 'default-teacher' && (
                      <div>
                        <span className="text-[9px] text-emerald-500 font-bold block ml-1 uppercase">Teacher Wage</span>
                        <input 
                          type="number" 
                          disabled={!enableHome} 
                          value={twHome} 
                          onChange={e => setTwHome(e.target.value)} 
                          className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded-lg text-emerald-600 outline-none" 
                          placeholder="0" 
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-1">
                <Users size={14}/> Wallet Group
              </label>
              <input 
                type="text" 
                list="edit-group-list" 
                value={groupName} 
                onChange={e => setGroupName(e.target.value)} 
                className="w-full px-4 py-2.5 border border-slate-300 rounded-xl outline-none font-medium" 
                placeholder="Optional" 
              />
              <datalist id="edit-group-list">
                {existingGroups.map(g => (<option key={g} value={g} />))}
              </datalist>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-2">
                <BookMarked size={14} className="text-brand-500" /> Resources / Exams / Books
              </label>
              <div className="grid grid-cols-1 gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
                {/* Existing predefined books */}
                {AVAILABLE_BOOKS.map(book => (
                  <label key={book} className="flex items-center gap-3 p-1 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer group">
                    <input 
                      type="checkbox" 
                      checked={selectedBooks.includes(book)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedBooks(prev => [...prev, book]);
                        } else {
                          setSelectedBooks(prev => prev.filter(b => b !== book));
                        }
                      }}
                      className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                    />
                    <span className="text-xs font-bold text-slate-700 group-hover:text-brand-700">{book}</span>
                  </label>
                ))}
                
                {/* Custom materials already added to this student but not in AVAILABLE_BOOKS */}
                {selectedBooks.filter(b => !AVAILABLE_BOOKS.includes(b)).map(book => (
                  <label key={book} className="flex items-center gap-3 p-1 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer group">
                    <input 
                      type="checkbox" 
                      checked={true}
                      onChange={() => setSelectedBooks(prev => prev.filter(b => b !== book))}
                      className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                    />
                    <span className="text-xs font-bold text-brand-600">{book}</span>
                  </label>
                ))}

                {/* Add Custom Material Input */}
                <div className="mt-2 pt-2 border-t border-slate-200">
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      placeholder="Add other material..." 
                      className="flex-1 px-2 py-1.5 text-[10px] font-bold border border-slate-300 rounded-lg outline-none focus:ring-1 focus:ring-brand-500"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const val = e.currentTarget.value.trim();
                          if (val && !selectedBooks.includes(val)) {
                            setSelectedBooks(prev => [...prev, val]);
                            e.currentTarget.value = '';
                          }
                        }
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-1"><Clock size={14}/> Student Timezone</label>
              <select 
                value={timezone} 
                onChange={e => setTimezone(e.target.value)} 
                className="w-full px-4 py-2.5 border border-slate-300 rounded-xl outline-none font-medium bg-slate-50"
              >
                {TIMEZONES.map(tz => (
                  <option key={tz.value} value={tz.value}>{tz.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-1">Student Email</label>
              <input 
                type="email" 
                value={email} 
                onChange={e => setEmail(e.target.value)} 
                className="w-full px-4 py-2.5 border border-slate-300 rounded-xl outline-none font-medium" 
                placeholder="student@example.com (for calendar sync)" 
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-red-500 uppercase mb-2 flex items-center gap-1 animate-pulse">ALERT / CRUCIAL INFO (FLASHING)</label>
              <input 
                type="text" 
                value={alertText} 
                onChange={e => setAlertText(e.target.value)} 
                className="w-full px-4 py-2.5 border-2 border-red-100 rounded-xl outline-none font-bold text-red-600 bg-red-50/30" 
                placeholder="e.g. Needs homework check, unpaid invoice..." 
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-brand-600 uppercase mb-2 flex items-center gap-1">STUDENT NEXT GOAL / HOMEWORK</label>
              <input 
                type="text" 
                value={nextTask} 
                onChange={e => setNextTask(e.target.value)} 
                className="w-full px-4 py-2.5 border-2 border-brand-100 rounded-xl outline-none font-bold text-brand-700 bg-brand-50/30" 
                placeholder="e.g. Finish unit 5, prepare for exam..." 
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Priority Status & Actions</label>
              <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <label className="flex items-center gap-3 p-1 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer group">
                  <input type="checkbox" checked={needsHomework} onChange={e => setNeedsHomework(e.target.checked)} className="w-4 h-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500" />
                  <span className="text-[10px] font-black uppercase text-slate-700">Needs Homework</span>
                </label>
                <label className="flex items-center gap-3 p-1 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer group">
                  <input type="checkbox" checked={needsPrep} onChange={e => setNeedsPrep(e.target.checked)} className="w-4 h-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500" />
                  <span className="text-[10px] font-black uppercase text-slate-700">Needs Prep</span>
                </label>
                <label className="flex items-center gap-3 p-1 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer group">
                  <input type="checkbox" checked={needsMaterial} onChange={e => setNeedsMaterial(e.target.checked)} className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
                  <span className="text-[10px] font-black uppercase text-slate-700">Needs Material</span>
                </label>
                <label className="flex items-center gap-3 p-1 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer group">
                  <input type="checkbox" checked={isExamPrep} onChange={e => setIsExamPrep(e.target.checked)} className="w-4 h-4 rounded border-slate-300 text-red-600 focus:ring-red-500" />
                  <span className="text-[10px] font-black uppercase text-slate-700">Exam Prep</span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Student Type</label>
              <input 
                type="text" 
                value={studentType} 
                onChange={e => setStudentType(e.target.value)} 
                className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none font-medium" 
                placeholder="e.g. TOEFL, Beginner..." 
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Likes & Expectations</label>
              <textarea 
                value={likesExpectations} 
                onChange={e => setLikesExpectations(e.target.value)} 
                className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none font-medium min-h-[80px] resize-none" 
                placeholder="What they enjoy and what they expect..."
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Dislikes</label>
              <textarea 
                value={dislikes} 
                onChange={e => setDislikes(e.target.value)} 
                className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none font-medium min-h-[80px] resize-none" 
                placeholder="What they don't like..."
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Past lesson: what we did</label>
              <textarea 
                value={pastLesson} 
                onChange={e => setPastLesson(e.target.value)} 
                className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none font-medium min-h-[80px] resize-none" 
                placeholder="What was done in the previous session..."
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Next lesson: what to do</label>
              <textarea 
                value={nextLesson} 
                onChange={e => setNextLesson(e.target.value)} 
                className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none font-medium min-h-[80px] resize-none" 
                placeholder="Plan for the next lesson..."
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Internal History / Private Notes</label>
              <textarea 
                value={notes} 
                onChange={e => setNotes(e.target.value)} 
                className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none font-medium min-h-[80px] resize-none" 
                placeholder="Private notes (replaces previous details section)..."
              />
            </div>

            <div className="flex gap-4 pt-4">
              {!showDeleteConfirm ? (
                <button 
                  type="button" 
                  onClick={() => setShowDeleteConfirm(true)} 
                  className="px-4 py-3 text-red-500 font-bold uppercase text-xs hover:bg-red-50 rounded-xl transition-colors"
                >
                  Delete
                </button>
              ) : (
                <div className="flex-1 flex items-center gap-2 bg-red-50 p-2 rounded-xl border border-red-100 animate-in slide-in-from-bottom-2">
                  <span className="text-[10px] font-bold text-red-600 uppercase ml-2">Are you sure?</span>
                  <button type="button" onClick={() => onDelete(student.id)} className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-[10px] font-black uppercase">Yes, Delete</button>
                  <button type="button" onClick={() => setShowDeleteConfirm(false)} className="px-3 py-1.5 bg-white text-slate-400 rounded-lg text-[10px] font-black uppercase border border-slate-200">No</button>
                </div>
              )}
              {!showDeleteConfirm && (
                <>
                  <button 
                    type="button" 
                    onClick={onClose} 
                    disabled={isSaving}
                    className="flex-1 px-4 py-3 text-slate-400 font-bold uppercase text-xs disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    disabled={isSaving || !name.trim()}
                    className="flex-1 px-4 py-3 bg-slate-900 text-white rounded-xl font-bold shadow-lg hover:bg-slate-800 transition-all disabled:bg-slate-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isSaving ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Saving...
                      </>
                    ) : 'Save Changes'}
                  </button>
                </>
              )}
            </div>
          </form>
        </div>
    </Modal>
  );
};
