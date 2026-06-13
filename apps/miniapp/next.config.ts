import type { NextConfig } from "next";
import { join } from "node:path";

const nextConfig: NextConfig = {
  // Monorepo'da birden çok lockfile var → workspace kökünü açıkça belirt (root yanlış tespitini önler).
  turbopack: { root: join(__dirname, "..", "..") },
  // Mini App ngrok tüneliyle telefonda açılır → dev origin'e izin ver (Next cross-origin uyarısını susturur).
  // ngrok subdomain'in değişirse buraya ekle.
  allowedDevOrigins: ["*.ngrok.app", "*.ngrok-free.app", "*.trycloudflare.com"],
};

export default nextConfig;
