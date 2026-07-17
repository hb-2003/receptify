'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Plus, Search, Upload, Users, Phone, Mail, MapPin, Trash2, X, Calendar, Hash, FileText } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { LANGUAGE_LABEL, formatDate } from '@/lib/utils';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { getTenantLabels } from '@/lib/tenant-context';

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
  dueDate?: string;
  appointmentDate?: string;
  customFields?: string;
}

export default function CustomersPage() {
  const [customerList, setCustomerList] = useState<Customer[]>([]);
  const [q, setQ] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [business, setBusiness] = useState<any>(null);
  const [shouldShowAddModal, setShouldShowAddModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [form, setForm] = useState({ fullName: '', phone: '', email: '', city: '', language: 'en', customerType: 'customer', notes: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch business info to determine the tenant industry taxonomy
  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((d) => setBusiness(d.business));
  }, []);

  const labels = getTenantLabels(business?.businessType);

  const load = useCallback(async () => {
    setIsLoading(true);
    const res = await fetch(`/api/customers?q=${encodeURIComponent(q)}`);
    const data = await res.json();
    setCustomerList(data.customers || []);
    setIsLoading(false);
  }, [q]);

  useEffect(() => {
    load();
  }, [load]);

  const openModal = () => {
    setForm({ fullName: '', phone: '', email: '', city: '', language: 'en', customerType: 'customer', notes: '' });
    setShouldShowAddModal(true);
  };

  const closeModal = () => {
    setForm({ fullName: '', phone: '', email: '', city: '', language: 'en', customerType: 'customer', notes: '' });
    setShouldShowAddModal(false);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const res = await fetch('/api/customers', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
    });
    const data = await res.json();
    setIsSubmitting(false);
    if (!res.ok) { toast.error(data.error || 'Failed'); return; }
    toast.success(`${labels.customerLabel} added`);
    closeModal();
    load();
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent opening detail drawer
    if (!confirm(`Delete this ${labels.customerLabel.toLowerCase()}?`)) return;
    const res = await fetch(`/api/customers/${id}`, { method: 'DELETE' });
    if (res.ok) { 
      toast.success('Deleted'); 
      if (selectedCustomer?.id === id) {
        setSelectedCustomer(null);
      }
      load(); 
    }
  };

  // Safe helper to parse DB custom fields JSON
  const getParsedCustomFields = (customer: Customer): Record<string, string> => {
    if (!customer.customFields) return {};
    if (typeof customer.customFields === 'object') {
      return customer.customFields as Record<string, string>;
    }
    try {
      const parsed = JSON.parse(customer.customFields as string);
      if (typeof parsed === 'object' && parsed !== null) {
        return parsed as Record<string, string>;
      }
    } catch (err) {
      // Fallback if it is double serialized or string
      try {
        const doubleParsed = JSON.parse(JSON.parse(customer.customFields as string));
        if (typeof doubleParsed === 'object' && doubleParsed !== null) {
          return doubleParsed as Record<string, string>;
        }
      } catch (_) {}
    }
    return {};
  };

  return (
    <div className="space-y-6 relative" data-testid="customers-page">
      <header className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <span className="overline">Customer database</span>
          <h1 className="mt-2 text-3xl font-extrabold text-brand-navy">{labels.customersLabelPlural}</h1>
          <p className="text-slate-500 text-sm mt-1">Add, search and manage the {labels.customersLabelPlural.toLowerCase()} you call.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/customers/upload" className="btn-secondary text-sm" data-testid="customers-upload-csv-button">
            <Upload className="w-4 h-4" /> Upload CSV
          </Link>
          <button onClick={openModal} className="btn-primary text-sm" data-testid="customers-add-button">
            <Plus className="w-4 h-4" /> Add {labels.customerLabel.toLowerCase()}
          </button>
        </div>
      </header>

      <div className="glass p-4 flex items-center gap-3">
        <Search className="w-4 h-4 text-slate-400" />
        <input
          className="flex-1 bg-transparent outline-none text-sm"
          placeholder={`Search by name, phone, or city…`}
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
        <EmptyState icon={Users} title={`No ${labels.customersLabelPlural.toLowerCase()} yet`} description={`Add your first ${labels.customerLabel.toLowerCase()} manually or upload a CSV file.`} action={
          <div className="flex gap-2 justify-center">
            <button onClick={openModal} className="btn-primary text-sm">Add {labels.customerLabel.toLowerCase()}</button>
            <Link href="/customers/upload" className="btn-secondary text-sm">Upload CSV</Link>
          </div>
        } />
      ) : (
        <div className="glass overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="customers-table">
              <thead className="bg-white/60 border-b border-slate-100">
                <tr className="text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                  <th className="px-5 py-4">{labels.customerLabel}</th>
                  <th className="px-5 py-4">Phone</th>
                  <th className="px-5 py-4">City</th>
                  <th className="px-5 py-4">{labels.typeLabel}</th>
                  <th className="px-5 py-4">{labels.dateLabel}</th>
                  <th className="px-5 py-4">Consent</th>
                  <th className="px-5 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {customerList.map((c) => {
                  const mappedDate = c.dueDate || c.appointmentDate;
                  return (
                    <tr 
                      key={c.id} 
                      onClick={() => setSelectedCustomer(c)}
                      className="hover:bg-brand-50/40 cursor-pointer transition-colors" 
                      data-testid={`customer-row-${c.id}`}
                    >
                      <td className="px-5 py-4">
                        <div className="font-semibold text-brand-ink">{c.fullName}</div>
                        {c.email && <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5"><Mail className="w-3 h-3" /> {c.email}</div>}
                      </td>
                      <td className="px-5 py-4 text-slate-700">
                        <span className="flex items-center gap-1">
                          <Phone className="w-3.5 h-3.5 text-slate-400" /> {c.phone}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-slate-700">
                        {c.city ? (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-slate-400" /> {c.city}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-5 py-4 text-slate-600 capitalize">
                        {c.customerType || '—'}
                      </td>
                      <td className="px-5 py-4 text-slate-600 font-mono text-xs">
                        {mappedDate ? (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" /> {formatDate(mappedDate)}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-5 py-4">
                        <Badge variant={c.consentStatus === 'granted' ? 'success' : 'warning'}>{c.consentStatus}</Badge>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <button 
                          onClick={(e) => handleDelete(c.id, e)} 
                          className="text-slate-400 hover:text-red-600 p-1 transition-colors" 
                          data-testid={`customer-delete-${c.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Customer Add Modal */}
      {shouldShowAddModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm grid place-items-center z-50 p-4" onClick={closeModal} data-testid="customer-add-modal">
          <div className="glass-strong p-6 w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-brand-navy">Add a {labels.customerLabel.toLowerCase()}</h2>
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
              <div className="sm:col-span-2">
                <label className="label-base">City</label>
                <input className="input-field" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} data-testid="add-customer-city-input" />
              </div>
              <div className="sm:col-span-2">
                <label className="label-base">Notes</label>
                <textarea rows={2} className="input-field" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} data-testid="add-customer-notes-input" />
              </div>
              <div className="sm:col-span-2 flex justify-end gap-2 mt-2">
                <button type="button" onClick={closeModal} className="btn-secondary text-sm">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="btn-primary text-sm" data-testid="add-customer-submit-button">{isSubmitting ? 'Saving…' : `Add ${labels.customerLabel.toLowerCase()}`}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Customer Details Slide-over Drawer */}
      {selectedCustomer && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 bg-black/10 backdrop-blur-[1px] z-40 animate-fade-in" onClick={() => setSelectedCustomer(null)} />
          
          {/* Drawer Container */}
          <div 
            className="fixed inset-y-0 right-0 w-full sm:max-w-md bg-white/95 backdrop-blur-xl border-l border-slate-200 z-50 shadow-2xl p-6 overflow-y-auto flex flex-col justify-between"
            data-testid="customer-detail-drawer"
          >
            <div>
              {/* Drawer Header */}
              <div className="flex items-center justify-between pb-5 border-b border-slate-100 mb-6">
                <div>
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#2F5CFF]">
                    {labels.customerLabel} Profile
                  </span>
                  <h2 className="text-xl font-extrabold text-brand-navy mt-1">
                    {selectedCustomer.fullName}
                  </h2>
                </div>
                <button 
                  onClick={() => setSelectedCustomer(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-all border border-slate-200/50"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Core Details Block */}
              <div className="space-y-4">
                <div className="flex items-center gap-3 bg-slate-50 border border-slate-200/40 rounded-xl p-3.5">
                  <div className="w-8 h-8 rounded-lg bg-[#2F5CFF]/10 text-[#2F5CFF] grid place-items-center">
                    <Phone className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block">Phone Number</span>
                    <a href={`tel:${selectedCustomer.phone}`} className="text-sm font-semibold text-brand-navy hover:text-[#2F5CFF] transition-colors">
                      {selectedCustomer.phone}
                    </a>
                  </div>
                </div>

                {selectedCustomer.email && (
                  <div className="flex items-center gap-3 bg-slate-50 border border-slate-200/40 rounded-xl p-3.5">
                    <div className="w-8 h-8 rounded-lg bg-[#2F5CFF]/10 text-[#2F5CFF] grid place-items-center">
                      <Mail className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block">Email Address</span>
                      <span className="text-sm font-semibold text-brand-navy">{selectedCustomer.email}</span>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-3 bg-slate-50 border border-slate-200/40 rounded-xl p-3.5">
                  <div className="w-8 h-8 rounded-lg bg-[#2F5CFF]/10 text-[#2F5CFF] grid place-items-center">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block">Location (City)</span>
                    <span className="text-sm font-semibold text-brand-navy">{selectedCustomer.city || 'Not provided'}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3 bg-slate-50 border border-slate-200/40 rounded-xl p-3.5">
                  <div className="w-8 h-8 rounded-lg bg-[#2F5CFF]/10 text-[#2F5CFF] grid place-items-center">
                    <Hash className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block">{labels.typeLabel}</span>
                    <span className="text-sm font-semibold text-brand-navy capitalize">{selectedCustomer.customerType || '—'}</span>
                  </div>
                </div>

                {(selectedCustomer.dueDate || selectedCustomer.appointmentDate) && (
                  <div className="flex items-center gap-3 bg-slate-50 border border-slate-200/40 rounded-xl p-3.5">
                    <div className="w-8 h-8 rounded-lg bg-[#2F5CFF]/10 text-[#2F5CFF] grid place-items-center">
                      <Calendar className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block">{labels.dateLabel}</span>
                      <span className="text-sm font-semibold text-brand-navy">
                        {formatDate(selectedCustomer.dueDate || selectedCustomer.appointmentDate || '')}
                      </span>
                    </div>
                  </div>
                )}

                {selectedCustomer.notes && (
                  <div className="bg-slate-50 border border-slate-200/40 rounded-xl p-4 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-slate-400">
                      <FileText className="w-3.5 h-3.5" /> Notes & History
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed font-medium">
                      {selectedCustomer.notes}
                    </p>
                  </div>
                )}

                {/* Custom Fields dynamic grid per custom CSV upload column mapping */}
                {Object.keys(getParsedCustomFields(selectedCustomer)).length > 0 && (
                  <div className="space-y-3 pt-6 border-t border-slate-100 mt-6 animate-slide-up">
                    <h4 className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-[#2F5CFF]">
                      Custom Fields (CSV Metadata)
                    </h4>
                    <div className="grid grid-cols-2 gap-3">
                      {Object.entries(getParsedCustomFields(selectedCustomer)).map(([k, v]) => (
                        <div key={k} className="bg-slate-50/60 border border-slate-200/50 rounded-xl p-3">
                          <span className="block text-[9px] font-mono uppercase tracking-wider text-slate-400 truncate" title={k}>
                            {k.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim()}
                          </span>
                          <span className="block text-xs font-semibold text-brand-navy mt-0.5 truncate" title={v}>
                            {v}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-6 border-t border-slate-100 flex items-center justify-between mt-8 text-xs text-slate-400 font-mono">
              <span>Consent: {selectedCustomer.consentStatus}</span>
              <span>ID: {selectedCustomer.id.slice(0, 8)}...</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
