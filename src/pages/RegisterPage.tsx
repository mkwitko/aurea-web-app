import { useState, useEffect, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../lib/auth';
import { apiErrorMessage } from '../lib/api-errors';
import { AuthShell } from '../components/AuthShell';
import { Help } from '../components/Help';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function RegisterPage() {
  const { t } = useTranslation();
  const { register, status } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
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

    // Validate passwords match
    if (password !== confirmPassword) {
      setError(t('auth.register.passwordMismatch'));
      return;
    }

    setBusy(true);
    try {
      await register({ name, organizationName, email, password });
      // Straight into the guide, not the dashboard: the landing promises the
      // first research in this session, and an empty dashboard with a checklist
      // is a page where that promise waits for a click.
      navigate('/app/onboarding');
    } catch (err) {
      // The backend's own wording when it sent one — "email already in use"
      // is actionable, the generic copy is not.
      setError(apiErrorMessage(err, t('auth.error')));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      eyebrow={t('auth.register.eyebrow')}
      title={t('auth.register.title')}
      subtitle={t('auth.register.subtitle')}
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">{t('auth.register.name')}</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="org">
            {t('auth.register.company')}
            <Help title={t('auth.register.companyHelpTitle')}>{t('auth.register.companyHelp')}</Help>
          </Label>
          <Input id="org" value={organizationName} onChange={(e) => setOrganizationName(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">{t('auth.register.email')}</Label>
          <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">{t('auth.register.password')}</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirmPassword">{t('auth.register.confirmPassword')}</Label>
          <Input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            minLength={8}
            required
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? t('auth.register.submitting') : t('auth.register.submit')}
        </Button>
      </form>
      <p className="mt-6 text-sm text-muted-foreground">
        {t('auth.register.have')}{' '}
        <Link to="/login" className="font-medium text-primary hover:underline">
          {t('auth.register.signin')}
        </Link>
      </p>
    </AuthShell>
  );
}
