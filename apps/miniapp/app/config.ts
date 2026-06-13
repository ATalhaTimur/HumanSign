// Mini App telefonda çalışır → BE her zaman TÜNEL (ngrok) adresi olmalı, localhost DEĞİL (01 §4).
export const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "";
export const APP_ID = process.env.NEXT_PUBLIC_APP_ID ?? "";
export const ACTION_DELEGATE = process.env.NEXT_PUBLIC_ACTION_DELEGATE ?? "delegate-agent";
