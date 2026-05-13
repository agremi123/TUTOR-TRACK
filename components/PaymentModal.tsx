
import React, { useState } from 'react';
import { X, Trash2, Users } from 'lucide-react';
import { Student, AttendanceEntry } from '../types.ts';
import { formatCurrency } from '../utils/dateUtils.ts';

interface PaymentModalProps {
  student: Student;
  allStudents: Student[];
  isOpen: boolean;
  onClose: () => void;
  onAddPayment: (studentId: string, amount: number) => void;
  onUpdatePayment: (studentId: string, paymentId: string, amount: number) => void;
  onDeletePayment: (studentId: string, paymentId: string) => void;
}

import { Modal } from './ui/Modal.tsx';

export const PaymentModal: React.FC<PaymentModalProps> = ({
  student,
  allStudents,
  isOpen,
  onClose,
  onAddPayment,
  onDeletePayment,
}) => {
  const [amount, setAmount] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount) return;
    onAddPayment(student.id, parseFloat(amount));
    setAmount('');
  };

  // Group Logic
  const isGrouped = !!student.groupName;
  const groupStudents = isGrouped 
    ? allStudents.filter(s => s.groupName === student.groupName) 
    : [student];

  let totalPaid = 0;
  let totalCost = 0;

  groupStudents.forEach(s => {
      totalPaid += s.payments.reduce((sum, p) => sum + p.amount, 0);
      const entries = (Object.values(s.attendance) as AttendanceEntry[]).filter(e => !e.deleted);
      totalCost += entries.reduce((sum: number, entry: AttendanceEntry) => {
        const rate = (s.rates[entry.type as keyof typeof s.rates] as number) || 0;
        return sum + (entry.hours * rate);
      }, 0);
  });

  const balance = totalPaid - totalCost;

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="max-w-lg">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div>
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                {student.name}'s Wallet
                {isGrouped && <Users size={16} className="text-purple-500" />}
            </h2>
            <p className="text-sm text-slate-500">
                {isGrouped ? `Shared Credit Pool: ${student.groupName}` : 'Manage payments and credits'}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[70vh]">
          {/* Balance Card */}
          <div className={`p-4 rounded-lg mb-6 border ${
            balance < 0 ? 'bg-red-50 border-red-100' : 'bg-emerald-50 border-emerald-100'
          }`}>
            <div className="text-sm font-medium text-slate-500 mb-1 flex justify-between">
                <span>{isGrouped ? 'Combined Group Balance' : 'Current Balance'}</span>
            </div>
            <div className={`text-3xl font-bold ${
              balance < 0 ? 'text-red-600' : 'text-emerald-600'
            }`}>
              {formatCurrency(balance)}
            </div>
          </div>

          {/* Add Payment Form */}
          <form onSubmit={handleSubmit} className="mb-6 flex gap-2">
            <div className="flex-1">
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Top up amount..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none"
              />
            </div>
            <button type="submit" className="bg-brand-600 text-white px-4 py-2 rounded-lg font-medium">Add</button>
          </form>

          {/* History */}
          <div className="space-y-2">
            {student.payments.slice().reverse().map(payment => (
              <div key={payment.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-100">
                <div>
                  <div className="font-semibold text-emerald-600">+{formatCurrency(payment.amount)}</div>
                  <div className="text-xs text-slate-400">{new Date(payment.date).toLocaleDateString()}</div>
                </div>
                <button onClick={() => onDeletePayment(student.id, payment.id)} className="text-slate-300 hover:text-red-500"><Trash2 size={16}/></button>
              </div>
            ))}
          </div>
        </div>
    </Modal>
  );
};
