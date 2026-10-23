import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, sep } from "node:path";

const root = resolve(process.cwd(), "public/native-windows-preview");
const indexPath = resolve(root, "index.html");
const port = Number(process.env.PORT || 4173);
const csp = [
  "default-src 'self' data:",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'"
].join("; ");

function send(response, status, type, body) {
  response.writeHead(status, {
    "Content-Type": type,
    "Cache-Control": "no-store, max-age=0",
    "Content-Security-Policy": csp,
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "X-Frame-Options": "DENY"
  });
  response.end(body);
}

const server = createServer(async (request, response) => {
  const pathname = new URL(request.url || "/", "http://127.0.0.1").pathname;

  if (pathname === "/version.json" || pathname === "/native-windows-preview/version.json") {
    try {
      const details = await stat(indexPath);
      return send(response, 200, "application/json; charset=utf-8", JSON.stringify({
        build: String(details.mtimeMs),
        updatedAt: details.mtime.toISOString()
      }));
    } catch {
      return send(response, 500, "application/json; charset=utf-8", JSON.stringify({ error: "Preview file is unavailable." }));
    }
  }

  if (!["/", "/index.html", "/native-windows-preview", "/native-windows-preview/", "/native-windows-preview/index.html"].includes(pathname)) {
    return send(response, 404, "text/plain; charset=utf-8", "Not found");
  }

  try {
    const html = await readFile(indexPath);
    return send(response, 200, "text/html; charset=utf-8", html);
  } catch {
    return send(response, 500, "text/plain; charset=utf-8", "Could not read the UI preview.");
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Private Ashke Ghalam UI preview available on port ${port}`);
});
