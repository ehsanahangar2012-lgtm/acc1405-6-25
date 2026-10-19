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

## Remaining production security gates

The reserved \`default\`/\`main\` workspace no longer has an anonymous super-admin bypass: current storage endpoints require the server-only admin secret for mother-portal requests. Customer workspace storage and the updated backup endpoints require the server-issued workspace token plus the registered device HWID. Keep the admin secret only in the mother portal's session storage; rotate it if it may have been exposed.

**Do not treat this branch as a production security sign-off yet.** The older global \`api.php\`, \`host-api.php\`, \`server-api-database.php\` and \`server-api-upload.php\` implementations require a separate migration/audit for authentication and tenant isolation. In particular, verify that support-chat reads do not return other customers' messages and that legacy backup, SMS, vault and generic CRUD actions cannot be called anonymously. Disable unused legacy endpoints or make them fail closed before public rollout.

Also verify all directory-deny rules against the actual hosting stack (Apache \`.htaccess\` versus Nginx rules), validate backups/uploads from a separate browser, and run the portal → issue → activate → sync → revoke flow against the real deployed host. CI uses a disposable test registry and does not prove production hosting configuration.