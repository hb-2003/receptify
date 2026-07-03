'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Megaphone, Plus, Trash2, Users, Calendar } from 'lucide-react';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { PURPOSE_LABEL, formatDate } from '@/lib/utils';
import { toast } from 'sonner';

export default function CampaignsPage() {
  const [campaignList, setCampaignList] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = async () => {
    const r = await fetch('/api/campaigns');
    const d = await r.json();
    setCampaignList(d.campaigns || []);
    setIsLoading(false);
  };
  useEffect(() => { load(); const t = setInterval(load, 4000); return () => clearInterval(t); }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this campaign?')) return;
    await fetch(`/api/campaigns/${id}`, { method: 'DELETE' });
    toast.success('Deleted');
    load();
  };

  return (
    <div className="space-y-6" data-testid="campaigns-page">
      <header className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <span className="overline">Calling campaigns</span>
          <h1 className="mt-2 text-3xl font-extrabold text-brand-navy">Campaigns</h1>
          <p className="text-slate-500 text-sm mt-1">View, launch and track your AI calling campaigns.</p>
        </div>
        <Link href="/campaigns/new" className="btn-primary text-sm" data-testid="campaigns-new-button">
          <Plus className="w-4 h-4" /> Create campaign
        </Link>
      </header>

      {isLoading ? (
        <div className="glass h-60 animate-pulse" />
      ) : campaignList.length === 0 ? (
        <EmptyState icon={Megaphone} title="No campaigns yet" description="Create your first AI calling campaign in under 2 minutes." action={
          <Link href="/campaigns/new" className="btn-primary text-sm">Create campaign</Link>
        } />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5" data-testid="campaigns-grid">
          {campaignList.map((c) => (
            <div key={c.id} className="glass p-5 hover:shadow-glow-hover transition-shadow" data-testid={`campaign-card-${c.id}`}>
              <div className="flex items-start justify-between">
                <span className="badge bg-brand-50 text-brand-700">{PURPOSE_LABEL[c.purpose] || c.purpose}</span>
                <StatusBadge status={c.status} />
              </div>
              <h3 className="font-bold text-brand-navy text-lg mt-3">{c.name}</h3>
              <div className="text-xs text-slate-500 mt-1 flex items-center gap-3">
                <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {c.totalContacts} contacts</span>
                <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {formatDate(c.createdAt)}</span>
              </div>

              {c.totalContacts > 0 && c.status !== 'draft' && (
                <div className="mt-4">
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-slate-500">Progress</span>
                    <span className="text-brand-700 font-semibold">{c.callsCompleted}/{c.totalContacts}</span>
                  </div>
                  <div className="h-2 bg-brand-50 rounded-full overflow-hidden">
                    <div className="h-full bg-brand-gradient" style={{ width: `${Math.min(100, (c.callsCompleted / Math.max(c.totalContacts, 1)) * 100)}%` }} />
                  </div>
                </div>
              )}

              <div className="mt-5 flex items-center justify-between">
                <Link href={`/campaigns/${c.id}`} className="text-brand-700 text-sm font-semibold hover:underline" data-testid={`campaign-view-${c.id}`}>View details →</Link>
                <button onClick={() => handleDelete(c.id)} className="text-slate-400 hover:text-red-600 p-1" data-testid={`campaign-delete-${c.id}`}><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}