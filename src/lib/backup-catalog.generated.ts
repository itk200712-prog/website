// Generated from canonical supabase/schema.sql; no runtime secrets.
export const SCHEMA_BACKUP_TABLES = [
  {
    "name": "profiles",
    "pk": "id"
  },
  {
    "name": "business_units",
    "pk": "slug"
  },
  {
    "name": "business_services",
    "pk": "id"
  },
  {
    "name": "business_contacts",
    "pk": "id"
  },
  {
    "name": "business_branches",
    "pk": "id"
  },
  {
    "name": "board_members",
    "pk": "id"
  },
  {
    "name": "news",
    "pk": "id"
  },
  {
    "name": "gallery_items",
    "pk": "id"
  },
  {
    "name": "gallery_comments",
    "pk": "id"
  },
  {
    "name": "messages",
    "pk": "id"
  },
  {
    "name": "membership_applications",
    "pk": "id"
  },
  {
    "name": "member_rows",
    "pk": "id"
  },
  {
    "name": "voter_rows",
    "pk": "id"
  },
  {
    "name": "data_files",
    "pk": "id"
  },
  {
    "name": "data_imports",
    "pk": "id"
  },
  {
    "name": "fuel_prices",
    "pk": "type"
  },
  {
    "name": "system_settings",
    "pk": "key"
  },
  {
    "name": "f28_members",
    "pk": "id"
  },
  {
    "name": "f28_items",
    "pk": "id"
  },
  {
    "name": "special_download_access",
    "pk": "id"
  },
  {
    "name": "backup_secrets",
    "pk": "key"
  },
  {
    "name": "site_images_backup",
    "pk": "path"
  },
  {
    "name": "backup_history",
    "pk": "id"
  },
  {
    "name": "fuel_stock",
    "pk": "id"
  },
  {
    "name": "admin_activity_logs",
    "pk": "id"
  },
  {
    "name": "live_chat_events",
    "pk": "id"
  },
  {
    "name": "chat_sessions",
    "pk": "id"
  },
  {
    "name": "chat_messages",
    "pk": "id"
  },
  {
    "name": "notify_emails",
    "pk": "id"
  }
];
export const SCHEMA_SELF_REFERENCES = [
  {
    "table": "gallery_comments",
    "column": "parent_id",
    "targetColumn": "id"
  }
];
