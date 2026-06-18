import { useState, useCallback, useEffect } from 'react';
import { getAccountBalance, queryContractNamedKeys, CONTRACTS } from './casper-client';
import { connectWallet, disconnectWallet, isWalletInstalled } from './casper-wallet';
import { cn } from './lib/utils';
import { LayoutDashboard, Server, BookOpen, Shield, Award, Wallet } from 'lucide-react';
import { Button } from './components/ui';
import OverviewTab from './components/OverviewTab';
import ComputeRegistryTab from './components/ComputeRegistryTab';
import OrderBookTab from './components/OrderBookTab';
import EscrowVaultTab from './components/EscrowVaultTab';
import ReputationTab from './components/ReputationTab';
import type { TxRecord } from './types';

export default function App() {
  const [activeTab, setActiveTab] = useState<'overview' | 'compute' | 'orderbook' | 'escrow' | 'reputation'>('overview');
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

  const tabs = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'compute', label: 'Compute Registry', icon: Server },
    { id: 'orderbook', label: 'Order Book', icon: BookOpen },
    { id: 'escrow', label: 'Escrow Vault', icon: Shield },
    { id: 'reputation', label: 'Reputation', icon: Award },
  ] as const;

  const isConnected = !!provider && !!publicKeyHex;

  return (
    <div className="flex h-screen bg-background text-foreground">
      <aside className="w-64 border-r bg-muted/40 flex flex-col">
        <div className="p-4 border-b">
          <h1 className="text-lg font-bold flex items-center gap-2"><LayoutDashboard className="h-5 w-5" />Chimera Dashboard</h1>
          <p className="text-xs text-muted-foreground mt-1">Casper Testnet</p>
        </div>
        <nav className="flex-1 p-2 space-y-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
                className={cn('w-full flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  activeTab === tab.id ? 'bg-primary text-primary-foreground' : 'hover:bg-accent hover:text-accent-foreground')}>
                <Icon className="h-4 w-4" />{tab.label}
              </button>
            );
          })}
        </nav>
        <div className="p-4 border-t space-y-2">
          {isConnected ? (
            <>
              <div className="space-y-1">
                <div className="text-xs font-medium text-muted-foreground">Account</div>
                <div className="text-xs font-mono break-all">{accountHash}</div>
                <div className="text-xs font-mono text-muted-foreground">{balance}</div>
              </div>
              <Button variant="outline" onClick={disconnect} className="w-full text-xs">Disconnect</Button>
            </>
          ) : (
            <>
              {!walletDetected && (
                <div className="text-xs text-red-600">
                  Casper Wallet extension not detected.
                  <a href="https://chromewebstore.google.com/detail/casper-wallet/" target="_blank" rel="noopener noreferrer" className="underline">Install it here</a>.
                </div>
              )}
              {walletError && <div className="text-xs text-red-600">{walletError}</div>}
              <Button onClick={connect} className="w-full"><Wallet className="h-4 w-4 mr-1" />Connect Wallet</Button>
            </>
          )}
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <div className="p-6 max-w-5xl mx-auto space-y-6">
          {activeTab === 'overview' && <OverviewTab contractKeys={contractKeys} txHistory={txHistory} publicKeyStr={publicKeyHex} accountHash={accountHash} balance={balance} />}
          {activeTab === 'compute' && <ComputeRegistryTab provider={provider} publicKeyHex={publicKeyHex} contractHash={CONTRACTS.computeRegistry} onTx={updateTx} />}
          {activeTab === 'orderbook' && <OrderBookTab provider={provider} publicKeyHex={publicKeyHex} contractHash={CONTRACTS.orderBook} escrowVaultHash={CONTRACTS.escrowVault} accountHash={accountHash} onTx={updateTx} />}
          {activeTab === 'escrow' && <EscrowVaultTab provider={provider} publicKeyHex={publicKeyHex} contractHash={CONTRACTS.escrowVault} accountHash={accountHash} onTx={updateTx} />}
          {activeTab === 'reputation' && <ReputationTab provider={provider} publicKeyHex={publicKeyHex} contractHash={CONTRACTS.reputation} onTx={updateTx} />}
        </div>
      </main>
    </div>
  );
}
