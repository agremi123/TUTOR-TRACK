
export type ClassType = 'online' | 'onsite' | 'home';
export type AttendanceStatus = 'confirmed' | 'planned';

export interface Attachment {
  id: string;
  name: string;
  data: string; // Base64 string
  mimeType: string;
  date: string;
}

export interface AttendanceEntry {
  hours: number;
  type: ClassType;
  status?: AttendanceStatus;
  summary?: string;
  nextGoal?: string;
  teacherPaid?: boolean;
  studentPaid?: boolean;
  teacherId?: string;
  wage?: number;
  startTime?: string; // e.g., "14:00"
  googleEventId?: string;
  googleCalendarId?: string;
  googleUpdatedAt?: string;
  source?: 'app' | 'google' | 'preply';
  deleted?: boolean;
  attachments?: Attachment[];
}

export interface AttendanceRecord {
  [date: string]: AttendanceEntry;
}

export interface Rates {
  online: number | null;
  onsite: number | null;
  home: number | null;
}

export interface Payment {
  id: string;
  date: string;
  amount: number;
  note?: string;
}

export interface Teacher {
  id: string;
  name: string;
  defaultWage?: number;
}

export interface Student {
  id: string;
  teacherId: string;
  name: string;
  rates: Rates;
  teacherRates: Rates;
  teacherHourlyRate?: number;
  defaultHours: number;
  payments: Payment[];
  attendance: AttendanceRecord;
  notes?: string;
  groupName?: string;
  documents?: Attachment[];
  hidden?: boolean;
  suggestedDays?: string[]; // Array of date strings (YYYY-MM-DD)
  nextTask?: string;
  isNextTaskDone?: boolean;
  books?: string[];
  isPrepared?: boolean;
  timezone?: string;
  email?: string;
  alertText?: string;
  studentType?: string;
  likesExpectations?: string;
  dislikes?: string;
  pastLesson?: string;
  nextLesson?: string;
  needsHomework?: boolean;
  needsPrep?: boolean;
  needsMaterial?: boolean;
  isExamPrep?: boolean;
  isPaymentPending?: boolean;
}

export interface AppState {
  students: Student[];
  currentDate: Date;
}

export interface DayInfo {
  date: Date;
  dateStr: string;
  dayNum: number;
  dayName: string;
  isWeekend: boolean;
  isToday: boolean;
  isTomorrow: boolean;
  isHighlighted: boolean;
}

export interface ExternalEvent {
  id: string;
  summary: string;
  calendarId?: string;
  updated?: string;
  organizer?: {
    email?: string;
    displayName?: string;
  };
  start: {
    dateTime?: string;
    date?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
  };
  location?: string;
  description?: string;
  colorId?: string;
}

export interface GoogleCalendar {
  id: string;
  summary: string;
  primary?: boolean;
  accessRole: string;
}

export interface Task {
  id: string;
  text: string;
  isDone: boolean;
  priority?: 'urgent' | 'normal';
  createdAt: number;
}

export interface UserSettings {
  tutorTrackCalendarId?: string;
  googleEmail?: string;
  pinnedNote?: string;
  pinnedNoteUpdatedAt?: string;
  preplyNote?: string;
  preplyNoteUpdatedAt?: string;
  tasksToday?: Task[];
  tasksTomorrow?: Task[];
  tasksLater?: Task[];
  ongoingProjects?: Project[];
  recurringTaskTemplates?: string[];
  lastChecklistReset?: string;
}

export interface Project {
  id: string;
  title: string;
  description: string;
  status: 'active' | 'on-hold' | 'completed';
  urgency?: number;
  createdAt: number;
}
