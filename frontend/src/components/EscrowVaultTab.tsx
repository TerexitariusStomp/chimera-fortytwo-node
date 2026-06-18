import { useState, useEffect, useCallback } from 'react';
import EntryPointCard from './EntryPointCard';
import { Button, Input, Card, Badge } from './ui';
import { Send, Shield, Clock, RefreshCw } from 'lucide-react';
import type { TxRecord } from '../types';
import * as sdk from 'casper-js-sdk';
import { getContractNamedKeys, queryDictionary } from '../casper-client';

function accountHashToBytes(hashStr: string): Uint8Array {
  const bytes = new Uint8Array(32);
  const hex = hashStr.replace('account-hash-', '');
  for (let i = 0; i < 32; i++) bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  return bytes;
}

interface Job {
  id: string;
  consumer: string;
  provider: string;
  amount: string;
  state: string;
  validUntil: number;
  createdAt: number;
}

const STATE_LABELS: Record<string, string> = {
  '0': 'pending', '1': 'assigned', '2': 'in_progress', '3': 'provider_done',
  '4': 'consumer_confirm', '5': 'settled', '6': 'refunded', '7': 'disputed',
  '8': 'consumer_won', '9': 'provider_won',
};

export default function EscrowVaultTab({ provider, publicKeyHex, contractHash, accountHash, onTx }: {
  provider: any; publicKeyHex: string; contractHash: string; accountHash: string; onTx: (tx: TxRecord) => void;
}) {
  const canSign = !!provider && !!publicKeyHex;
  const [jobs, setJobs] = useState<Job[]>([]);
  const [localJobs, setLocalJobs] = useState<Job[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(false);

  const loadJobs = useCallback(async () => {
    setLoadingJobs(true);
    try {
      const keys = await getContractNamedKeys(contractHash);
      const jobsUref = keys['jobs_dict'];
      const pendingUref = keys['pending_jobs'];
      if (!jobsUref || !pendingUref) { setJobs([]); return; }

      const pendingList: string[] = await queryDictionary(pendingUref, 'list') || [];
      const loaded: Job[] = [];
      for (const jobId of pendingList) {
        const raw = await queryDictionary(jobsUref, `${jobId}:consumer`);
        if (!raw) continue;
        // Query each field separately
        const consumer = await queryDictionary(jobsUref, `${jobId}:consumer`);
        const providerAddr = await queryDictionary(jobsUref, `${jobId}:provider`);
        const amount = await queryDictionary(jobsUref, `${jobId}:amount`);
        const stateRaw = await queryDictionary(jobsUref, `${jobId}:state`);
        const validUntil = await queryDictionary(jobsUref, `${jobId}:valid_until`);
        const createdAt = await queryDictionary(jobsUref, `${jobId}:created_at`);
        loaded.push({
          id: jobId,
          consumer: String(consumer || ''),
          provider: String(providerAddr || ''),
          amount: String(amount || '0'),
          state: STATE_LABELS[String(stateRaw ?? '')] || String(stateRaw ?? 'unknown'),
          validUntil: Number(validUntil || 0),
          createdAt: Number(createdAt || 0),
        });
      }
      setJobs(loaded);
    } catch (e) {
      console.error('Failed to load jobs:', e);
    } finally {
      setLoadingJobs(false);
    }
  }, [contractHash]);

  useEffect(() => {
    loadJobs();
    const id = setInterval(loadJobs, 30000);
    return () => clearInterval(id);
  }, [loadJobs]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h2 className="text-2xl font-bold">Escrow Vault</h2><p className="text-muted-foreground text-sm">{contractHash}</p></div>
      </div>

      {/* Time-gated release explanation */}
      <Card className="p-4">
        <h3 className="font-semibold mb-2 flex items-center gap-2"><Clock className="h-4 w-4" />Time-Gated Release Flow</h3>
        <ol className="text-xs text-muted-foreground space-y-1 list-decimal pl-4">
          <li>Order placed and funds enter escrow automatically.</li>
          <li>Inference provider submits results (provider_complete).</li>
          <li>Consumer has a 1-hour window to confirm or dispute.</li>
          <li>If no action within the timeframe, anyone can call auto_release to refund the consumer.</li>
          <li>If disputed, owner resolves and splits funds per agreed percentages.</li>
        </ol>
        <div className="mt-2 text-xs text-green-700">Auto-release is now active: call auto_release after valid_until expires.</div>
      </Card>

      {/* Job Status Board */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold flex items-center gap-2"><Shield className="h-4 w-4" />Job Status Board</h3>
          <button onClick={loadJobs} disabled={loadingJobs} className="text-xs flex items-center gap-1 text-blue-600 hover:underline">
            <RefreshCw className={`h-3 w-3 ${loadingJobs ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
        {(() => {
          const allJobs = [...localJobs, ...jobs];
          const seen = new Set<string>();
          const merged = allJobs.filter(j => { if (seen.has(j.id)) return false; seen.add(j.id); return true; });
          if (merged.length === 0) return <p className="text-sm text-muted-foreground">No active jobs found on chain.</p>;
          return (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {merged.map((job) => (
                <div key={job.id} className="flex items-center justify-between text-xs bg-muted p-2 rounded">
                  <div className="flex items-center gap-2">
                    <Badge variant={job.state === 'pending' ? 'warning' : job.state === 'settled' ? 'success' : job.state === 'refunded' ? 'default' : job.state === 'disputed' ? 'error' : 'default'}>{job.state}</Badge>
                    <span className="font-mono truncate max-w-[120px]">{job.id}</span>
                  </div>
                  <div className="text-muted-foreground">{job.amount} motes</div>
                </div>
              ))}
            </div>
          );
        })()}
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <EntryPointCard title="Create Job" contract="EscrowVault" contractHash={contractHash} provider={provider} publicKeyHex={publicKeyHex} onTx={onTx}>
          {({ submit }) => {
            const [consumer, setConsumer] = useState(accountHash); const [providerAddr, setProviderAddr] = useState(accountHash); const [amount, setAmount] = useState('1000000000000000000'); const [feeBps, setFeeBps] = useState('100'); const [orderId, setOrderId] = useState('order-1');
            return <form onSubmit={(e) => { e.preventDefault(); const jobId = `job:${consumer.replace('account-hash-','')}:0`; setLocalJobs(prev => [{ id: jobId, consumer, provider: providerAddr, amount, state: 'pending', validUntil: Math.floor(Date.now()/1000) + 3600, createdAt: Math.floor(Date.now()/1000) }, ...prev]); submit('create_job', {
              consumer: sdk.CLValue.newCLByteArray(accountHashToBytes(consumer)), provider: sdk.CLValue.newCLByteArray(accountHashToBytes(providerAddr)),
              amount: sdk.CLValue.newCLUInt512(amount), provider_fee_bps: sdk.CLValue.newCLUint64(feeBps), order_id: sdk.CLValue.newCLString(orderId),
            }); }} className="space-y-2">
              <Input label="Consumer Account Hash" value={consumer} onChange={setConsumer} />
              <Input label="Provider Account Hash" value={providerAddr} onChange={setProviderAddr} />
              <Input label="Amount (motes)" value={amount} onChange={setAmount} />
              <Input label="Provider Fee BPS" value={feeBps} onChange={setFeeBps} />
              <Input label="Order ID" value={orderId} onChange={setOrderId} />
              <Button type="submit" disabled={!canSign} className="w-full"><Send className="h-4 w-4 mr-1" />Create Job</Button>
            </form>;
          }}
        </EntryPointCard>
        <EntryPointCard title="Provider Ack" contract="EscrowVault" contractHash={contractHash} provider={provider} publicKeyHex={publicKeyHex} onTx={onTx}>
          {({ submit }) => {
            const [jobId, setJobId] = useState('');
            return <form onSubmit={(e) => { e.preventDefault(); submit('provider_ack', { job_id: sdk.CLValue.newCLString(jobId) }); }} className="space-y-2">
              <Input label="Job ID" value={jobId} onChange={setJobId} />
              <Button type="submit" disabled={!canSign} className="w-full"><Send className="h-4 w-4 mr-1" />Ack</Button>
            </form>;
          }}
        </EntryPointCard>
        <EntryPointCard title="Provider Complete" contract="EscrowVault" contractHash={contractHash} provider={provider} publicKeyHex={publicKeyHex} onTx={onTx}>
          {({ submit }) => {
            const [jobId, setJobId] = useState(''); const [responseHash, setResponseHash] = useState('');
            return <form onSubmit={(e) => { e.preventDefault(); submit('provider_complete', { job_id: sdk.CLValue.newCLString(jobId), response_hash: sdk.CLValue.newCLString(responseHash) }); }} className="space-y-2">
              <Input label="Job ID" value={jobId} onChange={setJobId} />
              <Input label="Response Hash" value={responseHash} onChange={setResponseHash} />
              <Button type="submit" disabled={!canSign} className="w-full"><Send className="h-4 w-4 mr-1" />Complete</Button>
            </form>;
          }}
        </EntryPointCard>
        <EntryPointCard title="Consumer Confirm" contract="EscrowVault" contractHash={contractHash} provider={provider} publicKeyHex={publicKeyHex} onTx={onTx}>
          {({ submit }) => {
            const [jobId, setJobId] = useState(''); const [rating, setRating] = useState('5');
            return <form onSubmit={(e) => { e.preventDefault(); submit('consumer_confirm', {
              job_id: sdk.CLValue.newCLString(jobId), rating: sdk.CLValue.newCLUint64(rating),
            }); }} className="space-y-2">
              <Input label="Job ID" value={jobId} onChange={setJobId} />
              <Input label="Rating (1-10)" value={rating} onChange={setRating} />
              <Button type="submit" disabled={!canSign} className="w-full"><Send className="h-4 w-4 mr-1" />Confirm & Release</Button>
            </form>;
          }}
        </EntryPointCard>
        <EntryPointCard title="Claim Payment" contract="EscrowVault" contractHash={contractHash} provider={provider} publicKeyHex={publicKeyHex} onTx={onTx}>
          {({ submit }) => {
            const [jobId, setJobId] = useState('');
            return <form onSubmit={(e) => { e.preventDefault(); submit('claim_payment', { job_id: sdk.CLValue.newCLString(jobId) }); }} className="space-y-2">
              <Input label="Job ID" value={jobId} onChange={setJobId} />
              <Button type="submit" disabled={!canSign} className="w-full"><Send className="h-4 w-4 mr-1" />Claim</Button>
            </form>;
          }}
        </EntryPointCard>
        <EntryPointCard title="Auto Release" contract="EscrowVault" contractHash={contractHash} provider={provider} publicKeyHex={publicKeyHex} onTx={onTx}>
          {({ submit }) => {
            const [jobId, setJobId] = useState('');
            return <form onSubmit={(e) => { e.preventDefault(); submit('auto_release', { job_id: sdk.CLValue.newCLString(jobId) }); }} className="space-y-2">
              <Input label="Job ID" value={jobId} onChange={setJobId} />
              <Button type="submit" disabled={!canSign} className="w-full"><Send className="h-4 w-4 mr-1" />Auto Release</Button>
              <p className="text-xs text-muted-foreground">Refunds expired jobs (valid_until passed).</p>
            </form>;
          }}
        </EntryPointCard>
        <EntryPointCard title="Resolve Dispute" contract="EscrowVault" contractHash={contractHash} provider={provider} publicKeyHex={publicKeyHex} onTx={onTx}>
          {({ submit }) => {
            const [jobId, setJobId] = useState(''); const [consumerPayout, setConsumerPayout] = useState('50'); const [providerPayout, setProviderPayout] = useState('50');
            return <form onSubmit={(e) => { e.preventDefault(); submit('resolve_dispute', {
              job_id: sdk.CLValue.newCLString(jobId), consumer_payout_pct: sdk.CLValue.newCLUint64(consumerPayout), provider_payout_pct: sdk.CLValue.newCLUint64(providerPayout),
            }); }} className="space-y-2">
              <Input label="Job ID" value={jobId} onChange={setJobId} />
              <Input label="Consumer Payout %" value={consumerPayout} onChange={setConsumerPayout} />
              <Input label="Provider Payout %" value={providerPayout} onChange={setProviderPayout} />
              <Button type="submit" disabled={!canSign} variant="danger" className="w-full">Resolve</Button>
            </form>;
          }}
        </EntryPointCard>
        <EntryPointCard title="Claim Resolution" contract="EscrowVault" contractHash={contractHash} provider={provider} publicKeyHex={publicKeyHex} onTx={onTx}>
          {({ submit }) => {
            const [jobId, setJobId] = useState('');
            return <form onSubmit={(e) => { e.preventDefault(); submit('claim_resolution', { job_id: sdk.CLValue.newCLString(jobId) }); }} className="space-y-2">
              <Input label="Job ID" value={jobId} onChange={setJobId} />
              <Button type="submit" disabled={!canSign} className="w-full"><Send className="h-4 w-4 mr-1" />Claim Resolution</Button>
            </form>;
          }}
        </EntryPointCard>
        <EntryPointCard title="Withdraw Protocol Fees" contract="EscrowVault" contractHash={contractHash} provider={provider} publicKeyHex={publicKeyHex} onTx={onTx}>
          {({ submit }) => {
            const [amount, setAmount] = useState('0');
            return <form onSubmit={(e) => { e.preventDefault(); submit('withdraw_protocol_fees', { amount: sdk.CLValue.newCLUInt512(amount) }); }} className="space-y-2">
              <Input label="Amount (motes, 0 for all)" value={amount} onChange={setAmount} />
              <Button type="submit" disabled={!canSign} className="w-full"><Send className="h-4 w-4 mr-1" />Withdraw Fees</Button>
            </form>;
          }}
        </EntryPointCard>
      </div>
    </div>
  );
}
