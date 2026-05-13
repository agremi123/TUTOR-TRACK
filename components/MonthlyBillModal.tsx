
import React from 'react';
import { Printer, X, FileText, ChevronLeft, ChevronRight, CheckCircle2 } from 'lucide-react';
import { Student } from '../types.ts';
import { formatCurrency, getMonthName } from '../utils/dateUtils.ts';
import { Modal } from './ui/Modal.tsx';

interface MonthlyBillModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: Student;
  monthDate: Date; // The month being viewed
  onBulkMarkAsPaid?: (studentId: string, keys: string[]) => void;
}

export const MonthlyBillModal: React.FC<MonthlyBillModalProps> = ({
  isOpen,
  onClose,
  student,
  monthDate: initialMonthDate,
  onBulkMarkAsPaid
}) => {
  const [billingMode, setBillingMode] = React.useState<'monthly' | 'full' | 'unpaid'>('monthly');
  const [viewedDate, setViewedDate] = React.useState(initialMonthDate);
  const [activeMonthTab, setActiveMonthTab] = React.useState<string | null>(null);

  // Update viewed date if initialMonthDate changes while open
  React.useEffect(() => {
    setViewedDate(initialMonthDate);
  }, [initialMonthDate, isOpen]);

  const currentMonth = viewedDate.getMonth();
  const currentYear = viewedDate.getFullYear();

  const billEntries = React.useMemo(() => {
    return Object.entries(student.attendance)
      .filter(([dateStr, entry]) => {
        if (entry.deleted) return false;
        if (entry.status === 'planned') return false; // Only bill confirmed/past lessons
        
        if (billingMode === 'full') return true;
        if (billingMode === 'unpaid') return !entry.studentPaid;
        
        const date = new Date(dateStr);
        return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
      })
      .map(([dateStr, entry]) => ({
        date: dateStr,
        ...entry
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [student, currentMonth, currentYear, billingMode]);

  const groupedEntries = React.useMemo(() => {
    const groups: { month: string, entries: typeof billEntries }[] = [];
    billEntries.forEach(entry => {
      const d = new Date(entry.date);
      const monthLabel = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      const existing = groups.find(g => g.month === monthLabel);
      if (existing) {
        existing.entries.push(entry);
      } else {
        groups.push({ month: monthLabel, entries: [entry] });
      }
    });
    return groups;
  }, [billEntries]);

  // Set default active tab when groups change
  React.useEffect(() => {
    if (groupedEntries.length > 0 && !activeMonthTab) {
      setActiveMonthTab(groupedEntries[0].month);
    } else if (groupedEntries.length === 0) {
      setActiveMonthTab(null);
    }
  }, [groupedEntries, activeMonthTab]);

  const displayedEntries = React.useMemo(() => {
    if (billingMode === 'monthly') return billEntries;
    if (!activeMonthTab) return [];
    return groupedEntries.find(g => g.month === activeMonthTab)?.entries || [];
  }, [billingMode, billEntries, groupedEntries, activeMonthTab]);

  const navigateMonth = (direction: number) => {
    const newDate = new Date(viewedDate);
    newDate.setMonth(newDate.getMonth() + direction);
    setViewedDate(newDate);
  };

  const totalAmount = billEntries.reduce((sum, entry) => {
    const rate = student.rates[entry.type as keyof typeof student.rates] || 0;
    return sum + (entry.hours * rate);
  }, 0);

  const handlePrint = () => {
    // Add a slightly larger delay to ensure any layout shifts or tab switching finishes before printing
    setTimeout(() => {
      window.print();
    }, 500);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="max-w-4xl" className="bill-modal-content">
      <div className="bg-white" id="printable-bill-root">
        {/* Header - Hidden in Print */}
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-center bg-slate-50 gap-4 print:hidden">
          <div className="flex items-center gap-2">
            <FileText className="text-slate-400" size={20} />
            <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Invoice Preview</span>
          </div>
          
          <div className="flex items-center gap-4">
            {billingMode === 'monthly' && (
              <div className="flex items-center gap-2 bg-slate-200 p-1 rounded-lg">
                <button onClick={() => navigateMonth(-1)} className="p-1 hover:bg-white rounded transition-all text-slate-600"><ChevronLeft size={16} /></button>
                <span className="text-[10px] font-black uppercase w-24 text-center text-slate-700">{getMonthName(viewedDate)}</span>
                <button onClick={() => navigateMonth(1)} className="p-1 hover:bg-white rounded transition-all text-slate-600"><ChevronRight size={16} /></button>
              </div>
            )}

            <div className="flex bg-slate-200 p-1 rounded-lg">
              <button 
                onClick={() => setBillingMode('monthly')}
                className={`px-3 py-1.5 text-[10px] font-black uppercase rounded-md transition-all ${billingMode === 'monthly' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Monthly
              </button>
              <button 
                onClick={() => setBillingMode('full')}
                className={`px-3 py-1.5 text-[10px] font-black uppercase rounded-md transition-all ${billingMode === 'full' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                All
              </button>
              <button 
                onClick={() => setBillingMode('unpaid')}
                className={`px-3 py-1.5 text-[10px] font-black uppercase rounded-md transition-all ${billingMode === 'unpaid' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Unpaid
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handlePrint}
                className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-black uppercase hover:bg-slate-800 transition-all shadow-lg shadow-slate-200"
              >
                <Printer size={16} /> Print Bill
              </button>
              <button
                onClick={onClose}
                className="p-2 hover:bg-slate-200 rounded-full text-slate-400 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
          </div>
        </div>

        {/* Printable Content */}
        <div className="flex-1 overflow-y-auto print:overflow-visible custom-scrollbar" style={{ maxHeight: 'calc(100vh - 220px)' }}>
          <div className="p-8 sm:p-12 print:p-0" id="printable-bill">
            <div className="flex justify-between items-start mb-12">
              <div className="space-y-1">
                <h1 className="text-3xl font-black text-slate-900 tracking-tight">INVOICE</h1>
                <p className="text-slate-500 text-sm font-bold uppercase tracking-widest">TutorTrack Pro</p>
              </div>
              <div className="text-right space-y-1 border-t-4 border-slate-900 pt-4">
                <p className="text-[10px] font-black text-slate-400 uppercase">Billing Period</p>
                <p className="text-lg font-black text-slate-900 leading-tight">
                  {billingMode === 'monthly' ? getMonthName(viewedDate) : 
                   billingMode === 'unpaid' ? 'Unpaid Lessons' : 'Lifetime Summary'}
                  {billingMode !== 'monthly' && activeMonthTab && (
                    <span className="block text-xs font-bold text-emerald-600 mt-1 print:hidden">Viewing: {activeMonthTab}</span>
                  )}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-12 mb-12">
              <div className="space-y-4">
                <div className="space-y-1 border-l-4 border-emerald-500 pl-6 py-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-2">Billed To</p>
                  <p className="text-2xl font-black text-slate-900 leading-tight">{student.name}</p>
                  {student.email && <p className="text-sm font-medium text-slate-500">{student.email}</p>}
                </div>
              </div>
            </div>

            {/* Month Tabs (Onglets) - Only show in Unpaid/Full mode */}
            {billingMode !== 'monthly' && groupedEntries.length > 1 && (
              <div className="flex flex-wrap gap-1 mb-6 print:hidden border-b border-slate-100 px-1">
                {groupedEntries.map((group, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveMonthTab(group.month)}
                    className={`px-4 py-2 text-[9px] font-black uppercase tracking-widest transition-all relative ${
                      activeMonthTab === group.month 
                        ? 'text-slate-900' 
                        : 'text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    {group.month}
                    {activeMonthTab === group.month && (
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-900 rounded-full" />
                    )}
                  </button>
                ))}
              </div>
            )}

            <div className="space-y-8">
              {/* Screen view: either single month or active tab */}
              <div className="print:hidden">
                <div className="overflow-hidden border border-slate-100 rounded-2xl">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-slate-50/50 border-b border-slate-100">
                        <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest text-left">Date</th>
                        <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest text-left">Type</th>
                        <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Hrs</th>
                        <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Rate</th>
                        <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {displayedEntries.map((entry, idx) => {
                        const rate = student.rates[entry.type as keyof typeof student.rates] || 0;
                        const amount = entry.hours * rate;
                        return (
                          <tr key={idx} className="hover:bg-slate-50/30 transition-colors">
                            <td className="px-4 py-2 text-xs font-bold text-slate-700 whitespace-nowrap">{entry.date}</td>
                            <td className="px-4 py-2 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                              <span className={`px-2 py-0.5 rounded-md ${
                                entry.type === 'online' ? 'bg-sky-50 text-sky-700 font-black' :
                                entry.type === 'onsite' ? 'bg-purple-50 text-purple-700 font-black' :
                                'bg-orange-50 text-orange-700 font-black'
                              }`}>
                                {entry.type}
                              </span>
                            </td>
                            <td className="px-4 py-2 text-xs font-black text-slate-600 text-center">{entry.hours}</td>
                            <td className="px-4 py-2 text-xs font-bold text-slate-500 text-right">{formatCurrency(rate)}</td>
                            <td className="px-4 py-2 text-xs font-black text-slate-900 text-right">{formatCurrency(amount)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Print view: always show all grouped entries */}
              <div className="hidden print:block space-y-6">
                {groupedEntries.map((group, gIdx) => (
                  <div key={gIdx} className="space-y-2">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-900 border-b-2 border-slate-900 pb-1">{group.month}</h3>
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200">
                          <th className="py-2 text-[8px] font-black uppercase text-left">Date</th>
                          <th className="py-2 text-[8px] font-black uppercase text-left">Type</th>
                          <th className="py-2 text-[8px] font-black uppercase text-center">Hrs</th>
                          <th className="py-2 text-[8px] font-black uppercase text-right">Rate</th>
                          <th className="py-2 text-[8px] font-black uppercase text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.entries.map((entry, idx) => {
                          const rate = student.rates[entry.type as keyof typeof student.rates] || 0;
                          return (
                            <tr key={idx} className="border-b border-slate-50 last:border-0">
                              <td className="py-2 text-xs font-medium">{entry.date}</td>
                              <td className="py-2 text-[10px] uppercase font-bold">{entry.type}</td>
                              <td className="py-2 text-xs text-center">{entry.hours}h</td>
                              <td className="py-2 text-xs text-right">{formatCurrency(rate)}</td>
                              <td className="py-2 text-xs font-bold text-right">{formatCurrency(entry.hours * rate)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end mt-12">
              <div className="w-full max-w-[320px] space-y-3">
                <div className="flex justify-between items-center px-5 py-3 bg-slate-50 rounded-2xl border border-slate-100 text-slate-600">
                  <span className="text-[10px] font-black uppercase tracking-widest">Total Lessons</span>
                  <span className="text-sm font-black">{billEntries.length}</span>
                </div>
                <div className="flex justify-between items-center px-5 py-3 bg-slate-50 rounded-2xl border border-slate-100 text-slate-600">
                  <span className="text-[10px] font-black uppercase tracking-widest">Total Hours</span>
                  <span className="text-sm font-black">{billEntries.reduce((sum, e) => sum + e.hours, 0)}h</span>
                </div>
                <div className="flex justify-between items-center px-5 py-3 bg-slate-50 rounded-2xl border border-slate-100 text-slate-600">
                  <span className="text-[10px] font-black uppercase tracking-widest">Subtotal</span>
                  <span className="text-sm font-black">{formatCurrency(totalAmount)}</span>
                </div>
                <div className="flex justify-between items-center px-6 py-5 bg-slate-900 rounded-3xl text-white shadow-2xl shadow-slate-200">
                  <span className="text-xs font-black uppercase tracking-[0.2em]">Total Due</span>
                  <span className="text-2xl font-black">{formatCurrency(totalAmount)}</span>
                </div>

                {onBulkMarkAsPaid && displayedEntries.length > 0 && (billingMode === 'unpaid' || billingMode === 'monthly') && (
                  <button 
                    onClick={() => {
                      const count = displayedEntries.length;
                      const label = billingMode === 'monthly' ? 'this month' : activeMonthTab;
                      if (window.confirm(`Mark ${count} lessons from ${label} as paid?`)) {
                        onBulkMarkAsPaid(student.id, displayedEntries.map(e => e.date));
                        onClose();
                      }
                    }}
                    className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-4 bg-slate-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-700 transition-all shadow-xl shadow-slate-100 print:hidden"
                  >
                    <CheckCircle2 size={18} /> Mark {billingMode === 'monthly' ? 'All' : 'Month'} as Paid
                  </button>
                )}
              </div>
            </div>

            <div className="mt-24 pt-8 border-t border-slate-100 text-center">
              <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest leading-relaxed">Generated by TutorTrack Pro<br/>Simplified Academic Management</p>
            </div>
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page { margin: 10mm; size: auto; }
          
          /* Hide the main app content */
          #root { display: none !important; }
          
          /* Ensure modal overlay is positioned for printing */
          .modal-overlay { 
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            background: white !important;
            padding: 0 !important;
            margin: 0 !important;
            display: block !important;
          }

          .bill-modal-content {
            box-shadow: none !important;
            border: none !important;
            width: 100% !important;
            max-width: none !important;
            margin: 0 !important;
            padding: 0 !important;
            border-radius: 0 !important;
            overflow: visible !important;
          }

          #printable-bill-root {
            display: block !important;
            padding: 0 !important;
          }

          .print:hidden { display: none !important; }
          
          /* Ensure scroll containers show all content */
          .overflow-y-auto, .custom-scrollbar {
            overflow: visible !important;
            height: auto !important;
            max-height: none !important;
          }

          /* General print reset */
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
      `}} />
    </Modal>
  );
};
