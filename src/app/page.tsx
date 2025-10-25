import { redirect } from 'next/navigation';

export default function Home() {
  // Redirect to landing page for unauthenticated users
  redirect('/landing');
}
