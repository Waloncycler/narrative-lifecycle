import type { canonicalEvents, rawSnapshots } from '@/db/schema';

export type CanonicalEvent = typeof canonicalEvents.$inferSelect;
export type RawSnapshot = typeof rawSnapshots.$inferSelect;
