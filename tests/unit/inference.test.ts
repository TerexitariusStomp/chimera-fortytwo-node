import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createInferenceBackend } from '../../src/node/inference.js';
import { NodeConfig } from '../../src/types/index.js';

const mockConfig: NodeConfig = {
  name: 'test-node',
  region: 'test',
  capacityTokensPerSec: 10,
  minPriceWei: 1000n,
  stakeWei: 1000n,
  modelCacheDir: './models/cache',
  defaultModel: 'test-model',
  modelFormat: 'onnx',
  inferenceBackend: 'mock',
  consensusMinPeers: 2,
  consensusMatchTimeoutMs: 1000,
  rankingWindowSize: 10,
};

describe('Mock Inference Backend', () => {
  let backend: ReturnType<typeof createInferenceBackend>;

  beforeAll(async () => {
    backend = createInferenceBackend(mockConfig);
    await backend.initialize();
  });

  afterAll(async () => {
    await backend.teardown();
  });

  it('should return a mock result', async () => {
    const result = await backend.run({
      jobId: 'job-1',
      modelId: 'test-model',
      prompt: 'Hello world',
      params: { temperature: 0.7, topP: 0.9, maxTokens: 50 },
      deadline: Date.now() + 5000,
    });

    expect(result.jobId).toBe('job-1');
    expect(result.output).toContain('MOCK');
    expect(result.usage.computeMs).toBeGreaterThanOrEqual(0);
    expect(result.usage.memoryPeakMB).toBeGreaterThan(0);
  });

  it('should report healthy', async () => {
    expect(await backend.health()).toBe(true);
  });
});
