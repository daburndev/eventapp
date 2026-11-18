"use client";

import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { TextField } from "@/components/ui/TextField";
import {
  validateLoginForm,
  type LoginFormErrors,
  type LoginFormValues,
} from "@/features/staff-auth/validation/login.schema";

interface LoginFormProps {
  isSubmitting: boolean;
  submitError: string | null;
  onSubmit: (values: LoginFormValues) => void;
}

export function LoginForm({ isSubmitting, submitError, onSubmit }: LoginFormProps) {
  const [values, setValues] = useState<LoginFormValues>({ email: "", password: "" });
  const [errors, setErrors] = useState<LoginFormErrors>({});

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validateLoginForm(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length === 0) {
      onSubmit(values);
    }
  }

  return (
    <Card className="w-full max-w-sm">
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <h1 className="text-xl font-bold">Staff login</h1>
        <TextField
          label="Email"
          type="email"
          autoComplete="username"
          value={values.email}
          onChange={(event) => setValues((current) => ({ ...current, email: event.target.value }))}
          error={errors.email}
        />
        <TextField
          label="Password"
          type="password"
          autoComplete="current-password"
          value={values.password}
          onChange={(event) => setValues((current) => ({ ...current, password: event.target.value }))}
          error={errors.password}
        />
        {submitError ? (
          <p role="alert" className="text-sm text-danger">
            {submitError}
          </p>
        ) : null}
        <Button type="submit" isFullWidth isLoading={isSubmitting}>
          Log in
        </Button>
      </form>
    </Card>
  );
}
