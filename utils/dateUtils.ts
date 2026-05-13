
import { DayInfo } from '../types';

/**
 * Gets the current date/time adjusted to Thailand (Asia/Bangkok) timezone.
 */
export const getThailandNow = (): Date => {
  const now = new Date();
  // Create a formatter for Thailand timezone
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false
  });
  
  const parts = formatter.formatToParts(now);
  const partValues: { [key: string]: string } = {};
  parts.forEach(p => partValues[p.type] = p.value);
  
  // Construct a date object representing Thailand local time
  return new Date(
    parseInt(partValues.year),
    parseInt(partValues.month) - 1,
    parseInt(partValues.day),
    parseInt(partValues.hour),
    parseInt(partValues.minute),
    parseInt(partValues.second)
  );
};

/**
 * Gets a YYYY-MM-DD string for today in Thailand.
 */
export const getThailandTodayStr = (): string => {
  const thNow = getThailandNow();
  const year = thNow.getFullYear();
  const month = String(thNow.getMonth() + 1).padStart(2, '0');
  const day = String(thNow.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const getThailandDateStr = (date: Date): string => {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  });
  const parts = formatter.formatToParts(date);
  const partValues: { [key: string]: string } = {};
  parts.forEach(p => partValues[p.type] = p.value);
  
  const year = partValues.year;
  const month = partValues.month.padStart(2, '0');
  const day = partValues.day.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const getDaysInMonth = (year: number, month: number, highlightedDateStr?: string): DayInfo[] => {
  const date = new Date(year, month, 1);
  const days: DayInfo[] = [];
  const thNow = getThailandNow();
  const todayStr = getThailandTodayStr();
  const tomorrow = new Date(thNow);
  tomorrow.setDate(thNow.getDate() + 1);
  const tomorrowStr = getThailandDateStr(tomorrow);

  while (date.getMonth() === month) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${d}`;
    
    days.push({
      date: new Date(date),
      dateStr,
      dayNum: date.getDate(),
      dayName: date.toLocaleDateString('en-US', { weekday: 'narrow' }),
      isWeekend: date.getDay() === 0 || date.getDay() === 6,
      isToday: dateStr === todayStr,
      isTomorrow: dateStr === tomorrowStr,
      isHighlighted: dateStr === highlightedDateStr
    });
    date.setDate(date.getDate() + 1);
  }
  return days;
};

export const getDaysInCurrentWeek = (): DayInfo[] => {
  const now = getThailandNow();
  const todayStr = getThailandTodayStr();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const tomorrowStr = getThailandDateStr(tomorrow);
  const dayOfWeek = now.getDay(); // 0 is Sunday
  
  // Start from Monday (1)
  const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
  const monday = new Date(now.setDate(diff));
  
  const days: DayInfo[] = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${d}`;
    
    days.push({
      date: new Date(date),
      dateStr,
      dayNum: date.getDate(),
      dayName: date.toLocaleDateString('en-US', { weekday: 'short' }),
      isWeekend: date.getDay() === 0 || date.getDay() === 6,
      isToday: dateStr === todayStr,
      isTomorrow: dateStr === tomorrowStr,
      isHighlighted: false
    });
  }
  return days;
};

export const formatDate = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    minimumFractionDigits: 0,
  }).format(amount);
};

export const getMonthName = (date: Date | string | number): string => {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return 'Invalid Month';
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
};

/**
 * Converts a time string (HH:mm) from one timezone to another on a specific date.
 * Returns the formatted time string.
 */
export const convertTimeBetweenTimeZones = (
  timeStr: string,
  dateStr: string,
  fromTimeZone: string,
  toTimeZone: string
): string => {
  try {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const [year, month, day] = dateStr.split('-').map(Number);
    
    const date = new Date(year, month - 1, day, hours, minutes);
    
    // Calculate the difference between timezones
    const fromDate = new Date(date.toLocaleString('en-US', { timeZone: fromTimeZone }));
    const toDate = new Date(date.toLocaleString('en-US', { timeZone: toTimeZone }));
    const diff = fromDate.getTime() - toDate.getTime();
    
    const resultDate = new Date(date.getTime() + diff);
    
    return new Intl.DateTimeFormat('en-US', {
      timeZone: toTimeZone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(resultDate);
  } catch {
    return timeStr;
  }
};

// Simplified version for our specific use case: base is always Asia/Bangkok
export const getBKKLocalTime = (timeStr: string, dateStr: string): string => {
  try {
    const bkkDate = new Date(`${dateStr}T${timeStr}:00+07:00`); 
    
    // Format: "7:00 PM"
    const timeFormatted = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Bangkok',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }).format(bkkDate);

    // Format: "Tuesday"
    const dayFormatted = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Bangkok',
      weekday: 'long'
    }).format(bkkDate);
    
    return `${timeFormatted}, ${dayFormatted}`;
  } catch {
    return timeStr;
  }
};

export const getMinutesUntil = (targetTimeMs: number): number => {
  const now = getThailandNow().getTime();
  const diffMs = targetTimeMs - now;
  return Math.floor(diffMs / (1000 * 60));
};

/**
 * Normalizes a student name for deduplication.
 * Removes "lesson with", "class", "preply", etc., handles parentheses, and lowercases.
 */
export const normalizeStudentName = (name: string): string => {
  if (!name) return '';
  let n = name.toLowerCase();
  
  // Remove common phrases/prefixes/suffixes
  const phrasesToRemove = [
    "lesson with", 
    "lesson",
    "class", 
    "preply", 
    "tutor session",
    "tutor", 
    "session", 
    "with"
  ];
  
  phrasesToRemove.forEach(p => {
    // Match at start or end with optional separators
    const startRegex = new RegExp("^" + p + "[:\\s-]*", "gi");
    const endRegex = new RegExp("[:\\s-]*" + p + "$", "gi");
    n = n.replace(startRegex, "").replace(endRegex, "");
  });
  
  // Handle phrases in the middle
  n = n.replace(/[:\s-]+(class|lesson|preply|session|with|tutor session)[:\s-]*/gi, " ");

  // Remove parentheses and brackets
  n = n.replace(/\(.*?\)/g, "").replace(/\[.*?\]/g, "");
  
  // Clean up whitespace
  n = n.trim().replace(/\s+/g, " ");

  // Final cleanup of non-alphanumeric (except for CJK characters and spaces)
  // We want to keep spaces now to allow multi-word names
  n = n.replace(/^[^a-z0-9ㄱ-ㅎㅏ-ㅣ가-힣]+|[^a-z0-9ㄱ-ㅎㅏ-ㅣ가-힣]+$/gi, "");

  return n.trim();
};

export const getStudentLocalTime = (timeStr: string, dateStr: string, studentTimeZone: string): string => {
  if (!studentTimeZone || studentTimeZone === 'Asia/Bangkok') return timeStr;
  
  try {
    const bkkDate = new Date(`${dateStr}T${timeStr}:00+07:00`); 
    
    // Format: "7:00 PM"
    const timeFormatted = new Intl.DateTimeFormat('en-US', {
      timeZone: studentTimeZone,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }).format(bkkDate);

    // Format: "Tuesday"
    const dayFormatted = new Intl.DateTimeFormat('en-US', {
      timeZone: studentTimeZone,
      weekday: 'long'
    }).format(bkkDate);
    
    return `${timeFormatted}, ${dayFormatted}`;
  } catch {
    return timeStr;
  }
};
