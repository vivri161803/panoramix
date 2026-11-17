# api

## Overview
HTTP route handlers under `/api`. Currently it only contains the scheduled
cron jobs.

## Subdirectories & Boundaries
- cron: [./cron/README.md](./cron/README.md) - `CRON_SECRET`-protected `GET` handlers for daily alerts and prep reminders, using the Supabase admin client.
