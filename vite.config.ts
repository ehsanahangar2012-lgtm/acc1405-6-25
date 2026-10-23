import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindPostCss from '@tailwindcss/postcss';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const BROWSER_PREVIEW_CSP = "default-src 'self' data: blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'";

function convertOklch(value: string): string {
  return value.replace(/oklch\(\s*([+-]?(?:\d+\.?\d*|\.\d+)%?)\s+([+-]?(?:\d+\.?\d*|\.\d+))\s+([+-]?(?:\d+\.?\d*|\.\d+))(?:\s*\/\s*([+-]?(?:\d+\.?\d*|\.\d+)%?))?\s*\)/gi,
    (_match: string, lightnessRaw: string, chromaRaw: string, hueRaw: string, alphaRaw?: string) => {
      const L = String(lightnessRaw).endsWith('%') ? parseFloat(lightnessRaw) / 100 : parseFloat(lightnessRaw);
      const C = parseFloat(chromaRaw);
      const h = parseFloat(hueRaw) * Math.PI / 180;
      const a = C * Math.cos(h);
      const b = C * Math.sin(h);
      const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
      const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
      const s_ = L - 0.0894841775 * a - 1.2914855480 * b;
      const l = l_ * l_ * l_;
      const m = m_ * m_ * m_;
      const s = s_ * s_ * s_;
      const linear = [
        4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
        -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
        -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
      ];
      const toSrgb = (channel) => {
        const clipped = Math.max(0, Math.min(1, channel));
        const converted = clipped <= 0.0031308
          ? 12.92 * clipped
          : 1.055 * Math.pow(clipped, 1 / 2.4) - 0.055;
        return Math.round(converted * 255);
      };
      const [r, g, blue] = linear.map(toSrgb);
      const alpha = alphaRaw == null ? 1 : (String(alphaRaw).endsWith('%') ? parseFloat(alphaRaw) / 100 : parseFloat(alphaRaw));
      return alpha < 0.999 ? `rgba(${r}, ${g}, ${blue}, ${Math.max(0, Math.min(1, alpha))})` : `rgb(${r}, ${g}, ${blue})`;
    });
}

function parseLegacyColor(expression: string, vars: Map<string, string>): number[] {
  let value = String(expression).trim().toLowerCase();
  const variable = value.match(/^var\((--[\w-]+)/);
  if (variable) value = String(vars.get(variable[1]) || '').trim().toLowerCase();

  if (value === 'currentcolor') return [0, 0, 0, 1];
  if (value === 'white') return [255, 255, 255, 1];
  if (value === 'black') return [0, 0, 0, 1];

  const rgb = value.match(/^rgba?\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)(?:\s*,\s*(\d+(?:\.\d+)?))?\s*\)$/);
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3]), rgb[4] == null ? 1 : Number(rgb[4])];

  const hex = value.match(/^#([\da-f]{3,8})$/i);
  if (hex) {
    let digits = hex[1];
    if (digits.length === 3 || digits.length === 4) digits = digits.split('').map(ch => ch + ch).join('');
    if (digits.length === 6 || digits.length === 8) {
      return [
        parseInt(digits.slice(0, 2), 16),
        parseInt(digits.slice(2, 4), 16),
        parseInt(digits.slice(4, 6), 16),
        digits.length === 8 ? parseInt(digits.slice(6, 8), 16) / 255 : 1
      ];
    }
  }
  return [0, 0, 0, 1];
}

function replaceCssFunctionCalls(value: string, functionName: string, replacer: (call: string) => string): string {
  const marker = `${functionName.toLowerCase()}(`;
  const lower = value.toLowerCase();
  let output = '';
  let cursor = 0;

  while (cursor < value.length) {
    const start = lower.indexOf(marker, cursor);
    if (start < 0) {
      output += value.slice(cursor);
      break;
    }

    output += value.slice(cursor, start);
    const openIndex = start + marker.length - 1;
    let depth = 0;
    let quote = '';
    let escaped = false;
    let end = openIndex;

    for (; end < value.length; end++) {
      const char = value[end];
      if (quote) {
        if (escaped) escaped = false;
        else if (char === '\\') escaped = true;
        else if (char === quote) quote = '';
        continue;
      }
      if (char === '"' || char === "'") {
        quote = char;
        continue;
      }
      if (char === '(') depth++;
      else if (char === ')') {
        depth--;
        if (depth === 0) break;
      }
    }

    if (end >= value.length || depth !== 0) {
      output += value.slice(start);
      break;
    }

    output += replacer(value.slice(start, end + 1));
    cursor = end + 1;
  }

  return output;
}

function androidLegacyCssPlugin(): any {
  return {
    postcssPlugin: 'ashk-android-legacy-css',
    OnceExit(root: any) {
      // Tailwind v4 emits newer color functions and CSS cascade layers.
      // Convert colors and flatten layer wrappers for older Android System WebView builds.
      root.walkDecls((decl: any) => {
        decl.value = convertOklch(decl.value);
        decl.value = decl.value
          .replace(/linear-gradient\(\s*in\s+(?:oklab|lab|srgb|hsl|hwb)\s*,/gi, 'linear-gradient(')
          .replace(/linear-gradient\(\s*([^,()]+?)\s+in\s+(?:oklab|lab|srgb|hsl|hwb)\s*,/gi, (_m: string, direction: string) => `linear-gradient(${direction.trim()},`);
      });

      const colorVars = new Map();
      root.walkDecls((decl: any) => {
        if (decl.prop.startsWith('--color-')) colorVars.set(decl.prop, decl.value.trim());
      });

      const mixPattern = /color-mix\(\s*in\s+(?:oklab|srgb|lab|lch|hsl|hwb)\s*,\s*(var\(--color-[\w-]+\)|currentcolor|#[\da-f]{3,8}|rgba?\([^)]*\)|white|black)\s+(\d+(?:\.\d+)?)%\s*,\s*transparent\s*\)/gi;
      root.walkDecls((decl: any) => {
        decl.value = decl.value.replace(mixPattern, (_m: string, expression: string, opacityRaw: string) => {
          const [r, g, blue, originalAlpha] = parseLegacyColor(expression, colorVars);
          const alpha = Math.max(0, Math.min(1, Number(opacityRaw) / 100 * originalAlpha));
          return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(blue)}, ${alpha.toFixed(3)})`;
        });
      });

      root.walkAtRules('supports', (rule: any) => {
        rule.params = rule.params
          .replace(/\(color:\s*color-mix\(in\s+lab,\s*red,\s*red\)\)/gi, '(color: rgb(0, 0, 0))')
          .replace(/background-image:\s*linear-gradient\(in\s+(?:lab|oklab|srgb),\s*red,\s*red\)/gi, 'background-image: linear-gradient(red, red)');
      });

      const flattenLayers = (container: any) => {
        for (const node of [...(container.nodes || [])]) {
          if (node.type === 'atrule' && node.name === 'layer') {
            if (!node.nodes || node.nodes.length === 0) {
              node.remove();
              continue;
            }
            const children = node.nodes.map((child: any) => child.clone());
            node.replaceWith(...children);
            children.forEach((child: any) => flattenLayers(child));
          } else if (node.nodes) {
            flattenLayers(node);
          }
        }
      };
      flattenLayers(root);

      // Safety net: no color-mix() should survive in the packaged APK. The first pass
      // preserves common Tailwind transparency values; this fallback covers other
      // color-mix variants and CSS feature-detection expressions unsupported by old WebViews.
      root.walkDecls((decl: any) => {
        decl.value = replaceCssFunctionCalls(decl.value, 'oklch', () => 'rgb(0, 0, 0)');
        decl.value = replaceCssFunctionCalls(decl.value, 'color-mix', () => 'rgba(0, 0, 0, 0.5)');
      });
      root.walkAtRules((rule: any) => {
        if (typeof rule.params === 'string') {
          rule.params = convertOklch(rule.params);
          rule.params = replaceCssFunctionCalls(rule.params, 'oklch', () => 'rgb(0, 0, 0)');
          rule.params = replaceCssFunctionCalls(rule.params, 'color-mix', () => 'rgb(0, 0, 0)');
        }
      });
      root.walkRules((rule: any) => {
        if (typeof rule.selector === 'string') {
          rule.selector = replaceCssFunctionCalls(rule.selector, 'oklch', () => 'rgb(0, 0, 0)');
          rule.selector = replaceCssFunctionCalls(rule.selector, 'color-mix', () => 'rgba(0, 0, 0, 0.5)');
        }
      });
    }
  };
}

function excludeMotherPortalAdminToolsPlugin(enabled: boolean): any {
  return {
    name: 'ashk-exclude-mother-portal-admin-tools',
    enforce: 'pre',
    transform(code: string, id: string) {
      if (!enabled) return null;
      const normalizedId = id.replace(/\\/g, '/');
      if (normalizedId.endsWith('/App.tsx')) {
        const transformed = code
          .replaceAll("import('./pages/LicenseManager')", "import('./pages/LicenseManagerUnavailable')")
          .replaceAll("import('./pages/DebugCenter')", "import('./pages/DebugCenterUnavailable')")
          .replaceAll("import('./pages/InstallAndroid')", "import('./pages/InstallAndroidClient')");
        return transformed === code ? null : { code: transformed, map: null };
      }
      if (normalizedId.endsWith('/components/Sidebar.tsx')) {
        let transformed = code
          .replace("...(!isNativeClient ? [{ to: '/license-manager', icon: KeyRound, label: 'صدور لایسنس و مدیریت کلاینت‌ها (پرتال مدیر)', perm: 'settings' }] : []),", "...([]),")
          .replaceAll("import { AppDownloadCenterModal } from './AppDownloadCenterModal';", "")
          .replaceAll("const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);", "")
          .replaceAll("<AppDownloadCenterModal isOpen={isDownloadModalOpen} onClose={() => setIsDownloadModalOpen(false)} />", "");
        const downloadButtonStart = transformed.indexOf("          {/* Download App Package Button: owner web portal only */}");
        const downloadButtonEnd = downloadButtonStart >= 0
          ? transformed.indexOf("\n          )}", downloadButtonStart)
          : -1;
        if (downloadButtonStart >= 0 && downloadButtonEnd >= 0) {
          transformed = transformed.slice(0, downloadButtonStart) + transformed.slice(downloadButtonEnd + 13);
        }
        return transformed === code ? null : { code: transformed, map: null };
      }
      return null;
    }
  };
}

function browserPreviewIsolationPlugin(): any {
  return {
    name: 'ashk-browser-preview-isolation',
    transformIndexHtml: {
      order: 'post',
      handler(html: string): string {
        const buildId = String(process.env.GITHUB_SHA || 'local').replace(/[^a-zA-Z0-9._-]/g, '');
        let output = html.replace(
          /<meta http-equiv="Content-Security-Policy" content="[^"]*"\s*\/>/i,
          `<meta http-equiv="Content-Security-Policy" content="${BROWSER_PREVIEW_CSP}" />`
        );
        // All dependencies are bundled locally by Vite; no CDN import map is needed in preview.
        output = output.replace(/\s*<script type="importmap">[\s\S]*?<\/script>/i, '');
        output = output.replace('</head>', `<meta name="ashk-preview-build" content="${buildId}">\n</head>`);
        output = output.replace('</body>', `<script>
          (() => {
            const initialBuild = document.querySelector('meta[name="ashk-preview-build"]')?.content;
            if (!initialBuild || initialBuild === 'local') return;
            window.setInterval(async () => {
              try {
                const response = await fetch('./version.json?check=' + Date.now(), { cache: 'no-store' });
                if (!response.ok) return;
                const version = await response.json();
                if (version?.sha && version.sha !== initialBuild) window.location.reload();
              } catch (_) {}
            }, 20000);
          })();
        </script>\n</body>`);
        return output;
      }
    }
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const excludeMotherPortalAdminTools = mode === 'android' || mode === 'desktop' || mode === 'browser-preview';
  return {
    base: process.env.VITE_BASE_PATH || './',
    server: {
      port: 3000,
      host: '0.0.0.0',
      proxy: {
        '/signature-api-simple.php': {
          target: 'http://localhost:8000',
          changeOrigin: true
        }
      }
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
      minify: 'esbuild',
      cssMinify: true,
      reportCompressedSize: false,
    },
    css: mode === 'android'
      ? { postcss: { plugins: [tailwindPostCss(), androidLegacyCssPlugin()] } }
      : undefined,
    plugins: [
      excludeMotherPortalAdminToolsPlugin(excludeMotherPortalAdminTools),
      react(),
      ...(mode === 'browser-preview' ? [browserPreviewIsolationPlugin()] : [])
    ],
    define: {
      'import.meta.env.VITE_GEMINI_API_KEY': JSON.stringify(env.VITE_GEMINI_API_KEY || env.GEMINI_API_KEY)
    },
    resolve: {
      alias: {
        '@': resolve(__dirname, '.'),
        'html2canvas': 'html2canvas-pro',
      }
    }
  };
});
