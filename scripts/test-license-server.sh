#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TEST_DIR="$(mktemp -d)"
SERVER_PID=""
cleanup() { if [[ -n "$SERVER_PID" ]]; then kill "$SERVER_PID" 2>/dev/null || true; fi; rm -rf "$TEST_DIR"; }
trap cleanup EXIT
cp "$ROOT_DIR/host-backend/license_validator.php" "$ROOT_DIR/host-backend/tenant-manager.php" "$ROOT_DIR/host-backend/host-storage-api.php" "$ROOT_DIR/host-backend/storage.php" "$ROOT_DIR/host-backend/server-api-backup.php" "$ROOT_DIR/host-backend/backup-system.php" "$ROOT_DIR/host-backend/api.php" "$ROOT_DIR/host-backend/host-api.php" "$ROOT_DIR/host-backend/server-api-database.php" "$ROOT_DIR/host-backend/server-api-upload.php" "$ROOT_DIR/host-backend/audit-trail-api.php" "$ROOT_DIR/host-backend/digital-signature-config.php" "$ROOT_DIR/host-backend/remote-signature-api.php" "$ROOT_DIR/host-backend/signature-api-simple.php" "$TEST_DIR/"
mkdir -p "$TEST_DIR/data"
export TEST_REGISTRY_PATH="$TEST_DIR/data/workspaces_auth.json"
php <<'PHP'
<?php
$privateKey = openssl_pkey_new(['private_key_type' => OPENSSL_KEYTYPE_RSA, 'private_key_bits' => 2048]);
if ($privateKey === false) { fwrite(STDERR, "Unable to create RSA key\n"); exit(1); }
$privatePem = '';
if (!openssl_pkey_export($privateKey, $privatePem)) { fwrite(STDERR, "Unable to export RSA key\n"); exit(1); }
$details = openssl_pkey_get_details($privateKey);
$base = ['title'=>'CI Test Customer','created_at'=>date('Y-m-d H:i:s'),'expire_date'=>date('Y-m-d',strtotime('+7 days')),'status'=>'ACTIVE','max_users'=>5,'is_unlimited'=>false,'plan'=>'BRONZE','max_customers'=>50,'max_documents'=>500,'features'=>['BASIC_MODULES'],'hwid'=>'','workspace_id'=>'ws_test','token'=>'ASHK-CI-TEST-0001'];
$expired = $base; $expired['workspace_id']='ws_expired'; $expired['token']='ASHK-CI-EXPIRED-0001'; $expired['expire_date']=date('Y-m-d',strtotime('-2 days'));
$registry=['auto_register_new_tenants'=>false,'admin_secret_key'=>'ci-test-admin-secret','license_signing_private_key'=>$privatePem,'license_signing_public_key'=>$details['key'],'workspaces'=>['ws_test'=>$base,'ws_expired'=>$expired]];
$json=json_encode($registry,JSON_PRETTY_PRINT|JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);
if($json===false||file_put_contents(getenv('TEST_REGISTRY_PATH'),$json)===false){fwrite(STDERR,"Unable to write test registry\n");exit(1);}
chmod(getenv('TEST_REGISTRY_PATH'),0600);
PHP
# Reserved mother workspaces must require the server-held admin secret; no anonymous super-admin bypass.
php -r '
require $argv[1];
$checks = [
  ["default", "", false, "ADMIN_AUTH_REQUIRED"],
  ["main", "wrong", false, "ADMIN_AUTH_REQUIRED"],
  ["default", "ci-test-admin-secret", true, "ACTIVE"],
  ["main", "ci-test-admin-secret", true, "ACTIVE"],
  ["", "ci-test-admin-secret", false, "INVALID_WORKSPACE"]
];
foreach ($checks as [$workspace, $token, $allowed, $status]) {
  $result = LicenseValidator::validateAccess($workspace, $token);
  if (($result["allowed"] ?? false) !== $allowed || ($result["status"] ?? "") !== $status) {
    fwrite(STDERR, "Mother workspace auth failed for " . json_encode($workspace) . ": " . json_encode($result) . "\n");
    exit(1);
  }
}
echo "PASS: master workspaces require the server admin secret; blank workspace is denied.\n";
' "$TEST_DIR/license_validator.php"

PORT="$(node -e "const s=require('node:net').createServer();s.listen(0,'127.0.0.1',()=>{console.log(s.address().port);s.close()})")"
php -S "127.0.0.1:$PORT" -t "$TEST_DIR" >"$TEST_DIR/php-server.log" 2>&1 &
SERVER_PID=$!
BASE_URL="http://127.0.0.1:$PORT"

for attempt in $(seq 1 40); do
  if curl --silent --fail "$BASE_URL/tenant-manager.php?action=public_key" >/dev/null; then break; fi
  sleep 0.25
done

# A legacy digital-signature API must never accept the historical public fallback or VITE token.
if grep -Eq "default-api-key-change-in-production|VITE_API_TOKEN" \
  "$ROOT_DIR/host-backend/digital-signature-config.php" \
  "$ROOT_DIR/android/app/src/main/assets/public/digital-signature-config.php"; then
  echo "Public/fallback digital-signature API credentials must not be used" >&2
  exit 1
fi
unset ASHK_DIGITAL_SIGNATURE_API_TOKEN || true
VITE_API_TOKEN=default-api-key-change-in-production php -r '
require $argv[1];
$config = DigitalSignatureConfig::getInstance();
if ($config->validateToken("default-api-key-change-in-production") || $config->validateToken("")) {
  fwrite(STDERR, "Digital-signature API accepted a missing/server-unconfigured secret\\n"); exit(1);
}
' "$TEST_DIR/digital-signature-config.php"
ASHK_DIGITAL_SIGNATURE_API_TOKEN=ci-digital-signature-secret php -r '
require $argv[1];
$config = DigitalSignatureConfig::getInstance();
if (!$config->validateToken("ci-digital-signature-secret") ||
    $config->validateToken("wrong-secret") ||
    $config->validateToken("default-api-key-change-in-production")) {
  fwrite(STDERR, "Digital-signature server-only token validation failed\\n"); exit(1);
}
' "$TEST_DIR/digital-signature-config.php"

# Retired legacy endpoints must fail closed.
for endpoint in server-api-database.php server-api-upload.php audit-trail-api.php; do
  code="$(curl --silent --show-error --max-time 8 -o "$TEST_DIR/$endpoint.json" -w '%{http_code}' "$BASE_URL/$endpoint")"
  [[ "$code" == "410" ]]
  php -r '$j=json_decode(file_get_contents($argv[1]),true);if(($j["error"]??"")!=="ENDPOINT_RETIRED"){fwrite(STDERR,"Retired endpoint returned an unexpected result");exit(1);}' "$TEST_DIR/$endpoint.json"
done
if grep -Eq "secure_api_token_change_this" "$ROOT_DIR/host-backend/server-api-database.php" "$ROOT_DIR/host-backend/server-api-upload.php"; then
  echo "Legacy fallback token must not exist in retired endpoints" >&2
  exit 1
fi

# Only a server-authorized mother account may access the global host API.
code="$(curl --silent --show-error --max-time 8 -o "$TEST_DIR/host-api-no-auth.json" -w '%{http_code}' "$BASE_URL/host-api.php?action=status")"
[[ "$code" == "403" ]]
code="$(curl --silent --show-error --max-time 8 -o "$TEST_DIR/host-api-mother.json" -w '%{http_code}' \
  -H 'X-Workspace-ID: default' -H 'X-Workspace-Token: ci-test-admin-secret' "$BASE_URL/host-api.php?action=status")"
[[ "$code" == "200" ]]
php -r '$j=json_decode(file_get_contents($argv[1]),true);if(($j["success"]??false)!==true){fwrite(STDERR,"Mother host API authorization failed");exit(1);}' "$TEST_DIR/host-api-mother.json"

# Generic legacy API calls are denied without workspace credentials.
code="$(curl --silent --show-error --max-time 8 -o "$TEST_DIR/api-no-auth.json" -w '%{http_code}' \
  -H 'Content-Type: application/json' -d '{"action":"get","table":"companies"}' "$BASE_URL/api.php")"
[[ "$code" == "403" ]]

post_json() {
  local body="$1" output="$2"; shift 2
  curl --silent --show-error --max-time 8 "$@" -H 'Content-Type: application/json' -d "$body" -o "$output" -w '%{http_code}' "$BASE_URL/tenant-manager.php"
}
assert_status() {
  php -r '$j=json_decode(file_get_contents($argv[1]),true); if (($j["status"]??"") !== $argv[2]) {fwrite(STDERR,"Expected ".$argv[2].", got ".($j["status"]??"missing")."\n"); exit(1);}' "$1" "$2"
}
# Protected storage must fail closed for default/main unless the master secret is supplied.
code="$(curl --silent --show-error --max-time 8 -o "$TEST_DIR/master-storage-denied.json" -w '%{http_code}' \
  -H 'Content-Type: application/json' -d '{"action":"test","workspace_id":"default"}' "$BASE_URL/host-storage-api.php")"
[[ "$code" == "403" ]]
php -r '$j=json_decode(file_get_contents($argv[1]),true);if(($j["status"]??"")!=="ADMIN_AUTH_REQUIRED"){fwrite(STDERR,"Expected protected master storage denial\n");exit(1);}' "$TEST_DIR/master-storage-denied.json"

# A query-string token must not authenticate protected storage APIs.
code="$(curl --silent --show-error --max-time 8 -o "$TEST_DIR/master-storage-query.json" -w '%{http_code}' \
  "$BASE_URL/host-storage-api.php?action=test&workspace_id=default&workspace_token=ci-test-admin-secret")"
[[ "$code" == "403" ]]

# A verified mother-portal admin secret may access the reserved master workspace.
code="$(curl --silent --show-error --max-time 8 -o "$TEST_DIR/master-storage-allowed.json" -w '%{http_code}' \
  -H 'Content-Type: application/json' -d '{"action":"stats","workspace_id":"default","workspace_token":"ci-test-admin-secret"}' "$BASE_URL/host-storage-api.php")"
[[ "$code" == "200" ]]
php -r '$j=json_decode(file_get_contents($argv[1]),true);if(($j["success"]??false)!==true||!is_array($j["stats"]??null)){fwrite(STDERR,"Master storage did not accept verified admin\n");exit(1);}' "$TEST_DIR/master-storage-allowed.json"

# Verification must use POST; do not expose license keys through query-string logs.
code="$(curl --silent --show-error --max-time 8 -o "$TEST_DIR/get-verify.json" -w '%{http_code}' "$BASE_URL/tenant-manager.php?action=verify_license&workspace_id=ws_test&token=ASHK-CI-TEST-0001&hwid=HWID-GET")"
[[ "$code" == "405" ]]

code="$(post_json '{"action":"verify_license","workspace_id":"ws_test","token":"WRONG-KEY","hwid":"HWID-ATTACKER"}' "$TEST_DIR/invalid.json")"
[[ "$code" == "403" ]]; assert_status "$TEST_DIR/invalid.json" "INVALID_TOKEN"
php -r '$r=json_decode(file_get_contents($argv[1]),true);if(($r["workspaces"]["ws_test"]["hwid"]??"")!==""){fwrite(STDERR,"Bad key bound HWID\n");exit(1);}' "$TEST_REGISTRY_PATH"
code="$(post_json '{"action":"verify_license","workspace_id":"ws_test","token":"ASHK-CI-TEST-0001","hwid":"HWID-A"}' "$TEST_DIR/valid.json")"
[[ "$code" == "200" ]]
php -r '
$r=json_decode(file_get_contents($argv[1]),true);
if(($r["allowed"]??false)!==true||($r["status"]??"")!=="ACTIVE"){fwrite(STDERR,"Valid activation rejected\n");exit(1);}
$q=$r["license_receipt"]??[];$raw=base64_decode($q["signed_payload"]??"",true);$sig=base64_decode($q["signature"]??"",true);
$reg=json_decode(file_get_contents($argv[2]),true);$pub=openssl_pkey_get_public($reg["license_signing_public_key"]??"");
if($raw===false||$sig===false||openssl_verify($raw,$sig,$pub,OPENSSL_ALGO_SHA256)!==1){fwrite(STDERR,"Receipt signature invalid\n");exit(1);}
$p=json_decode($raw,true);if(($p["hwid"]??"")!=="HWID-A"||($p["plan"]??"")!=="BRONZE"||($p["max_customers"]??null)!==50||($p["max_documents"]??null)!==500){fwrite(STDERR,"Wrong receipt entitlements\n");exit(1);}
' "$TEST_DIR/valid.json" "$TEST_REGISTRY_PATH"
php -r '$r=json_decode(file_get_contents($argv[1]),true);if(($r["workspaces"]["ws_test"]["hwid"]??"")!=="HWID-A"){fwrite(STDERR,"HWID not persisted\n");exit(1);}' "$TEST_REGISTRY_PATH"

# Simple public-link signatures: tenant-authenticated creation, no overwrite, exact link proof on sign.
cat > "$TEST_DIR/simple-signature-create.json" <<'JSON'
{"action":"createRequest","request":{"id":"client-id-must-be-ignored","token":"a1234567-89ab-4cde-8fab-0123456789ab~YWJj","documentId":"DOC-SIMPLE-CI","documentType":"INVOICE","documentPreview":"{\"customer\":\"CI sample\"}","createdAt":"2099-01-01T00:00:00Z","expiresAt":"2099-01-03T00:00:00Z","status":"SIGNED"}}
JSON
code="$(curl --silent --show-error --max-time 8 -o "$TEST_DIR/simple-signature-no-auth.json" -w '%{http_code}' \
  -H 'Content-Type: application/json' --data-binary @"$TEST_DIR/simple-signature-create.json" "$BASE_URL/signature-api-simple.php")"
[[ "$code" == "403" ]]

code="$(curl --silent --show-error --max-time 8 -o "$TEST_DIR/simple-signature-created.json" -w '%{http_code}' \
  -H 'X-Workspace-ID: ws_test' -H 'X-Workspace-Token: ASHK-CI-TEST-0001' -H 'X-Device-HWID: HWID-A' \
  -H 'Content-Type: application/json' --data-binary @"$TEST_DIR/simple-signature-create.json" "$BASE_URL/signature-api-simple.php")"
[[ "$code" == "201" ]]
SIMPLE_TOKEN='a1234567-89ab-4cde-8fab-0123456789ab~YWJj'
php -r '$j=json_decode(file_get_contents($argv[1]),true);$r=$j["request"]??[];if(($j["success"]??false)!==true||($r["workspace_id"]??"")!=="ws_test"||($r["id"]??"")==="client-id-must-be-ignored"||($r["status"]??"")!=="PENDING"||($r["token"]??"")!==$argv[2]){fwrite(STDERR,"Simple signature request was not issued securely");exit(1);}' "$TEST_DIR/simple-signature-created.json" "$SIMPLE_TOKEN"
SIMPLE_ID="$(php -r '$j=json_decode(file_get_contents($argv[1]),true);echo $j["request"]["id"]??"";' "$TEST_DIR/simple-signature-created.json")"

# Reusing any existing token from any workspace is rejected rather than overwritten.
code="$(curl --silent --show-error --max-time 8 -o "$TEST_DIR/simple-signature-duplicate.json" -w '%{http_code}' \
  -H 'X-Workspace-ID: ws_test' -H 'X-Workspace-Token: ASHK-CI-TEST-0001' -H 'X-Device-HWID: HWID-A' \
  -H 'Content-Type: application/json' --data-binary @"$TEST_DIR/simple-signature-create.json" "$BASE_URL/signature-api-simple.php")"
[[ "$code" == "409" ]]
code="$(curl --silent --show-error --max-time 8 -o "$TEST_DIR/simple-signature-public.json" -w '%{http_code}' \
  --get --data-urlencode 'action=getRequest' --data-urlencode "token=$SIMPLE_TOKEN" "$BASE_URL/signature-api-simple.php")"
[[ "$code" == "200" ]]
php -r '$j=json_decode(file_get_contents($argv[1]),true);$r=$j["request"]??[];if(($r["id"]??"")!==$argv[2]||isset($r["workspace_id"])||($r["status"]??"")!=="PENDING"){fwrite(STDERR,"Public simple signature read exposed tenant metadata or wrong request");exit(1);}' "$TEST_DIR/simple-signature-public.json" "$SIMPLE_ID"

php -r '$j=json_decode(file_get_contents($argv[1]),true);$token=$argv[2];file_put_contents($argv[3],json_encode(["action"=>"signRequest","token"=>$token,"signerName"=>"CI signer","signatureData"=>"ci-signature"],JSON_UNESCAPED_UNICODE));' "$TEST_DIR/simple-signature-created.json" "$SIMPLE_TOKEN" "$TEST_DIR/simple-signature-sign.json"
code="$(curl --silent --show-error --max-time 8 -o "$TEST_DIR/simple-signature-signed.json" -w '%{http_code}' \
  -H 'Content-Type: application/json' --data-binary @"$TEST_DIR/simple-signature-sign.json" "$BASE_URL/signature-api-simple.php")"
[[ "$code" == "200" ]]
php -r '$j=json_decode(file_get_contents($argv[1]),true);$r=$j["request"]??[];if(($r["status"]??"")!=="SIGNED"||($r["signerName"]??"")!=="CI signer"||($r["signatureData"]??"")!=="ci-signature"){fwrite(STDERR,"Simple signature was not server-confirmed");exit(1);}' "$TEST_DIR/simple-signature-signed.json"
code="$(curl --silent --show-error --max-time 8 -o "$TEST_DIR/simple-signature-replay.json" -w '%{http_code}' \
  -H 'Content-Type: application/json' --data-binary @"$TEST_DIR/simple-signature-sign.json" "$BASE_URL/signature-api-simple.php")"
[[ "$code" == "409" ]]

# Remote-signature management and issuance require a licensed, device-bound workspace.
code="$(curl --silent --show-error --max-time 8 -o "$TEST_DIR/remote-signature-no-auth-list.json" -w '%{http_code}' "$BASE_URL/remote-signature-api.php?action=list_requests")"
[[ "$code" == "403" ]]
code="$(curl --silent --show-error --max-time 8 -o "$TEST_DIR/remote-signature-no-auth-create.json" -w '%{http_code}' \
  -H 'Content-Type: application/json' -d '{"action":"create_request","data":{"documentId":"DOC-X","documentType":"INVOICE","documentTitle":"Unauthorized","documentUrl":"https://example.invalid/doc.pdf","signerName":"CI","authMethod":"link"}}' \
  "$BASE_URL/remote-signature-api.php")"
[[ "$code" == "403" ]]

code="$(curl --silent --show-error --max-time 8 -o "$TEST_DIR/remote-signature-created.json" -w '%{http_code}' \
  -H 'X-Workspace-ID: ws_test' -H 'X-Workspace-Token: ASHK-CI-TEST-0001' -H 'X-Device-HWID: HWID-A' \
  -H 'Content-Type: application/json' \
  -d '{"action":"create_request","data":{"id":"client-supplied-id","signatureToken":"client-supplied-token","documentId":"DOC-CI","documentType":"INVOICE","documentTitle":"CI signature test","documentUrl":"https://example.invalid/ci.pdf","signerName":"CI Signer","signerNationalId":"0000000000","signerPhone":"09000000000","signerEmail":"ci@example.invalid","authMethod":"otp_sms","status":"signed"}}' \
  "$BASE_URL/remote-signature-api.php")"
[[ "$code" == "201" ]]
php -r '$j=json_decode(file_get_contents($argv[1]),true);$r=$j["data"]??[];if(($j["success"]??false)!==true||($r["workspace_id"]??"")!=="ws_test"||($r["id"]??"")==="client-supplied-id"||($r["signatureToken"]??"")==="client-supplied-token"||strlen($r["signatureToken"]??"")!==64||($r["status"]??"")!=="pending"){fwrite(STDERR,"Remote-signature request was not securely issued");exit(1);}' "$TEST_DIR/remote-signature-created.json"
SIG_ID="$(php -r '$j=json_decode(file_get_contents($argv[1]),true);echo $j["data"]["id"]??"";' "$TEST_DIR/remote-signature-created.json")"
SIG_TOKEN="$(php -r '$j=json_decode(file_get_contents($argv[1]),true);echo rawurlencode($j["data"]["signatureToken"]??"");' "$TEST_DIR/remote-signature-created.json")"

# External link access exposes the matching request only; tenant listing remains isolated.
code="$(curl --silent --show-error --max-time 8 -o "$TEST_DIR/remote-signature-public.json" -w '%{http_code}' "$BASE_URL/remote-signature-api.php?action=get_by_token&token=$SIG_TOKEN")"
[[ "$code" == "200" ]]
php -r '$j=json_decode(file_get_contents($argv[1]),true);$r=$j["data"]??[];if(($r["id"]??"")!==$argv[2]||isset($r["workspace_id"])||isset($r["requesterUserId"])){fwrite(STDERR,"Public signature link leaked workspace metadata or returned wrong request");exit(1);}' "$TEST_DIR/remote-signature-public.json" "$SIG_ID"
php -r '$p=$argv[1];$r=json_decode(file_get_contents($p),true)?:[];$r[]=["id"=>"other-tenant-request","workspace_id"=>"ws_other","status"=>"pending","documentType"=>"INVOICE","createdAt"=>date(DATE_ATOM)];file_put_contents($p,json_encode($r));' "$TEST_DIR/signatures/requests.json"
code="$(curl --silent --show-error --max-time 8 -o "$TEST_DIR/remote-signature-tenant-list.json" -w '%{http_code}' \
  -H 'X-Workspace-ID: ws_test' -H 'X-Workspace-Token: ASHK-CI-TEST-0001' -H 'X-Device-HWID: HWID-A' \
  "$BASE_URL/remote-signature-api.php?action=list_requests")"
[[ "$code" == "200" ]]
php -r '$j=json_decode(file_get_contents($argv[1]),true);$a=$j["data"]??[];if(count($a)!==1||($a[0]["id"]??"")!==$argv[2]){fwrite(STDERR,"Remote-signature list leaked another tenant request");exit(1);}' "$TEST_DIR/remote-signature-tenant-list.json" "$SIG_ID"

# A valid link alone cannot bypass OTP when the request policy requires OTP.
code="$(curl --silent --show-error --max-time 8 -o "$TEST_DIR/remote-signature-otp-bypass.json" -w '%{http_code}' \
  -H 'Content-Type: application/json' \
  -d "{\"action\":\"sign_document\",\"signatureToken\":\"$(php -r '$j=json_decode(file_get_contents($argv[1]),true);echo $j["data"]["signatureToken"];' "$TEST_DIR/remote-signature-created.json")\",\"data\":{\"requestId\":\"$SIG_ID\",\"signatureData\":\"forged-signature\"}}" \
  "$BASE_URL/remote-signature-api.php")"
[[ "$code" == "403" ]]

# Seed a test OTP challenge rather than send a real SMS, then verify and consume a one-time session.
php -r '$p=$argv[1];$r=json_decode(file_get_contents($p),true)?:[];$r[$argv[2]]=["requestId"=>$argv[2],"workspace_id"=>"ws_test","codeHash"=>password_hash("123456",PASSWORD_DEFAULT),"attempts"=>0,"expiresAt"=>time()+600];file_put_contents($argv[1],json_encode($r));' "$TEST_DIR/signatures/otp_codes.json" "$SIG_ID"
code="$(curl --silent --show-error --max-time 8 -o "$TEST_DIR/remote-signature-verified.json" -w '%{http_code}' \
  -H 'Content-Type: application/json' \
  -d "{\"action\":\"verify_otp\",\"requestId\":\"$SIG_ID\",\"signatureToken\":\"$(php -r '$j=json_decode(file_get_contents($argv[1]),true);echo $j["data"]["signatureToken"];' "$TEST_DIR/remote-signature-created.json")\",\"otpCode\":\"123456\"}" \
  "$BASE_URL/remote-signature-api.php")"
[[ "$code" == "200" ]]
SESSION_TOKEN="$(php -r '$j=json_decode(file_get_contents($argv[1]),true);echo $j["sessionToken"]??"";' "$TEST_DIR/remote-signature-verified.json")"
[[ "${#SESSION_TOKEN}" == "64" ]]
code="$(curl --silent --show-error --max-time 8 -o "$TEST_DIR/remote-signature-signed.json" -w '%{http_code}' \
  -H 'Content-Type: application/json' \
  -d "{\"action\":\"sign_document\",\"signatureToken\":\"$(php -r '$j=json_decode(file_get_contents($argv[1]),true);echo $j["data"]["signatureToken"];' "$TEST_DIR/remote-signature-created.json")\",\"sessionToken\":\"$SESSION_TOKEN\",\"data\":{\"requestId\":\"$SIG_ID\",\"signatureData\":\"ci-verified-signature\"}}" \
  "$BASE_URL/remote-signature-api.php")"
[[ "$code" == "200" ]]
php -r '$j=json_decode(file_get_contents($argv[1]),true);if(($j["success"]??false)!==true||($j["data"]["requestId"]??"")!==$argv[2]){fwrite(STDERR,"OTP-verified remote signature did not save");exit(1);}' "$TEST_DIR/remote-signature-signed.json" "$SIG_ID"

# Customer credentials cannot access the mother-only generic host data API.
code="$(curl --silent --show-error --max-time 8 -o "$TEST_DIR/host-api-tenant.json" -w '%{http_code}' \
  -H 'X-Workspace-ID: ws_test' -H 'X-Workspace-Token: ASHK-CI-TEST-0001' -H 'X-Device-HWID: HWID-A' \
  "$BASE_URL/host-api.php?action=list_files")"
[[ "$code" == "403" ]]
php -r '$j=json_decode(file_get_contents($argv[1]),true);if(($j["error"]??"")!=="MOTHER_PORTAL_ONLY"){fwrite(STDERR,"Tenant reached mother-only host API");exit(1);}' "$TEST_DIR/host-api-tenant.json"

# Seed two tenants and an unscoped historical message; only the caller's own history may be visible.
php -r '$m=[["id"=>"own-message","workspace_id"=>"ws_test","text"=>"own"],["id"=>"other-message","workspace_id"=>"ws_other","text"=>"private"],["id"=>"legacy-message","text"=>"unscoped"]];file_put_contents($argv[1],json_encode($m,JSON_UNESCAPED_UNICODE));' "$TEST_DIR/data/support_chat.json"
code="$(curl --silent --show-error --max-time 8 -o "$TEST_DIR/api-chat-isolation.json" -w '%{http_code}' \
  -H 'X-Workspace-ID: ws_test' -H 'X-Workspace-Token: ASHK-CI-TEST-0001' -H 'X-Device-HWID: HWID-A' \
  "$BASE_URL/api.php?action=support_chat")"
[[ "$code" == "200" ]]
php -r '$j=json_decode(file_get_contents($argv[1]),true);$m=$j["messages"]??[];if(count($m)!==1||($m[0]["id"]??"")!=="own-message"){fwrite(STDERR,"Support chat tenant isolation failed");exit(1);}' "$TEST_DIR/api-chat-isolation.json"

# A registered customer cannot use generic global CRUD operations.
code="$(curl --silent --show-error --max-time 8 -o "$TEST_DIR/api-tenant-crud.json" -w '%{http_code}' \
  -H 'X-Workspace-ID: ws_test' -H 'X-Workspace-Token: ASHK-CI-TEST-0001' -H 'X-Device-HWID: HWID-A' \
  -H 'Content-Type: application/json' -d '{"action":"get","table":"companies"}' "$BASE_URL/api.php")"
[[ "$code" == "403" ]]
php -r '$j=json_decode(file_get_contents($argv[1]),true);if(($j["error"]??"")!=="MOTHER_PORTAL_ONLY"){fwrite(STDERR,"Tenant accessed mother-only CRUD");exit(1);}' "$TEST_DIR/api-tenant-crud.json"

# Every data API must require both the registered workspace token and the pinned device.
code="$(curl --silent --show-error --max-time 8 -o "$TEST_DIR/storage-no-hwid.json" -w '%{http_code}' \
  -H 'Content-Type: application/json' -d '{"action":"test","workspace_id":"ws_test","workspace_token":"ASHK-CI-TEST-0001"}' "$BASE_URL/storage.php")"
[[ "$code" == "403" ]]; assert_status "$TEST_DIR/storage-no-hwid.json" "INVALID_HWID"
code="$(curl --silent --show-error --max-time 8 -o "$TEST_DIR/storage-wrong-hwid.json" -w '%{http_code}' \
  -H 'Content-Type: application/json' -d '{"action":"test","workspace_id":"ws_test","workspace_token":"ASHK-CI-TEST-0001","hwid":"HWID-B"}' "$BASE_URL/storage.php")"
[[ "$code" == "403" ]]; assert_status "$TEST_DIR/storage-wrong-hwid.json" "HWID_MISMATCH"
code="$(curl --silent --show-error --max-time 8 -o "$TEST_DIR/storage-valid.json" -w '%{http_code}' \
  -H 'Content-Type: application/json' -d '{"action":"test","workspace_id":"ws_test","workspace_token":"ASHK-CI-TEST-0001","hwid":"HWID-A"}' "$BASE_URL/storage.php")"
[[ "$code" == "200" ]]
php -r '$r=json_decode(file_get_contents($argv[1]),true);if(($r["success"]??false)!==true||($r["workspace"]??"")!=="ws_test"){fwrite(STDERR,"Device-bound storage access failed\\n");exit(1);}' "$TEST_DIR/storage-valid.json"

code="$(curl --silent --show-error --max-time 8 -o "$TEST_DIR/host-storage-valid.json" -w '%{http_code}' \
  -H 'Content-Type: application/json' -d '{"action":"stats","workspace_id":"ws_test","workspace_token":"ASHK-CI-TEST-0001","hwid":"HWID-A"}' "$BASE_URL/host-storage-api.php")"
[[ "$code" == "200" ]]
php -r '$r=json_decode(file_get_contents($argv[1]),true);if(($r["success"]??false)!==true||!is_array($r["stats"]??null)){fwrite(STDERR,"Device-bound host storage access failed\n");exit(1);}' "$TEST_DIR/host-storage-valid.json"

code="$(curl --silent --show-error --max-time 8 -o "$TEST_DIR/backup-api-no-auth.json" -w '%{http_code}' \
  -H 'Content-Type: application/json' -d '{"action":"list"}' "$BASE_URL/server-api-backup.php")"
[[ "$code" == "400" ]]
code="$(curl --silent --show-error --max-time 8 -o "$TEST_DIR/backup-api-valid.json" -w '%{http_code}' \
  -H 'Content-Type: application/json' -d '{"action":"list","workspace_id":"ws_test","workspace_token":"ASHK-CI-TEST-0001","hwid":"HWID-A"}' "$BASE_URL/server-api-backup.php")"
[[ "$code" == "200" ]]
php -r '$r=json_decode(file_get_contents($argv[1]),true);if(($r["success"]??false)!==true||!is_array($r["backups"]??null)){fwrite(STDERR,"Device-bound host backup access failed\\n");exit(1);}' "$TEST_DIR/backup-api-valid.json"

code="$(curl --silent --show-error --max-time 8 -o "$TEST_DIR/backup-system-no-auth.json" -w '%{http_code}' \
  -H 'X-Workspace-ID: ws_test' -H 'Content-Type: application/json' -d '{"action":"backup_data","type":"ci_test","payload":{"probe":"should-deny"}}' "$BASE_URL/backup-system.php")"
[[ "$code" == "403" ]]
code="$(curl --silent --show-error --max-time 8 -o "$TEST_DIR/backup-system-valid.json" -w '%{http_code}' \
  -H 'X-Workspace-ID: ws_test' -H 'X-Workspace-Token: ASHK-CI-TEST-0001' -H 'X-Device-HWID: HWID-A' \
  -H 'Content-Type: application/json' -d '{"action":"backup_data","type":"ci_test","payload":{"probe":"ok"}}' "$BASE_URL/backup-system.php")"
[[ "$code" == "200" ]]
php -r '$r=json_decode(file_get_contents($argv[1]),true);if(($r["success"]??false)!==true||empty($r["file"])){fwrite(STDERR,"Device-bound backup write failed\\n");exit(1);}' "$TEST_DIR/backup-system-valid.json"

code="$(post_json '{"action":"verify_license","workspace_id":"ws_test","token":"ASHK-CI-TEST-0001","hwid":"HWID-B"}' "$TEST_DIR/mismatch.json")"
[[ "$code" == "403" ]]; assert_status "$TEST_DIR/mismatch.json" "HWID_MISMATCH"
code="$(post_json '{"action":"verify_license","workspace_id":"ws_expired","token":"ASHK-CI-EXPIRED-0001","hwid":"HWID-EXPIRED"}' "$TEST_DIR/expired.json")"
[[ "$code" == "403" ]]; assert_status "$TEST_DIR/expired.json" "EXPIRED"
php -r '$r=json_decode(file_get_contents($argv[1]),true);if(($r["workspaces"]["ws_expired"]["hwid"]??"")!==""){fwrite(STDERR,"Expired license bound HWID\n");exit(1);}' "$TEST_REGISTRY_PATH"
code="$(post_json '{"action":"list"}' "$TEST_DIR/no-admin.json")"
[[ "$code" == "401" ]]
code="$(post_json '{"action":"revoke_license","workspace_id":"ws_test"}' "$TEST_DIR/revoke.json" -H 'X-Admin-Secret: ci-test-admin-secret')"
[[ "$code" == "200" ]]
php -r '$r=json_decode(file_get_contents($argv[1]),true);if(($r["success"]??false)!==true){fwrite(STDERR,"Revoke failed\n");exit(1);}' "$TEST_DIR/revoke.json"
code="$(post_json '{"action":"verify_license","workspace_id":"ws_test","token":"ASHK-CI-TEST-0001","hwid":"HWID-A"}' "$TEST_DIR/revoked.json")"
[[ "$code" == "403" ]]; assert_status "$TEST_DIR/revoked.json" "SUSPENDED"

# License issuance must be server-authorized and create a usable server-side license.
code="$(post_json '{"action":"add","workspace_id":"ws_unauthorized","token":"ASHK-CI-UNAUTH-0001","title":"Unauthorized","expire_date":"2099-12-31","status":"ACTIVE","is_unlimited":false,"max_users":3,"plan":"BRONZE","max_customers":50,"max_documents":500,"features":["BASIC_MODULES"],"hwid":"HWID-UNAUTH"}' "$TEST_DIR/unauthorized-add.json")"
[[ "$code" == "401" ]]
php -r '$r=json_decode(file_get_contents($argv[1]),true);if(isset($r["workspaces"]["ws_unauthorized"])){fwrite(STDERR,"Unauthorized issuance modified registry\n");exit(1);}' "$TEST_REGISTRY_PATH"

code="$(post_json '{"action":"add","workspace_id":"ws_issued","token":"ASHK-CI-ISSUED-0001","title":"Issued CI Customer","expire_date":"2099-12-31","status":"ACTIVE","is_unlimited":false,"max_users":3,"plan":"HEMAYAT","max_customers":70,"max_documents":450,"features":["BASIC_MODULES"],"hwid":"HWID-ISSUED-A"}' "$TEST_DIR/issued.json" -H 'X-Admin-Secret: ci-test-admin-secret')"
[[ "$code" == "200" ]]
php -r '$r=json_decode(file_get_contents($argv[1]),true);if(($r["success"]??false)!==true||($r["workspace"]["workspace_id"]??"")!=="ws_issued"){fwrite(STDERR,"Authorized license issuance failed\n");exit(1);}' "$TEST_DIR/issued.json"

code="$(post_json '{"action":"verify_license","workspace_id":"ws_issued","token":"ASHK-CI-ISSUED-0001","hwid":"HWID-ISSUED-A"}' "$TEST_DIR/issued-verify.json")"
[[ "$code" == "200" ]]
php -r '
$r=json_decode(file_get_contents($argv[1]),true);
if(($r["allowed"]??false)!==true||($r["status"]??"")!=="ACTIVE"){fwrite(STDERR,"Issued license is not activatable\n");exit(1);}
$q=$r["license_receipt"]??[];$raw=base64_decode($q["signed_payload"]??"",true);$sig=base64_decode($q["signature"]??"",true);
$reg=json_decode(file_get_contents($argv[2]),true);$pub=openssl_pkey_get_public($reg["license_signing_public_key"]??"");
if($raw===false||$sig===false||openssl_verify($raw,$sig,$pub,OPENSSL_ALGO_SHA256)!==1){fwrite(STDERR,"Issued license receipt signature invalid\n");exit(1);}
$p=json_decode($raw,true);
if(($p["workspace_id"]??"")!=="ws_issued"||($p["hwid"]??"")!=="HWID-ISSUED-A"||($p["plan"]??"")!=="HEMAYAT"||($p["max_users"]??null)!==3||($p["max_customers"]??null)!==70||($p["max_documents"]??null)!==450){fwrite(STDERR,"Issued license receipt entitlements wrong\n");exit(1);}
' "$TEST_DIR/issued-verify.json" "$TEST_REGISTRY_PATH"

code="$(post_json '{"action":"revoke_license","workspace_id":"ws_issued"}' "$TEST_DIR/issued-revoke.json" -H 'X-Admin-Secret: ci-test-admin-secret')"
[[ "$code" == "200" ]]
code="$(post_json '{"action":"verify_license","workspace_id":"ws_issued","token":"ASHK-CI-ISSUED-0001","hwid":"HWID-ISSUED-A"}' "$TEST_DIR/issued-after-revoke.json")"
[[ "$code" == "403" ]]
assert_status "$TEST_DIR/issued-after-revoke.json" "SUSPENDED"

echo "PASS: license lifecycle, HWID/RSA, retired APIs, host-package data isolation, tenant-scoped signatures, OTP sessions, token collision protection, storage and revocation."
