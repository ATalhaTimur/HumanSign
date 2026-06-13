"use client";

import { MiniKitProvider } from "@worldcoin/minikit-js/minikit-provider";
import { useEffect, type ReactNode } from "react";

const APP_ID = process.env.NEXT_PUBLIC_APP_ID ?? "";

export function Providers({ children }: { children: ReactNode }) {
  // Mini App'te tarayıcı devtools yok → Eruda mobil konsolu (04 §1). Sadece client'ta.
  useEffect(() => {
    import("eruda").then((eruda) => eruda.default.init()).catch(() => {});
  }, []);

  return <MiniKitProvider props={{ appId: APP_ID }}>{children}</MiniKitProvider>;
}
