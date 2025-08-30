import { z } from "zod";

export const LanguageLevelEnum = z.enum(["A1","A2","B1","B2","C1","C2","NATIVE"]);

export const CandidateLanguageInput = z.object({
  language: z.string().min(1, "language is required"),
  level: LanguageLevelEnum
});

export const CandidateProfileUpsertSchema = z.object({
  fullName: z.string().min(3).max(200),
  country: z.string().optional(),
  city: z.string().optional(),
  position: z.string().optional(),
  salaryMin: z.number().int().nonnegative().optional(),
  salaryMax: z.number().int().nonnegative().optional(),
  education: z.string().optional(),
  skills: z.array(z.string().min(1)).max(50).optional(),
  languages: z.array(CandidateLanguageInput).max(20).optional()
}).refine(
  (d) => (d.salaryMin == null || d.salaryMax == null) || d.salaryMin <= d.salaryMax,
  { message: "salaryMin must be <= salaryMax", path: ["salaryMin"] }
);

export const EmployerProfileUpsertSchema = z.object({
  companyName: z.string().min(2),
  industry: z.string().min(2),
  contactPerson: z.string().min(2),
  city: z.string().optional(),
  contacts: z.any().optional(), // можно уточнить схему JSON по желанию
  description: z.string().max(2000).optional()
});
