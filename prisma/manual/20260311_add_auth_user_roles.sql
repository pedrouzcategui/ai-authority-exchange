DO $$
BEGIN
  CREATE TYPE auth_user_role AS ENUM ('user', 'admin');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE auth_users
ADD COLUMN IF NOT EXISTS role auth_user_role NOT NULL DEFAULT 'user';

UPDATE auth_users
SET role = 'user'
WHERE role IS NULL;

UPDATE auth_users AS auth_user
SET role = 'admin'
FROM users AS legacy_user
WHERE auth_user.legacy_user_id = legacy_user.id
  AND lower(trim(coalesce(
    nullif(legacy_user.full_name, ''),
    nullif(concat_ws(' ', legacy_user.first_name, legacy_user.last_name), '')
  ))) = 'pedro uzcategui';