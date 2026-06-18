import { describe, it, expect } from 'vitest';
import { aggregateRankings, weightedMajorityVote } from '../../src/consensus/bradley-terry.js';
import { ComparisonPair } from '../../src/types/index.js';

describe('Bradley-Terry Aggregation', () => {
  it('should rank a single clear winner', () => {
    const comparisons: ComparisonPair[] = [
      { queryId: 'q1', peerA: 'A', peerB: 'B', responseA: 'good', responseB: 'bad', judgePeerId: 'J1', preference: 'A', timestamp: 1 },
      { queryId: 'q1', peerA: 'A', peerB: 'C', responseA: 'good', responseB: 'worse', judgePeerId: 'J1', preference: 'A', timestamp: 2 },
      { queryId: 'q1', peerA: 'B', peerB: 'C', responseA: 'bad', responseB: 'worse', judgePeerId: 'J1', preference: 'A', timestamp: 3 },
    ];

    const rankings = aggregateRankings(comparisons);
    const scores = new Map(rankings.map((r) => [r.peerId, r.score]));

    expect(scores.get('A')).toBeGreaterThan(scores.get('B')!);
    expect(scores.get('B')).toBeGreaterThan(scores.get('C')!);
  });

  it('should handle ties gracefully', () => {
    const comparisons: ComparisonPair[] = [
      { queryId: 'q1', peerA: 'A', peerB: 'B', responseA: 'x', responseB: 'x', judgePeerId: 'J1', preference: 'tie', timestamp: 1 },
      { queryId: 'q1', peerA: 'A', peerB: 'B', responseA: 'x', responseB: 'x', judgePeerId: 'J1', preference: 'tie', timestamp: 2 },
    ];

    const rankings = aggregateRankings(comparisons);
    const [a, b] = rankings;

    expect(Math.abs(a.score - b.score)).toBeLessThan(0.01);
  });

  it('should return empty for no comparisons', () => {
    expect(aggregateRankings([])).toEqual([]);
  });
});

describe('Weighted Majority Vote', () => {
  it('should select the highest-weighted response', () => {
    const responses = [
      { peerId: 'A', output: 'yes' },
      { peerId: 'B', output: 'yes' },
      { peerId: 'C', output: 'no' },
    ];

    const rankings = [
      { peerId: 'A', score: 1.5, confidence: 0.8, comparisons: 10 },
      { peerId: 'B', score: 1.2, confidence: 0.7, comparisons: 8 },
      { peerId: 'C', score: 0.5, confidence: 0.9, comparisons: 12 },
    ];

    const result = weightedMajorityVote(responses, rankings);
    expect(result.output).toBe('yes');
    expect(result.confidence).toBeGreaterThan(0.5);
  });
});
