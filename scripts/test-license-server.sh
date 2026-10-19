#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TEST_DIR="$(mktemp -d)"
SERVER_PID=""
cleanup() { if [[ -n "$SERVER_PID" ]]; then kill "$SERVER_PID" 2>/dev/null || true; fi; rm -rf "$TEST_DIR"; }
trap cleanup EXIT
cp "$ROOT_DIR/host-backend/license_validator.php" "$ROOT_DIR/host-backend/tenant-manager.php" "$ROOT_DIR/host-backend/host-storage-api.php" "$ROOT_DIR/host-backend/storage.php" "$TEST_DIR/"
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
  -H 'Content-Type: application/json' -d '{"action":"test","workspace_id":"default","workspace_token":"ci-test-admin-secret"}' "$BASE_URL/host-storage-api.php")"
[[ "$code" == "200" ]]
php -r '$j=json_decode(file_get_contents($argv[1]),true);if(($j["success"]??false)!==true||($j["workspace"]??"")!=="default"){fwrite(STDERR,"Master storage did not accept verified admin\n");exit(1);}' "$TEST_DIR/master-storage-allowed.json"

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
echo "PASS: license token safety, HWID, RSA signature, quotas, expiry, admin auth, revocation."
