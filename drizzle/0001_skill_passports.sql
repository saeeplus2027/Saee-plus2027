CREATE TABLE `skill_passports` (
  `user_id` text PRIMARY KEY NOT NULL,
  `payload` text NOT NULL,
  `version` integer NOT NULL DEFAULT 1,
  `updated_at` text NOT NULL
);
