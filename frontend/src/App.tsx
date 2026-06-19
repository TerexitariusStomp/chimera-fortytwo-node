import { useState, useCallback, useEffect } from 'react';
import { getAccountBalance, queryContractNamedKeys, CONTRACTS } from './casper-client';
import { connectWallet, disconnectWallet, isWalletInstalled } from './casper-wallet';
import { Wallet } from 'lucide-react';
import { Button, Badge } from './components/ui';
import OverviewTab from './components/OverviewTab';
import ComputeRegistryTab from './components/ComputeRegistryTab';
import OrderBookTab from './components/OrderBookTab';
import EscrowVaultTab from './components/EscrowVaultTab';
import ReputationTab from './components/ReputationTab';
import type { TxRecord } from './types';

export default function App() {
  const [provider, setProvider] = useState<any>(null);
  const [publicKeyHex, setPublicKeyHex] = useState('');
  const [accountHash, setAccountHash] = useState('');
  const [balance, setBalance] = useState('');
  const [txHistory, setTxHistory] = useState<TxRecord[]>([]);
  const [contractKeys, setContractKeys] = useState<Record<string, { name: string; key: string }[]>>({});
  const [walletError, setWalletError] = useState('');
  const [walletDetected, setWalletDetected] = useState(false);

  useEffect(() => {
    // Poll for Casper Wallet since extensions inject asynchronously
    const check = () => setWalletDetected(isWalletInstalled());
    check();
    const interval = setInterval(check, 1000);
    return () => clearInterval(interval);
  }, []);

  const connect = useCallback(async () => {
    setWalletError('');
    const res = await connectWallet();
    if (res.connected && res.provider) {
      setProvider(res.provider);
      setPublicKeyHex(res.publicKey);
      const pk = (await import('casper-js-sdk')).PublicKey.fromHex(res.publicKey);
      setAccountHash(pk.accountHash().toPrefixedString());
      getAccountBalance(pk).then(setBalance);
      Object.entries(CONTRACTS).forEach(([name, hash]) => {
        queryContractNamedKeys(hash).then((keys) => {
          setContractKeys((prev) => ({ ...prev, [name]: keys }));
        });
      });
    } else {
      setWalletError('Could not connect to Casper Wallet. Make sure the extension is installed and unlocked.');
    }
  }, []);

  const disconnect = useCallback(async () => {
    await disconnectWallet();
    setProvider(null); setPublicKeyHex(''); setAccountHash(''); setBalance(''); setContractKeys({}); setWalletError('');
  }, []);

  const updateTx = useCallback((tx: TxRecord) => {
    setTxHistory((prev) => {
      const existing = prev.find((t) => t.deployHash === tx.deployHash);
      if (existing) return prev.map((t) => (t.deployHash === tx.deployHash ? { ...t, ...tx } : t));
      return [tx, ...prev];
    });
  }, []);

  const isConnected = !!provider && !!publicKeyHex;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top Header */}
      <header className="border-b bg-muted/40">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Chimera Inference Network</h1>
            <p className="text-xs text-muted-foreground">Casper Testnet — Auto-routed AI inference</p>
          </div>
          {/* Navigation Tabs */}
          <nav className="hidden md:flex items-center gap-1">
            {[
              { id: 'overview', label: 'Overview' },
              { id: 'escrow', label: 'Inference' },
              { id: 'compute', label: 'Compute' },
              { id: 'orderbook', label: 'Order Book' },
              { id: 'reputation', label: 'Reputation' },
            ].map((tab) => (
              <a key={tab.id} href={`#${tab.id}`}
                className="rounded-md px-3 py-1.5 text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground text-muted-foreground">
                {tab.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            {isConnected ? (
              <>
                <div className="text-right">
                  <div className="text-xs font-mono text-muted-foreground">{accountHash.slice(0, 20)}...{accountHash.slice(-8)}</div>
                  <div className="text-xs font-mono">{balance}</div>
                </div>
                <Button variant="outline" onClick={disconnect} className="text-xs">Disconnect</Button>
              </>
            ) : (
              <>
                {walletError && <div className="text-xs text-red-600">{walletError}</div>}
                <Button onClick={connect} className="text-xs"><Wallet className="h-3 w-3 mr-1" />Connect Wallet</Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Content — Single Page with all sections */}
      <main className="max-w-5xl mx-auto px-6 py-6 space-y-8">
        {!walletDetected && !isConnected && (
          <div className="text-sm text-red-600 bg-red-50 p-3 rounded">
            Casper Wallet extension not detected.
            <a href="https://chromewebstore.google.com/detail/casper-wallet/" target="_blank" rel="noopener noreferrer" className="underline ml-1">Install it here</a>.
          </div>
        )}

        {/* Section: Overview */}
        <section id="overview" className="space-y-4">
          <OverviewTab contractKeys={contractKeys} txHistory={txHistory} publicKeyStr={publicKeyHex} accountHash={accountHash} balance={balance} />
        </section>

        {/* Section: Escrow Vault (Inference) */}
        <section id="escrow" className="space-y-4">
          <EscrowVaultTab provider={provider} publicKeyHex={publicKeyHex} contractHash={CONTRACTS.escrowVault} accountHash={accountHash} onTx={updateTx} />
        </section>

        {/* Section: Compute Registry */}
        <section id="compute" className="space-y-4">
          <ComputeRegistryTab provider={provider} publicKeyHex={publicKeyHex} contractHash={CONTRACTS.computeRegistry} onTx={updateTx} />
        </section>

        {/* Section: Order Book */}
        <section id="orderbook" className="space-y-4">
          <OrderBookTab provider={provider} publicKeyHex={publicKeyHex} contractHash={CONTRACTS.orderBook} escrowVaultHash={CONTRACTS.escrowVault} accountHash={accountHash} onTx={updateTx} />
        </section>

        {/* Section: Reputation */}
        <section id="reputation" className="space-y-4">
          <ReputationTab provider={provider} publicKeyHex={publicKeyHex} contractHash={CONTRACTS.reputation} onTx={updateTx} />
        </section>

        {/* Recent Transactions */}
        <section id="transactions" className="space-y-2">
          <h3 className="font-semibold text-sm">Recent Transactions</h3>
          {txHistory.length === 0 ? <p className="text-sm text-muted-foreground">No transactions yet</p> : (
            <div className="space-y-2">
              {txHistory.slice(0, 5).map((tx) => (
                <div key={tx.id} className="flex items-center justify-between text-xs bg-muted p-2 rounded">
                  <div className="flex items-center gap-2">
                    <div>
                      <div className="font-medium">{tx.contract} :: {tx.entryPoint}</div>
                      <a href={`https://testnet.cspr.live/deploy/${tx.deployHash}`} target="_blank" rel="noopener noreferrer" className="font-mono text-muted-foreground hover:text-blue-600 hover:underline">
                        {tx.deployHash}
                      </a>
                    </div>
                  </div>
                  <Badge variant={tx.status === 'success' ? 'success' : tx.status === 'error' ? 'error' : 'warning'}>{tx.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
