# Experience and authentication update

17 October 2026. Public origin: https://veyra-forensics.vercel.app.

## Delivered surfaces

Sources and Cyber ethics sit beside Methodology in the shared footer. Sources distinguishes primary research, public safety guidance and implementation documentation from evidence of product accuracy. Cyber ethics covers permission, privacy, uncertainty, context, respectful handling and independent verification.

The footer uses a monumental Archivo Black wordmark, graphite surfaces and a restrained red fracture. Its composition was informed by the rendered Vivacity footer, without using that site's assets. Decorative small gray text was removed; remaining captions and controls use a readable type scale and contrast. Core warnings and evidence remain visible.

Application views keep the address at `/`. Back, Forward and refresh restore the current view using history state and tab-scoped storage. Legacy direct paths remain valid entry points. Sharing the root address does not encode a particular view. OAuth temporarily visits the provider and the required API callback before returning to the root address.

The source is separated into layout, authentication session, history, navigation and case-study modules. Authored code comments and unused footer rules were removed. Third-party attribution remains. `npm run source:package` creates a scanned archive with an explicit file allowlist, excluding secrets, local deployment state, dependencies and build artifacts.

## Provider and database configuration

Dedicated Google and GitHub OAuth clients use the exact HTTPS callback paths documented in AUTHENTICATION.md. Google's consent application is external and published in production, with only OpenID/profile/email scopes. GitHub requests no additional scopes. No provider access tokens are retained.

Neon Free is provisioned in Washington DC (iad1). Neon Auth and Realtime are disabled. The application schema is installed. Vercel holds only the restricted runtime database connection: CRUD on five application tables and access to two sequences. SQL inspection confirmed no superuser, database creation, role management or schema creation privileges. The temporary bootstrap function was removed. Owner credentials are not installed in the application.

The free plan and its capacity limits still apply. Backup retention, maintenance scheduling, operator contact information and ongoing usage monitoring remain operational responsibilities.

## Verification

All 38 browser tests passed against the production build on localhost:3009. This includes provider mocks using real Auth.js/session routes, refresh, logout, ownership, import/review, evidence tracing, graph replay, PDF export, error recovery, keyboard access, reduced motion and responsive layouts. The new Sources, ethics and footer views were inspected at 1920, 1440, 1366 and 390 pixels. All 28 unit/API tests, lint and the TypeScript/production build passed.

Production deployment `dpl_yQQpERgLfi978piqDkZbBKSPTCQN` is ready on the canonical origin. All 10 product/navigation browser tests passed on that origin, including the actual opening, graph workflow, root-address routing and responsive Sources/ethics/footer views. HTTP verification passed for 13 routes and 29 assets. Both provider buttons are enabled; the production CSRF endpoint responds, and guest private-history access returns 401. No page exceptions were observed.

Real Google and GitHub first-time authorization and returning-user login passed after the user's consent approval. Both profile images appeared, sessions survived refresh, and logout returned to login. GitHub's synthetic four-message investigation was saved, listed, renamed, reopened and restored after refresh. Google's separate account could neither list nor open that GitHub investigation. The approved synthetic record was permanently deleted and remained absent after refresh.

Read-only production SQL checks confirmed one account per provider, two distinct users, no retained provider access/refresh/ID tokens, hashed unexpired session tokens and zero remaining investigations after cleanup. Only aggregate results were recorded; no profile data or credentials are included in verification artifacts.

Live acceptance found two presentation issues: an expired OAuth security check used misleading configuration copy, and a restored four-message report displayed replay position 60. The error now offers a direct retry and alternate provider; restored replay starts at its actual message count. All 14 authentication/product browser tests passed after these fixes, including regression assertions before and after refresh. Follow-up production deployment `dpl_3q8nfNaUoNXmT48FKTsm4F2tZ5Ny` publishes these corrections on the same canonical origin. [The live acceptance record](LIVE_AUTH_ACCEPTANCE.md) describes the actual provider checks.

Provider cancellation, outage simulation, session expiry, invalid redirects and unauthorized mutation remain covered by automated provider mocks. No live provider outage or cross-user destructive operation was induced. Automated accessibility checks do not establish screen-reader compatibility or field performance.

Final live checks on the follow-up deployment passed for 13 routes, 29 assets, configured provider buttons, the guest authorization boundary and session continuity across deployment. Real Google guest-report recovery displayed the corrected four-message replay count and still required explicit save consent. The temporary report was cleared and private history remained empty.
