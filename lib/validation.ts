import { z } from "zod";

export const QUESTION_MAX = 255;
export const CATEGORY_MAX = 255;
export const ANSWER_MAX = 10_000;

const singleLine = (label: string, max: number) =>
  z
    .string()
    .trim()
    .max(max, `${label} must be ${max} characters or fewer`)
    .refine((v) => !/[\r\n]/.test(v), `${label} must be a single line`);

export const faqInputSchema = z.object({
  question: singleLine("Question", QUESTION_MAX).pipe(
    z.string().min(1, "Question is required"),
  ),
  answer: z
    .string()
    .trim()
    .min(1, "Answer is required")
    .max(ANSWER_MAX, `Answer must be ${ANSWER_MAX} characters or fewer`),
  category: singleLine("Category", CATEGORY_MAX),
  active: z.boolean(),
});

export type FaqInput = z.infer<typeof faqInputSchema>;
export type FaqField = keyof FaqInput;
export type FieldErrors = Partial<Record<FaqField, string>>;

export const FAQ_FIELDS = Object.keys(faqInputSchema.shape) as FaqField[];

export function validateFaqInput(
  data: unknown,
): { ok: true; value: FaqInput } | { ok: false; fieldErrors: FieldErrors } {
  const result = faqInputSchema.safeParse(data);
  if (result.success) return { ok: true, value: result.data };

  const fieldErrors: FieldErrors = {};
  for (const issue of result.error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && key in faqInputSchema.shape) {
      fieldErrors[key as FaqField] ??= issue.message;
    }
  }
  return { ok: false, fieldErrors };
}
