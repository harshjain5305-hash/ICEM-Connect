import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import { useAuth } from './useAuth';
import { registerSchema, loginSchema, DEPARTMENTS } from './auth.schema';
import { INSTITUTIONAL_DOMAIN } from './domainValidation';
import { ShieldCheck, Mail, ArrowRight, UserCheck, KeyRound, Sparkles } from 'lucide-react';

interface AuthShellProps {
  onSuccess?: (userEmail: string) => void;
}

export const AuthShell: React.FC<AuthShellProps> = ({ onSuccess }) => {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<'signin' | 'register' | 'verification_pending'>('register');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [prn, setPrn] = useState('');
  const [department, setDepartment] = useState('');
  const [year, setYear] = useState<number | ''>('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [statusMessage, setStatusMessage] = useState<{ type: 'info' | 'success' | 'warning' | 'destructive'; text: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fillDemoStudent = () => {
    setName('Rahul Sharma');
    setEmail(`rahul.sharma@${INSTITUTIONAL_DOMAIN}`);
    setPrn('PRN123456');
    setDepartment('MCA');
    setYear(1);
    setPassword('CampusPass123!');
    setConfirmPassword('CampusPass123!');
    setErrors({});
  };

  const fillDemoAdmin = () => {
    setName('ICEM Campus Admin');
    setEmail(`admin.moderator@${INSTITUTIONAL_DOMAIN}`);
    setPrn('ADMIN001');
    setDepartment('Computer Engineering');
    setYear(4);
    setPassword('CampusPass123!');
    setConfirmPassword('CampusPass123!');
    setErrors({});
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);
    setErrors({});

    if (mode === 'register') {
      const result = registerSchema.safeParse({
        name,
        email,
        prn,
        department: department || null,
        year: year ? Number(year) : null,
        password,
        confirmPassword,
      });

      if (!result.success) {
        const fieldErrors: Record<string, string> = {};
        result.error.errors.forEach((err) => {
          if (err.path[0]) fieldErrors[String(err.path[0])] = err.message;
        });
        setErrors(fieldErrors);
        return;
      }

      setIsLoading(true);
      try {
        const res = await register(result.data);
        if (res.requiresVerification) {
          setMode('verification_pending');
          setStatusMessage({
            type: 'success',
            text: `Verification link dispatched to ${email}.`,
          });
        } else {
          setStatusMessage({
            type: 'success',
            text: 'Account created and verified! Welcome to ICEM Connect.',
          });
          onSuccess?.(email);
        }
      } catch (err) {
        setStatusMessage({
          type: 'destructive',
          text: err instanceof Error ? err.message : 'Registration failed.',
        });
      } finally {
        setIsLoading(false);
      }
    } else {
      const result = loginSchema.safeParse({ email, password });
      if (!result.success) {
        const fieldErrors: Record<string, string> = {};
        result.error.errors.forEach((err) => {
          if (err.path[0]) fieldErrors[String(err.path[0])] = err.message;
        });
        setErrors(fieldErrors);
        return;
      }

      setIsLoading(true);
      try {
        await login(result.data);
        setStatusMessage({ type: 'success', text: 'Welcome back! Signed in successfully.' });
        onSuccess?.(email);
      } catch (err) {
        setStatusMessage({
          type: 'destructive',
          text: err instanceof Error ? err.message : 'Sign in failed.',
        });
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <div className="mx-auto w-full max-w-md px-4 py-6">
      <Card className="border-border shadow-lg">
        <CardHeader className="text-center pb-3">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#003C84]/10 text-primary">
            <ShieldCheck className="h-7 w-7 text-[#00A2A5]" />
          </div>
          <CardTitle className="text-xl text-primary">
            {mode === 'verification_pending'
              ? 'Verify Your ICEM Email'
              : mode === 'register'
              ? 'Create ICEM Student Account'
              : 'Sign in to ICEM Connect'}
          </CardTitle>
          <CardDescription>
            {mode === 'verification_pending'
              ? `Verification sent to ${email}`
              : `Strictly restricted to verified @${INSTITUTIONAL_DOMAIN} students`}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {statusMessage && (
            <div className="mb-4">
              <Alert variant={statusMessage.type}>{statusMessage.text}</Alert>
            </div>
          )}

          {mode === 'verification_pending' ? (
            <div className="space-y-4 text-center py-2">
              <div className="rounded-xl border border-[#00A2A5]/30 bg-[#00A2A5]/5 p-4 text-left text-xs text-primary dark:border-[#00A2A5]/40 dark:bg-[#00A2A5]/10 dark:text-foreground space-y-2">
                <div className="flex items-center gap-2 font-semibold text-[#003C84] dark:text-[#43CBD0]">
                  <Mail className="h-4 w-4 text-[#00A2A5]" />
                  <span>Institutional Domain Verification</span>
                </div>
                <p>
                  We enforce server-side validation to ensure only active ICEM students can join. Please check your college inbox at <strong>{email}</strong> to activate your account.
                </p>
                <p className="text-[11px] text-muted-foreground pt-1 border-t border-[#00A2A5]/20">
                  Privacy note: Your PRN ({prn || 'verified'}) is stored strictly in private backend tables and will never be exposed to other riders.
                </p>
              </div>

              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setMode('signin');
                  setStatusMessage(null);
                }}
              >
                Back to Sign In
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3.5">
              {/* Quick Fill Helpers for Testing */}
              <div className="flex items-center justify-between pb-1 text-[11px]">
                <span className="text-muted-foreground">Quick test fill:</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={fillDemoStudent}
                    className="text-primary hover:underline font-medium flex items-center gap-1"
                  >
                    <Sparkles className="h-3 w-3 text-[#00A2A5]" /> Student
                  </button>
                  <span className="text-muted-foreground">•</span>
                  <button
                    type="button"
                    onClick={fillDemoAdmin}
                    className="text-[#E85C0D] hover:underline font-medium flex items-center gap-1"
                  >
                    <Sparkles className="h-3 w-3" /> Admin
                  </button>
                </div>
              </div>

              {mode === 'register' && (
                <>
                  <Input
                    label="Full Name"
                    placeholder="e.g. Rahul Sharma"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    error={errors.name}
                    disabled={isLoading}
                    required
                  />

                  <Input
                    label="ICEM PRN / Roll"
                    placeholder="e.g. 123B1B045"
                    value={prn}
                    onChange={(e) => setPrn(e.target.value)}
                    error={errors.prn}
                    helperText="Confidential verification identifier. Never exposed publicly."
                    disabled={isLoading}
                    required
                  />

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-foreground mb-1">
                        Department
                      </label>
                      <select
                        value={department}
                        onChange={(e) => setDepartment(e.target.value)}
                        className="flex h-11 w-full rounded-lg border border-input bg-card px-2.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <option value="">Optional</option>
                        {DEPARTMENTS.map((dept) => (
                          <option key={dept} value={dept}>
                            {dept}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-foreground mb-1">
                        Year
                      </label>
                      <select
                        value={year}
                        onChange={(e) => setYear(e.target.value ? Number(e.target.value) : '')}
                        className="flex h-11 w-full rounded-lg border border-input bg-card px-2.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <option value="">Optional</option>
                        <option value={1}>1st Year</option>
                        <option value={2}>2nd Year</option>
                        <option value={3}>3rd Year</option>
                        <option value={4}>4th Year</option>
                        <option value={5}>5th Year</option>
                      </select>
                    </div>
                  </div>
                </>
              )}

              <Input
                label="ICEM Email Address"
                type="email"
                placeholder={`student@${INSTITUTIONAL_DOMAIN}`}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                error={errors.email}
                helperText={`Must end with @${INSTITUTIONAL_DOMAIN}`}
                disabled={isLoading}
                required
              />

              <Input
                label="Password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                error={errors.password}
                disabled={isLoading}
                required
              />

              {mode === 'register' && (
                <Input
                  label="Confirm Password"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  error={errors.confirmPassword}
                  disabled={isLoading}
                  required
                />
              )}

              <Button type="submit" className="w-full mt-2" isLoading={isLoading}>
                {mode === 'register' ? (
                  <>
                    <span>Verify &amp; Register</span>
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                ) : (
                  <>
                    <span>Sign In</span>
                    <KeyRound className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </form>
          )}
        </CardContent>

        {mode !== 'verification_pending' && (
          <CardFooter className="flex flex-col gap-3 border-t border-border pt-4 text-center text-sm">
            {mode === 'register' ? (
              <p className="text-muted-foreground text-xs">
                Already registered with your ICEM email?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('signin');
                    setErrors({});
                    setStatusMessage(null);
                  }}
                  className="font-medium text-primary hover:underline"
                >
                  Sign In
                </button>
              </p>
            ) : (
              <p className="text-muted-foreground text-xs">
                New ICEM student?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('register');
                    setErrors({});
                    setStatusMessage(null);
                  }}
                  className="font-medium text-primary hover:underline"
                >
                  Create Account
                </button>
              </p>
            )}

            <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
              <UserCheck className="h-3.5 w-3.5 text-[#00A2A5]" />
              <span>Restricted to Indira College of Engineering &amp; Management students</span>
            </div>
          </CardFooter>
        )}
      </Card>
    </div>
  );
};
