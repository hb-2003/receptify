import { redirect } from 'next/navigation';
import { getUserFromRequest } from '@/lib/auth';
import { getDB } from '@/lib/db/data-source';
import { Business } from '@/lib/db/entities/Business';
import { Sidebar } from '@/components/ui/Sidebar';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getUserFromRequest();
  if (!user) redirect('/login');
  let business: Business | null = null;
  if (user.businessId) {
    const db = await getDB();
    business = await db.getRepository(Business).findOne({ where: { id: user.businessId } });
  }
  return (
    <div className="bg-dashboard">
      <Sidebar
        user={{ ownerName: user.ownerName, email: user.email }}
        business={business ? { name: business.name } : undefined}
      />
      <main className="ml-[220px] min-h-screen p-6 lg:p-10">{children}</main>
    </div>
  );
}
