// @ts-nocheck
const REQUESTS_TIMEOUT_MS = 30 * 60 * 1000;

export function getWalletProvider(): any {
  const constructor = (window as any).CasperWalletProvider;
  if (!constructor) {
    return null;
  }
  return constructor({ timeout: REQUESTS_TIMEOUT_MS });
}

export function isWalletInstalled(): boolean {
  return !!(window as any).CasperWalletProvider;
}

export async function connectWallet(): Promise<{ connected: boolean; publicKey: string; provider: any }> {
  const provider = getWalletProvider();
  if (!provider) {
    return { connected: false, publicKey: '', provider: null };
  }
  const connected = await provider.requestConnection();
  if (!connected) {
    return { connected: false, publicKey: '', provider: null };
  }
  const publicKey = await provider.getActivePublicKey();
  return { connected: true, publicKey, provider };
}

export async function disconnectWallet(): Promise<void> {
  const provider = getWalletProvider();
  if (provider) {
    await provider.disconnect();
  }
}
