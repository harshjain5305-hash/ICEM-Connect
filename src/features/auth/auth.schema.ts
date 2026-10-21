import { z } from 'zod';
import { validateInstitutionalEmail } from './domainValidation';

export const DEPARTMENTS = [
  'MCA',
  'Computer Engineering',
  'Artificial Intelligence & Data Science',
  'Information Technology',
  'Mechanical Engineering',
  'Civil Engineering',
  'MBA',
] as const;

export const emailSchema = z
  .string()
  .min(1, 'Email address is required')
  .email('Please enter a valid email format')
  .refine(
    (email) => validateInstitutionalEmail(email).isValid,
    (email) => ({
      message: validateInstitutionalEmail(email).error || 'Must be an official @indiraicem.ac.in email',
    })
  );

export const registerSchema = z
  .object({
    name: z
      .string()
      .min(2, 'Name must be at least 2 characters')
      .max(80, 'Name must be less than 80 characters')
      .regex(/^[a-zA-Z\s.'-]+$/, 'Name can only contain letters, spaces, and hyphens'),
    email: emailSchema,
    prn: z
      .string()
      .min(4, 'PRN must be at least 4 characters')
      .max(30, 'PRN must be less than 30 characters')
      .regex(/^[a-zA-Z0-9_-]+$/, 'PRN must be alphanumeric'),
    department: z.string().optional().nullable(),
    year: z
      .number()
      .int()
      .min(1, 'Year must be between 1 and 5')
      .max(5, 'Year must be between 1 and 5')
      .optional()
      .nullable(),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    confirmPassword: z.string().min(6, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
});

export const profileUpdateSchema = z.object({
  department: z.string().optional().nullable(),
  year: z
    .number()
    .int()
    .min(1, 'Year must be between 1 and 5')
    .max(5, 'Year must be between 1 and 5')
    .optional()
    .nullable(),
  profile_image_url: z.string().url('Must be a valid URL').optional().nullable(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
