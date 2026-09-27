export interface SignalAuditRecord {
  id: string;
  timestamp: number;
  symbol: string;
  timeframe: string;
  regime: string;
  setupState: string;
  direction: 'LONG' | 'SHORT' | 'NEUTRAL';
  setupQuality: number;
  rankScore: number;
  mtfAlignment: number;
  conflictLevel: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH';
  conflictPenalty: number;
  volatilityState: string;
  factorScores: Record<string, number>;
  entryPrice: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  takeProfit3?: number;
  riskMultiplier: number;
  finalDecision: 'EXECUTE' | 'WATCH' | 'REJECT';
  rejectionReason?: string;
  rejectionCode?: string;
  provenance: {
    source: string;
    freshness: string;
  };
}

export class SignalAuditTrail {
  private static auditRecords: SignalAuditRecord[] = [];
  private static readonly MAX_RECORDS = 1000;

  /**
   * Deterministically logs an institutional signal decision audit record.
   * Zero future-data leakage: only inputs and decisions at time T are stored.
   */
  public static logDecision(record: SignalAuditRecord): void {
    this.auditRecords.unshift(record);
    if (this.auditRecords.length > this.MAX_RECORDS) {
      this.auditRecords.pop();
    }
  }

  /**
   * Flexible record logger accepting partial objects.
   */
  public static record(record: any): void {
    const id = record.id || `audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    this.logDecision({
      id,
      timestamp: record.timestamp || Date.now(),
      symbol: record.asset || record.symbol || 'BTCUSDT',
      timeframe: record.timeframe || '1h',
      regime: record.marketRegime || record.regime || 'UNKNOWN',
      setupState: record.setupState || 'NO_SETUP',
      direction: record.direction || (record.action === 'BUY' ? 'LONG' : record.action === 'SELL' ? 'SHORT' : 'NEUTRAL'),
      setupQuality: record.setupQuality ?? 0,
      rankScore: record.rankScore ?? 0,
      mtfAlignment: record.mtfAlignment ?? 0,
      conflictLevel: record.conflictLevel || 'NONE',
      conflictPenalty: record.conflictPenalty ?? 0,
      volatilityState: record.volatilityState || 'NORMAL',
      factorScores: record.factorScores || {},
      entryPrice: record.entryPrice ?? 0,
      stopLoss: record.stopLoss ?? 0,
      takeProfit1: record.takeProfit1 ?? 0,
      takeProfit2: record.takeProfit2 ?? 0,
      takeProfit3: record.takeProfit3 ?? 0,
      riskMultiplier: record.riskMultiplier ?? 1.0,
      finalDecision: record.finalDecision || (record.action === 'BUY' || record.action === 'SELL' ? 'EXECUTE' : 'REJECT'),
      rejectionReason: record.rejectionReason,
      rejectionCode: record.rejectionCode,
      provenance: record.provenance || { source: 'Engine', freshness: 'LIVE' },
    });
  }

  public static size(): number {
    return this.auditRecords.length;
  }

  public static query(filter: { asset?: string; symbol?: string; action?: string; direction?: string }): SignalAuditRecord[] {
    return this.auditRecords.filter((r) => {
      if (filter.asset && r.symbol !== filter.asset) return false;
      if (filter.symbol && r.symbol !== filter.symbol) return false;
      if (filter.direction && r.direction !== filter.direction) return false;
      if (filter.action) {
        const action = r.direction === 'LONG' ? 'BUY' : r.direction === 'SHORT' ? 'SELL' : 'HOLD';
        if (action !== filter.action) return false;
      }
      return true;
    });
  }

  public static getRecords(limit = 100, symbol?: string): SignalAuditRecord[] {
    let filtered = this.auditRecords;
    if (symbol) {
      filtered = filtered.filter((r) => r.symbol === symbol);
    }
    return filtered.slice(0, limit);
  }

  public static clear(): void {
    this.auditRecords = [];
  }
}
