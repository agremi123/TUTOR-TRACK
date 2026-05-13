import React, { useState, useRef } from 'react';
import { Upload, X, Loader2, AlertCircle } from 'lucide-react';
import { analyzeReceipt } from '../services/geminiService.ts';
import { Student } from '../types.ts';

interface ReceiptUploadProps {
  students: Student[];
  onVerified: (data: { studentId: string; amount: number; date: string }) => void;
}

export const ReceiptUpload: React.FC<ReceiptUploadProps> = ({ students, onVerified }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setError(null);

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(',')[1];
        try {
          const analysis = await analyzeReceipt(base64);
          
          if (!analysis.studentName?.trim()) {
            setError('Could not identify a student name on this receipt.');
            return;
          }

          // Find student by name
          const student = students.find(s => 
            s.name.toLowerCase().includes(analysis.studentName!.toLowerCase())
          );

          if (!student) {
            setError(`Could not identify student: ${analysis.studentName || 'Unknown'}`);
            return;
          }

          onVerified({
            studentId: student.id,
            amount: analysis.amount,
            date: analysis.date || new Date().toISOString().split('T')[0]
          });
        } catch (error) {
          console.error('Receipt analysis error:', error);
          setError('Failed to analyze receipt. Please try again.');
        } finally {
          setIsUploading(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('File reading error:', error);
      setError('Error reading file.');
      setIsUploading(false);
    }
  };

  return (
    <div className="relative">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        className="hidden"
      />
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={isUploading}
        className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-widest transition-all ${
          isUploading ? 'bg-slate-100 text-slate-400' : 'bg-white border-2 border-slate-200 text-slate-600 hover:border-brand-500 hover:text-brand-600'
        }`}
      >
        {isUploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
        {isUploading ? 'Analyzing...' : 'Upload Receipt'}
      </button>

      {error && (
        <div className="absolute top-full mt-2 right-0 w-64 bg-red-50 border border-red-100 p-3 rounded-xl shadow-lg z-50 animate-in slide-in-from-top-2">
          <div className="flex gap-2 text-red-600">
            <AlertCircle size={16} className="flex-shrink-0" />
            <p className="text-[10px] font-bold leading-tight">{error}</p>
          </div>
          <button onClick={() => setError(null)} className="absolute top-1 right-1 p-1 text-red-300 hover:text-red-500">
            <X size={12} />
          </button>
        </div>
      )}
    </div>
  );
};
