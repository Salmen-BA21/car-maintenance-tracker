import { z } from 'zod';

const localDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date in YYYY-MM-DD format.')
  .refine((value) => new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value, 'Use a real calendar date.');

const createCarSchema = z
  .object({
    name: z.string().trim().min(1, 'Car name is required.').max(60, 'Car name must be 60 characters or less.'),
    fuelType: z.enum(['petrol', 'diesel']),
    timingDrive: z.enum(['belt', 'chain']),
    gearbox: z.enum(['manual', 'automatic']),
    hasDpf: z.boolean(),
    initialOdometerKm: z.number().int().min(0).max(9_999_999),
    entryDate: localDate,
  })
  .superRefine((value, context) => {
    if (value.fuelType !== 'diesel' && value.hasDpf) {
      context.addIssue({ code: 'custom', path: ['hasDpf'], message: 'Only diesel cars can have a DPF.' });
    }
  });

export type CreateCarInput = z.input<typeof createCarSchema>;

export class CarInputError extends Error {
  constructor(readonly messages: string[]) {
    super(messages.join(' '));
  }
}

export function parseCreateCarInput(input: CreateCarInput) {
  const result = createCarSchema.safeParse(input);
  if (!result.success) throw new CarInputError(result.error.issues.map((issue) => issue.message));
  return result.data;
}
