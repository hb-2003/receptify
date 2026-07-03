'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Phone, User, Calendar, Clock, FileText, Mic, Sparkles } from 'lucide-react';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { PURPOSE_LABEL, LANGUAGE_LABEL, formatDate, formatDuration } from '@/lib/utils';

export default function CallDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/calls/${id}`).then((r) => r.json()).then((d) => { setData(d); setIsLoading(false); });
  }, [id]);

  if (isLoading || !data?.call) return <div className="glass h-60 animate-pulse" />;
  const { call, customer, campaign, transcript, recording } = data;

  return (
    <div className="space-y-6 max-w-4xl" data-testid="call-detail-page">
      <header>
        <Link href="/calls" className="text-xs text-brand-600 inline-flex items-center gap-1 mb-2"><ArrowLeft className="w-3 h-3" /> Back to calls</Link>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-3xl font-extrabold text-brand-navy">Call with {customer?.fullName}</h1>
          <StatusBadge status={call.status} />
          <StatusBadge status={call.outcome} type="outcome" />
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Info icon={User} label="Customer" value={`${customer?.fullName} · ${customer?.phone}`} />
        <Info icon={Phone} label="Campaign" value={campaign?.name} />
        <Info icon={Calendar} label="Started" value={call.startedAt ? formatDate(call.startedAt) : 'Not started'} />
        <Info icon={Clock} label="Duration" value={formatDuration(call.durationSec)} />
      </div>

      <div className="glass p-6" data-testid="call-recording-section">
        <h3 className="font-bold text-brand-navy mb-3 flex items-center gap-2"><Mic className="w-4 h-4" /> Recording</h3>
        {recording ? (
          <>
            <audio controls src={recording.audioUrl} className="w-full rounded-xl" data-testid="call-audio-player" />
            <p className="text-xs text-slate-500 mt-2">Mock recording — real audio will play when calling integration is connected.</p>
          </>
        ) : (
          <p className="text-sm text-slate-500">No recording available.</p>
        )}
      </div>

      <div className="glass p-6" data-testid="call-transcript-section">
        <h3 className="font-bold text-brand-navy mb-3 flex items-center gap-2"><FileText className="w-4 h-4" /> Transcript</h3>
        {transcript ? (
          <div className="bg-white rounded-xl border border-slate-200 p-4 text-sm whitespace-pre-wrap leading-relaxed text-brand-ink max-h-72 overflow-auto">
            {transcript.text}
          </div>
        ) : (
          <p className="text-sm text-slate-500">No transcript available.</p>
        )}
      </div>

      {transcript?.summary && (
        <div className="glass p-6" data-testid="call-summary-section">
          <h3 className="font-bold text-brand-navy mb-2 flex items-center gap-2"><Sparkles className="w-4 h-4" /> AI Summary</h3>
          <p className="text-sm text-brand-ink leading-relaxed">{transcript.summary}</p>
        </div>
      )}
    </div>
  );
}

function Info({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="glass p-4 flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 grid place-items-center"><Icon className="w-4 h-4" /></div>
      <div className="min-w-0">
        <div className="text-xs uppercase tracking-wider text-slate-500 font-semibold">{label}</div>
        <div className="text-sm font-semibold text-brand-ink truncate">{value || '—'}</div>
      </div>
    </div>
  );
}
