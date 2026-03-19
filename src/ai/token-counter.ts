export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  estimatedCost: number;
}

// Approximate pricing per 1M tokens (Claude Sonnet 4)
const INPUT_COST_PER_M = 3.0;
const OUTPUT_COST_PER_M = 15.0;

export function calculateCost(inputTokens: number, outputTokens: number): number {
  return (inputTokens / 1_000_000) * INPUT_COST_PER_M + (outputTokens / 1_000_000) * OUTPUT_COST_PER_M;
}

export class TokenTracker {
  private sessionInput = 0;
  private sessionOutput = 0;

  record(inputTokens: number, outputTokens: number): void {
    this.sessionInput += inputTokens;
    this.sessionOutput += outputTokens;
  }

  getUsage(): TokenUsage {
    return {
      inputTokens: this.sessionInput,
      outputTokens: this.sessionOutput,
      estimatedCost: calculateCost(this.sessionInput, this.sessionOutput),
    };
  }

  reset(): void {
    this.sessionInput = 0;
    this.sessionOutput = 0;
  }
}
