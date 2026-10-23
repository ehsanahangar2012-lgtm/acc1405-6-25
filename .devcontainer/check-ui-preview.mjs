import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";

const html = await readFile("public/native-windows-preview/index.html", "utf8");
const server = await readFile(".devcontainer/preview-server.mjs", "utf8");

assert.match(html, /<html[^>]*lang="fa"[^>]*dir="rtl"/i, "Preview must be Persian RTL.");
assert.match(html, /\.sidebar\s*\{[^}]*grid-column\s*:\s*2/s, "Main navigation must be on the right.");
assert.match(html, /id="page-dashboard"/, "Dashboard must exist.");
for (const id of ["page-customers","page-products","page-invoices","page-payments","page-expenses","page-forecast","page-ledger","page-reports","page-migration"]) {
  assert.ok(html.includes('id="' + id + '"'), "Missing UI page: " + id);
}
for (const id of ["saveForm","addDraftLine","invoiceOverlay","printInvoice","searchCustomers","searchProducts","searchInvoices","resetDemo","quickAddCustomerFromInvoice","quickAddProductFromInvoice","inlineEntityOverlay","inlineEntitySave"]) {
  assert.ok(html.includes('id="' + id + '"'), "Missing key interaction: " + id);
}
assert.match(html, /const openInlineEntity = mode =>/, "Inline person/product editor should exist.");
assert.match(html, /const saveInlineEntity = \(\) =>/, "Inline person/product save handler should exist.");
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
