import vinext from "vinext";
import { defineConfig, loadEnv } from "vite";
import hostingConfig from "./.openai/hosting.json";
import { sites } from "./build/sites-vite-plugin";

const SITE_CREATOR_PLACEHOLDER_DATABASE_ID =
  "00000000-0000-4000-8000-000000000000";

const { d1, r2 } = hostingConfig;

// macOS Seatbelt blocks FSEvents, so Codex previews need polling for HMR.
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === "seatbelt";

export default defineConfig(async ({ mode }) => {
  const fileEnvironment = loadEnv(mode, process.cwd(), "");
  const environmentValue = (name: string, fallback = "") => process.env[name] ?? fileEnvironment[name] ?? fallback;
  const localBindingConfig = {
    main: "./worker/index.ts",
    compatibility_flags: ["nodejs_compat"],
    vars: {
      ADMIN_SETUP_TOKEN: environmentValue("ADMIN_SETUP_TOKEN"),
      ADMIN_RECOVERY_TOKEN: environmentValue("ADMIN_RECOVERY_TOKEN"),
      EMAIL_MODE: environmentValue("EMAIL_MODE", "preview"),
      EMAIL_API_URL: environmentValue("EMAIL_API_URL"),
      EMAIL_API_TOKEN: environmentValue("EMAIL_API_TOKEN"),
      SMTP_FROM: environmentValue("SMTP_FROM", "まちの小さなキッチンカー <orders@example.jp>"),
      ORDER_NOTIFICATION_EMAIL: environmentValue("ORDER_NOTIFICATION_EMAIL", "makishi0520@gmail.com"),
      APP_URL: environmentValue("APP_URL", "http://localhost:3000"),
    },
    d1_databases: d1
      ? [
          {
            binding: d1,
            database_name: "site-creator-d1",
            database_id: SITE_CREATOR_PLACEHOLDER_DATABASE_ID,
          },
        ]
      : [],
    r2_buckets: r2
      ? [
          {
            binding: r2,
            bucket_name: "site-creator-r2",
          },
        ]
      : [],
  };

  // Keep Wrangler and Miniflare state project-local. These are non-secret tool
  // settings; application environment belongs in ignored `.env*` files.
  process.env.WRANGLER_WRITE_LOGS ??= "false";
  process.env.WRANGLER_LOG_PATH ??= ".wrangler/logs";
  process.env.MINIFLARE_REGISTRY_PATH ??= ".wrangler/registry";

  // Wrangler snapshots its log path while the Cloudflare plugin is imported.
  const { cloudflare } = await import("@cloudflare/vite-plugin");

  return {
    server: isCodexSeatbeltSandbox
      ? { watch: { useFsEvents: false, usePolling: true } }
      : undefined,
    plugins: [
      vinext(),
      sites(),
      cloudflare({
        viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
        config: localBindingConfig,
      }),
    ],
  };
});
