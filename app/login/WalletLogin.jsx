"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  clearWalletConnectStorage,
  getInjectedProvider,
  getWalletConnectProvider,
  isWalletConnectConfigured,
  resetWalletConnectProvider,
  syncApprovedChain,
} from "@/lib/web3/wallet";

const STATEMENT = "Đăng nhập vào AXIS: Gadget Grand Prix bằng ví của bạn.";
const WALLETCONNECT_TIMEOUT_MS = 45000;

function withTimeout(promise, ms, timeoutMessage) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(timeoutMessage)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

export default function WalletLogin() {
  const router = useRouter();
  const [pending, setPending] = useState(null); // "injected" | "walletconnect" | null
  const [error, setError] = useState(null);

  // every fresh page load (F5, first visit) starts with a clean slate —
  // no leftover pairing/session from a previous, possibly broken attempt
  useEffect(() => {
    clearWalletConnectStorage();
  }, []);

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
      const provider = await withTimeout(
        getWalletConnectProvider(),
        WALLETCONNECT_TIMEOUT_MS,
        "Không khởi tạo được WalletConnect (hết thời gian chờ)."
      );
      if (!provider.session) {
        await withTimeout(
          provider.connect(),
          WALLETCONNECT_TIMEOUT_MS,
          "Hết thời gian chờ quét QR / duyệt kết nối trên ví."
        );
      }
      syncApprovedChain(provider);
      await withTimeout(
        signInWithProvider("walletconnect", provider),
        WALLETCONNECT_TIMEOUT_MS,
        "Hết thời gian chờ ví duyệt chữ ký đăng nhập."
      );
    } catch (e) {
      resetWalletConnectProvider();
      const raw = e?.message;
      setError(
        raw && raw.trim() && !raw.includes("eth_requestAccounts is missing or invalid")
          ? raw
          : "Kết nối WalletConnect bị rớt/hết thời gian chờ (thường do mạng chặn WebSocket duy trì lâu qua proxy). Thử lại, hoặc dùng MetaMask nếu có sẵn extension — không phụ thuộc WebSocket nên ổn định hơn trên mạng hạn chế."
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
