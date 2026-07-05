'use client';

import { useState } from 'react';
import Link from 'next/link';
import Papa from 'papaparse';
import { Upload, FileSpreadsheet, ArrowLeft, CheckCircle2, AlertCircle, Download } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

const FIELD_OPTIONS = [
  { value: 'fullName', label: 'Full Name *' },
  { value: 'phone', label: 'Phone *' },
  { value: 'email', label: 'Email' },
  { value: 'city', label: 'City' },
  { value: 'customerType', label: 'Customer Type' },
  { value: 'notes', label: 'Notes' },
  { value: 'dueDate', label: 'Due Date' },
  { value: 'appointmentDate', label: 'Appointment Date' },
  { value: '__ignore__', label: '— Ignore column —' },
];

function guessMapping(header: string): string {
  const h = header.toLowerCase().replace(/[\s_-]/g, '');
  if (h.includes('name')) return 'fullName';
  if (h.includes('phone') || h.includes('mobile')) return 'phone';
  if (h.includes('email')) return 'email';
  if (h.includes('city') || h.includes('location')) return 'city';
  if (h.includes('type')) return 'customerType';
  if (h.includes('note')) return 'notes';
  if (h.includes('due')) return 'dueDate';
  if (h.includes('appoint')) return 'appointmentDate';
  return '__ignore__';
}

export default function UploadCsvPage() {
  const router = useRouter();
  const [step, setStep] = useState<'upload' | 'map' | 'done'>('upload');
  const [rawRows, setRawRows] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [result, setResult] = useState<any>(null);
  const [isUploading, setIsUploading] = useState(false);

  const onFile = (file: File) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        if (!res.data?.length) {
          toast.error('Empty file');
          return;
        }
        const cols = res.meta.fields || [];
        setHeaders(cols);
        setRawRows(res.data as any[]);
        const guess: Record<string, string> = {};
        cols.forEach((h) => (guess[h] = guessMapping(h)));
        setMapping(guess);
        setStep('map');
      },
      error: () => toast.error('Failed to parse CSV'),
    });
  };

  const handleConfirm = async () => {
    setIsUploading(true);
    const rows = rawRows.map((r) => {
      const out: any = {};
      for (const h of headers) {
        const target = mapping[h];
        if (!target || target === '__ignore__') continue;
        out[target] = r[h];
      }
      return out;
    });
    const res = await fetch('/api/customers/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows, dedupe: true }),
    });
    const data = await res.json();
    setIsUploading(false);
    if (!res.ok) {
      toast.error(data.error || 'Upload failed');
      return;
    }
    setResult(data);
    setStep('done');
    toast.success(`${data.insertedCount} customers imported`);
  };

  return (
    <div className="space-y-6 max-w-4xl" data-testid="upload-csv-page">
      <header className="flex items-center justify-between">
        <div>
          <Link href="/customers" className="text-xs text-brand-600 inline-flex items-center gap-1 mb-2"><ArrowLeft className="w-3 h-3" /> Back to customers</Link>
          <h1 className="text-3xl font-extrabold text-brand-navy">Upload customers (CSV)</h1>
          <p className="text-slate-500 text-sm mt-1">Bulk import via CSV. We&apos;ll validate phone numbers and skip duplicates.</p>
        </div>
        <a href="/api/customers/upload" download className="btn-secondary text-sm" data-testid="download-sample-csv">
          <Download className="w-4 h-4" /> Sample CSV
        </a>
      </header>

      {step === 'upload' && (
        <label className="glass p-12 grid place-items-center text-center cursor-pointer hover:shadow-glow-hover transition-shadow" data-testid="csv-dropzone">
          <input type="file" accept=".csv,text/csv" hidden onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} data-testid="csv-file-input" />
          <div className="w-16 h-16 rounded-2xl bg-brand-gradient text-white grid place-items-center mb-4 shadow-glow">
            <Upload className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-bold text-brand-navy">Choose a CSV file</h3>
          <p className="text-sm text-slate-500 mt-1 max-w-md">Required columns: Full name, Phone. Optional: Email, City, Language, Type, Notes.</p>
          <span className="btn-primary text-sm mt-5">Browse file</span>
        </label>
      )}

      {step === 'map' && (
        <div className="space-y-5">
          <div className="glass p-6">
            <h3 className="font-bold text-brand-navy mb-1">Map your columns</h3>
            <p className="text-sm text-slate-500 mb-5">{rawRows.length} rows detected. Confirm how each column maps to our fields.</p>
            <div className="space-y-3" data-testid="csv-mapping">
              {headers.map((h) => (
                <div key={h} className="flex items-center gap-3">
                  <div className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-brand-ink">{h}</div>
                  <span className="text-slate-400">→</span>
                  <select className="input-field py-2 flex-1" value={mapping[h]} onChange={(e) => setMapping((m) => ({ ...m, [h]: e.target.value }))} data-testid={`csv-map-${h}`}>
                    {FIELD_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>

          <div className="glass p-6">
            <h3 className="font-bold text-brand-navy mb-3">Preview (first 5 rows)</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-brand-50">
                  <tr>{headers.map((h) => <th key={h} className="px-3 py-2 text-left font-bold text-brand-700 uppercase tracking-wider">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {rawRows.slice(0, 5).map((r, i) => (
                    <tr key={i} className="border-t border-slate-100">{headers.map((h) => <td key={h} className="px-3 py-2 text-slate-700">{r[h] || '—'}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button onClick={() => setStep('upload')} className="btn-ghost text-sm">Choose different file</button>
            <button onClick={handleConfirm} disabled={isUploading} className="btn-primary text-sm" data-testid="csv-confirm-import-button">
              {isUploading ? 'Importing…' : 'Confirm import'}
            </button>
          </div>
        </div>
      )}

      {step === 'done' && result && (
        <div className="glass p-8 text-center" data-testid="csv-import-result">
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 grid place-items-center mx-auto mb-4">
            <CheckCircle2 className="w-7 h-7" />
          </div>
          <h2 className="text-2xl font-extrabold text-brand-navy">Import complete</h2>
          <div className="grid grid-cols-3 gap-3 mt-6 max-w-lg mx-auto">
            <div className="bg-white rounded-xl p-3 border border-slate-100"><div className="text-xs uppercase text-slate-500">Imported</div><div className="text-2xl font-extrabold text-emerald-600">{result.insertedCount}</div></div>
            <div className="bg-white rounded-xl p-3 border border-slate-100"><div className="text-xs uppercase text-slate-500">Duplicates</div><div className="text-2xl font-extrabold text-amber-600">{result.duplicatesCount}</div></div>
            <div className="bg-white rounded-xl p-3 border border-slate-100"><div className="text-xs uppercase text-slate-500">Invalid</div><div className="text-2xl font-extrabold text-red-600">{result.invalidCount}</div></div>
          </div>
          {result.invalid?.length > 0 && (
            <div className="mt-5 text-left text-xs bg-red-50 border border-red-100 rounded-xl p-4 max-h-40 overflow-auto">
              <div className="font-bold text-red-700 mb-2 flex items-center gap-1"><AlertCircle className="w-4 h-4" /> Invalid rows</div>
              {result.invalid.slice(0, 10).map((iv: any, i: number) => (
                <div key={i} className="text-red-700">• {iv.row?.fullName || iv.row?.phone || JSON.stringify(iv.row)} — {iv.reason}</div>
              ))}
            </div>
          )}
          <div className="mt-7 flex justify-center gap-2">
            <button onClick={() => { setStep('upload'); setResult(null); }} className="btn-secondary text-sm">Upload another</button>
            <button onClick={() => router.push('/customers')} className="btn-primary text-sm" data-testid="csv-go-to-customers">Go to customers</button>
          </div>
        </div>
      )}
    </div>
  );
}
