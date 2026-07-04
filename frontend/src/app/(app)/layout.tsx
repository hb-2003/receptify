import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { Sidebar } from '@/components/ui/Sidebar';

// Fetches the authenticated user and business profile from the Django backend.
// We use a server-side HTTP request since this Server Component runs on the Node.js server
// and can no longer connect directly to the database.
async function fetchCurrentUserProfile() {
  const cookieStore = await cookies();
  const authToken = cookieStore.get('receptify_token')?.value;

  // If there's no auth cookie, the user is unauthenticated
  if (!authToken) {
    return null;
  }

  // Use the backend URL provided in environments, falling back to local Django development port
  const backendServerUrl = process.env.REACT_APP_BACKEND_URL || 'http://127.0.0.1:8000';

  try {
    // Send the user's auth token cookie along to let Django verify who they are
    const backendResponse = await fetch(`${backendServerUrl}/api/auth/me`, {
      headers: {
        Cookie: `receptify_token=${authToken}`,
      },
    });

    if (!backendResponse.ok) {
      return null;
    }

    return await backendResponse.json();
  } catch (error) {
    // If the network or backend is down, log it and treat the user as unauthenticated
    console.error('Failed to retrieve user profile from the backend server:', error);
    return null;
  }
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const profileData = await fetchCurrentUserProfile();

  // If the profile fetch failed or they are unauthenticated, redirect to the login page immediately
  if (!profileData?.user) {
    redirect('/login');
  }

  const user = profileData.user;
  const business = profileData.business;

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