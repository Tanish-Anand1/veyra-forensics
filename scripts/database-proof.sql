SELECT jsonb_build_object(
  'application', 'VEYRA',
  'source', 'Hosted Neon PostgreSQL / Vercel SQL console',
  'scope', 'Current stored accounts and sessions, not a historical login-event log',
  'totals', jsonb_build_object(
    'captured_at', NOW(),
    'users', (SELECT COUNT(*) FROM users),
    'linked_accounts', (SELECT COUNT(*) FROM accounts),
    'google_accounts', (SELECT COUNT(*) FROM accounts WHERE provider = 'google'),
    'github_accounts', (SELECT COUNT(*) FROM accounts WHERE provider = 'github'),
    'stored_sessions', (SELECT COUNT(*) FROM sessions),
    'active_sessions', (SELECT COUNT(*) FROM sessions WHERE expires > NOW()),
    'investigations', (SELECT COUNT(*) FROM investigations),
    'retained_provider_tokens', (SELECT COUNT(*) FROM accounts WHERE access_token IS NOT NULL OR refresh_token IS NOT NULL OR id_token IS NOT NULL),
    'hashed_session_records', (SELECT COUNT(*) FROM sessions WHERE "sessionToken" ~ '^[a-f0-9]{64}$')
  ),
  'accounts', COALESCE((SELECT jsonb_agg(record ORDER BY account_ref) FROM (
    SELECT SUBSTRING(MD5(u.id::text), 1, 10) AS account_ref,
      CASE WHEN u.name IS NULL THEN 'Not supplied'
        WHEN LEFT(u.name, 1) ~ '^[A-Za-z]$' THEN UPPER(LEFT(u.name, 1)) || '*******'
        ELSE 'U*******' END AS masked_name,
      (u.name IS NOT NULL) AS name_stored,
      (u.image IS NOT NULL) AS profile_image_stored,
      EXISTS(SELECT 1 FROM accounts a WHERE a."userId" = u.id AND a.provider = 'google') AS google,
      EXISTS(SELECT 1 FROM accounts a WHERE a."userId" = u.id AND a.provider = 'github') AS github,
      (SELECT COUNT(*) FROM sessions s WHERE s."userId" = u.id) AS stored_sessions,
      (SELECT COUNT(*) FROM sessions s WHERE s."userId" = u.id AND s.expires > NOW()) AS active_sessions,
      (SELECT MAX(expires) FROM sessions s WHERE s."userId" = u.id) AS latest_session_expiry
    FROM users u ORDER BY account_ref LIMIT 100
  ) record), '[]'::jsonb),
  'account_limit', 100,
  'redaction', 'No full names, emails, original user IDs, provider IDs, avatars, token values or database credentials are included.'
) AS snapshot;
