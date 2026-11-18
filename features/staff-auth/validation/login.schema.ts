import { z } from "zod";

export const loginSchema = z.object({
  email: z.email("Enter a valid email."),
  password: z.string().min(1, "Enter your password."),
});

export type LoginFormValues = z.infer<typeof loginSchema>;

export type LoginFormErrors = Partial<Record<keyof LoginFormValues, string>>;

export function validateLoginForm(values: LoginFormValues): LoginFormErrors {
  const result = loginSchema.safeParse(values);
  if (result.success) {
    return {};
  }
  const errors: LoginFormErrors = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0] as keyof LoginFormValues | undefined;
    if (field && !errors[field]) {
      errors[field] = issue.message;
    }
  }
  return errors;
}
