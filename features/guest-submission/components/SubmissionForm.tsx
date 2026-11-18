"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/Button";
import { TextAreaField, TextField } from "@/components/ui/TextField";
import type { ServiceType, Tier } from "@/interfaces/venue/venue";
import { PhotoPicker } from "@/features/guest-submission/components/PhotoPicker";
import { TierPicker } from "@/features/guest-submission/components/TierPicker";
import { TurnstileWidget } from "@/features/guest-submission/components/TurnstileWidget";
import { MESSAGE_MAX_LENGTH, RETENTION_NOTICE } from "@/features/guest-submission/constants/submission-rules";
import { APP_ROUTES } from "@/lib/constants/app-routes";
import {
  validateSubmissionForm,
  type SubmissionFormErrors,
  type SubmissionFormValues,
} from "@/features/guest-submission/validation/submission-form.schema";

interface SubmissionFormProps {
  tiers: Tier[];
  serviceType: ServiceType;
  isSubmitting: boolean;
  submitError: string | null;
  /** Empty = Turnstile off (local dev). */
  turnstileSiteKey: string;
  onSubmit: (values: SubmissionFormValues, turnstileToken: string | null) => void;
}

export function SubmissionForm({
  tiers,
  serviceType,
  isSubmitting,
  submitError,
  turnstileSiteKey,
  onSubmit,
}: SubmissionFormProps) {
  const [values, setValues] = useState<SubmissionFormValues>({
    tierId: tiers[0]?.id ?? "",
    message: "",
    instagram: "",
    lineId: "",
    photo: null,
  });
  const [errors, setErrors] = useState<SubmissionFormErrors>({});
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  // Turnstile tokens are single-use: every submit attempt remounts the widget for a fresh one.
  const [submitAttempt, setSubmitAttempt] = useState(0);
  const isWaitingForCheck = Boolean(turnstileSiteKey) && !turnstileToken;

  function updateField<TField extends keyof SubmissionFormValues>(field: TField, value: SubmissionFormValues[TField]) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validateSubmissionForm(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length === 0 && !isWaitingForCheck) {
      onSubmit(values, turnstileToken);
      setTurnstileToken(null);
      setSubmitAttempt((attempt) => attempt + 1);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
      <TierPicker
        tiers={tiers}
        selectedTierId={values.tierId}
        onSelect={(tierId) => updateField("tierId", tierId)}
        error={errors.tierId}
      />
      <TextAreaField
        label="Your message"
        rows={3}
        maxLength={MESSAGE_MAX_LENGTH}
        placeholder="Happy birthday Nan! 🎂"
        value={values.message}
        onChange={(event) => updateField("message", event.target.value)}
        hint={`${values.message.length}/${MESSAGE_MAX_LENGTH}`}
        error={errors.message}
      />
      <TextField
        label="Instagram (optional)"
        placeholder="@your.ig"
        autoCapitalize="none"
        autoCorrect="off"
        value={values.instagram}
        onChange={(event) => updateField("instagram", event.target.value)}
        error={errors.instagram}
      />
      <TextField
        label="Line ID (optional)"
        placeholder="your.line.id"
        autoCapitalize="none"
        autoCorrect="off"
        value={values.lineId}
        onChange={(event) => updateField("lineId", event.target.value)}
        error={errors.lineId}
      />
      <PhotoPicker photo={values.photo} onChange={(photo) => updateField("photo", photo)} error={errors.photo} />
      {submitError ? (
        <p role="alert" className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">
          {submitError}
        </p>
      ) : null}
      {turnstileSiteKey ? (
        <TurnstileWidget key={submitAttempt} siteKey={turnstileSiteKey} onToken={setTurnstileToken} />
      ) : null}
      <Button type="submit" isFullWidth isLoading={isSubmitting} disabled={isWaitingForCheck}>
        {isWaitingForCheck ? "Checking you're not a bot…" : "Send to screen"}
      </Button>
      <p className="text-center text-xs text-muted">
        {RETENTION_NOTICE[serviceType]}{" "}
        <Link href={APP_ROUTES.privacy} className="underline underline-offset-2">
          Privacy
        </Link>
      </p>
    </form>
  );
}
