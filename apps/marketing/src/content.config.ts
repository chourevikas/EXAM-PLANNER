import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const exams = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/exams' }),
  schema: z.object({
    title: z.string(),
    description: z.string().max(170),
    name: z.string(),
    shortName: z.string(),
    /** Exam type name as configured in the admin panel; used for the free practice link. */
    practiceExam: z.string(),
    icon: z.string(),
    order: z.number(),
    updated: z.coerce.date(),
    faqs: z.array(z.object({ q: z.string(), a: z.string() })).default([]),
  }),
});

const legal = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/legal' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    updated: z.coerce.date(),
    /** Unreviewed drafts are served with noindex until the business signs off. */
    reviewed: z.boolean().default(false),
  }),
});

export const collections = { exams, legal };
