import LoginPage from '@/components/LoginPage';

interface AuthPageProps {
  searchParams: Promise<{ mode?: string }>;
}

export default async function AuthPage({ searchParams }: AuthPageProps) {
  const resolvedSearchParams = await searchParams;
  const initialMode = resolvedSearchParams.mode === 'signup' ? 'signup' : 'signin';
  return <LoginPage initialMode={initialMode} />;
}
