// EVM wallet connectors used only to obtain an EIP-1193 provider for
// Supabase's native signInWithWeb3 (Sign-In-With-Ethereum). No on-chain
// reads/writes happen here — this is authentication only.

export const isWalletConnectConfigured = Boolean(
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
);

export function getInjectedProvider() {
  if (typeof window === "undefined") return null;
  return window.ethereum ?? null;
}

let wcProviderPromise = null;

export async function getWalletConnectProvider() {
  if (!isWalletConnectConfigured) {
    throw new Error("Chưa cấu hình NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID.");
  }
  if (!wcProviderPromise) {
    wcProviderPromise = import("@walletconnect/ethereum-provider").then(({ EthereumProvider }) =>
      EthereumProvider.init({
        projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID,
        // all optional (no hard-required "chains") so the session still
        // succeeds even if the wallet doesn't support Ethereum mainnet —
        // a required chain the wallet can't fulfil breaks eth_requestAccounts
        // with a confusing "Missing or invalid ... eip155:1" error later
        optionalChains: [1, 137, 56, 8453, 42161],
        showQrModal: true,
        metadata: {
          name: "AXIS: Gadget Grand Prix",
          description: "Đại Hội Đua Xe Bảo Bối",
          url: typeof window !== "undefined" ? window.location.origin : "https://axis-ggp.vercel.app",
          icons: [],
        },
      })
    );
  }
  return wcProviderPromise;
}

export async function disconnectWalletConnect() {
  if (!wcProviderPromise) return;
  const provider = await wcProviderPromise;
  await provider.disconnect().catch(() => {});
}

// drop the cached provider so the next attempt starts a fresh relay
// session instead of reusing one that may be stuck after a failed connect
export function resetWalletConnectProvider() {
  wcProviderPromise = null;
}
