# Deployment Guide: Chimera-Fortytwo on Chimera Testnet

## Prerequisites

- Node.js 20+
- Foundry (for contract deployment)
- Docker & Docker Compose (optional)
- A wallet with Chimera testnet ETH

## 1. Deploy Smart Contracts

If the Chimera marketplace contracts (ComputeRegistry, OrderBook, EscrowVault, Reputation) are not yet deployed on testnet:

```bash
cd scripts/deploy
forge script DeployChimera.s.sol:DeployChimera \
  --rpc-url $CHIMERA_RPC_URL \
  --private-key $PRIVATE_KEY \
  --broadcast
```

After deployment, update `config/chimera-testnet.json` with the deployed contract addresses.

## 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your RPC URL, private key, and coordinator URL
```

## 3. Register Node

```bash
npm run register
```

This will:
- Register your wallet on ComputeRegistry
- Stake the minimum required amount
- Place an ask on the OrderBook for your default model

## 4. Run Node (Local)

```bash
npm run dev:node
```

## 5. Run with Docker

```bash
npm run docker:build
npm run docker:up
```

## 6. Verify Deployment

```bash
# Check node health
curl http://localhost:8080/health

# Check provider status on-chain
cast call $COMPUTE_REGISTRY "getProvider(address)" $YOUR_ADDRESS \
  --rpc-url $CHIMERA_RPC_URL
```

## Chimera Testnet Details

| Parameter | Value |
|-----------|-------|
| Network | chimera-testnet |
| Chain ID | 31337 (local) / TBD (public) |
| RPC | http://localhost:8545 (local Anvil) |
| Coordinator WS | ws://localhost:8080 |
| Minimum Stake | 1 ETH |
| Protocol Fee | 1% |

## Troubleshooting

**Error: "Node not registered or not active"**
- Run `npm run register` first
- Ensure your wallet has enough testnet ETH for gas + stake

**Error: "Coordinator connection closed"**
- Verify `COORDINATOR_WS_URL` is correct
- Check that the coordinator service is running

**Error: "Failed to submit providerDone"**
- The job may have already been settled or disputed
- Check job status on EscrowVault

## Architecture Notes

This deployment uses:
- **Fortytwo's swarm inference** for peer-ranked consensus
- **QVAC's ComputeRegistry** for provider identity and staking
- **QVAC's EscrowVault** for per-job payment settlement
- **QVAC's Reputation** for on-chain reputation tracking
- **x402-inspired** per-request payment flow (via escrow)

The node can operate in two modes:
1. **Direct inference** — job comes in, node runs model, submits result
2. **Swarm consensus** — job is distributed to N peers, pairwise ranking produces consensus output
