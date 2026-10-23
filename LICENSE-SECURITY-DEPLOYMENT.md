# License Security and Production Deployment

## License authority

The configured central license authority is defined by `HOST_BASE_URL` in `config.ts` (currently `https://acc.ashkghalam.ir`). The mother web portal is the only build that contains license issuance, server-registry management and package-generation tools. Windows, Android and isolated preview builds replace those pages with client-only screens.

If the production license-authority domain changes, update `HOST_BASE_URL`, deploy the PHP backend to that host, then rebuild and test the mother web portal and both native clients before distribution. Do not make the authority URL editable in customer builds.

## PHP server requirements

- PHP OpenSSL extension enabled.
- HTTPS enabled for the central host.
- PHP's account must be able to create/update `host-backend/data/workspaces_auth.json`.
- The first request to `tenant-manager.php` creates an empty tenant registry and a random server-only `admin_secret_key`. Read it through the host's trusted File Manager/SSH access; never commit or send it in chat.
- The same file receives the private key used to sign license receipts. Do not commit this generated file or any private-key material to Git.

## Protect the data directory

For Apache, keep the supplied `.htaccess` in `host-backend/data/`; confirm that `AllowOverride` permits access rules and that requesting `/host-backend/data/workspaces_auth.json` returns HTTP 403 or 404.

For Nginx, `.htaccess` is ignored. Add a server rule equivalent to:

```nginx
location ^~ /host-backend/data/ { deny all; }
location ^~ /data/ { deny all; }
```

Adjust the paths to match the actual document root. Verify from a separate browser that JSON data and backups are not directly downloadable. Restrict file permissions for the registry to the PHP account and administrator (typically 0600 on supported hosts).

## License issuance and activation

1. Open `/license-manager` in the mother web portal.
2. Enter the server-only admin secret from `workspaces_auth.json`.
3. Create a license. The portal records the customer, plan, quotas, HWID and token in the server registry; it no longer creates a client-side HMAC activation code.
4. Give the customer the license key, dedicated workspace ID and central host URL.
5. The Windows/Android client sends an online verification request. It checks the RSA signature, license key hash, workspace, device ID, validity window, status, plan and quotas before enabling commercial entitlements.
6. Revocation suspends the server registry entry. Clients re-check when they start or return online.

Legacy `ACT-...` activation codes are intentionally rejected because the old scheme included a signing secret in distributed client code. Reissue and register licenses through the mother portal.

## Release artifacts

GitHub Actions artifacts are QA downloads; they are not the same as an official signed release. A production release requires the version tag to match `package.json` and these GitHub Actions repository secrets:

- `WINDOWS_SIGNING_PFX_BASE64`
- `WINDOWS_SIGNING_PFX_PASSWORD`
- `ANDROID_KEYSTORE_BASE64`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

Never commit certificate/keystore bytes or paste secret values into chat. Without signing secrets, Windows EXE files are unsigned and the APK workflow emits a debug/test build.

## Current protections added on this branch

- `api.php` requires a registered workspace credential, enforces HWID for tenant requests, restricts global CRUD to the mother administrator, and scopes support-chat history by `workspace_id`.
- `host-api.php` no longer trusts `VITE_API_TOKEN`; global operations require the validated mother-portal administrator credential.
- `storage.php` now keeps `sig_`, `share_` and `public_` keys inside the current workspace instead of copying or searching those records globally. The public-signature API is the designated cross-device link-capability path.
- Server-side persistence enforces `max_customers`, `max_documents`, and `max_users` for collection writes, including the record-oriented API. Counters cover the key-value and record-per-file representations and use locks during writes. Over-limit existing data may be edited/reduced, but a write that grows it beyond the entitlement is rejected.
- The record-oriented `host-storage-api.php` restricts table names and record IDs, rejects path traversal, scopes logs/data to the workspace, validates uploaded image content, and checks quotas.
- `deleted-records-api.php` requires license/token/HWID, isolates tombstones per workspace, and limits cleanup to the mother administrator.
- `remote-signature-api.php` requires licensed workspace auth for management, separates requests by workspace, issues server-generated capability tokens, and requires an OTP session for SMS/e-mail authenticated signing.
- `signature-api-simple.php` requires a licensed workspace to create a request; public reads/signing are limited to an exact high-entropy request token, records are not written into the generic cross-tenant storage path, and replay/duplicate-token attempts are rejected.
- The legacy global database, upload, audit-trail, certificate, and old signature APIs, plus public installer/setup diagnostics, return HTTP 410. Signature backup generation and daily cleanup scripts return HTTP 403 on web requests and are CLI-only.
- `gemini-api.php` requires a licensed workspace/device, uses server-side `GEMINI_API_KEY` configuration only, and rate-limits requests on the server. The browser client no longer includes a shared fallback token. For shared hosting, `host-backend/.env.local` may be used for server-side keys; it is excluded from release packages and denied by the provided Apache rules. The old `VITE_API_TOKEN` signature-key fallback is removed; configure `ASHK_DIGITAL_SIGNATURE_API_TOKEN` only on the server if that legacy route is needed.
- Host package assembly removes stale runtime data, registries, database files, environment files and private key material before packaging. Every generated runtime data directory receives access-deny rules, and a CI regression test seeds dummy private files to verify they do not enter the host ZIP.

## Remaining production security gates

**This branch is not a production security sign-off.** The changes and integration tests run against a disposable PHP test server; they do not deploy the new PHP files to `acc.ashkghalam.ir` or verify the live server’s web-stack configuration.

Before a commercial rollout:

1. Deploy the current `host-backend/` endpoints and their matching configuration to the actual host. Remove/rotate any previously exposed shared keys or frontend-bundled secrets in production configuration; changing Git does not revoke a key already present on the live host.
2. Confirm Apache `.htaccess` rules are active. If Nginx serves the domain, add equivalent deny rules for `/host-backend/data/`, `/data/`, `/db/`, `/uploads/`, `/backups/`, `/daily-backups/`, and all other private runtime directories. Verify direct requests return 403/404 from a separate browser.
3. Set server-only secrets as environment variables where possible: `GEMINI_API_KEY` for AI use and `ASHK_DIGITAL_SIGNATURE_API_TOKEN` only if the legacy digital-signature API is still used. Do not add them to `VITE_*` variables or customer builds.
4. Configure daily cleanup only as a trusted CLI cron, for example `php /absolute/path/to/host-backend/daily-cron.php`. Ensure the host stores `workspaces_auth.json` outside public download paths and that backup files are not directly downloadable.
5. Run the real-host flow: mother-portal license issue → activation on Windows and Android → save/sync under quotas → rejected write above quota → revoke → verify access is denied. Test support-chat separation, signature/OTP delivery, image upload/download and recovery from backup.
6. Generate a commercial release only after end-to-end tests pass and signing secrets are configured. Without the Windows PFX and Android keystore secrets listed above, artifacts remain unsigned/test builds.

The workflow run on this branch reports the disposable security suite and host-package privacy regression tests. That does not establish that the live production host is patched, that provider SMS/e-mail delivery succeeds, or that every feature gate is enforced by the application UI.