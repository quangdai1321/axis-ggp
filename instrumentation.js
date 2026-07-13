export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const proxyUrl =
    process.env.HTTPS_PROXY ||
    process.env.https_proxy ||
    process.env.HTTP_PROXY ||
    process.env.http_proxy;

  if (!proxyUrl) return;

  const { setGlobalDispatcher, ProxyAgent } = await import("undici");
  setGlobalDispatcher(new ProxyAgent(proxyUrl));
}
