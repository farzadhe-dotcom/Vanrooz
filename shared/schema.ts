import { z } from "zod";
export const imageSchema = z.object({
  url: z
    .string()
    .url()
    .refine((u) => new URL(u).protocol === "https:", "HTTPS required"),
  alt: z.string().min(3),
  creator: z.string().min(1),
  sourceUrl: z
    .string()
    .url()
    .refine((u) => new URL(u).protocol === "https:", "HTTPS required"),
  licence: z.string().min(1),
  licenceUrl: z
    .string()
    .url()
    .refine((u) => new URL(u).protocol === "https:", "HTTPS required"),
  related: z.boolean(),
  changes: z.string(),
});
export const articleSchema = z.object({
  id: z.string().min(1),
  section: z.enum(["vancouver", "canada"]),
  category: z.string().min(2),
  headline: z.string().min(8).max(180),
  intro: z.string().min(30).max(800),
  paragraphs: z.array(z.string().min(20).max(1800)).min(1).max(8),
  publishedAt: z.string().datetime({ offset: true }),
  sourceName: z.string().min(1),
  olderReason: z.string(),
  image: imageSchema,
});
export const eventSchema = z.object({
  id: z.string(),
  title: z.string().min(5),
  description: z.string().min(20),
  venue: z.string().min(2),
  address: z.string().min(2),
  occurrences: z
    .array(
      z.object({
        start: z.string().datetime({ offset: true }),
        end: z.string().datetime({ offset: true }),
      }),
    )
    .min(1)
    .max(100),
  scheduleLabel: z.string().min(2),
  priceLabel: z.string().min(2),
  bookingUrl: z
    .string()
    .url()
    .refine((u) => new URL(u).protocol === "https:", "HTTPS required"),
  sourceName: z.string(),
  image: imageSchema,
});
export const editionSchema = z.object({
  date: z.string(),
  publishedAt: z.string().datetime({ offset: true }),
  note: z.string(),
  articles: z.array(articleSchema).min(1).max(13),
  events: z.array(eventSchema).max(6),
});
export type Article = z.infer<typeof articleSchema>;
export type EventItem = z.infer<typeof eventSchema>;
export type Edition = z.infer<typeof editionSchema>;
export type ImageAsset = z.infer<typeof imageSchema>;
export interface Source {
  id: string;
  name: string;
  kind: "rss" | "events";
  url: string;
  hosts: string[];
  section: "vancouver" | "canada";
  enabled: boolean;
  rightsReviewed: boolean;
  rightsNote: string;
  maxWords: number;
  selector?: string;
  imageKey: string;
}
export interface Candidate {
  id: string;
  sourceId: string;
  sourceName: string;
  url: string;
  title: string;
  publishedAt: string;
  text: string;
  hash: string;
  section: "vancouver" | "canada";
  maxWords: number;
  imageKey: string;
}
