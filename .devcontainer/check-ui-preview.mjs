import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";

const html = await readFile("public/native-windows-preview/index.html", "utf8");
const server = await readFile(".devcontainer/preview-server.mjs", "utf8");

assert.match(html, /<html[^>]*lang="fa"[^>]*dir="rtl"/i, "Preview must be Persian RTL.");
assert.match(html, /\.sidebar\s*\{[^}]*grid-column\s*:\s*2/s, "Main navigation must be on the right.");
assert.match(html, /id="page-dashboard"/, "Dashboard must exist.");
for (const id of ["page-customers","page-products","page-invoices","page-payments","page-expenses","page-forecast","page-ledger","page-checks","page-vouchers","page-cardex","page-moadian","page-companies","page-settings","page-server","page-reports","page-backup","page-migration"]) {
  assert.ok(html.includes('id="' + id + '"'), "Missing UI page: " + id);
}
const sidebar = html.match(/<aside class="sidebar"[\\s\\S]*?<\\/aside>/i)?.[0];
assert.ok(sidebar, "Accounting navigation must be present.");
const navPages = [...sidebar.matchAll(/class="nav-btn[^"]*" data-page="([^"]+)"/g)].map(match => match[1]);
assert.equal(new Set(navPages).size, navPages.length, "Accounting navigation must not repeat modules.");
for (const page of ["invoices","payments","vouchers","cardex","checks","ledger","reports","moadian","companies","settings","server","backup"]) {
  assert.ok(navPages.includes(page), "Missing accounting module navigation: " + page);
}
assert.ok(!navPages.includes("migration"), "Developer migration tracking must not appear as a customer module.");
for (const id of ["saveForm","addDraftLine","invoiceOverlay","printInvoice","searchCustomers","searchProducts","searchInvoices","resetDemo","quickAddCustomerFromInvoice","quickAddProductFromInvoice","inlineEntityOverlay","inlineEntitySave"]) {
  assert.ok(html.includes('id="' + id + '"'), "Missing key interaction: " + id);
}
assert.match(html, /const openInlineEntity = mode =>/, "Inline person/product editor should exist.");
assert.match(html, /settings:\\{invoiceTheme:'modern',showQr:true/, "The modern invoice theme must be the preview's first-run default.");
assert.match(html, /const switchActiveCompany = id =>/, "Switching companies must switch the scoped accounting workspace.");
assert.match(html, /state\\.companyData\\[state\\.activeCompanyId\\]=captureCompanyData\\(\\)/, "The current company's data must be saved before switching.");
assert.match(html, /applyCompanyData\\(nextData\\)/, "The selected company's independent data must be restored.");
assert.match(html, /id="invoiceThemeSelect"/, "Invoice preview must expose theme selection.");
assert.match(html, /id="invoiceQrToggle"/, "Invoice preview must expose QR inclusion.");
assert.match(html, /id="downloadInvoiceQr"/, "Invoice preview must allow downloading its QR as SVG.");
assert.match(html, /const saveInlineEntity = \(\) =>/, "Inline person/product save handler should exist.");
assert.match(html, /const exportVisibleTableCsv = \(bodyId, filename, excludeOperations = false\) =>/, "Visible table CSV export should exist.");
for (const id of ['customers','products','invoices','payments','expenses']) {
  assert.ok(html.includes('data-export-csv="' + id + '"'), "Missing CSV export action for: " + id);
}

for (const id of ["page-vouchers","page-cardex","page-checks","page-moadian","page-companies","page-settings","page-server"]) {
  assert.ok(html.includes('id="' + id + '"'), "Missing accounting module UI: " + id);
}
for (const id of ["activeCompanySelector","invoiceThemeSelect","invoiceQrToggle","downloadInvoiceQr","saveVoucher","saveCheck","companiesList","saveCompany","settingsInvoiceTheme","saveSettings","moadianInvoicesBody","saveMoadianConfig","serverBaseUrl","testServerConfig"]) {
  assert.ok(html.includes('id="' + id + '"'), "Missing accounting module control: " + id);
}
assert.match(html, /qrcode\(0,'M'\)/, "Invoice QR must be generated locally with a QR implementation.");
assert.match(html, /invoiceQrPayload/, "Invoice QR payload builder must be present.");
assert.match(html, /تولید QR ناموفق بود/, "QR errors should be visible rather than silently ignored.");
assert.match(html, /ارسال رسمی تا تنظیم و اعتبارسنجی API/, "Moadian integration status must not imply that real invoices are sent.");
assert.match(html, /دادهٔ حسابداری را به سرور ارسال نمی‌کند/, "Server configuration must not imply sync is active.");
assert.match(html, /const renderCardex = \(\) =>/, "Kardex renderer must exist.");
assert.match(html, /running\+=incoming\?v\.quantity:-v\.quantity/, "Kardex must show a running stock balance.");
assert.match(html, /data-check-status/, "Check status updates must be available.");
assert.doesNotMatch(html, /data-page="migration"/, "The client navigation must not expose unrelated/miscellaneous modules.");
assert.match(html, /class="nav-btn" data-page="moadian"/, "Accounting navigation should expose taxpayer module.");
assert.match(html, /class="nav-btn" data-page="companies"/, "Accounting navigation should expose company switching.");
assert.match(html, /data-page-link="vouchers"/, "Kardex page should link to the voucher registration page.");
assert.match(html, /const navLink=e\.target\.closest\('\[data-page-link\]'\)/, "Internal accounting page links must navigate.");
assert.match(html, /qrcode-generator by Kazuhiko Arase, MIT licensed/, "Offline QR library attribution and license notice must be included.");
assert.match(html, /refreshInvoiceCustomerOptions\(customer\.id\)/, "Saved people should be offered in the open invoice.");
assert.match(html, /refreshInvoiceProductOptions\(product\.id\)/, "Saved products should be offered in the open invoice.");
assert.match(html, /state\.customers\.some\(x => String\(x\.code\)\.toLowerCase\(\) === code\.toLowerCase\(\)\)/, "Person codes should be checked for duplicates.");
assert.match(html, /state\.products\.some\(x => String\(x\.code\)\.toLowerCase\(\) === code\.toLowerCase\(\)\)/, "Product codes should be checked for duplicates.");
assert.match(html, /localStorage/, "Demo state must remain browser-local.");
assert.match(html, /داده.*نمونه|داده.*مرورگر/, "Preview needs a demo-data/privacy notice.");
assert.match(server, /native-windows-preview\/version\.json/, "Version endpoint must work at the stable subpath.");
assert.match(server, /native-windows-preview\/index\.html/, "Stable preview subpath must route to the mock.");

const scriptBlocks = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)];
assert.ok(scriptBlocks.length > 0, "Expected inline interaction script.");
for (const [index, match] of scriptBlocks.entries()) {
  // Compile only. The application's DOM interactions are not executed by this static check.
  new Function(match[1]);
}
console.log("Preview source checks passed: RTL/right navigation, key pages/actions, local demo state, stable route, and inline script syntax.");
