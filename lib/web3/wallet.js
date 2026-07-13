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

// EthereumProvider defaults `chainId` to the first entry of
// chains/optionalChains at init time, and only updates it after connect()
// if the approved session accounts happen to parse cleanly. If that update
// is skipped/empty it silently keeps pointing at a chain the wallet never
// approved (e.g. mainnet), and every later request() fails with
// "Missing or invalid ... eip155:<chainId>". Force it to whatever chain
// the wallet actually approved.
export function syncApprovedChain(provider) {
  const approvedChains = provider.session?.namespaces?.eip155?.chains;
  if (!approvedChains || approvedChains.length === 0) return;

  const currentCaip = `eip155:${provider.chainId}`;
  if (approvedChains.includes(currentCaip)) return;

  const firstApproved = Number(approvedChains[0].split(":")[1]);
  if (Number.isFinite(firstApproved)) {
    provider.chainId = firstApproved;
  }
}
