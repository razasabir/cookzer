#!/usr/bin/env bash
# Applies any supabase/migrations/*.sql file that hasn't been run against
# the target database yet, tracked in a small public._schema_migrations
# table this script creates on first run.
#
# Migrations 001-029 were applied by hand through the Supabase SQL
# Editor before this script existed, so on its very first-ever run (the
# tracking table doesn't exist yet) it records those as already-applied
# without executing them, then runs everything from 030 onward. Every
# run after that just applies whatever's new.
set -euo pipefail

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is not set — add the SUPABASE_DB_URL secret in the repo's GitHub Actions settings (Settings > Secrets and variables > Actions)." >&2
  exit 1
fi

MIGRATIONS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/supabase/migrations"

# Applied by hand, before this script existed — see the comment above.
PREVIOUSLY_APPLIED_BY_HAND=(
  001_fix_participant_recursion.sql
  002_fix_creator_check_visibility.sql
  003_platform_tables.sql
  004_recipe_hero_photo.sql
  005_sample_recipes.sql
  006_restaurant_checkins.sql
  007_message_images.sql
  008_reactions_bookmarks.sql
  009_video_posts.sql
  010_cover_and_mood.sql
  011_groups.sql
  012_restaurant_ratings.sql
  013_saved_recipe_tags.sql
  014_moderation.sql
  015_group_conversations.sql
  016_recipe_lists.sql
  017_settings_and_notifications.sql
  018_performance_indexes.sql
  019_more_notification_types.sql
  020_group_admin_controls.sql
  021_ai_assistant_waitlist.sql
  022_ai_assistant_chat.sql
  023_oauth_signup_metadata.sql
  024_tip_posts.sql
  025_real_notifications.sql
  026_notification_email_pg_net.sql
  027_push_notifications.sql
  028_family_meal_planning.sql
  029_group_management.sql
)

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "
create table if not exists public._schema_migrations (
  filename text primary key,
  applied_at timestamptz not null default now()
);
"

tracked_count=$(psql "$DATABASE_URL" -tAc "select count(*) from public._schema_migrations;")
if [ "$tracked_count" -eq 0 ]; then
  echo "First run — recording the $(printf '%s\n' "${PREVIOUSLY_APPLIED_BY_HAND[@]}" | wc -l) migrations already applied by hand, without re-running them."
  for f in "${PREVIOUSLY_APPLIED_BY_HAND[@]}"; do
    psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "insert into public._schema_migrations (filename) values ('$f') on conflict do nothing;"
  done
fi

applied_any=0
for filepath in "$MIGRATIONS_DIR"/*.sql; do
  filename=$(basename "$filepath")
  already=$(psql "$DATABASE_URL" -tAc "select 1 from public._schema_migrations where filename = '$filename';")
  if [ "$already" == "1" ]; then
    echo "Skipping $filename (already applied)"
    continue
  fi
  echo "Applying $filename ..."
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$filepath"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "insert into public._schema_migrations (filename) values ('$filename');"
  echo "Applied $filename"
  applied_any=1
done

if [ "$applied_any" -eq 0 ]; then
  echo "Nothing to do — every migration is already applied."
else
  echo "Done."
fi

# Supabase's REST/RPC layer (PostgREST) caches the database schema and
# only picks up new tables/functions/columns on its own periodic reload
# — running migrations by hand via psql (as this script does, rather
# than through the Supabase dashboard) never tells it to refresh, so a
# newly-migrated table or RPC can 500 from the client for a while after
# a migration that applied cleanly. Sending this NOTIFY (Supabase's
# documented mechanism for exactly this) makes PostgREST reload
# immediately, every run — harmless, and worth it unconditionally since
# it's what actually made this migration's own tables/RPCs usable.
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "NOTIFY pgrst, 'reload schema';"
echo "Told PostgREST to reload its schema cache."
