'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Search, Upload, Users, Phone, Mail, MapPin, Trash2 } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { LANGUAGE_LABEL } from '@/lib/utils';
import { toast } from 'sonner';

interface Customer {
  id: string;
  fullName: string;
  phone: string;
  email?: string;
  city?: string;
  language: string;
  customerType?: string;
  notes?: string;
  consentStatus: string;
  createdAt: string;
}

export default function CustomersPage() {
  const [customerList, setCustomerList] = useState<Customer[]>([]);
  const [q, setQ] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [shouldShowAddModal, setShouldShowAddModal] = useState(false);
  const [form, setForm] = useState({ fullName: '', phone: '', email: '', city: '', language: 'en', customerType: 'customer', notes: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const load = async () => {
    setIsLoading(true);
    const res = await fetch(`/api/customers?q=${encodeURIComponent(q)}`);
    const data = await res.json();
    setCustomerList(data.customers || []);
    setIsLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const res = await fetch('/api/customers', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
    });
    const data = await res.json();
    setIsSubmitting(false);
    if (!res.ok) { toast.error(data.error || 'Failed'); return; }
    toast.success('Customer added');
    setShouldShowAddModal(false);
    setForm({ fullName: '', phone: '', email: '', city: '', language: 'en', customerType: 'customer', notes: '' });
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this customer?')) return;
    const res = await fetch(`/api/customers/${id}`, { method: 'DELETE' });
    if (res.ok) { toast.success('Deleted'); load(); }
  };

  return (
    <div className="space-y-6" data-testid="customers-page">
      <header className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <span className="overline">Customer database</span>
          <h1 className="mt-2 text-3xl font-extrabold text-brand-navy">Customers</h1>
          <p className="text-slate-500 text-sm mt-1">Add, search and manage the customers you call.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/customers/upload" className="btn-secondary text-sm" data-testid="customers-upload-csv-button">
            <Upload className="w-4 h-4" /> Upload CSV
          </Link>
          <button onClick={() => setShouldShowAddModal(true)} className="btn-primary text-sm" data-testid="customers-add-button">
            <Plus className="w-4 h-4" /> Add customer
          </button>
        </div>
      </header>

      <div className="glass p-4 flex items-center gap-3">
        <Search className="w-4 h-4 text-slate-400" />
        <input
          className="flex-1 bg-transparent outline-none text-sm"
          placeholder="Search by name, phone, or city…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && load()}
          data-testid="customers-search-input"
        />
        <button onClick={load} className="btn-ghost text-xs" data-testid="customers-search-button">Search</button>
      </div>

      {isLoading ? (
        <div className="glass h-60 animate-pulse" />
      ) : customerList.length === 0 ? (
        <EmptyState icon={Users} title="No customers yet" description="Add your first customer manually or upload a CSV file." action={
          <div className="flex gap-2 justify-center">
            <button onClick={() => setShouldShowAddModal(true)} className="btn-primary text-sm">Add customer</button>
            <Link href="/customers/upload" className="btn-secondary text-sm">Upload CSV</Link>
          </div>
        } />
      ) : (
        <div className="glass overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="customers-table">
              <thead className="bg-white/60 border-b border-slate-100">
                <tr className="text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                  <th className="px-5 py-4">Customer</th>
                  <th className="px-5 py-4">Phone</th>
                  <th className="px-5 py-4">City</th>
                  <th className="px-5 py-4">Language</th>
                  <th className="px-5 py-4">Type</th>
                  <th className="px-5 py-4">Consent</th>
                  <th className="px-5 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {customerList.map((c) => (
                  <tr key={c.id} className="hover:bg-brand-50/40" data-testid={`customer-row-${c.id}`}>
                    <td className="px-5 py-4">
                      <div className="font-semibold text-brand-ink">{c.fullName}</div>
                      {c.email && <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5"><Mail className="w-3 h-3" /> {c.email}</div>}
                    </td>
                    <td className="px-5 py-4 text-slate-700"><span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5 text-slate-400" /> {c.phone}</span></td>
                    <td className="px-5 py-4 text-slate-700">{c.city ? <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5 text-slate-400" />{c.city}</span> : '—'}</td>
                    <td className="px-5 py-4"><span className="badge bg-brand-50 text-brand-700">{LANGUAGE_LABEL[c.language] || c.language}</span></td>
                    <td className="px-5 py-4 text-slate-600">{c.customerType || '—'}</td>
                    <td className="px-5 py-4">
                      <span className={`badge ${c.consentStatus === 'granted' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{c.consentStatus}</span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button onClick={() => handleDelete(c.id)} className="text-slate-400 hover:text-red-600 p-1" data-testid={`customer-delete-${c.id}`}><Trash2 className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {shouldShowAddModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm grid place-items-center z-50 p-4" onClick={() => setShouldShowAddModal(false)} data-testid="customer-add-modal">
          <div className="glass-strong p-6 w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-brand-navy">Add a customer</h2>
            <form onSubmit={handleAdd} className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="label-base">Full name *</label>
                <input required className="input-field" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} data-testid="add-customer-fullname-input" />
              </div>
              <div>
                <label className="label-base">Phone *</label>
                <input required className="input-field" placeholder="+91 98XXXXXXXX" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} data-testid="add-customer-phone-input" />
              </div>
              <div>
                <label className="label-base">Email</label>
                <input type="email" className="input-field" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} data-testid="add-customer-email-input" />
              </div>
              <div>
                <label className="label-base">City</label>
                <input className="input-field" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} data-testid="add-customer-city-input" />
              </div>
              <div>
                <label className="label-base">Language</label>
                <select className="input-field" value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })} data-testid="add-customer-language-select">
                  <option value="en">English</option>
                  <option value="hi">Hindi</option>
                  <option value="gu">Gujarati</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="label-base">Notes</label>
                <textarea rows={2} className="input-field" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} data-testid="add-customer-notes-input" />
              </div>
              <div className="sm:col-span-2 flex justify-end gap-2 mt-2">
                <button type="button" onClick={() => setShouldShowAddModal(false)} className="btn-ghost text-sm">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="btn-primary text-sm" data-testid="add-customer-submit-button">{isSubmitting ? 'Saving…' : 'Add customer'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}