"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  getInjectedProvider,
  getWalletConnectProvider,
  isWalletConnectConfigured,
  resetWalletConnectProvider,
} from "@/lib/web3/wallet";

const STATEMENT = "Đăng nhập vào AXIS: Gadget Grand Prix bằng ví của bạn.";

export default function WalletLogin() {
  const router = useRouter();
  const [pending, setPending] = useState(null); // "injected" | "walletconnect" | null
  const [error, setError] = useState(null);

  async function signInWithProvider(kind, provider) {
    setError(null);
    setPending(kind);
    try {
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithWeb3({
        chain: "ethereum",
        statement: STATEMENT,
        wallet: provider,
      });
      if (signInError) throw signInError;
      router.push("/lobby");
      router.refresh();
    } catch (e) {
      const raw = e?.message || "";
      if (raw.includes("eth_requestAccounts is missing or invalid")) {
        setError(
          "Ví từ chối kết nối hoặc chưa mở khoá. Mở ví, đăng nhập/mở khoá, rồi thử lại (nếu MetaMask có popup đang chờ, hãy xử lý nó trước)."
        );
      } else {
        setError(raw || "Kết nối ví thất bại.");
      }
    } finally {
      setPending(null);
    }
  }

  async function withInjected() {
    const provider = getInjectedProvider();
    if (!provider) {
      setError("Không tìm thấy ví trình duyệt (MetaMask...). Hãy cài extension hoặc dùng WalletConnect.");
      return;
    }
    await signInWithProvider("injected", provider);
  }

  async function withWalletConnect() {
    setError(null);
    setPending("walletconnect");
    try {
      const provider = await getWalletConnectProvider();
      if (!provider.session) {
        await provider.connect();
      }
      await signInWithProvider("walletconnect", provider);
    } catch (e) {
      resetWalletConnectProvider();
      const raw = e?.message;
      setError(
        raw && raw.trim()
          ? raw
          : "Kết nối WalletConnect bị rớt giữa chừng (thường do mạng chặn WebSocket qua proxy). Thử lại, hoặc dùng MetaMask nếu có sẵn extension."
      );
      setPending(null);
    }
  }

  return (
    <div className="mt-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="h-px flex-1 bg-white/10" />
        <span className="text-xs text-white/40 font-bold uppercase tracking-wide">hoặc dùng ví</span>
        <div className="h-px flex-1 bg-white/10" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={withInjected}
          disabled={pending !== null}
          className="flex items-center justify-center gap-2 bg-white/5 border border-white/15 rounded-xl py-2.5 text-sm font-bold hover:bg-white/10 transition disabled:opacity-50"
        >
          🦊 {pending === "injected" ? "Đang kết nối..." : "MetaMask"}
        </button>
        <button
          type="button"
          onClick={withWalletConnect}
          disabled={pending !== null || !isWalletConnectConfigured}
          title={!isWalletConnectConfigured ? "Chưa cấu hình WalletConnect Project ID" : undefined}
          className="flex items-center justify-center gap-2 bg-white/5 border border-white/15 rounded-xl py-2.5 text-sm font-bold hover:bg-white/10 transition disabled:opacity-50"
        >
          🔗 {pending === "walletconnect" ? "Đang kết nối..." : "WalletConnect"}
        </button>
      </div>

      {!isWalletConnectConfigured && (
        <p className="text-white/40 text-xs mt-2">
          WalletConnect chưa được cấu hình (thiếu Project ID).
        </p>
      )}
      {error && <p className="text-red-400 text-sm mt-3">{error}</p>}
    </div>
  );
}
