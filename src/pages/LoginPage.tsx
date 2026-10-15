import { useState, useEffect, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../lib/auth';
import { apiErrorMessage } from '../lib/api-errors';
import { AuthShell } from '../components/AuthShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function LoginPage() {
  const { t } = useTranslation();
  const { login, status } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Redirect if already authenticated
  useEffect(() => {
    if (status === 'authenticated') {
      navigate('/app', { replace: true });
    }
  }, [status, navigate]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(email, password);
      navigate('/app');
    } catch (err) {
      // The backend's own wording when it sent one — "invalid credentials"
      // tells the user what to do next, the generic copy does not.
      setError(apiErrorMessage(err, t('auth.error')));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell eyebrow={t('auth.login.eyebrow')} title={t('auth.login.title')} subtitle={t('auth.login.subtitle')}>
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">{t('auth.login.email')}</Label>
          <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">{t('auth.login.password')}</Label>
          <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? t('auth.login.submitting') : t('auth.login.submit')}
        </Button>
      </form>
      <p className="mt-6 text-sm text-muted-foreground">
        {t('auth.login.newHere')}{' '}
        <Link to="/register" className="font-medium text-primary hover:underline">
          {t('auth.login.create')}
        </Link>
      </p>
    </AuthShell>
  );
}
