-- Add autoInviteEnabled to SparkSetting.
-- Controls whether applicants from trusted email domains are automatically
-- sent an interview invite (bypassing the recruiter review queue). The
-- invite goes to the candidate's inbox — not returned in the API response —
-- so a spoofed email domain is harmless: the bearer link only reaches the
-- real inbox owner.
ALTER TABLE "SparkSetting"
  ADD COLUMN IF NOT EXISTS "autoInviteEnabled" boolean NOT NULL DEFAULT false;
