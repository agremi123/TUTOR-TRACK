
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Plus, Users, LayoutGrid, Sparkles, Wifi, Building2, Download, Upload, CheckCircle, XCircle, GraduationCap, UserPlus, Settings, Trash2, User, Briefcase, X, ChevronDown, Eye, Search, BarChart3, RefreshCw, Clock, AlertCircle, Calendar as CalendarIcon } from 'lucide-react';
import { Student, AttendanceEntry, Teacher, ExternalEvent, GoogleCalendar, Task } from './types.ts';
import { getDaysInMonth, getMonthName, formatCurrency, getThailandNow, getThailandTodayStr, getThailandDateStr, normalizeStudentName } from './utils/dateUtils.ts';
import { StudentRow } from './components/StudentRow.tsx';
import { PaymentModal } from './components/PaymentModal.tsx';
import { EditStudentModal } from './components/EditStudentModal.tsx';
import { StudentProfile } from './components/StudentProfile.tsx';
import { DailySchedule } from './components/DailySchedule.tsx';
import { auth, db, collection, doc, setDoc, onSnapshot, deleteDoc, writeBatch, loginWithGoogle, logout } from './firebase.ts';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { AIChat } from './components/AIChat.tsx';
import { ReceiptUpload } from './components/ReceiptUpload.tsx';
import { MonthlyBillModal } from './components/MonthlyBillModal.tsx';
import { WorkspaceView } from './components/WorkspaceView.tsx';
import { StudentRoster } from './components/StudentRoster.tsx';
import { AVAILABLE_BOOKS, TIMEZONES } from './constants.ts';
import { Modal } from './components/ui/Modal.tsx';



enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

const cleanFirestorePayload = (obj: unknown): unknown => {
  if (obj === null) return null;
  if (obj === undefined) return "";
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(item => cleanFirestorePayload(item));

  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (value === undefined) {
      console.warn(`[Firestore Cleanup] Converting undefined field to empty string: ${key}`);
      cleaned[key] = "";
    } else if (typeof value === 'object') {
      cleaned[key] = cleanFirestorePayload(value);
    } else {
      cleaned[key] = value;
    }
  }
  return cleaned;
};

export const App: React.FC = () => {
  // State
  const [students, setStudents] = useState<Student[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [isVisibilityModalOpen, setIsVisibilityModalOpen] = useState(false);
  const [visibilitySearch, setVisibilitySearch] = useState('');
  const [quotaExceeded, setQuotaExceeded] = useState(false);
  const [tasksToday, setTasksToday] = useState<Task[]>([]);
  
  // Initialize with Thailand Time
  const [currentDate, setCurrentDate] = useState(() => getThailandNow());
  const [highlightedDateStr, setHighlightedDateStr] = useState<string>(getThailandTodayStr());
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isManageTeachersOpen, setIsManageTeachersOpen] = useState(false);
  const [isAddTeacherModalOpen, setIsAddTeacherModalOpen] = useState(false);
  
  const [selectedStudentForPayment, setSelectedStudentForPayment] = useState<Student | null>(null);
  const [studentToEdit, setStudentToEdit] = useState<Student | null>(null);
  const [teacherToDelete, setTeacherToDelete] = useState<string | null>(null);
  const [viewingStudentProfile, setViewingStudentProfile] = useState<Student | null>(null);
  const [studentForBill, setStudentForBill] = useState<Student | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const initialLoadDone = useRef(false);
  const isSettingUpCalendarRef = useRef(false);
  const migrationDone = useRef(false);
  const studentsRef = useRef<Student[]>(students);

  useEffect(() => {
    studentsRef.current = students;
  }, [students]);
  
  const isDragging = useRef(false);
  const startX = useRef(0);
  const scrollLeft = useRef(0);
  const [isCursorGrabbing, setIsCursorGrabbing] = useState(false);

  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  
  const showToast = useCallback((msg: string, type: 'success' | 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);
  
  // New Student Form State
  const [newStudentName, setNewStudentName] = useState('');
  const [newTeacherName, setNewTeacherName] = useState('');
  
  // Student Rates & Teacher Wages
  const [rateOnline, setRateOnline] = useState('');
  const [rateOnsite, setRateOnsite] = useState('');
  const [rateHome, setRateHome] = useState('');
  const [twOnline, setTwOnline] = useState('');
  const [twOnsite, setTwOnsite] = useState('');
  const [twHome, setTwHome] = useState('');
  
  const [enableOnline, setEnableOnline] = useState(true);
  const [enableOnsite, setEnableOnsite] = useState(true);
  const [enableHome] = useState(true);

  const [newStudentCredit, setNewStudentCredit] = useState('');
  const [newStudentGroupName, setNewStudentGroupName] = useState('');
  const [newStudentNotes, setNewStudentNotes] = useState('');
  const [newStudentBooks, setNewStudentBooks] = useState<string[]>([]);
  const [selectedInitialTeacherId, setSelectedInitialTeacherId] = useState('default-teacher');
  const [newStudentTimezone, setNewStudentTimezone] = useState('Asia/Bangkok');
  const [newStudentEmail, setNewStudentEmail] = useState('');
  const [newStudentAlertText, setNewStudentAlertText] = useState('');

  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isAIChatOpen, setIsAIChatOpen] = useState(false);
  const [activeMainTab, setActiveMainTab] = useState<'roster' | 'calendar' | 'workspace'>('roster');

  const handleFirestoreError = useCallback((error: unknown, operationType: OperationType, path: string | null) => {
    const err = error as { code?: string; message?: string };
    const errCode = err?.code || '';
    if (errCode === 'resource-exhausted') {
      setQuotaExceeded(true);
    }
    const errInfo = {
      error: error instanceof Error ? error.message : String(error),
      code: errCode,
      authInfo: {
        userId: auth.currentUser?.uid,
        email: auth.currentUser?.email,
      },
      operationType,
      path
    };
    console.error('Firestore Error: ', JSON.stringify(errInfo));
    // Don't re-throw for quota errors, just flag it
    if (errCode !== 'resource-exhausted') {
       showToast(`Data operation failed: ${errInfo.error}`, 'error');
    }
  }, [showToast, setQuotaExceeded]);

  // CRITICAL CONSTRAINT: Test connection on boot
  useEffect(() => {
     const testConnection = async () => {
       try {
         const { getDocFromServer } = await import('firebase/firestore');
         await getDocFromServer(doc(db, 'test', 'connection'));
       } catch (error: unknown) {
         const err = error as { code?: string };
         if (err?.code === 'resource-exhausted') setQuotaExceeded(true);
       }
     };
     testConnection();
  }, [setQuotaExceeded]);
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  // Google Calendar States
  const [isGoogleAuthenticated, setIsGoogleAuthenticated] = useState(false);
  const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(localStorage.getItem('google_access_token'));
  const [tutorTrackCalendarId, setTutorTrackCalendarId] = useState<string | null>(null);
  const [pinnedNote, setPinnedNote] = useState <string>('');
  const [pinnedNoteUpdatedAt, setPinnedNoteUpdatedAt] = useState<string | null>(null);
  const [preplyNote, setPreplyNote] = useState<string>('');
  const [preplyNoteUpdatedAt, setPreplyNoteUpdatedAt] = useState<string | null>(null);
  const isSyncingRef = useRef(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [eventIdToDelete, setEventIdToDelete] = useState('');
  const [externalEvents, setExternalEvents] = useState<ExternalEvent[]>([]);

  // Stable sync guard helper
  const setSyncingStatus = useCallback((status: boolean) => {
    isSyncingRef.current = status;
    setIsSyncing(status);
  }, []);

  // Migration & Initial Data Load
  useEffect(() => {
    if (!user || migrationDone.current) return;

    const migrateData = async () => {
      const saved = localStorage.getItem('tutortrack_data_v3');
      if (saved) {
        console.log('[Migration] Found local data, starting migration...');
        try {
          const parsed = JSON.parse(saved);
          let loadedStudents: Student[] = [];
          let loadedTeachers: Teacher[] = [];

          if (Array.isArray(parsed)) {
            loadedStudents = parsed;
            loadedTeachers = [{ id: 'default-teacher', name: 'Rémi', color: '#6366f1' }];
          } else if (parsed.teachers && parsed.students) {
            loadedStudents = parsed.students;
            loadedTeachers = parsed.teachers;
          }

          if (loadedStudents.length > 0 || loadedTeachers.length > 0) {
            const batch = writeBatch(db);
            for (const t of loadedTeachers) {
              batch.set(doc(db, 'users', user.uid, 'teachers', t.id), cleanFirestorePayload(t), { merge: true });
            }
            for (const s of loadedStudents) {
              batch.set(doc(db, 'users', user.uid, 'students', s.id), cleanFirestorePayload(s), { merge: true });
            }
            await batch.commit();
            console.log('[Migration] Migration successful.');
            localStorage.removeItem('tutortrack_data_v3');
          }
        } catch (error) {
          console.error('[Migration] Failed to migrate data:', error);
        }
      }
      migrationDone.current = true;
    };

    migrateData();
  }, [user]);

  const handleSessionExpired = useCallback(() => {
    if (isGoogleAuthenticated) {
      setIsGoogleAuthenticated(false);
      setGoogleAccessToken(null);
      localStorage.removeItem('google_access_token');
      showToast('Google session expired. Please reconnect.', 'error');
    }
  }, [isGoogleAuthenticated, showToast]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      console.log('[Auth] Firebase user state changed:', u?.email);
      setUser(u);
      setIsAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Firestore Sync: Students
  useEffect(() => {
    if (!user) {
      setStudents([]);
      return;
    }

    const q = collection(db, 'users', user.uid, 'students');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const studentData: Student[] = [];
      snapshot.forEach((doc) => {
        studentData.push({ id: doc.id, ...doc.data() } as Student);
      });
      setStudents(studentData);
      console.log(`[Firestore] Students synced: ${studentData.length} records`);
      initialLoadDone.current = true;
      setQuotaExceeded(prev => prev ? false : prev);
    }, (error) => {
      if (error.code === 'resource-exhausted') {
        setQuotaExceeded(prev => {
          if (!prev) console.warn("Firestore Students: Quota exceeded. Sync paused.");
          return true;
        });
      } else {
        console.error("Firestore Students Error:", error);
      }
    });

    return () => unsubscribe();
  }, [user, setQuotaExceeded]);
    // Legacy Cleanup: Move preply-teacher to default-teacher and deduplicate
    useEffect(() => {
        if (!user || students.length === 0 || initialLoadDone.current === false) return;
        
        const cleanup = async () => {
            const batch = writeBatch(db);
            let hasChanges = false;
            const normalizedMap: Record<string, Student> = {};
            const studentsToDelete: string[] = [];

            // Pre-pass: Identify and mark invalid students for deletion
            students.forEach(s => {
                const norm = normalizeStudentName(s.name);
                if (!norm || norm.length < 2 || ['unknown', 'unknown student', 'test'].includes(norm.toLowerCase())) {
                    console.log(`[Cleanup] Identifying student for deletion (invalid name): "${s.name}" (${s.id})`);
                    studentsToDelete.push(s.id);
                    hasChanges = true;
                }
            });

            // First pass: Build a map of "winners"
            students.forEach(s => {
                if (studentsToDelete.includes(s.id)) return;
                const norm = normalizeStudentName(s.name);
                if (!norm) return;

                const existing = normalizedMap[norm];

                if (existing) {
                    // We found a duplicate! MERGE s into existing.
                    console.log(`[Cleanup] Merging duplicate: "${s.name}" (${s.id}) -> "${existing.name}" (${existing.id})`);
                    
                    // Merge fields
                    const mergedAttendance = { ...existing.attendance, ...s.attendance };
                    const mergedPayments = [...existing.payments];
                    s.payments.forEach(p => {
                        if (!mergedPayments.some(mp => mp.id === p.id || (mp.date === p.date && mp.amount === p.amount))) {
                            mergedPayments.push(p);
                        }
                    });

                    // Decide who to actually keep (prefer local IDs over google IDs)
                    const keepExisting = !existing.id.startsWith('google-') || (s.id.startsWith('google-') && Object.keys(existing.attendance).length >= Object.keys(s.attendance).length);
                    
                    const loserId = keepExisting ? s.id : existing.id;
                    const winnerStudent = keepExisting ? existing : s;

                    normalizedMap[norm] = {
                        ...winnerStudent,
                        attendance: mergedAttendance,
                        payments: mergedPayments,
                        groupName: existing.groupName || s.groupName, // Preserve group info
                        updatedAt: new Date().toISOString()
                    } as Student;

                    studentsToDelete.push(loserId);
                    hasChanges = true;
                } else {
                    normalizedMap[norm] = s;
                }
            });

            // Second pass: Apply deletions and updates
            if (hasChanges) {
                // To avoid quota burn, we only apply deletions if they aren't already marked
                for (const loserId of studentsToDelete) {
                    batch.delete(doc(db, 'users', user.uid, 'students', loserId));
                }
                // Update winners
                Object.values(normalizedMap).forEach(winner => {
                  // Only update if it actually was a merge winner (has changes)
                  if (winner.updatedAt && new Date(winner.updatedAt).getTime() > Date.now() - 10000) {
                    batch.set(doc(db, 'users', user.uid, 'students', winner.id), cleanFirestorePayload(winner));
                  }
                });

                try {
                    await batch.commit();
                    showToast(`Cleaned up and merged student records`, 'success');
                } catch (e) {
                    console.error('[Cleanup] Commit failed (possibly quota):', e);
                    setQuotaExceeded(true);
                }
            }
        };

        const lastCleanup = localStorage.getItem('last_cleanup_v8');
        if (lastCleanup !== 'done' && students.length > 0) {
            localStorage.setItem('last_cleanup_v8', 'done');
            cleanup();
        }
    }, [user, students, initialLoadDone, showToast, setQuotaExceeded]);


  // Firestore Sync: Teachers
  useEffect(() => {
    if (!user) {
      setTeachers([]);
      return;
    }

    const q = collection(db, 'users', user.uid, 'teachers');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const teacherData: Teacher[] = [];
      snapshot.forEach((doc) => {
        teacherData.push({ id: doc.id, ...doc.data() } as Teacher);
      });
      
      const defaultTeacherId = 'default-teacher';

      // Only check locally. Initialization will be handled by a separate one-time check or migration.
      // To prevent flicker, we ensure they are in the list if not found yet, but we don't setDoc here.
      if (!teacherData.find(t => t.id === defaultTeacherId)) {
        teacherData.push({ id: defaultTeacherId, name: 'Rémi', color: '#6366f1' });
      }
      
      setTeachers(teacherData);
      setQuotaExceeded(prev => prev ? false : prev);
    }, (error) => {
      if (error.code === 'resource-exhausted') {
        setQuotaExceeded(prev => {
          if (!prev) console.warn("Firestore Teachers: Quota exceeded. Sync paused.");
          return true;
        });
      } else {
        console.error("Firestore Teachers Error:", error);
      }
    });

    return () => unsubscribe();
  }, [user, setQuotaExceeded]);

  // Firestore Sync: Settings
  useEffect(() => {
    if (!user) return;

    const docRef = doc(db, 'users', user.uid, 'settings', 'main');
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setTutorTrackCalendarId(data.tutorTrackCalendarId || null);
        setPinnedNote(data.pinnedNote || '');
        setPinnedNoteUpdatedAt(data.pinnedNoteUpdatedAt || null);
        setPreplyNote(data.preplyNote || '');
        setPreplyNoteUpdatedAt(data.preplyNoteUpdatedAt || null);
        setTasksToday(data.tasksToday || []);
      }
      setQuotaExceeded(prev => prev ? false : prev);
    }, (error) => {
      if (error.code === 'resource-exhausted') {
        setQuotaExceeded(prev => {
          if (!prev) console.warn("Firestore Settings: Quota exceeded. Sync paused.");
          return true;
        });
      } else {
        console.error("Firestore Settings Error:", error);
      }
    });

    return () => unsubscribe();
  }, [user, setQuotaExceeded]);

  const updatePinnedNote = async (value: string) => {
    if (!user) return;
    const updatedAt = new Date().toISOString();
    try {
      await setDoc(doc(db, 'users', user.uid, 'settings', 'main'), {
        pinnedNote: value,
        pinnedNoteUpdatedAt: updatedAt
      }, { merge: true });
      setPinnedNote(value);
      setPinnedNoteUpdatedAt(updatedAt);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'settings/pinnedNote');
    }
  };

  const updatePreplyNote = async (value: string) => {
    if (!user) return;
    const updatedAt = new Date().toISOString();
    try {
      await setDoc(doc(db, 'users', user.uid, 'settings', 'main'), {
        preplyNote: value,
        preplyNoteUpdatedAt: updatedAt
      }, { merge: true });
      setPreplyNote(value);
      setPreplyNoteUpdatedAt(updatedAt);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'settings/preplyNote');
    }
  };

  const lastSyncTimeRef = useRef<number>(0);
  const findExistingStudentByName = useCallback((name: string, list?: Student[]) => {
    if (!name) return null;
    const norm = normalizeStudentName(name);
    if (!norm) return null;
    const searchIn = list || studentsRef.current;
    
    // 1. Exact match after normalization
    const exactMatch = searchIn.find(s => normalizeStudentName(s.name) === norm);
    if (exactMatch) return exactMatch;

    // 2. Partial match for "similar" names as requested
    // If we have "Melissa" and "Melissa R", they should match
    if (norm.length >= 2) {
      return searchIn.find(s => {
        const sNorm = normalizeStudentName(s.name);
        if (!sNorm) return false;
        return sNorm.includes(norm) || norm.includes(sNorm);
      });
    }
    
    return null;
  }, []); // Remove dependency on students state, use ref instead

  const handleLogin = async () => {
    if (isLoggingIn) return;
    setIsLoggingIn(true);
    try {
      await loginWithGoogle();
      showToast('Logged in successfully', 'success');
    } catch (error: unknown) {
      const err = error as Error;
      // Filter out the common "popup closed by user" error to avoid annoying toasts
      if (!err.message.includes('popup-closed-by-user')) {
        showToast(`Login failed: ${err.message}`, 'error');
      }
      console.error('[Auth] Login error:', err);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleManualCleanup = useCallback(async () => {
    if (!user || students.length === 0 || quotaExceeded) {
       if (quotaExceeded) showToast('Quota exceeded.', 'error');
       return;
    }
    
    setSyncingStatus(true);
    showToast('Starting student cleanup and merge...', 'success');
    
    try {
      const batch = writeBatch(db);
      let mergeCount = 0;
      const normalizedMap: Record<string, Student> = {};
      const studentsToDelete: string[] = [];

      // Sort students: non-google IDs first, then by lesson count (descending)
      const sortedStudents = [...students].sort((a, b) => {
        const aIsGoogle = a.id.startsWith('google-');
        const bIsGoogle = b.id.startsWith('google-');
        if (aIsGoogle !== bIsGoogle) return aIsGoogle ? 1 : -1;
        
        const aCount = Object.keys(a.attendance).length;
        const bCount = Object.keys(b.attendance).length;
        return bCount - aCount;
      });

      const googleEventsToDelete: string[] = [];
      const cloudSlotRegistry = new Map<string, string>(); // fingerprint -> firstEventId

      // 1. CLOUD-SIDE DEDUPLICATION
      if (isGoogleAuthenticated && tutorTrackCalendarId) {
        try {
          console.log('[Maintenance] Fetching Google events for thorough deduplication...');
          const calendarId = tutorTrackCalendarId || 'primary';
          const response = await fetch(`/api/calendar/events?calendarId=${encodeURIComponent(calendarId)}`, { credentials: 'include' });
          if (response.ok) {
            const freshEvents = await response.json();
            for (const event of freshEvents) {
              const start = event.start?.dateTime || event.start?.date;
              if (!start || !event.summary) continue;
              
              const normSummary = normalizeStudentName(event.summary);
              const fingerprint = `${normSummary}_${start}`;
              
              if (cloudSlotRegistry.has(fingerprint)) {
                console.log(`[Maintenance] Cloud Duplicate: "${event.summary}" at ${start}. ID: ${event.id}`);
                googleEventsToDelete.push(event.id);
                cloudDuplicatesFound++;
              } else {
                cloudSlotRegistry.set(fingerprint, event.id);
              }
            }
          }
        } catch (err) {
          console.warn('[Maintenance] Cloud deduplication fetch failed:', err);
        }
      }

      // 2. LOCAL STATE DEDUPLICATION AND MERGING
      sortedStudents.forEach(s => {
        const norm = normalizeStudentName(s.name);
        if (!norm) return;

        const updatedAttendance = { ...s.attendance };
        let studentChanged = false;
        const localFingerprints = new Set<string>();

        Object.entries(s.attendance || {}).forEach(([k, e]) => {
          if (e.deleted) return;
          
          const fingerprint = `${norm}_${k}`;
          if (localFingerprints.has(fingerprint)) {
            console.log(`[Maintenance] Local duplicate for ${s.name} at ${k}. Marking deleted.`);
            updatedAttendance[k] = { ...e, deleted: true };
            studentChanged = true;
            if (e.googleEventId) googleEventsToDelete.push(e.googleEventId);
          } else {
            localFingerprints.add(fingerprint);
            // Also cross-check with cloud registry to catch ID mismatches
            if (e.googleEventId && cloudSlotRegistry.has(fingerprint) && e.googleEventId !== cloudSlotRegistry.get(fingerprint)) {
               console.log(`[Maintenance] ID mismatch for ${s.name} at ${k}. Purging redundant ID ${e.googleEventId}`);
               googleEventsToDelete.push(e.googleEventId);
            }
          }
        });

        if (studentChanged) {
          s.attendance = updatedAttendance;
        }

        // Find if we already have a "similar" student in our results map
        let existing: Student | undefined = undefined;
        
        // Exact check first
        if (normalizedMap[norm]) {
          existing = normalizedMap[norm];
        } else {
          // Similarity check (similar to findExistingStudentByName)
          const similarNorm = Object.keys(normalizedMap).find(k => {
             return k.includes(norm) || norm.includes(k);
          });
          if (similarNorm) existing = normalizedMap[similarNorm];
        }

        if (existing && existing.id !== s.id) {
          console.log(`[Manual Cleanup] Merging similar: "${s.name}" (${s.id}) -> "${existing.name}" (${existing.id})`);
          
          // Merge Attendance
          const mergedAttendance = { ...existing.attendance };
          Object.entries(s.attendance).forEach(([k, e]) => {
             if (e.deleted) {
               if (e.googleEventId && e.googleCalendarId) {
                 googleEventsToDelete.push({ eventId: e.googleEventId, calendarId: e.googleCalendarId });
               }
               return;
             }

             // 1. First, check if this event (by googleEventId) already exists in mergedAttendance
             let foundByEventId = false;
             if (e.googleEventId) {
               for (const [mk, me] of Object.entries(mergedAttendance)) {
                 if (me.googleEventId === e.googleEventId) {
                   // Found duplicate event, merge properties if needed
                   if (!me.status && e.status === 'confirmed') mergedAttendance[mk].status = 'confirmed';
                   foundByEventId = true;
                   break;
                 }
               }
             }

             if (!foundByEventId) {
               // 2. Check for same-hour conflict in the merged attendance
               const [datePart, timePart] = k.split('@');
               const h1 = timePart ? Number(timePart.split(':')[0]) : (e.startTime ? Number(e.startTime.split(':')[0]) : null);
               
               let hourConflict = false;
               if (h1 !== null) {
                 for (const [mk, me] of Object.entries(mergedAttendance)) {
                   if (me.deleted) continue;
                   if (!mk.startsWith(datePart)) continue;
                   const h2 = mk.includes('@') ? Number(mk.split('@')[1].split(':')[0]) : (me.startTime ? Number(me.startTime.split(':')[0]) : null);
                   if (h1 === h2) {
                     hourConflict = true;
                     // If existing is not confirmed but this one is, swap them
                     if (!me.status && e.status === 'confirmed') {
                        if (me.googleEventId && me.googleCalendarId) googleEventsToDelete.push({ eventId: me.googleEventId, calendarId: me.googleCalendarId });
                        mergedAttendance[mk] = e;
                     } else {
                        // This is the redundant one
                        if (e.googleEventId && e.googleCalendarId) googleEventsToDelete.push({ eventId: e.googleEventId, calendarId: e.googleCalendarId });
                     }
                     break;
                   }
                 }
               }

               if (!hourConflict) {
                 // 3. Normal merge
                 if (!mergedAttendance[k] || (!mergedAttendance[k].status && e.status === 'confirmed')) {
                    mergedAttendance[k] = e;
                 }
               }
             }
          });
          
          // Merge Payments
          const mergedPayments = [...existing.payments];
          s.payments.forEach(p => {
            if (!mergedPayments.some(mp => mp.id === p.id || (mp.date === p.date && mp.amount === p.amount))) {
              mergedPayments.push(p);
            }
          });

          // Update winner
          const winnerNorm = normalizeStudentName(existing.name);
          normalizedMap[winnerNorm] = {
            ...existing,
            attendance: mergedAttendance,
            payments: mergedPayments,
            updatedAt: new Date().toISOString()
          };

          studentsToDelete.push(s.id);
          mergeCount++;
        } else {
          normalizedMap[norm] = s;
        }
      });

      if (mergeCount > 0) {
        studentsToDelete.forEach(id => {
          batch.delete(doc(db, 'users', user.uid, 'students', id));
        });

        Object.values(normalizedMap).forEach(winner => {
          // Only send update if it was actually touched
          const original = students.find(s => s.id === winner.id);
          if (original && JSON.stringify(original.attendance) !== JSON.stringify(winner.attendance)) {
             batch.set(doc(db, 'users', user.uid, 'students', winner.id), cleanFirestorePayload(winner));
          }
        });

        await batch.commit();
        showToast(`Deduplication complete: Merged ${mergeCount} similar records`, 'success');
      } else {
        showToast('Processing cloud calendar deduplication...', 'success');
      }

      // 3. PROCESS CLOUD DELETIONS
      if (googleEventsToDelete.length > 0 && isGoogleAuthenticated) {
        const uniqueToDelete = Array.from(new Set(googleEventsToDelete));
        console.log(`[Maintenance] Purging ${uniqueToDelete.length} duplicates from Google Calendar...`);
        
        const calendarId = tutorTrackCalendarId || 'primary';
        for (const eventId of uniqueToDelete) {
          try {
            const response = await fetch(`/api/calendar/events/${eventId}?calendarId=${encodeURIComponent(calendarId)}`, {
              method: 'DELETE',
              credentials: 'include'
            });
            if (response.ok || response.status === 410) {
              console.log(`[Maintenance] Successfully deleted ${eventId}`);
            } else {
              console.warn(`[Maintenance] Failed to delete ${eventId}: ${response.status}`);
            }
          } catch (err) {
            console.error(`[Maintenance] Error deleting ${eventId}:`, err);
          }
        }
        showToast(`Maintenance complete: Cleaned ${uniqueToDelete.length} cloud duplicates`, 'success');
      } else if (mergeCount === 0) {
        showToast('System stable. No duplicates found.', 'success');
      }
    } catch (error) {
      console.error('[Manual Cleanup] Error:', error);
      showToast('Cleanup failed. Check console.', 'error');
    } finally {
      setSyncingStatus(false);
    }
  }, [user, students, quotaExceeded, showToast, setSyncingStatus, isGoogleAuthenticated, tutorTrackCalendarId]);

  const handleDeleteEventById = async () => {
    if (!eventIdToDelete) {
      showToast('Please enter an event ID', 'error');
      return;
    }
    if (!isGoogleAuthenticated) {
      showToast('Please log in to Google Calendar first', 'error');
      return;
    }

    setIsSyncing(true);
    const id = eventIdToDelete.trim();
    showToast(`Attempting to delete event: ${id}...`, 'success');
    
    try {
      const calendarId = tutorTrackCalendarId || 'primary';
      const response = await fetch(`/api/calendar/events/${id}?calendarId=${encodeURIComponent(calendarId)}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      
      if (response.ok) {
        showToast('Successfully deleted event from Google!', 'success');
        console.log(`[Manual Deletion] SUCCESS: Deleted eventId: ${id}`);
        setEventIdToDelete('');
      } else {
        const errData = await response.json().catch(() => ({}));
        showToast(`Deletion failed: ${response.status}`, 'error');
        console.warn(`[Manual Deletion] ERROR: Status ${response.status}`, errData);
      }
    } catch (err) {
      console.error('[Manual Deletion] FATAL:', err);
      showToast('Network error while deleting.', 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      showToast('Logged out successfully', 'success');
    } catch (error: unknown) {
      const err = error as Error;
      showToast(`Logout failed: ${err.message}`, 'error');
    }
  };

  const importFromGoogle = useCallback(async (events: ExternalEvent[]) => {
    if (!user || isSyncingRef.current) return;
    isSyncingRef.current = true;
    console.log(`[Sync] [Import] Starting with ${events.length} cloud events...`);
    
    const currentStudents = [...studentsRef.current];
    const batch = writeBatch(db);
    let totalChanges = 0;
    const studentChanges = new Set<number>();

    // 1. Index current local state by googleEventId
    const idToLocalEntry = new Map<string, { sIdx: number; key: string; entry: AttendanceEntry }>();
    currentStudents.forEach((s, sIdx) => {
      Object.entries(s.attendance || {}).forEach(([k, e]) => {
        if (e.googleEventId) {
          idToLocalEntry.set(e.googleEventId, { sIdx, key: k, entry: e });
        }
      });
    });

    // 2. Process events
    for (const event of events) {
      if (event.summary?.toLowerCase().startsWith('tutor session:')) continue;
      
      const start = event.start.dateTime || event.start.date;
      const end = event.end.dateTime || event.end.date;
      if (!start || !end || !event.summary) continue;

      const startDate = new Date(start);
      const endDate = new Date(end);
      const dateStr = getThailandDateStr(startDate);
      const startTime = event.start.dateTime ? startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Bangkok' }) : '';
      const hours = Math.round(((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60)) * 2) / 2;
      const key = dateStr + (startTime ? '@' + startTime : '');
      if (hours <= 0) continue;

      const localMatch = idToLocalEntry.get(event.id);

      if (localMatch) {
         // STABLE ID MATCH FOUND
         const student = currentStudents[localMatch.sIdx];
         const entry = localMatch.entry;

         // A. Timestamp check: Only update if Google version is newer
         if (entry.googleUpdatedAt && event.updated && new Date(event.updated) <= new Date(entry.googleUpdatedAt)) {
            continue;
         }

         // B. Status and Type inference
         const textToSearch = (event.summary + ' ' + (event.description || '')).toLowerCase();
         const isPreply = textToSearch.includes('preply');
         
         let status: AttendanceStatus = 'planned';
         // Only auto-confirm if explicitly marked as done/paid/complete
         if (['done', 'paid', 'complete'].some(k => textToSearch.includes(k))) status = 'confirmed';
         if (entry.status === 'confirmed' && status === 'planned') status = 'confirmed'; // Don't revert manual confirmation

         let type = entry.type;
         if (['online', 'zoom', 'skype', 'meet', 'preply'].some(k => textToSearch.includes(k))) type = 'online';

         // C. Update if details changed
         const needsUpdate = localMatch.key !== key || 
                             entry.hours !== hours || 
                             entry.status !== status || 
                             entry.type !== type ||
                             entry.googleUpdatedAt !== event.updated;

         if (needsUpdate) {
            console.log(`[Sync] [Update] ${student.name}: ${event.id}`);
            if (localMatch.key !== key) delete student.attendance[localMatch.key];
            student.attendance[key] = {
              ...entry,
              hours, startTime, status, type,
              googleUpdatedAt: event.updated,
              googleCalendarId: event.calendarId || 'primary',
              source: isPreply ? 'preply' : (entry.source || 'google')
            };
            studentChanges.add(localMatch.sIdx);
         }
      } else {
         // NO ID MATCH - Check for existing student or potential "app" lesson to link
         const studentName = normalizeStudentName(event.summary);
         
         // STRICT: Skip any event that doesn't have a recognizable student name
         if (!studentName || 
             ['joe', 'lessonjoe', 'unknown', 'unknown student', 'lesson', 'tutor'].includes(studentName.toLowerCase()) ||
             studentName.length < 2) {
           continue; 
         }

         let targetStudent = findExistingStudentByName(studentName, currentStudents);
         
         if (!targetStudent) {
           console.log(`[Sync] [Create Student] ${studentName}`);
           const newId = 'google-' + Math.random().toString(36).substr(2, 9);
           targetStudent = {
             id: newId, 
             name: studentName.split(' ').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' '), 
             teacherId: 'default-teacher',
             rates: { online: 0, onsite: 0, home: 0 }, 
             teacherRates: { online: 0, onsite: 0, home: 0 },
             defaultHours: 1, 
             payments: [], 
             attendance: {}, 
             hidden: false, 
             groupName: 'Sync'
           };
           currentStudents.push(targetStudent);
           batch.set(doc(db, 'users', user.uid, 'students', newId), cleanFirestorePayload(targetStudent));
           // We'll update the index too if we wanted, but not needed for the rest of this loop
         }

         if (targetStudent) {
           const sIdx = currentStudents.findIndex(s => s.id === targetStudent!.id);
           const textToSearch = (event.summary + ' ' + (event.description || '')).toLowerCase();
           const isPreply = textToSearch.includes('preply');

           // D. Look for an existing "app" lesson at this time to avoid duplicates
           let existingSlotEntry: AttendanceEntry | null = null;
           let slotKey: string | null = null;
           
           for (const [k, e] of Object.entries(targetStudent.attendance)) {
             if (k.startsWith(dateStr) && !e.deleted) {
               // Check if same ID already existed under different key
               if (e.googleEventId === event.id) { existingSlotEntry = e; slotKey = k; break; }
               // OR check same time window
               const kTime = k.includes('@') ? k.split('@')[1] : e.startTime || '';
               if (kTime && startTime) {
                 const diff = Math.abs(Number(startTime.split(':')[0]) * 60 + Number(startTime.split(':')[1]) - (Number(kTime.split(':')[0]) * 60 + Number(kTime.split(':')[1])));
                 if (diff < 45) { existingSlotEntry = e; slotKey = k; break; }
               }
             }
           }

           if (existingSlotEntry) {
             // Link the Google ID to the existing slot
             if (!existingSlotEntry.googleEventId) {
               console.log(`[Sync] [Link] Linking event ${event.id} to existing lesson for ${targetStudent.name}`);
               targetStudent.attendance[slotKey!] = {
                 ...existingSlotEntry,
                 googleEventId: event.id,
                 googleUpdatedAt: event.updated,
                 googleCalendarId: event.calendarId || 'primary',
                 source: isPreply ? 'preply' : (existingSlotEntry.source || 'app')
               };
               studentChanges.add(sIdx);
             }
           } else {
             // Create NEW entry
             console.log(`[Sync] [Create Lesson] ${targetStudent.name}: ${event.id}`);
             targetStudent.attendance[key] = {
               hours, startTime,
               googleEventId: event.id,
               googleUpdatedAt: event.updated,
               googleCalendarId: event.calendarId || 'primary',
               type: (isPreply || ['online', 'zoom'].some(k => textToSearch.includes(k))) ? 'online' : 'onsite',
               status: ['done', 'paid', 'complete'].some(k => textToSearch.includes(k)) ? 'confirmed' : 'planned',
               source: isPreply ? 'preply' : 'google'
             };
             studentChanges.add(sIdx);
           }
         }
      }
    }

    // 3. Batch commit
    for (const idx of Array.from(studentChanges)) {
      const s = currentStudents[idx];
      totalChanges++;
      const payload = cleanFirestorePayload({
        attendance: s.attendance,
        updatedAt: new Date().toISOString()
      });
      batch.set(doc(db, 'users', user.uid, 'students', s.id), payload, { merge: true });
    }

    if (totalChanges > 0) {
      try {
        await batch.commit();
        showToast(`Synced ${totalChanges} updates from Google`, 'success');
      } catch (err) {
        console.error('[Sync] Batch commit error:', err);
      }
    }
    
    isSyncingRef.current = false;
    lastSyncTimeRef.current = Date.now();
  }, [user, showToast, findExistingStudentByName, setQuotaExceeded]);

  const fetchCalendarEvents = useCallback(async (calendarIdArg?: string | unknown) => {
    // If called as event handler, calendarIdArg will be an event object.
    const calendarId = typeof calendarIdArg === 'string' ? calendarIdArg : undefined;

    if (!isGoogleAuthenticated || quotaExceeded || isSyncingRef.current) return;
    setSyncingStatus(true);
    try {
      const calendarsToFetch = ['primary'];
      const headers: Record<string, string> = { };
      
      // Only use the token if it looks like a real string (not an object dump)
      if (googleAccessToken && googleAccessToken.length > 20 && !googleAccessToken.includes('[object')) {
        headers['Authorization'] = `Bearer ${googleAccessToken}`;
      }

      const fetchOptions: RequestInit = { 
        credentials: 'include',
        headers
      };

      // 1. Diagnostic: List primary calendars
      try {
        const listRes = await fetch('/api/calendar/list', fetchOptions);
        if (listRes.ok) {
          const contentType = listRes.headers.get('content-type');
          if (!contentType || !contentType.includes('application/json')) {
            const bodyPreview = await listRes.text().then(t => t.slice(0, 100));
            throw new Error(`Non-JSON response from /api/calendar/list: ${contentType}. Preview: ${bodyPreview}`);
          }
          const calendars: GoogleCalendar[] = await listRes.json();
          
          // Auto-include any calendar with "Preply" or "Class" in the name
          calendars.forEach((c: GoogleCalendar) => {
            const summary = c.summary?.toLowerCase() || '';
            if ((summary.includes('preply') || summary.includes('class')) && !calendarsToFetch.includes(c.id)) {
              console.log(`[Sync] Auto-including lesson calendar: "${c.summary}"`);
              calendarsToFetch.push(c.id);
            }
          });
        } else {
          if (listRes.status === 401) {
            handleSessionExpired();
            return;
          }
        }
      } catch (e) {
        console.error('[Sync] Calendar discovery failed:', e);
      }
      
      // 2. Validate tutorTrackCalendarId before adding it
      if (tutorTrackCalendarId && 
          tutorTrackCalendarId !== 'primary' && 
          tutorTrackCalendarId !== '[object Object]' && 
          tutorTrackCalendarId !== 'null' && 
          tutorTrackCalendarId !== 'undefined' &&
          !calendarsToFetch.includes(tutorTrackCalendarId)) {
        calendarsToFetch.push(tutorTrackCalendarId);
      }
      
      if (calendarId && 
          calendarId !== '[object Object]' && 
          !calendarsToFetch.includes(calendarId as string)) {
        calendarsToFetch.push(calendarId as string);
      }

      const allEvents: ExternalEvent[] = [];
      const seenIds = new Set<string>();
      const successCalendarIds = new Set<string>();

      for (const id of calendarsToFetch) {
        try {
          const res = await fetch(`/api/calendar/events?calendarId=${encodeURIComponent(id)}`, fetchOptions);
          
          if (res.status === 401) {
            handleSessionExpired();
            return;
          }

          if (res.status === 404 && id === tutorTrackCalendarId) {
            // Calendar ID is no longer valid (e.g., deleted in Google Calendar)
            console.warn(`[Sync] Calendar "${id}" not found (404). Clearing ID.`);
            setTutorTrackCalendarId(null);
            if (user) {
              setDoc(doc(db, 'users', user.uid, 'settings', 'main'), {
                tutorTrackCalendarId: null
              }, { merge: true }).catch(e => console.error('Failed to clear calendar ID:', e));
            }
            continue;
          }

          if (res.ok) {
            const contentType = res.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
              const bodyPreview = await res.text().then(t => t.slice(0, 100));
              console.warn(`[Sync] Non-JSON response for calendar ${id}: ${contentType}. Preview: ${bodyPreview}`);
              continue;
            }
            const data: ExternalEvent[] = await res.json();
            successCalendarIds.add(id);
            
            // Item 3: Identify which calendar contains Preply/Class events
            const hits = data.filter(e => 
              (e.summary || '').toLowerCase().includes('preply') || 
              (e.description || '').toLowerCase().includes('preply') ||
              (e.summary || '').toLowerCase().includes('class') ||
              (e.description || '').toLowerCase().includes('class')
            );
            if (hits.length > 0) {
              console.log(`✅ [Sync] [SUCCESS] Found ${hits.length} lesson events in calendar: "${id}"`);
            }

            data.forEach(event => {
              if (!seenIds.has(event.id)) {
                seenIds.add(event.id);
                allEvents.push({ ...event, calendarId: id });
              }
            });
          }
        } catch {
          console.warn(`[Sync] Skipping calendar ${id} (possible permission or fetch issue)`);
        }
      }

      if (successCalendarIds.size > 0) {
        setExternalEvents(allEvents);
        importFromGoogle(allEvents);
        // Run cleanup after sync to catch and purge any newly created duplicates
        setTimeout(() => handleManualCleanup(), 3000);
      } else {
        console.warn('[Sync] No calendars were successfully fetched. Skipping update to prevent data loss.');
      }
    } catch (error) {
      console.error('Failed to fetch calendar events:', error);
    } finally {
      setSyncingStatus(false);
    }
  }, [importFromGoogle, tutorTrackCalendarId, isGoogleAuthenticated, googleAccessToken, handleSessionExpired, user, quotaExceeded, setSyncingStatus, handleManualCleanup]);

  // Automatic sync interval
  useEffect(() => {
    if (isGoogleAuthenticated && user && !quotaExceeded) {
       fetchCalendarEvents();
       const interval = setInterval(() => fetchCalendarEvents(), 5 * 60 * 1000); // Sync every 5 mins
       return () => clearInterval(interval);
    }
  }, [isGoogleAuthenticated, user, quotaExceeded, fetchCalendarEvents]);

  const checkApiHealth = useCallback(async () => {
    console.log('[Health] Checking API health...');
    try {
      const res = await fetch('/api/health');
      const data = await res.json();
      if (res.ok && data.ok) {
        console.log('[Health] API is healthy');
        return true;
      }
      console.error('[Health] API health check failed:', data);
      return false;
    } catch (error) {
      console.error('[Health] API health check connection error:', error);
      return false;
    }
  }, []);

  const setupTutorTrackCalendar = useCallback(async (freshToken?: string) => {
    if (isSettingUpCalendarRef.current) {
      console.log('[Calendar] Setup already in progress, skipping...');
      return;
    }

    console.log('[Calendar] [Step 1] Starting setupTutorTrackCalendar...');
    const tokenToUse = freshToken || googleAccessToken;

    if (!tokenToUse) {
      console.log('[Calendar] No token available for setup');
      return;
    }
    
    const isHealthy = await checkApiHealth();
    if (!isHealthy) {
      console.error('[Calendar] [Error] Backend API health check failed');
      showToast('Backend API is not responding correctly. Please try again later.', 'error');
      return;
    }

    try {
      isSettingUpCalendarRef.current = true;
      console.log('[Calendar] [Step 2] Calling /api/calendar/setup...');
      
      const res = await fetch('/api/calendar/setup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokenToUse}`
        },
        credentials: 'include',
        body: JSON.stringify({ accessToken: tokenToUse })
      });

      if (res.status === 401) {
        handleSessionExpired();
        return;
      }

      console.log('[Calendar] [Step 3] Setup response status:', res.status);
      
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        console.error('[Calendar] [Error] Failed to parse setup response as JSON:', e);
        throw new Error('Invalid server response (not JSON)');
      }

      if (res.ok) {
        console.log('[Calendar] [Success] Setup successful. Calendar ID:', data.calendarId);
        setTutorTrackCalendarId(data.calendarId);
        
        if (user) {
          try {
            await setDoc(doc(db, 'users', user.uid, 'settings', 'main'), {
              tutorTrackCalendarId: data.calendarId
            }, { merge: true });
          } catch (e) {
            console.error('Failed to save calendar ID to Firestore:', e);
          }
        }
        
        fetchCalendarEvents(data.calendarId);
      } else {
        console.error('[Calendar] [Error] Setup failed with error:', data.error, data.details);
        showToast(data.error || 'Failed to setup TutorTrack calendar', 'error');
      }
    } catch (error: unknown) {
      const err = error as { message?: string };
      console.error('[Calendar] [Fatal Error] Detailed setup error:', error);
      showToast(`Connection error: ${err.message || 'Check console for details'}`, 'error');
    } finally {
      isSettingUpCalendarRef.current = false;
    }
  }, [fetchCalendarEvents, checkApiHealth, showToast, user, googleAccessToken, handleSessionExpired]);

  const checkGoogleAuthStatus = useCallback(async () => {
    if (googleAccessToken) {
      setIsGoogleAuthenticated(true);
      // setupTutorTrackCalendar is NOT automatically called here anymore
      return;
    }

    try {
      const res = await fetch('/api/auth/status', {
        credentials: 'include'
      });
      const data = await res.json();
      setIsGoogleAuthenticated(data.isAuthenticated);
      // setupTutorTrackCalendar is NOT automatically called here anymore
    } catch (error) {
      console.error('Failed to check auth status:', error);
    }
  }, [googleAccessToken]);

  useEffect(() => {
    const handleOAuthMessage = (event: MessageEvent) => {
      const origin = event.origin;
      if (!origin.endsWith('.run.app') && !origin.includes('localhost')) return;

      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        const tokens = event.data.tokens;
        if (tokens?.access_token) {
          localStorage.setItem('google_access_token', tokens.access_token);
          setGoogleAccessToken(tokens.access_token);
          setIsGoogleAuthenticated(true);
          setupTutorTrackCalendar(tokens.access_token);
          showToast('Google Calendar connected successfully!', 'success');
        }
      }
    };
    window.addEventListener('message', handleOAuthMessage);
    return () => window.removeEventListener('message', handleOAuthMessage);
  }, [setupTutorTrackCalendar, showToast]);

  useEffect(() => {
    checkGoogleAuthStatus();
  }, [user, checkGoogleAuthStatus]);


  // Initial sync once authenticated - DISABLED AUTOMATIC RUN
  useEffect(() => {
    // Initial sync removed for stability. Sync will be manual.
  }, []);

  // Periodic sync - DISABLED AUTOMATIC BACKGROUND RUN
  useEffect(() => {
    // Periodic sync removed for stability.
  }, []);

  const handleConnectGoogleCalendar = async (): Promise<string | null> => {
    console.log('[Auth] [Step 1] Starting Google Calendar connection (Server flow)...');
    try {
      const response = await fetch('/api/auth/google/url');
      if (!response.ok) throw new Error('Failed to get auth URL');
      const { url } = await response.json();
      
      console.log('[Auth] [Step 2] Opening Google OAuth popup...');
      const width = 600;
      const height = 700;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;
      
      window.open(
        url,
        'google_oauth',
        `width=${width},height=${height},left=${left},top=${top}`
      );
      
      return null;
    } catch (error: unknown) {
      const err = error as Error;
      console.error('[Auth] [Fatal Error] Connection error:', err);
      showToast(`Connection failed: ${err.message || 'Unknown error'}`, 'error');
      return null;
    }
  };

  const handleLogoutGoogle = async () => {
    try {
      await fetch('/api/auth/logout', { 
        method: 'POST',
        credentials: 'include'
      });
      localStorage.removeItem('google_access_token');
      setGoogleAccessToken(null);
      setIsGoogleAuthenticated(false);
      setExternalEvents([]);
      showToast('Disconnected from Google Calendar', 'success');
      await auth.signOut();
    } catch (error) {
      console.error('Failed to logout:', error);
    }
  };

  const days = useMemo(() => {
    return getDaysInMonth(currentDate.getFullYear(), currentDate.getMonth(), highlightedDateStr);
  }, [currentDate, highlightedDateStr]);

  const changeMonth = (delta: number) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + delta);
    setCurrentDate(newDate);
  };

  const goToToday = () => {
    const now = getThailandNow();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    // Check if we are already in the current month/year
    if (currentDate.getMonth() === firstOfMonth.getMonth() && currentDate.getFullYear() === firstOfMonth.getFullYear()) {
      // Trigger manual scroll even if currentDate didn't change
      if (scrollContainerRef.current) {
        const todayElement = scrollContainerRef.current.querySelector('.is-today-cell') as HTMLElement;
        if (todayElement) {
          const container = scrollContainerRef.current;
          const left = todayElement.offsetLeft - (container.clientWidth / 2) + (todayElement.clientWidth / 2);
          container.scrollTo({ left, behavior: 'smooth' });
        }
      }
    } else {
      setCurrentDate(firstOfMonth);
      // The scroll useEffect will handle the jump after the month change and render
    }
  };
  
  const existingGroups = useMemo(() => {
      const groups = new Set<string>();
      students.forEach(s => { if (s.groupName) groups.add(s.groupName); });
      return Array.from(groups).sort();
  }, [students]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!scrollContainerRef.current) return;
    if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('input') || (e.target as HTMLElement).closest('select') || (e.target as HTMLElement).closest('.attendance-cell')) return;
    isDragging.current = true;
    setIsCursorGrabbing(true);
    startX.current = e.pageX - scrollContainerRef.current.offsetLeft;
    scrollLeft.current = scrollContainerRef.current.scrollLeft;
  };

  const handleMouseLeave = () => {
    isDragging.current = false;
    setIsCursorGrabbing(false);
  };

  const handleMouseUp = () => {
    isDragging.current = false;
    setIsCursorGrabbing(false);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current || !scrollContainerRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollContainerRef.current.offsetLeft;
    const walk = (x - startX.current) * 2; 
    scrollContainerRef.current.scrollLeft = scrollLeft.current - walk;
  };

  const addTeacher = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newTeacherName || !user || quotaExceeded) {
        if (quotaExceeded) showToast('Quota exceeded, cannot add teacher.', 'error');
        return;
      }
      try {
        const id = crypto.randomUUID();
        const newTeacher: Teacher = { id, name: newTeacherName };
        const cleaned = cleanFirestorePayload(newTeacher);
        await setDoc(doc(db, 'users', user.uid, 'teachers', id), cleaned);
        setNewTeacherName('');
        setIsAddTeacherModalOpen(false);
        showToast('New teacher added to system', 'success');
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, `teachers`);
      }
  };

  const deleteTeacher = async (id: string) => {
    if (id === 'default-teacher') {
      showToast('Cannot delete the main teacher', 'error');
      return;
    }
    if (!user || quotaExceeded) {
       if (quotaExceeded) showToast('Quota exceeded, cannot delete teacher.', 'error');
       return;
    }
    const teacher = teachers.find(t => t.id === id);
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'teachers', id));
      showToast(`Teacher ${teacher?.name || ''} removed`, 'success');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `teachers/${id}`);
    }
  };


  const addStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || quotaExceeded) {
      if (quotaExceeded) showToast('Quota exceeded, cannot add students.', 'error');
      else showToast('You must be logged in to add students', 'error');
      return;
    }
    if (!newStudentName.trim() || newStudentName.trim().length < 2) {
      showToast('Please enter a valid student name', 'error');
      return;
    }

    const existingStudent = findExistingStudentByName(newStudentName.trim());

    if (existingStudent) {
      console.log(`[Duplicate Prevention] Student with name "${newStudentName}" already exists (matched similarity with: "${existingStudent.name}", ID: ${existingStudent.id}). Showing profile instead.`);
      setViewingStudentProfile(existingStudent);
      setIsAddModalOpen(false);
      setNewStudentName('');
      showToast(`Student already exists under a similar name. Opening profile.`, 'error');
      return;
    }

    const rawStudentData = {
      id: crypto.randomUUID(),
      teacherId: selectedInitialTeacherId,
      name: newStudentName.trim(),
      teacherHourlyRate: 0, 
      teacherRates: {
          online: parseFloat(twOnline) || 0,
          onsite: parseFloat(twOnsite) || 0,
          home: parseFloat(twHome) || 0
      },
      rates: {
          online: enableOnline && rateOnline ? parseFloat(rateOnline) : null,
          onsite: enableOnsite && rateOnsite ? parseFloat(rateOnsite) : null,
          home: enableHome && rateHome ? parseFloat(rateHome) : null
      },
      defaultHours: 1,
      attendance: {},
      payments: newStudentCredit ? [{
        id: crypto.randomUUID(),
        date: getThailandNow().toISOString(),
        amount: parseFloat(newStudentCredit)
      }] : [],
      groupName: newStudentGroupName.trim() || '',
      notes: newStudentNotes.trim() || '',
      books: newStudentBooks || [],
      hidden: false,
      timezone: newStudentTimezone || 'Asia/Bangkok',
      email: newStudentEmail.trim() || '',
      alertText: newStudentAlertText.trim() || '',
      nextTask: '',
      isNextTaskDone: false,
      isPrepared: false,
      documents: []
    };

    console.log('[Firestore] Saving new student payload:', JSON.stringify(rawStudentData, null, 2));

    try {
      const cleanedStudent = cleanFirestorePayload(rawStudentData);
      console.log('[Firestore] Cleaned payload:', JSON.stringify(cleanedStudent, null, 2));
      await setDoc(doc(db, 'users', user.uid, 'students', cleanedStudent.id), cleanedStudent);
      setNewStudentName('');
      setRateOnline(''); setRateOnsite(''); setRateHome('');
      setTwOnline(''); setTwOnsite(''); setTwHome('');
      setNewStudentCredit(''); setNewStudentGroupName('');
      setNewStudentNotes(''); setNewStudentBooks([]);
      setNewStudentTimezone('Asia/Bangkok');
      setNewStudentEmail('');
      setNewStudentAlertText('');
      setIsAddModalOpen(false);
      showToast('Student added successfully', 'success');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'students');
    }
  };


  const toggleStudentVisibility = async (studentId: string) => {
    if (!user || quotaExceeded) return;
    const student = students.find(s => s.id === studentId);
    if (!student) return;
    try {
      const updated = cleanFirestorePayload({
        ...student,
        hidden: !student.hidden,
        updatedAt: new Date().toISOString()
      });
      await setDoc(doc(db, 'users', user.uid, 'students', studentId), updated);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `students/${studentId}/visibility`);
    }
  };

  const handleReceiptVerified = async (data: { studentId: string; amount: number; date: string }) => {
    if (!user) return;
    const student = students.find(s => s.id === data.studentId);
    if (!student) return;

    // Logic: If class hasn't been logged already, log it.
    // We'll check if there's an attendance entry for this date.
    // If not, we'll create a default one.
    
    const dateKey = data.date;
    const existingEntry = Object.entries(student.attendance).find(([k, e]) => k.startsWith(dateKey) && !e.deleted);
    
    const newAttendance = { ...student.attendance };
    if (!existingEntry) {
      // Log a default 1-hour onsite lesson if none exists
      newAttendance[dateKey] = {
        hours: student.defaultHours || 1,
        type: 'onsite',
        status: 'confirmed',
        studentPaid: true,
        source: 'app'
      };
    } else {
      // Mark existing as paid
      newAttendance[existingEntry[0]] = {
        ...existingEntry[1],
        studentPaid: true
      };
    }

    const newPayment = {
      id: crypto.randomUUID(),
      date: getThailandNow().toISOString(),
      amount: data.amount,
      note: `Receipt Verified for ${data.date}`
    };

    const updated = cleanFirestorePayload({
      ...student,
      attendance: newAttendance,
      payments: [...student.payments, newPayment],
      updatedAt: new Date().toISOString()
    });

    await setDoc(doc(db, 'users', user.uid, 'students', data.studentId), updated);

    showToast(`Receipt verified for ${student.name}`, 'success');
  };

  useEffect(() => {
    // Scroll to today on initial load and month change
    const scrollToToday = () => {
      if (!scrollContainerRef.current) return;
      
      const container = scrollContainerRef.current;
      const todayElement = container.querySelector('.is-today-cell') as HTMLElement;
      
      if (todayElement) {
        // Calculate the ideal scroll position to center today, 
        // but it will stop at the boundaries (e.g., far right for 30th)
        const scrollLeft = todayElement.offsetLeft - (container.clientWidth / 2) + (todayElement.clientWidth / 2);
        
        container.scrollTo({
          left: scrollLeft,
          behavior: 'auto' // Use 'auto' for "right away" feel, 'smooth' for animation
        });
      } else if (days.length > 0) {
        // If today isn't in this month, but we're looking at a month, 
        // scroll to the start or end depending on direction? 
        // Usually, if we change months, we might want to stay relative, 
        // but for "today" we only care if today is visible.
      }
    };

    // Use a few frames to ensure the table has rendered and dimensions are stable
    const timer = setTimeout(scrollToToday, 50);
    return () => clearTimeout(timer);
  }, [days]);

  const handleAIAction = async (action: string, payload: Record<string, unknown>) => {
    if (!user) return;
    console.log('[AI Action]', action, payload);

    try {
      switch (action) {
        case 'add_student': {
          if (!payload.name) return;
          const existing = findExistingStudentByName(payload.name as string);
          if (existing) {
            console.log(`[AI Duplicate Prevention] Student "${payload.name}" already exists. ID: ${existing.id}`);
            showToast(`Student "${payload.name}" already exists.`, 'error');
            break;
          }
          const newStudent = cleanFirestorePayload({
            id: crypto.randomUUID(),
            name: payload.name as string,
            teacherId: (payload.teacherId as string) || 'default-teacher',
            rates: { online: 0, onsite: 0, home: 0 },
            teacherRates: { online: 0, onsite: 0, home: 0 },
            defaultHours: 1,
            payments: [],
            attendance: {},
            groupName: typeof payload.groupName === 'string' ? payload.groupName : '',
            hidden: false
          });
          await setDoc(doc(db, 'users', user.uid, 'students', newStudent.id), newStudent);
          showToast(`Added student ${payload.name}`, 'success');
          break;
        }
        case 'cancel_lesson': {
          if (!payload.studentId || !payload.date) return;
          const key = payload.startTime ? `${payload.date}@${payload.startTime}` : payload.date;
          await updateAttendance(payload.studentId, key, null);
          showToast(`Cancelled lesson on ${payload.date}`, 'success');
          break;
        }
        case 'log_lesson': {
          if (!payload.studentId || !payload.date || !payload.hours || !payload.type) return;
          const key = payload.startTime ? `${payload.date}@${payload.startTime}` : payload.date;
          const entry: AttendanceEntry = {
            hours: payload.hours,
            type: payload.type as ClassType,
            startTime: payload.startTime,
            status: (payload.status as AttendanceStatus) || 'confirmed',
            source: 'app'
          };
          await updateAttendance(payload.studentId, key, entry);
          showToast(`Logged lesson for ${payload.date}`, 'success');
          break;
        }
        case 'add_payment': {
          if (!payload.studentId || !payload.amount) return;
          await addPayment(payload.studentId, payload.amount);
          showToast(`Added payment of ${payload.amount}`, 'success');
          break;
        }
        default:
          console.warn('Unknown AI action:', action);
      }
    } catch (error) {
      console.error('AI Action failed:', error);
      showToast('AI failed to update data', 'error');
    }
  };

  const handleSyncAllToGoogle = async () => {
    if (!isGoogleAuthenticated || !tutorTrackCalendarId) {
      showToast('Please connect Google Calendar first', 'error');
      return;
    }

    setIsSyncing(true);
    let successCount = 0;
    let failCount = 0;

    const lessonsToSync: Array<{ studentId: string; dateStr: string; entry: AttendanceEntry }> = [];
    students.forEach(student => {
      Object.entries(student.attendance).forEach(([dateStr, entry]) => {
        if (entry.deleted) return;
        
        // Requirement 2 & 3: Only sync manual lessons (source 'app').
        // If it was imported (source 'google' or 'preply'), NEVER send it back to Google Calendar.
        const isManualLesson = entry.source === 'app' || !entry.source;
        const hasStartTime = !!entry.startTime;
        
        if (isManualLesson && hasStartTime) {
           lessonsToSync.push({ studentId: student.id, dateStr, entry });
        }
      });
    });

    if (lessonsToSync.length === 0) {
      showToast('No lessons found to sync', 'success');
      setIsSyncing(false);
      return;
    }

    showToast(`Syncing ${lessonsToSync.length} lessons...`, 'success');

    for (const [idx, item] of lessonsToSync.entries()) {
      const student = students.find(s => s.id === item.studentId);
      const pureDate = item.dateStr.split('@')[0];
      
      // Validation: Ensure we have a valid start time and duration
      if (!item.entry.startTime || !item.entry.hours || item.entry.hours <= 0) {
        console.warn(`[Sync] [Item ${idx}] Skipping lesson due to invalid duration/time:`, item);
        failCount++;
        continue;
      }

      // Force Thailand offset (+7) for the ISO string
      const startIso = `${pureDate}T${item.entry.startTime}:00+07:00`;
      const startDate = new Date(startIso);
      const endDate = new Date(startDate.getTime() + (item.entry.hours || 0) * 60 * 60 * 1000);
      
      // Double check date validity
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        console.error(`[Sync] [Item ${idx}] Invalid date constructed:`, { pureDate, startTime: item.entry.startTime, startIso });
        failCount++;
        continue;
      }

      const getThailandISO = (date: Date) => {
        const offsetDate = new Date(date.getTime() + (7 * 60 * 60 * 1000));
        return offsetDate.toISOString().split('.')[0] + '+07:00';
      };

      const finalStartIso = getThailandISO(startDate);
      const finalEndIso = getThailandISO(endDate);
      
      const body = {
        summary: `Tutor Session: ${student?.name || 'Student'}`,
        description: `Lesson with ${student?.name || 'Student'} (${item.entry.type || 'Lesson'})`,
        start: finalStartIso,
        end: finalEndIso,
        attendees: student?.email ? [{ email: student.email }] : undefined
      };

      try {
        const isUpdate = item.entry.googleEventId && item.entry.googleCalendarId === tutorTrackCalendarId;
        const endpoint = isUpdate 
          ? `/api/calendar/events/${item.entry.googleEventId}?calendarId=${encodeURIComponent(tutorTrackCalendarId || 'primary')}`
          : `/api/calendar/events?calendarId=${encodeURIComponent(tutorTrackCalendarId || 'primary')}`;
        
        const fetchOptions: RequestInit = {
          method: isUpdate ? 'PATCH' : 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(body)
        };
        
        if (googleAccessToken) {
          (fetchOptions.headers as Record<string, string>)['Authorization'] = `Bearer ${googleAccessToken}`;
        }

        console.log(`[Sync] [Item ${idx}] ${isUpdate ? 'Updating' : 'Creating'} event for ${student?.name}...`);
        const response = await fetch(endpoint, fetchOptions);

        if (response.status === 401) {
          handleSessionExpired();
          return;
        }

        if (response.status === 404) {
          console.error('[Sync] Calendar not found (404). Clearing ID.');
          setTutorTrackCalendarId(null);
          if (user) {
            setDoc(doc(db, 'users', user.uid, 'settings', 'main'), {
              tutorTrackCalendarId: null
            }, { merge: true }).catch(e => console.error('Failed to clear calendar ID:', e));
          }
          showToast('TutorTrack calendar was not found. Please reconnect.', 'error');
          setIsSyncing(false);
          return;
        }

        if (response.ok) {
          const result = await response.json();
          if (result.id) {
            console.log(`[Sync] [Item ${idx}] Success! Event ID:`, result.id);
            
            // Persist to Firestore
            const freshStudent = students.find(s => s.id === item.studentId);
            if (freshStudent && user) {
               const newAttendance = { ...freshStudent.attendance };
               newAttendance[item.dateStr] = { 
                 ...item.entry, 
                 googleEventId: result.id,
                 googleCalendarId: tutorTrackCalendarId,
                 source: 'app'
               };
                const updated = cleanFirestorePayload({
                  ...freshStudent,
                  attendance: newAttendance,
                  updatedAt: new Date().toISOString()
                });
                await setDoc(doc(db, 'users', user.uid, 'students', freshStudent.id), updated);
            }
            
            successCount++;
          } else {
            console.error(`[Sync] [Item ${idx}] POST successful but no event ID returned:`, result);
            failCount++;
          }
        } else {
          const errorData = await response.json().catch(() => ({}));
          console.error(`[Sync] [Item ${idx}] POST failed status:`, response.status, 'body:', errorData);
          failCount++;
        }
      } catch (err) {
        console.error(`[Sync] [Item ${idx}] POST fetch error:`, err);
        failCount++;
      }
    }

    setIsSyncing(false);
    fetchCalendarEvents();
    showToast(`Sync complete: ${successCount} synced, ${failCount} failed`, successCount > 0 ? 'success' : 'error');
  };

  const updateAttendance = async (studentId: string, key: string, data: AttendanceEntry | null) => {
    if (!user || quotaExceeded) {
      if (quotaExceeded) showToast('Quota exceeded, cannot update data.', 'error');
      return;
    }
    const student = students.find(s => s.id === studentId);
    if (!student) return;

    // Check for same-hour conflicts across ALL students to prevent duplicates (only for new/updated entries)
    if (data && !data.deleted) {
      const [datePart, timePart] = key.split('@');
      const normName = normalizeStudentName(student.name);

      if (timePart) {
        const [h1, m1] = timePart.split(':').map(Number);
        
        // Find any student with same normalized name who has a class at this time
        for (const s of students) {
          if (normalizeStudentName(s.id === studentId ? student.name : s.name) === normName) {
            const conflict = Object.entries(s.attendance).find(([k, e]) => {
              if (s.id === studentId && k === key) return false;
              if (e.deleted) return false;
              if (!k.startsWith(datePart)) return false;
              const kTime = k.includes('@') ? k.split('@')[1] : e.startTime;
              if (!kTime) return false;
              const [h2, m2] = kTime.split(':').map(Number);
              return Math.abs((h1 * 60 + m1) - (h2 * 60 + m2)) < 55; // Within 55 mins
            });
            
            if (conflict) {
              const conflictTime = conflict[0].includes('@') ? conflict[0].split('@')[1] : conflict[1].startTime;
              showToast(`Conflict: ${s.name} already has a class at ${conflictTime}. Overlapping classes for the same student are not allowed.`, 'error');
              return;
            }
          }
        }
      }
    }

    const existingEntry = student.attendance[key];
    const googleEventId = existingEntry?.googleEventId;
    const googleCalendarId = existingEntry?.googleCalendarId;
    const dateStr = key.split('@')[0];

    // RULE: source tracking. If it's a new entry, it's 'app'.
    let updatedData: AttendanceEntry | null = data ? { 
      ...data, 
      source: data.source || (existingEntry?.source || 'app') 
    } : null;

    try {
      // RULE: Only push to Google if the lesson was created in the app
      const isManualLesson = updatedData ? (updatedData.source === 'app') : (existingEntry?.source === 'app');
      
      if (isGoogleAuthenticated && tutorTrackCalendarId && isManualLesson) {
        try {
          const fetchOptions: RequestInit = {
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' }
          };
          if (googleAccessToken) (fetchOptions.headers as Record<string, string>)['Authorization'] = `Bearer ${googleAccessToken}`;

          if (updatedData === null) {
            // DELETION
            if (googleEventId) {
              updatedData = { ...existingEntry, deleted: true };
              await fetch(`/api/calendar/events/${googleEventId}?calendarId=${encodeURIComponent(googleCalendarId || tutorTrackCalendarId || 'primary')}`, { 
                ...fetchOptions,
                method: 'DELETE'
              }).catch(e => console.warn('[Calendar] Delete failed:', e));
            }
          } else if (updatedData.startTime) {
            // UPDATE / CREATE
            const startIso = `${dateStr}T${updatedData.startTime}:00+07:00`;
            const startDate = new Date(startIso);
            const endDate = new Date(startDate.getTime() + (updatedData.hours || 0) * 60 * 60 * 1000);
            
            const getThailandISO = (date: Date) => {
              const offsetDate = new Date(date.getTime() + (7 * 60 * 60 * 1000));
              return offsetDate.toISOString().split('.')[0] + '+07:00';
            };

            const body = {
              summary: `Tutor Session: ${student.name}${updatedData.status === 'confirmed' ? ' [✅]' : ''}`,
              description: `Lesson with ${student.name} (${updatedData.type})`,
              start: getThailandISO(startDate),
              end: getThailandISO(endDate),
              attendees: student.email ? [{ email: student.email }] : undefined
            };

            const method = googleEventId ? 'PATCH' : 'POST';
            const url = googleEventId 
              ? `/api/calendar/events/${googleEventId}?calendarId=${encodeURIComponent(googleCalendarId || tutorTrackCalendarId || 'primary')}` 
              : `/api/calendar/events?calendarId=${encodeURIComponent(tutorTrackCalendarId || 'primary')}`;
            
            let response = await fetch(url, { ...fetchOptions, method, body: JSON.stringify(body) });

            if (response.status === 410 || response.status === 404) {
              // Re-create if missing
              console.log('[Sync] Event missing in Google, re-creating...');
              response = await fetch(`/api/calendar/events?calendarId=${encodeURIComponent(tutorTrackCalendarId || 'primary')}`, { 
                ...fetchOptions, method: 'POST', body: JSON.stringify(body) 
              });
            }

            if (response.ok) {
              const result = await response.json();
              if (result.id) {
                updatedData.googleEventId = result.id;
                updatedData.googleCalendarId = tutorTrackCalendarId || 'primary';
                updatedData.googleUpdatedAt = result.updated;
              }
            } else if (response.status === 401) {
              handleSessionExpired();
              return;
            }
          }
        } catch (calErr) {
          console.error('[Calendar] API interaction failed:', calErr);
        }
      }
      const newAttendance = { ...student.attendance };
      if (updatedData === null) {
        delete newAttendance[key];
      } else {
        const newKey = dateStr + (updatedData.startTime ? '@' + updatedData.startTime : '');
        if (newKey !== key) {
          delete newAttendance[key];
        }
        newAttendance[newKey] = updatedData;
      }

      const updated = cleanFirestorePayload({
        ...student,
        attendance: newAttendance,
        updatedAt: new Date().toISOString()
      });
      await setDoc(doc(db, 'users', user.uid, 'students', studentId), updated);
      console.log(`[Firestore] Successfully saved status: ${updatedData?.status || 'deleted'} for ${student.name}`);
      
      // Do NOT call fetchCalendarEvents() here. 
      // Manual updates are already written to Google Calendar above in this function.
      // A full sync is unnecessarily expensive and burns quota.
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `students/${studentId}`);
    }
  };


  const updateStudentFields = async (studentId: string, fields: Partial<Student>) => {
    if (!user || quotaExceeded) return;
    try {
      const payload = cleanFirestorePayload({
        ...fields,
        updatedAt: new Date().toISOString()
      });
      
      // Update local state
      setStudents(prev => prev.map(s => s.id === studentId ? { ...s, ...fields } : s));
      if (viewingStudentProfile?.id === studentId) {
        setViewingStudentProfile(prev => prev ? { ...prev, ...fields } : null);
      }

      await setDoc(doc(db, 'users', user.uid, 'students', studentId), payload, { merge: true });
      showToast('Profile updated!', 'success');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `students/${studentId}`);
    }
  };

  const updateStudentTask = async (studentId: string, task: string | null, isDone: boolean) => {
    if (!user || quotaExceeded) return;
    try {
      const payload = cleanFirestorePayload({
        nextTask: task || '',
        isNextTaskDone: isDone,
        updatedAt: new Date().toISOString()
      });
      await setDoc(doc(db, 'users', user.uid, 'students', studentId), payload, { merge: true });
      showToast(isDone ? 'Task marked as completed!' : 'Task updated!', 'success');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `students/${studentId}`);
    }
  };

  const updateStudent = async (updatedStudent: Student) => {
    if (!user || quotaExceeded) return;
    
    // Basic validation
    if (!updatedStudent.id || !updatedStudent.name) {
      console.error('Invalid student data for update:', updatedStudent);
      showToast('Cannot update student: missing required fields', 'error');
      return;
    }

    console.log('[Firestore] Updating student payload:', JSON.stringify(updatedStudent, null, 2));

    try {
      const cleanedStudent = cleanFirestorePayload({
        ...updatedStudent,
        updatedAt: new Date().toISOString()
      });
      await setDoc(doc(db, 'users', user.uid, 'students', cleanedStudent.id), cleanedStudent);
      setStudentToEdit(null);
      showToast('Student details updated', 'success');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}/students/${updatedStudent.id}`);
    }
  };

  const deleteStudent = async (id: string) => {
    if (!user || quotaExceeded) return;
    const student = students.find(s => s.id === id);
    if (!student) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'students', id));
      setStudentToEdit(null);
      if (viewingStudentProfile?.id === id) setViewingStudentProfile(null);
      showToast(`Student ${student.name} removed`, 'success');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `students/${id}`);
    }
  };

  const addPayment = async (studentId: string, amount: number) => {
    if (!user || quotaExceeded) return;
    const student = students.find(s => s.id === studentId);
    if (!student) return;
    
    const newPayment = {
      id: crypto.randomUUID(),
      date: getThailandNow().toISOString(),
      amount: amount
    };

    try {
      const updated = cleanFirestorePayload({
        ...student,
        payments: [...student.payments, newPayment],
        updatedAt: new Date().toISOString()
      });
      await setDoc(doc(db, 'users', user.uid, 'students', studentId), updated);
      showToast('Payment added', 'success');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `students/${studentId}/payments`);
    }
  };

  const updatePayment = async (studentId: string, paymentId: string, amount: number) => {
    if (!user || quotaExceeded) return;
    const student = students.find(s => s.id === studentId);
    if (!student) return;

    try {
      const updatedPayments = student.payments.map(p => p.id === paymentId ? { ...p, amount } : p);
      const updated = cleanFirestorePayload({
        ...student,
        payments: updatedPayments,
        updatedAt: new Date().toISOString()
      });
      await setDoc(doc(db, 'users', user.uid, 'students', studentId), updated);
      showToast('Payment updated', 'success');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `students/${studentId}/payments/${paymentId}`);
    }
  };

  const deletePayment = async (studentId: string, paymentId: string) => {
    if (!user || quotaExceeded) return;
    const student = students.find(s => s.id === studentId);
    if (!student) return;

    try {
      const updatedPayments = student.payments.filter(p => p.id !== paymentId);
      const updated = cleanFirestorePayload({
        ...student,
        payments: updatedPayments,
        updatedAt: new Date().toISOString()
      });
      await setDoc(doc(db, 'users', user.uid, 'students', studentId), updated);
      showToast('Payment removed', 'success');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `students/${studentId}/payments/${paymentId}`);
    }
  };
  
  const bulkMarkAsPaid = async (studentId: string, attendanceKeys: string[]) => {
    if (!user || quotaExceeded || attendanceKeys.length === 0) return;
    const student = students.find(s => s.id === studentId);
    if (!student) return;

    try {
      const newAttendance = { ...student.attendance };
      attendanceKeys.forEach(key => {
        if (newAttendance[key]) {
          newAttendance[key] = { ...newAttendance[key], studentPaid: true };
        }
      });

      const updated = cleanFirestorePayload({
        ...student,
        attendance: newAttendance,
        updatedAt: new Date().toISOString()
      });

      await setDoc(doc(db, 'users', user.uid, 'students', studentId), updated);
      showToast(`Marked ${attendanceKeys.length} lessons as paid`, 'success');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `students/${studentId}`);
    }
  };

  const settleDebt = (student: Student, amount: number) => {
      if (amount <= 0) return;
      addPayment(student.id, amount);
      showToast(`Settled ${formatCurrency(amount)} for ${student.name}`, 'success');
  };

  // 🚀 Optimized Teacher Ledgers (O(N) instead of O(N*T))
  const teacherLedgers = useMemo(() => {
    const firstDayStrInView = days[0].dateStr;
    const ledgers: Record<string, {
      lastClassDateStr: string;
      preMonthProfit: number;
      daily: Array<{ billed: number; wage: number; profit: number; cumulative: number }>;
    }> = {};

    const teacherIds = new Set(teachers.map(t => t.id));
    teacherIds.add('default-teacher');
    teacherIds.add('preply-teacher');

    // Initialize all ledgers
    teacherIds.forEach(tId => {
      ledgers[tId] = { 
        lastClassDateStr: '', 
        preMonthProfit: 0, 
        daily: days.map(() => ({ billed: 0, wage: 0, profit: 0, cumulative: 0 })) 
      };
    });

    // Use a map for O(1) day lookup
    const dayIndexMap: Record<string, number> = {};
    days.forEach((d, idx) => dayIndexMap[d.dateStr] = idx);

    // One-pass calculation
    students.forEach(s => {
      Object.entries(s.attendance).forEach(([dateStr, entry]) => {
        if (!entry || entry.deleted) return;
        if (entry.status === 'confirmed' || !entry.status) {
          let tId = entry.teacherId || s.teacherId || 'default-teacher';
          if (tId === 'preply-teacher') tId = 'default-teacher';
          if (!ledgers[tId]) {
            ledgers[tId] = { 
              lastClassDateStr: '', 
              preMonthProfit: 0, 
              daily: days.map(() => ({ billed: 0, wage: 0, profit: 0, cumulative: 0 })) 
            };
          }

          const sRate = (s.rates[entry.type as keyof typeof s.rates] as number) || 0;
          const tWage = tId === 'default-teacher' ? 0 : (entry.wage !== undefined ? entry.wage : (s.teacherRates[entry.type as keyof typeof s.teacherRates] || 0));
          const profit = (entry.hours * sRate) - (entry.hours * tWage);

          if (dateStr < firstDayStrInView) {
            ledgers[tId].preMonthProfit += profit;
          } else {
            const dayIdx = dayIndexMap[dateStr];
            if (dayIdx !== undefined) {
              const d = ledgers[tId].daily[dayIdx];
              d.billed += entry.hours * sRate;
              d.wage += entry.hours * tWage;
              d.profit += profit;
              if (dateStr > ledgers[tId].lastClassDateStr) {
                ledgers[tId].lastClassDateStr = dateStr;
              }
            }
          }
        }
      });
    });

    // Calculate cumulative
    Object.values(ledgers).forEach(ledger => {
      let rolling = ledger.preMonthProfit;
      ledger.daily.forEach(d => {
        rolling += d.profit;
        d.cumulative = rolling;
      });
    });

    return ledgers;
  }, [students, days, teachers]);

  const groupedStudents = useMemo(() => {
    const groups: Record<string, Student[]> = {};
    const teacherIds = new Set(teachers.map(t => t.id));
    
    // Initialize groups for all known teachers
    teachers.forEach(t => groups[t.id] = []);

    // Ensure default-teacher group exists even if teacher list is empty
    if (!groups['default-teacher']) groups['default-teacher'] = [];

    students.filter(s => !s.hidden).forEach(s => {
        // Exclude Preply Sync students from the main table (Monthly Sheet)
        // per user request: "remove all students coming from preply from remi's classes"
        // and "just list the preply students names in the roster"
        if (s.groupName === 'Preply Sync') return;

        let tId = s.teacherId || 'default-teacher';
        
        // Remove Preply category, merge into default if any leftovers exist
        if (tId === 'preply-teacher') tId = 'default-teacher';

        if (!groups[tId]) groups[tId] = [];
        groups[tId].push(s);
    });

    // Sort groups: others by teacher name
    const sortedGroupIds = Object.keys(groups).sort((a, b) => {
        if (a === 'default-teacher') return -1;
        if (b === 'default-teacher') return 1;
        
        const tA = teachers.find(t => t.id === a);
        const tB = teachers.find(t => t.id === b);
        return (tA?.name || '').localeCompare(tB?.name || '');
    });

    const sortedGroups: Record<string, Student[]> = {};
    sortedGroupIds.forEach(id => {
        if (groups[id].length > 0 || id === 'default-teacher' || teacherIds.has(id)) {
            sortedGroups[id] = groups[id].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
        }
    });
    
    return sortedGroups;
  }, [students, teachers]);

  const rosterStudents = useMemo(() => {
    return [...students].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  }, [students]);

  const toggleGroup = (teacherId: string) => {
    setCollapsedGroups(prev => ({ ...prev, [teacherId]: !prev[teacherId] }));
  };


  const unhideAllStudents = async () => {
    if (!user) return;
    const hiddenStudents = students.filter(s => s.hidden);
    if (hiddenStudents.length === 0) return;

    try {
        for (const student of hiddenStudents) {
            const updated = cleanFirestorePayload({
                ...student,
                hidden: false,
                updatedAt: new Date().toISOString()
            });
            await setDoc(doc(db, 'users', user.uid, 'students', student.id), updated);
        }
        showToast(`Restored ${hiddenStudents.length} students`, 'success');
    } catch (error) {
        console.error('Failed to unhide students:', error);
        showToast('Failed to restore students', 'error');
    }
  };

  const handleExportData = () => {
    const dataToSave = { teachers, students };
    const now = getThailandNow();
    const timestamp = now.toISOString().split('.')[0] + '_' + now.toLocaleTimeString([], { hour12: false }).replace(/:/g, '-');
    const blob = new Blob([JSON.stringify(dataToSave, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); 
    a.href = url;
    a.download = `tutortrack-backup-${timestamp}.json`;
    document.body.appendChild(a); 
    a.click(); 
    document.body.removeChild(a); 
    URL.revokeObjectURL(url);
    showToast('Data exported successfully', 'success');
  };

  const hiddenCount = students.filter(s => s.hidden).length;

  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
          <span className="text-sm font-bold text-slate-500 tracking-widest uppercase">Initializing...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl max-w-md w-full text-center space-y-8 border border-slate-100 animate-in zoom-in-95 duration-300">
          <div className="bg-brand-600 w-20 h-20 rounded-3xl flex items-center justify-center text-white mx-auto shadow-xl shadow-brand-200 rotate-3 hover:rotate-0 transition-transform duration-500">
            <LayoutGrid size={40} />
          </div>
          <div className="space-y-3">
            <h1 className="text-3xl font-black text-slate-800 tracking-tight">TutorTrack Pro</h1>
            <p className="text-slate-500 text-sm font-medium leading-relaxed">
              Your professional tutoring management suite.<br/>
              Log in to access your students and schedule.
            </p>
          </div>
          
          <div className="pt-4">
            <button 
              onClick={handleLogin}
              className="w-full flex items-center justify-center gap-4 px-8 py-5 bg-slate-900 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg hover:shadow-slate-200 active:scale-[0.98] group"
            >
              <span className="bg-white p-1 rounded-md group-hover:scale-110 transition-transform flex items-center justify-center">
                <img src="https://www.google.com/favicon.ico" alt="Google" className="w-4 h-4" />
              </span>
              Login with Google
            </button>
          </div>

          <div className="pt-6 border-t border-slate-50">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Secure Cloud Sync Enabled</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans">
      {quotaExceeded && (
        <div className="bg-red-600 text-white px-4 py-3 text-center text-[10px] font-bold uppercase tracking-widest relative z-[101] flex items-center justify-center gap-6">
          <div className="flex items-center gap-2">
            <Wifi size={14} className="animate-pulse" />
            <span>Firestore Daily Quota Exceeded. Automatic syncing is paused.</span>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setQuotaExceeded(false)} className="px-3 py-1 bg-white/20 rounded hover:bg-white/30 transition-colors">Dismiss</button>
            <button onClick={() => window.location.reload()} className="px-3 py-1 bg-white text-red-600 rounded hover:bg-slate-100 transition-colors">Retry Connection</button>
          </div>
        </div>
      )}
      {toast && (
        <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-2 px-4 py-3 rounded-lg shadow-xl animate-in slide-in-from-top-4 fade-in duration-300 ${
          toast.type === 'success' ? 'bg-slate-800 text-emerald-400' : 'bg-red-50 text-red-600 border border-red-200'
        }`}>
          {toast.type === 'success' ? <CheckCircle size={18} /> : <XCircle size={18} />}
          <span className={`text-sm font-medium ${toast.type === 'success' ? 'text-white' : ''}`}>{toast.msg}</span>
        </div>
      )}

      <header className="bg-white border-b border-slate-100 sticky top-0 z-50 shadow-sm print:hidden">
        <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => setViewingStudentProfile(null)} className="bg-brand-600 p-2 rounded-lg text-white shadow-brand-200 shadow-md hover:bg-brand-700 transition-colors">
              <LayoutGrid size={24} />
            </button>
            <h1 className="text-xl font-bold text-slate-800 hidden sm:block tracking-tight">TutorTrack Pro</h1>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 shadow-inner">
              <button
                onClick={() => {
                  setActiveMainTab('roster');
                  setViewingStudentProfile(null);
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeMainTab === 'roster' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                title="Priority Student Roster"
              >
                <LayoutGrid size={14} /> Roster
              </button>
              <button
                onClick={() => {
                  setActiveMainTab('calendar');
                  setViewingStudentProfile(null);
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeMainTab === 'calendar' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                title="Lesson Calendar"
              >
                <CalendarIcon size={14} /> Calendar
              </button>
              <button
                onClick={() => setActiveMainTab('workspace')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeMainTab === 'workspace' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                title="Notes & Tasks"
              >
                <div className="relative">
                  <AlertCircle size={14} />
                  {tasksToday.some(t => !t.isDone) && <span className="absolute -top-1 -right-1 w-2 h-2 bg-orange-500 rounded-full animate-pulse" />}
                </div>
                Workspace
              </button>
            </div>
            
            {activeMainTab === 'calendar' && (
              <div className={`flex items-center bg-slate-50 rounded-lg p-1 border border-slate-100 shadow-inner ${viewingStudentProfile ? 'invisible' : ''}`}>
                <button 
                  onClick={goToToday} 
                  className="px-2 py-1 text-[9px] font-black uppercase text-brand-600 hover:bg-white hover:shadow-sm rounded-md transition-all mr-1"
                  title="Go to Today"
                >
                  Today
                </button>
                <div className="flex border-l border-slate-200 pl-1">
                  <button onClick={() => changeMonth(-1)} className="p-2 hover:bg-white hover:shadow-sm rounded-md transition-all text-slate-500 hover:text-slate-800"><ChevronLeft size={20} /></button>
                  <span className="w-36 text-center font-bold text-slate-700 select-none text-sm self-center">{getMonthName(currentDate)}</span>
                  <button onClick={() => changeMonth(1)} className="p-2 hover:bg-white hover:shadow-sm rounded-md transition-all text-slate-500 hover:text-slate-800"><ChevronRight size={20} /></button>
                </div>
            </div>
          )}
        </div>

          <div className="flex items-center gap-3">
             <div className="flex flex-col items-end border-r border-slate-100 pr-3 mr-1">
                 <div className="flex items-center gap-1">
                    <button onClick={handleExportData} className="p-2 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors" title="Backup Data"><Download size={18} /></button>
                    <button onClick={() => fileInputRef.current?.click()} className="p-2 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors" title="Restore Data"><Upload size={18} /></button>
                    <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file || !user) return;
                        const reader = new FileReader();
                        reader.onload = async (event) => {
                            try {
                                const parsed = JSON.parse(event.target?.result as string);
                                if (parsed.teachers && parsed.students) {
                                    // Persist to Firestore
                                    for (const t of parsed.teachers) {
                                        await setDoc(doc(db, 'users', user.uid, 'teachers', t.id), cleanFirestorePayload(t), { merge: true });
                                    }
                                    for (const s of parsed.students) {
                                        await setDoc(doc(db, 'users', user.uid, 'students', s.id), cleanFirestorePayload(s), { merge: true });
                                    }
                                    showToast('Data restored and synced to cloud', 'success');
                                } else showToast('Invalid format', 'error');
                            } catch { showToast('Error parsing', 'error'); }
                        };
                        reader.readAsText(file); e.target.value = '';
                    }} />
                 </div>
             </div>
             
             <button onClick={() => setIsVisibilityModalOpen(true)} className={`p-2 rounded-lg transition-all relative ${hiddenCount > 0 ? 'bg-amber-50 text-amber-600 border border-amber-200' : 'text-slate-400 hover:bg-slate-50'}`} title="Manage Student Visibility">
                <Eye size={20} />
                {hiddenCount > 0 && <span className="absolute -top-1 -right-1 bg-amber-600 text-white text-[8px] font-bold w-4 h-4 rounded-full flex items-center justify-center border border-white">{hiddenCount}</span>}
             </button>
             <button onClick={() => setIsManageTeachersOpen(true)} className="p-2 text-slate-400 hover:bg-slate-50 rounded-lg transition-all" title="Manage Teachers"><Users size={20} /></button>
             <ReceiptUpload students={students} onVerified={handleReceiptVerified} />
             <button onClick={() => setIsAIChatOpen(true)} className="hidden md:flex items-center gap-2 px-3 py-2 text-sm font-semibold text-brand-700 bg-brand-50 border border-brand-200 rounded-lg hover:bg-brand-100 transition-all">
                <Sparkles size={16} /> <span className="hidden lg:inline">AI Assistant</span>
             </button>
             {/* Auth & Sync Buttons */}
             {!user ? (
               <button 
                  onClick={handleLogin} 
                  className="flex items-center gap-2 px-3 py-2 text-sm font-semibold rounded-lg transition-all text-slate-700 bg-slate-50 border border-slate-200 hover:bg-slate-100"
               >
                  <User size={16} /> 
                  <span className="hidden lg:inline">Login with Google</span>
               </button>
             ) : (
               <div className="flex items-center gap-2">
                 <div className="flex items-center gap-2 px-2 py-1 bg-slate-50 rounded-lg border border-slate-100">
                   <img src={user.photoURL || ''} alt={user.displayName || ''} className="w-6 h-6 rounded-full" referrerPolicy="no-referrer" />
                   <span className="text-xs font-bold text-slate-600 hidden xl:inline">{user.displayName?.split(' ')[0]}</span>
                   <button 
                     onClick={handleLogout}
                     className="ml-1 p-1 text-slate-400 hover:text-red-500 transition-colors"
                     title="Logout"
                   >
                     <X size={14} />
                   </button>
                 </div>
                 <button 
                    onClick={() => {
                        if (isGoogleAuthenticated && tutorTrackCalendarId) {
                            handleLogoutGoogle();
                        } else {
                            handleConnectGoogleCalendar();
                        }
                     }} 
                    disabled={isSyncing}
                    className={`flex items-center gap-2 px-3 py-2 text-sm font-semibold rounded-lg transition-all ${
                        isGoogleAuthenticated 
                            ? (tutorTrackCalendarId ? 'text-indigo-700 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100' : 'text-amber-700 bg-amber-50 border border-amber-200 hover:bg-amber-100')
                            : 'text-slate-700 bg-slate-50 border border-slate-200 hover:bg-slate-100'
                    }`}
                 >
                    <CalendarIcon size={16} className={isSyncing ? 'animate-spin' : ''} /> 
                    <span className="hidden lg:inline">
                        {isSyncing ? 'Syncing...' : isGoogleAuthenticated ? (tutorTrackCalendarId ? 'Google Connected' : 'Setup Calendar') : 'Connect Google Calendar'}
                    </span>
                 </button>
               </div>
             )}
             {isGoogleAuthenticated && (
               <button 
                  onClick={handleSyncAllToGoogle} 
                  disabled={isSyncing}
                  className={`hidden md:flex items-center gap-2 px-3 py-2 text-sm font-semibold rounded-lg transition-all text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100`}
               >
                  <RefreshCw size={16} className={isSyncing ? 'animate-spin' : ''} /> 
                  <span className="hidden lg:inline">Sync All</span>
               </button>
             )}
            <button onClick={() => setIsAddModalOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg transition-all font-medium shadow-md">
              <Plus size={18} /> <span className="hidden sm:inline">Add Student</span>
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <main className="flex-1 flex flex-col overflow-hidden">
          {viewingStudentProfile ? (
            <StudentProfile 
              student={viewingStudentProfile} 
              allStudents={students}
              onBack={() => setViewingStudentProfile(null)}
              onUpdateFields={updateStudentFields}
              onShowBill={setStudentForBill}
            />
          ) : activeMainTab === 'workspace' && user ? (
            <WorkspaceView 
              userId={user.uid}
              pinnedNote={pinnedNote}
              pinnedNoteUpdatedAt={pinnedNoteUpdatedAt}
              onUpdatePinnedNote={updatePinnedNote}
              preplyNote={preplyNote}
              preplyNoteUpdatedAt={preplyNoteUpdatedAt}
              onUpdatePreplyNote={updatePreplyNote}
            />
          ) : activeMainTab === 'roster' && user ? (
            <StudentRoster 
                students={students}
                externalEvents={externalEvents}
                onViewStudent={setViewingStudentProfile}
                onUpdateFields={updateStudentFields}
                onImportEvent={(event) => importFromGoogle([event])}
            />
          ) : activeMainTab === 'calendar' && user ? (
             <div className="flex-1 flex flex-col overflow-hidden">
                <div className="flex-1 overflow-y-auto pb-20">
                   <div className="p-4 sm:p-6 lg:p-8">
                     <div className="bg-white rounded-xl shadow-lg border border-slate-100 flex flex-col overflow-hidden mb-8">
                        <div ref={scrollContainerRef} onMouseDown={handleMouseDown} onMouseLeave={handleMouseLeave} onMouseUp={handleMouseUp} onMouseMove={handleMouseMove} className={`overflow-x-auto relative custom-scrollbar select-none ${isCursorGrabbing ? 'cursor-grabbing' : 'cursor-grab'}`}>
                            <table className="w-full border-collapse min-w-max">
                               <thead className="sticky top-0 z-40 bg-slate-100 border-b border-slate-200">
                                  <tr className="h-16">
                                     <th className="sticky left-0 z-50 bg-slate-100 p-4 text-left min-w-[240px] border-r border-slate-200 shadow-[2px_0_6px_-2px_rgba(0,0,0,0.03)]"><span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest">Student Information</span></th>
                                     {days.map((day) => (
                                        <th key={day.dateStr} onClick={() => setHighlightedDateStr(day.dateStr)} className={`p-1 min-w-[48px] text-center border-r border-slate-200 transition-all cursor-pointer group/th ${day.isToday ? 'bg-sky-50 is-today-cell shadow-[inset_0_-2px_0_0_#0ea5e9]' : day.isHighlighted ? 'bg-slate-100' : 'bg-white hover:bg-slate-50'}`}>
                                           <div className="flex flex-col items-center justify-center h-full">
                                              <span className={`text-[9px] font-bold uppercase mb-1 ${day.isToday ? 'text-sky-600' : 'text-slate-400'}`}>{day.dayName}</span>
                                              <span className={`text-xs font-bold w-7 h-7 flex items-center justify-center rounded-full transition-colors ${day.isToday ? 'bg-sky-600 text-white shadow-sky-200 shadow-lg' : 'text-slate-700'}`}>{day.dayNum}</span>
                                           </div>
                                        </th>
                                     ))}
                                     <th className="sticky right-0 z-50 bg-slate-100 p-0 min-w-[320px] border-l border-slate-200 shadow-[-2px_0_6px_-2px_rgba(0,0,0,0.03)]">
                                        <div className="grid grid-cols-3 h-full divide-x divide-slate-200 items-stretch">
                                           <div className="flex items-center justify-center px-2 py-4 text-[9px] font-black uppercase text-slate-400 leading-tight text-center">Hours<br/>Month</div>
                                           <div className="flex items-center justify-center px-2 py-4 text-[9px] font-black uppercase text-slate-400 leading-tight text-center">Hours<br/>Total</div>
                                           <div className="flex items-center justify-center px-2 py-4 text-[9px] font-black uppercase text-slate-400 leading-tight text-center">Hours<br/>Left</div>
                                        </div>
                                     </th>
                                  </tr>
                               </thead>
                               <tbody className="divide-y divide-slate-100">
                                  {Object.entries(groupedStudents).map(([teacherId, groupStudents]) => {
                                     if (groupStudents.length === 0 && teacherId !== 'default-teacher') return null;
                                     const teacherFound = teachers.find(t => t.id === teacherId);
                                     const teacher = teacherFound || { 
                                       id: teacherId, 
                                       name: teacherId === 'default-teacher' ? 'Rémi' : teacherId, 
                                       color: '#94a3b8' 
                                     };
                                     const isCollapsed = collapsedGroups[teacherId];
                                     const ledger = teacherLedgers[teacherId];

                                     return (
                                        <React.Fragment key={teacher.id}>
                                           <tr onClick={() => toggleGroup(teacherId)} className="bg-slate-50/50 border-y border-slate-100 cursor-pointer hover:bg-slate-100 transition-colors group/header">
                                              <td className="sticky left-0 z-20 bg-slate-50 p-3 border-r border-slate-100 group-hover/header:bg-slate-100">
                                                 <div className="flex items-center gap-3">
                                                    <div className={`transition-transform duration-200 ${isCollapsed ? '-rotate-90' : ''}`}><ChevronDown size={16} className="text-slate-400" /></div>
                                                    <div className="w-7 h-7 rounded-lg bg-slate-700 text-white flex items-center justify-center font-bold text-[10px]">{teacher.name.charAt(0)}</div>
                                                    <div className="flex-1">
                                                       <h3 className="font-extrabold text-slate-700 text-xs tracking-tight">{teacher.name}'s Classes</h3>
                                                       <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{groupStudents.length} Students Active</p>
                                                    </div>
                                                 </div>
                                              </td>
                                              <td colSpan={days.length + 1} className="bg-slate-50/20"></td>
                                           </tr>
                                           {!isCollapsed && (
                                             <>
                                               {groupStudents.map(student => (
                                                   <StudentRow 
                                                     key={student.id} 
                                                     student={student} 
                                                     allStudents={students} 
                                                     days={days} 
                                                     currentDate={currentDate} 
                                                     teachers={teachers} 
                                                     onUpdateAttendance={updateAttendance} 
                                                     onOpenPaymentModal={setSelectedStudentForPayment} 
                                                     onEditStudent={setStudentToEdit} 
                                                     onViewStudent={setViewingStudentProfile} 
                                                     onSettleDebt={settleDebt} 
                                                     onToggleVisibility={toggleStudentVisibility}
                                                     onUpdateStudent={updateStudent}
                                                     onUpdateStudentTask={updateStudentTask}
                                                     onDeleteStudent={deleteStudent}
                                                     onShowBill={setStudentForBill}
                                                   />
                                               ))}
                                               
                                               <tr className="bg-slate-50/80 border-t border-slate-200 select-text">
                                                 <td className="sticky left-0 z-20 bg-slate-50 p-2 pl-8 border-r border-slate-100">
                                                   <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><BarChart3 size={10} className="text-sky-500"/> Student Billed</span>
                                                 </td>
                                                 {days.map((day, idx) => {
                                                   const data = ledger?.daily?.[idx];
                                                   const shouldShow = ledger && day.dateStr <= ledger.lastClassDateStr;
                                                   return (
                                                     <td key={idx} className={`text-center p-1.5 text-[9px] font-bold text-sky-600 border-r border-slate-100 ${day.isHighlighted ? 'bg-brand-50' : ''}`}>
                                                       {shouldShow && data && data.billed > 0 ? formatCurrency(data.billed).replace('THB', '') : '-'}
                                                     </td>
                                                   );
                                                 })}
                                                 <td className="sticky right-0 z-20 bg-slate-50 border-l border-slate-200 p-2 text-right">
                                                   <span className="text-[10px] font-black text-sky-700">{ledger ? formatCurrency(ledger.daily.reduce((sum, d) => sum + d.billed, 0)) : '-'}</span>
                                                 </td>
                                               </tr>

                                               {teacher.id !== 'default-teacher' && (
                                                 <tr className="bg-slate-50/80 border-t border-slate-100 select-text">
                                                 <td className="sticky left-0 z-20 bg-slate-50 p-2 pl-8 border-r border-slate-100">
                                                   <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><GraduationCap size={10} className="text-red-500"/> Teacher Wage</span>
                                                 </td>
                                                 {days.map((day, idx) => {
                                                   const data = ledger?.daily?.[idx];
                                                   const shouldShow = ledger && day.dateStr <= ledger.lastClassDateStr;
                                                   return (
                                                     <td key={idx} className={`text-center p-1.5 text-[9px] font-bold text-red-500 border-r border-slate-100 ${day.isHighlighted ? 'bg-brand-50' : ''}`}>
                                                       {shouldShow && data && data.wage > 0 ? formatCurrency(data.wage).replace('THB', '') : '-'}
                                                     </td>
                                                   );
                                                 })}
                                                 <td className="sticky right-0 z-20 bg-slate-50 border-l border-slate-200 p-2 text-right">
                                                   <span className="text-[10px] font-black text-red-700">{ledger ? formatCurrency(ledger.daily.reduce((sum, d) => sum + d.wage, 0)) : '-'}</span>
                                                 </td>
                                               </tr>
                                             )}
                                           </>
                                         )}
                                      </React.Fragment>
                                   );
                                })}
                             </tbody>
                          </table>
                        </div>
                     </div>
                   </div>
                </div>
             </div>
          ) : (
            <StudentRoster 
                students={students}
                onViewStudent={setViewingStudentProfile}
                onUpdateFields={updateStudentFields}
            />
          )}

        {/* Daily Planning Section */}

        {/* Daily Planning Section */}
        {!viewingStudentProfile && (
            <div className="max-w-[1600px] mx-auto px-4 sm:px-8 pb-20">
              <DailySchedule students={students} teachers={teachers} externalEvents={externalEvents} />
            </div>
        )}
      </main>
    </div>

      {/* Visibility Modal */}
      <Modal 
        isOpen={isVisibilityModalOpen} 
        onClose={() => setIsVisibilityModalOpen(false)} 
        maxWidth="max-w-lg"
      >
          <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><Eye size={18} className="text-brand-600"/> Student Visibility</h2>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Hide or show students in the monthly sheet</p>
              </div>
              <div className="flex items-center gap-2">
                {hiddenCount > 0 && (
                    <button 
                        onClick={unhideAllStudents}
                        className="px-3 py-1.5 bg-brand-50 text-brand-700 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-brand-100 transition-colors"
                    >
                        Unhide All
                    </button>
                )}
                <button onClick={() => setIsVisibilityModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full text-slate-500"><X size={20} /></button>
              </div>
          </div>
          <div className="p-4 border-b border-slate-100 bg-white">
              <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input type="text" placeholder="Search by name..." value={visibilitySearch} onChange={e => setVisibilitySearch(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500 text-sm font-medium" />
              </div>
          </div>
          <div className="p-4 overflow-y-auto space-y-2 flex-1 max-h-[60vh]">
              {rosterStudents.filter(student => student.name.toLowerCase().includes(visibilitySearch.toLowerCase())).map(student => (
                    <div key={student.id} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors">
                        <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                                student.hidden 
                                  ? 'bg-slate-200 text-slate-400' 
                                  : student.groupName === 'Preply Sync'
                                    ? 'bg-pink-100 text-pink-700'
                                    : 'bg-brand-100 text-brand-700'
                            }`}>{student.name.replace(/^[- \s.·]+/, '').charAt(0)}</div>
                            <div className="flex flex-col">
                                <span className={`font-bold text-sm ${
                                    student.hidden 
                                      ? 'text-slate-400' 
                                      : student.groupName === 'Preply Sync'
                                        ? 'text-pink-600'
                                        : 'text-slate-700'
                                }`}>{student.name.replace(/^[- \s.·]+/, '')}</span>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{teachers.find(t => t.id === student.teacherId)?.name || 'Default'}</span>
                            </div>
                        </div>
                        <button onClick={() => toggleStudentVisibility(student.id)} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors outline-none ${student.hidden ? 'bg-slate-300' : 'bg-brand-600'}`}>
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${student.hidden ? 'translate-x-1' : 'translate-x-6'}`} />
                        </button>
                    </div>
              ))}
              {students.length === 0 && <p className="text-center py-8 text-slate-400 italic">No students yet.</p>}
          </div>
          <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-center">
              <button onClick={() => setIsVisibilityModalOpen(false)} className="px-6 py-2 bg-slate-800 text-white rounded-xl font-bold text-sm shadow-md hover:bg-slate-700 transition-all uppercase tracking-widest">Done</button>
          </div>
      </Modal>

      {/* Management Modals */}
      <Modal
        isOpen={isManageTeachersOpen}
        onClose={() => setIsManageTeachersOpen(false)}
        maxWidth="max-w-md"
      >
          <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><Settings size={18} className="text-brand-600"/> Manage Teachers</h2>
              <button onClick={() => setIsManageTeachersOpen(false)} className="p-2 hover:bg-slate-200 rounded-full text-slate-500"><X size={20} /></button>
          </div>
          <div className="p-6 overflow-y-auto space-y-4 max-h-[60vh]">
              <div className="space-y-2">
                  {teachers.map(t => (
                      <div key={t.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 group">
                          <span className="font-bold text-slate-700 flex items-center gap-2">{t.id === 'default-teacher' ? <User size={14} className="text-brand-500"/> : <Briefcase size={14} className="text-slate-400"/>}{t.name}</span>
                          {t.id !== 'default-teacher' && (
                              <div className="flex items-center gap-1">
                                  {teacherToDelete === t.id ? (
                                      <div className="flex items-center gap-1 animate-in slide-in-from-right-2">
                                          <button onClick={() => { deleteTeacher(t.id); setTeacherToDelete(null); }} className="px-2 py-1 bg-red-600 text-white text-[9px] font-black rounded-md uppercase">Confirm</button>
                                          <button onClick={() => setTeacherToDelete(null)} className="px-2 py-1 bg-white text-slate-400 text-[9px] font-black rounded-md uppercase border border-slate-200">No</button>
                                      </div>
                                  ) : (
                                      <button onClick={() => setTeacherToDelete(t.id)} className="text-slate-300 hover:text-red-500 p-1 transition-colors"><Trash2 size={16}/></button>
                                  )}
                              </div>
                          )}
                      </div>
                  ))}
              </div>
              <button onClick={() => setIsAddTeacherModalOpen(true)} className="w-full py-3 border-2 border-dashed border-slate-100 rounded-xl text-slate-400 hover:text-brand-600 hover:border-brand-200 transition-all font-bold text-sm flex items-center justify-center gap-2"><Plus size={18} /> Add Teacher</button>

              <div className="pt-4 border-t border-slate-100">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Maintenance</h3>
                  <button 
                    onClick={handleManualCleanup}
                    disabled={isSyncing}
                    className="w-full py-3 bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 hover:border-brand-200 hover:text-brand-600 transition-all font-bold text-sm flex items-center justify-center gap-2"
                  >
                    <RefreshCw size={18} className={isSyncing ? 'animate-spin' : ''} /> 
                    {isSyncing ? 'Processing...' : 'Deduplicate & Merge Students'}
                  </button>
                  <p className="mt-2 text-[9px] text-slate-400 text-center italic">Finds and merges students with similar names, combining their history.</p>
                  
                  <div className="mt-6 pt-4 border-t border-slate-100">
                      <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Calendar Troubleshooting</h3>
                      <div className="flex gap-2">
                        <input 
                          type="text"
                          value={eventIdToDelete}
                          onChange={(e) => setEventIdToDelete(e.target.value)}
                          placeholder="Google Event ID"
                          className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono"
                        />
                        <button 
                          onClick={handleDeleteEventById}
                          disabled={isSyncing || !eventIdToDelete}
                          className="px-4 py-2 bg-red-50 text-red-600 border border-red-100 rounded-lg text-xs font-bold hover:bg-red-600 hover:text-white transition-all disabled:opacity-50"
                        >
                          Delete
                        </button>
                      </div>
                      <p className="mt-2 text-[9px] text-slate-400 italic">Caution: This will permanently remove the event from Google Calendar by its raw ID.</p>
                  </div>
              </div>
          </div>
      </Modal>

      <Modal
        isOpen={isAddTeacherModalOpen}
        onClose={() => setIsAddTeacherModalOpen(false)}
        maxWidth="max-w-sm"
      >
           <div className="p-6">
                <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2"><UserPlus size={20} className="text-brand-600"/> Add Teacher</h2>
                <form onSubmit={addTeacher}>
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                        <input type="text" autoFocus required value={newTeacherName} onChange={(e) => setNewTeacherName(e.target.value)} className="w-full px-4 py-2.5 border border-slate-300 rounded-xl outline-none shadow-sm focus:ring-2 focus:ring-brand-500" placeholder="Teacher Name" />
                    </div>
                    <div className="flex gap-3">
                        <button type="button" onClick={() => setIsAddTeacherModalOpen(false)} className="flex-1 px-4 py-2 text-slate-400 font-bold text-xs uppercase">Cancel</button>
                        <button type="submit" className="flex-1 px-4 py-2.5 bg-brand-600 text-white rounded-xl font-bold shadow-md hover:bg-brand-700 transition-colors">Add Teacher</button>
                    </div>
                </form>
           </div>
      </Modal>

      {/* Add Student Modal */}
      <Modal 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)} 
        maxWidth="max-w-md"
      >
        <div className="p-6">
          <h2 className="text-2xl font-bold text-slate-800 mb-6">Create New Student</h2>
          <form onSubmit={addStudent} noValidate className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Student Identity</label>
              <input autoFocus type="text" required value={newStudentName} onChange={e => setNewStudentName(e.target.value)} className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none font-medium" placeholder="Full Student Name" />
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-1"><GraduationCap size={14}/> Primary Teacher</label>
                  <select value={selectedInitialTeacherId} onChange={e => setSelectedInitialTeacherId(e.target.value)} className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none font-medium bg-slate-50">
                      {teachers.map(t => (
                          <option key={t.id} value={t.id}>{t.name} {t.id === 'default-teacher' ? '(Me)' : ''}</option>
                      ))}
                  </select>
                </div>
            </div>
            <div className="space-y-4">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest text-center">Initial Pricing & Teacher Wages (THB)</label>
                <div className="grid grid-cols-1 gap-2">
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <div className="flex items-center gap-2 mb-2"><input type="checkbox" checked={enableOnline} onChange={e => setEnableOnline(e.target.checked)} /><Wifi size={14}/><span className="text-[10px] font-bold">ONLINE</span></div>
                      <div className={`grid grid-cols-2 gap-2 ${!enableOnline && 'opacity-50'}`}>
                        <div>
                           <span className="text-[9px] text-slate-400 font-bold block ml-1 uppercase">Student Pays</span>
                           <input type="number" disabled={!enableOnline} value={rateOnline} onChange={e => setRateOnline(e.target.value)} className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded-lg outline-none" placeholder="0" />
                        </div>
                        {selectedInitialTeacherId !== 'default-teacher' && (
                          <div>
                             <span className="text-[9px] text-emerald-500 font-bold block ml-1 uppercase">Teacher Wage</span>
                             <input type="number" disabled={!enableOnline} value={twOnline} onChange={e => setTwOnline(e.target.value)} className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded-lg text-emerald-600 outline-none" placeholder="0" />
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <div className="flex items-center gap-2 mb-2"><input type="checkbox" checked={enableOnsite} onChange={e => setEnableOnsite(e.target.checked)} /><Building2 size={14}/><span className="text-[10px] font-bold">FACE-TO-FACE</span></div>
                      <div className={`grid grid-cols-2 gap-2 ${!enableOnsite && 'opacity-50'}`}>
                        <div>
                           <span className="text-[9px] text-slate-400 font-bold block ml-1 uppercase">Student Pays</span>
                           <input type="number" disabled={!enableOnsite} value={rateOnsite} onChange={e => setRateOnsite(e.target.value)} className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded-lg outline-none" placeholder="0" />
                        </div>
                        {selectedInitialTeacherId !== 'default-teacher' && (
                          <div>
                             <span className="text-[9px] text-emerald-500 font-bold block ml-1 uppercase">Teacher Wage</span>
                             <input type="number" disabled={!enableOnsite} value={twOnsite} onChange={e => setTwOnsite(e.target.value)} className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded-lg text-emerald-600 outline-none" placeholder="0" />
                          </div>
                        )}
                      </div>
                    </div>
                </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Initial Credit</label>
                  <input type="number" value={newStudentCredit} onChange={e => setNewStudentCredit(e.target.value)} className="w-full px-4 py-2.5 border border-slate-300 rounded-xl outline-none font-bold" placeholder="0" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-1"><Users size={14}/> Wallet Group</label>
                  <input type="text" list="group-list" value={newStudentGroupName} onChange={e => setNewStudentGroupName(e.target.value)} className="w-full px-4 py-2.5 border border-slate-300 rounded-xl outline-none font-medium" placeholder="Optional" />
                  <datalist id="group-list">{existingGroups.map(g => (<option key={g} value={g} />))}</datalist>
                </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Resources / Exams / Books</label>
              <div className="grid grid-cols-1 gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
                {/* Predefined books */}
                {AVAILABLE_BOOKS.map(book => (
                  <label key={book} className="flex items-center gap-3 p-1 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer group">
                    <input 
                      type="checkbox" 
                      checked={newStudentBooks.includes(book)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setNewStudentBooks(prev => [...prev, book]);
                        } else {
                          setNewStudentBooks(prev => prev.filter(b => b !== book));
                        }
                      }}
                      className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                    />
                    <span className="text-xs font-bold text-slate-700 group-hover:text-brand-700">{book}</span>
                  </label>
                ))}

                {/* Custom materials already added to this new student */}
                {newStudentBooks.filter(b => !AVAILABLE_BOOKS.includes(b)).map(book => (
                  <label key={book} className="flex items-center gap-3 p-1 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer group">
                    <input 
                      type="checkbox" 
                      checked={true}
                      onChange={() => setNewStudentBooks(prev => prev.filter(b => b !== book))}
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
                          if (val && !newStudentBooks.includes(val)) {
                            setNewStudentBooks(prev => [...prev, val]);
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
                value={newStudentTimezone} 
                onChange={e => setNewStudentTimezone(e.target.value)} 
                className="w-full px-4 py-2.5 border border-slate-300 rounded-xl outline-none font-medium bg-slate-50"
              >
                {TIMEZONES.map(tz => (
                  <option key={tz.value} value={tz.value}>{tz.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Student Email</label>
              <input 
                type="email" 
                value={newStudentEmail} 
                onChange={e => setNewStudentEmail(e.target.value)} 
                className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none font-medium" 
                placeholder="student@example.com (for calendar sync)" 
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-red-500 uppercase mb-2 flex items-center gap-1 animate-pulse">ALERT / CRUCIAL INFO (FLASHING)</label>
              <input 
                type="text" 
                value={newStudentAlertText} 
                onChange={e => setNewStudentAlertText(e.target.value)} 
                className="w-full px-4 py-2.5 border-2 border-red-100 rounded-xl outline-none font-bold text-red-600 bg-red-50/30" 
                placeholder="e.g. Needs homework check, unpaid invoice..." 
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Student Details / Notes</label>
              <textarea 
                value={newStudentNotes} 
                onChange={e => setNewStudentNotes(e.target.value)} 
                className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none font-medium min-h-[80px] resize-none" 
                placeholder="Any specific details about this student..."
              />
            </div>
            <div className="flex gap-4 pt-6">
              <button type="button" onClick={() => setIsAddModalOpen(false)} className="flex-1 px-4 py-3 text-slate-400 font-bold uppercase text-xs">Cancel</button>
              <button type="submit" className="flex-1 px-4 py-3 bg-slate-900 text-white rounded-xl font-bold shadow-lg hover:bg-slate-800">Save Student</button>
            </div>
          </form>
        </div>
      </Modal>

      {studentToEdit && (
        <EditStudentModal 
          key={studentToEdit.id} 
          student={studentToEdit} 
          teachers={teachers}
          existingGroups={existingGroups}
          isOpen={!!studentToEdit} 
          onClose={() => setStudentToEdit(null)} 
          onSave={updateStudent} 
          onDelete={deleteStudent}
        />
      )}

      {studentForBill && (
        <MonthlyBillModal
          isOpen={!!studentForBill}
          onClose={() => setStudentForBill(null)}
          student={studentForBill}
          monthDate={currentDate}
          onBulkMarkAsPaid={bulkMarkAsPaid}
        />
      )}
      
      {selectedStudentForPayment && <PaymentModal student={selectedStudentForPayment} allStudents={students} isOpen={!!selectedStudentForPayment} onClose={() => setSelectedStudentForPayment(null)} onAddPayment={addPayment} onUpdatePayment={updatePayment} onDeletePayment={deletePayment} />}
      <AIChat 
        isOpen={isAIChatOpen} 
        onClose={() => setIsAIChatOpen(false)} 
        students={students} 
        teachers={teachers} 
        onUpdateData={handleAIAction} 
      />

      {quotaExceeded && (
        <div className="bg-red-600 text-white px-4 py-2 text-center text-xs font-bold fixed top-0 left-0 right-0 z-[200] flex items-center justify-center gap-4">
          <span>DAILY DATABASE QUOTA REACHED. CHANGES WILL NOT SAVE UNTIL TOMORROW.</span>
          <button onClick={() => setQuotaExceeded(false)} className="underline opacity-80 hover:opacity-100">Dismiss</button>
        </div>
      )}
    </div>
  );
};
