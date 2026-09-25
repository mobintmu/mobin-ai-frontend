import { useCallback, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowRight, LockKeyhole, ShieldCheck } from 'lucide-react';
import { Turnstile } from './Turnstile';
import { register, type Session, ApiError } from '../lib/api';

const schema = z.object({
  given_name: z.string().trim().min(1, 'Enter your given name.'),
  family_name: z.string().trim().min(1, 'Enter your family name.'),
  email: z.string(), phone: z.string(), privacy_accepted: z.boolean(), marketing_consent: z.boolean(),
}).superRefine((data, context) => {
  if (!data.email.trim() && !data.phone.trim()) context.addIssue({ code: 'custom', path: ['email'], message: 'Enter an email address or phone number.' });
  if (data.email.trim() && !z.email().safeParse(data.email.trim()).success) context.addIssue({ code: 'custom', path: ['email'], message: 'Enter a valid email address.' });
  if (data.phone.trim() && !/^\+?[\d\s().-]{7,24}$/.test(data.phone.trim())) context.addIssue({ code: 'custom', path: ['phone'], message: 'Enter a valid phone number with country code.' });
  if (!data.privacy_accepted) context.addIssue({ code: 'custom', path: ['privacy_accepted'], message: 'Accept the privacy notice to continue.' });
});
type Form = z.infer<typeof schema>;

export function Registration({ onComplete }: { onComplete: (session: Session) => void }) {
  const [token, setToken] = useState<string | null>(null);
  const [resetSignal, setResetSignal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(null);
  const submittingRef = useRef(false);
  const { register: field, handleSubmit, formState: { errors, isSubmitting } } = useForm<Form>({ resolver: zodResolver(schema), defaultValues: { given_name: '', family_name: '', email: '', phone: '', privacy_accepted: false, marketing_consent: false } });
  const onToken = useCallback((value: string | null) => setToken(value), []);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token || submittingRef.current) return;

    submittingRef.current = true;
    setError(null);
    setReference(null);

    try {
      await handleSubmit(async values => {
        try {
          const session = await register({
            given_name: values.given_name.trim(),
            family_name: values.family_name.trim(),
            email: values.email.trim() || null,
            phone: values.phone.trim() || null,
            privacy_accepted: true,
            privacy_policy_version: '2026-09-25',
            marketing_consent: values.marketing_consent,
            turnstile_token: token,
          });
          onComplete(session);
        } catch (caught) {
          const apiError = caught instanceof ApiError ? caught : null;
          setError(apiError?.message ?? 'Registration could not be completed. Please try again.');
          setReference(apiError?.requestId ?? null);
          if (apiError?.code.startsWith('turnstile') || apiError?.code === 'network_error') {
            setToken(null);
            setResetSignal(value => value + 1);
          }
        }
      })(event);
    } finally {
      submittingRef.current = false;
    }
  };
  return <div className="registration-wrap">
    <div className="registration-heading"><span className="eyebrow">01 / GET STARTED</span><h2>Start with a quick hello.</h2><p>A few details help keep Mobin'AI useful and give us a way to follow up about the service.</p></div>
    <form className="registration-form" onSubmit={submit} noValidate>
      <div className="two-fields">
        <label>Given name <span aria-hidden="true">*</span><input autoComplete="given-name" {...field('given_name')} aria-invalid={!!errors.given_name} /><small>{errors.given_name?.message}</small></label>
        <label>Family name <span aria-hidden="true">*</span><input autoComplete="family-name" {...field('family_name')} aria-invalid={!!errors.family_name} /><small>{errors.family_name?.message}</small></label>
      </div>
      <div className="two-fields">
        <label>Email <span className="optional">optional</span><input type="email" autoComplete="email" placeholder="you@example.com" {...field('email')} aria-invalid={!!errors.email} /><small>{errors.email?.message}</small></label>
        <label>Phone <span className="optional">optional</span><input type="tel" autoComplete="tel" placeholder="+1 555 000 0000" {...field('phone')} aria-invalid={!!errors.phone} /><small>{errors.phone?.message}</small></label>
      </div>
      <p className="field-hint">Provide at least one contact method. Your email or phone is not verified.</p>
      <div className="consents">
        <label className="check-row"><input type="checkbox" {...field('privacy_accepted')} /><span>I agree to the <a href="/privacy" target="_blank" rel="noopener noreferrer">privacy notice</a>. <b>*</b><small>{errors.privacy_accepted?.message}</small></span></label>
        <label className="check-row"><input type="checkbox" {...field('marketing_consent')} /><span>I’d like occasional updates from Mobin. <em>Optional</em></span></label>
      </div>
      <Turnstile onToken={onToken} resetSignal={resetSignal} />
      {error && <p className="form-error" role="alert">{error}{reference && <> Support reference: {reference}</>}</p>}
      <button className="primary-button" disabled={!token || isSubmitting} type="submit">{isSubmitting ? 'Creating your space…' : 'Continue to chat'} <ArrowRight size={18} /></button>
      <p className="form-footnote"><LockKeyhole size={14} /> Your conversation stays in this browser session. <ShieldCheck size={14} /></p>
    </form>
  </div>;
}
