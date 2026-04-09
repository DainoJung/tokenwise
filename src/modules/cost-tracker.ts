/**
 * Cost Tracker — Real-time cost monitoring and savings reporting
 */

import type { CostRecord, CostSummary } from '../types';
import { estimateCost } from '../utils/pricing';

export class CostTracker {
  private records: CostRecord[] = [];

  record(params: {
    model: string;
    originalModel: string;
    inputTokens: number;
    outputTokens: number;
    originalInputTokens: number;
    optimizations: string[];
  }): CostRecord {
    const savedInputTokens = params.originalInputTokens - params.inputTokens;
    const estimatedCostUSD = estimateCost(params.model, params.inputTokens, params.outputTokens);
    const estimatedOriginalCostUSD = estimateCost(params.originalModel, params.originalInputTokens, params.outputTokens);

    const record: CostRecord = {
      timestamp: Date.now(),
      model: params.model,
      originalModel: params.originalModel,
      inputTokens: params.inputTokens,
      outputTokens: params.outputTokens,
      originalInputTokens: params.originalInputTokens,
      savedInputTokens: Math.max(0, savedInputTokens),
      estimatedCostUSD,
      estimatedOriginalCostUSD,
      savingsUSD: Math.max(0, estimatedOriginalCostUSD - estimatedCostUSD),
      optimizations: params.optimizations,
    };

    this.records.push(record);
    return record;
  }

  getSummary(): CostSummary {
    const byModel: CostSummary['byModel'] = {};

    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalOriginalInputTokens = 0;
    let totalSavedInputTokens = 0;
    let totalCostUSD = 0;
    let totalOriginalCostUSD = 0;
    let totalSavingsUSD = 0;

    for (const r of this.records) {
      totalInputTokens += r.inputTokens;
      totalOutputTokens += r.outputTokens;
      totalOriginalInputTokens += r.originalInputTokens;
      totalSavedInputTokens += r.savedInputTokens;
      totalCostUSD += r.estimatedCostUSD;
      totalOriginalCostUSD += r.estimatedOriginalCostUSD;
      totalSavingsUSD += r.savingsUSD;

      if (!byModel[r.model]) {
        byModel[r.model] = { requests: 0, inputTokens: 0, outputTokens: 0, costUSD: 0 };
      }
      byModel[r.model].requests++;
      byModel[r.model].inputTokens += r.inputTokens;
      byModel[r.model].outputTokens += r.outputTokens;
      byModel[r.model].costUSD += r.estimatedCostUSD;
    }

    return {
      totalRequests: this.records.length,
      totalInputTokens,
      totalOutputTokens,
      totalOriginalInputTokens,
      totalSavedInputTokens,
      totalCostUSD,
      totalOriginalCostUSD,
      totalSavingsUSD,
      savingsPercent: totalOriginalCostUSD > 0
        ? ((totalSavingsUSD / totalOriginalCostUSD) * 100)
        : 0,
      byModel,
      records: this.records,
    };
  }

  /** Pretty-print current savings */
  printSummary(): string {
    const s = this.getSummary();
    const lines = [
      '╔══════════════════════════════════════╗',
      '║       TokenWise Cost Report          ║',
      '╠══════════════════════════════════════╣',
      `║  Requests:     ${String(s.totalRequests).padStart(18)} ║`,
      `║  Input tokens: ${formatNumber(s.totalInputTokens).padStart(18)} ║`,
      `║  Original:     ${formatNumber(s.totalOriginalInputTokens).padStart(18)} ║`,
      `║  Saved tokens: ${formatNumber(s.totalSavedInputTokens).padStart(18)} ║`,
      '╠══════════════════════════════════════╣',
      `║  Actual cost:  $${s.totalCostUSD.toFixed(4).padStart(17)} ║`,
      `║  Without TW:   $${s.totalOriginalCostUSD.toFixed(4).padStart(17)} ║`,
      `║  You saved:    $${s.totalSavingsUSD.toFixed(4).padStart(17)} ║`,
      `║  Savings:      ${s.savingsPercent.toFixed(1).padStart(17)}% ║`,
      '╚══════════════════════════════════════╝',
    ];
    return lines.join('\n');
  }

  reset(): void {
    this.records = [];
  }
}

function formatNumber(n: number): string {
  return n.toLocaleString('en-US');
}
