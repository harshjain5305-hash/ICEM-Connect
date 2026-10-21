import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import { validateInstitutionalEmail, INSTITUTIONAL_DOMAIN } from './domainValidation';
import { supabase, isSupabaseConfigured } from '@/integrations/supabase/client';
import { ShieldCheck, Mail, ArrowRight, UserCheck, KeyRound } from 'lucide-react';

interface AuthShellProps {
  onSuccess?: (userEmail: string) => void;
}

export const AuthShell: React.FC<AuthShellProps> = ({ onSuccess }) => {
  const [mode, setMode] = useState<'signin' | 'register' | 'verification_pending'>('register');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [prn, setPrn] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [statusMessage, setStatusMessage] = useState<{ type: 'info' | 'success' | 'warning' | 'destructive'; text: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const validateForm = () => {
    const errs: Record<string, string> = {};

    // Validate email with strict institutional check
    const emailResult = validateInstitutionalEmail(email);
    if (!emailResult.isValid) {
      errs.email = emailResult.error || 'Invalid institutional email.';
    }

    if (!password || password.length < 6) {
      errs.password = 'Password must be at least 6 characters.';
    }

    if (mode === 'register') {
      if (!name.trim()) {
        errs.name = 'Full name is required.';
      }
      if (!prn.trim()) {
        errs.prn = 'ICEM PRN is required for student verification.';
      }
      if (password !== confirmPassword) {
        errs.confirmPassword = 'Passwords do not match.';
      }
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      const configured = isSupabaseConfigured();

      if (!configured) {
        // When running in local Phase 0 verification without live remote secrets:
        // Validate domain and advance to verification shell to demonstrate the flow cleanly!
        setTimeout(() => {
          setIsLoading(false);
          if (mode === 'register') {
            setMode('verification_pending');
            setStatusMessage({
              type: 'success',
              text: `Verification email shell triggered for ${email}. (Configured domain: @${INSTITUTIONAL_DOMAIN})`,
            });
          } else {
            setStatusMessage({
              type: 'info',
              text: `Authentication shell validated for ${email}.`,
            });
            onSuccess?.(email);
          }
        }, 500);
        return;
      }

      if (mode === 'register') {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              name,
              prn,
            },
          },
        });

        if (error) {
          setStatusMessage({ type: 'destructive', text: error.message });
        } else {
          setMode('verification_pending');
          setStatusMessage({
            type: 'success',
            text: `Verification link sent to your institutional inbox (${email}). Please verify to continue.`,
          });
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          setStatusMessage({ type: 'destructive', text: error.message });
        } else if (data.user) {
          setStatusMessage({ type: 'success', text: 'Welcome back! Authentication successful.' });
          onSuccess?.(email);
        }
      }
    } catch (err) {
      setStatusMessage({
        type: 'destructive',
        text: err instanceof Error ? err.message : 'Authentication request failed.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-md px-4 py-8">
      <Card className="border-border shadow-lg">
        <CardHeader className="text-center pb-4">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#003C84]/10 text-primary">
            <ShieldCheck className="h-7 w-7 text-[#00A2A5]" />
          </div>
          <CardTitle className="text-xl">
            {mode === 'verification_pending'
              ? 'Verify Your ICEM Email'
              : mode === 'register'
              ? 'Create ICEM Student Account'
              : 'Sign in to ICEM Connect'}
          </CardTitle>
          <CardDescription>
            {mode === 'verification_pending'
              ? `A verification message was dispatched to ${email}`
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
            <form onSubmit={handleSubmit} className="space-y-4">
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

                  <div>
                    <Input
                      label="ICEM PRN / Student Roll"
                      placeholder="e.g. 123B1B045"
                      value={prn}
                      onChange={(e) => setPrn(e.target.value)}
                      error={errors.prn}
                      helperText="Private verification identifier. Never exposed publicly."
                      disabled={isLoading}
                      required
                    />
                  </div>
                </>
              )}

              <Input
                label="ICEM Email Address"
                type="email"
                placeholder={`yourname@${INSTITUTIONAL_DOMAIN}`}
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
                    <span>Verify & Register</span>
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
              <UserCheck className="h-3.5 w-3.5 text-primary" />
              <span>Restricted to Indira College of Engineering & Management students</span>
            </div>
          </CardFooter>
        )}
      </Card>
    </div>
  );
};
