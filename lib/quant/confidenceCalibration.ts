import { ReplayedTrade } from './historicalReplayEngine';

export interface CalibrationBucket {
  bucketRange: string;
  midpointConfidence: number;
  sampleCount: number;
  wins: number;
  realizedWinRate: number; // 0 - 100
  calibrationDelta: number; // realizedWinRate - midpointConfidence
  status: 'CALIBRATED' | 'OVERCONFIDENT' | 'UNDERCONFIDENT' | 'INSUFFICIENT_SAMPLE';
}

export interface CalibrationReport {
  status: 'CALIBRATED' | 'UNCALIBRATED';
  totalEvaluatedTrades: number;
  expectedCalibrationError: number; // ECE %
  buckets: CalibrationBucket[];
  verdict: string;
  isMonotonic: boolean; // Does higher confidence correspond to higher win rate?
}

export class ConfidenceCalibrationEngine {
  /**
   * Assesses whether the model's confidence scores correspond to real-world empirical hit rates.
   * Completely avoids calling unverified scores "probabilities".
   */
  public static evaluate(trades: ReplayedTrade[]): CalibrationReport {
    if (!trades || trades.length < 5) {
      return {
        status: 'UNCALIBRATED',
        totalEvaluatedTrades: trades?.length ?? 0,
        expectedCalibrationError: 0,
        buckets: [],
        verdict: 'Недостаточно исторических сделок для калибровки достоверности (требуется >= 5 сделок).',
        isMonotonic: false,
      };
    }

    const bucketDefs = [
      { label: '50-60%', min: 50, max: 60, mid: 55 },
      { label: '60-70%', min: 60, max: 70, mid: 65 },
      { label: '70-80%', min: 70, max: 80, mid: 75 },
      { label: '80-90%', min: 80, max: 90, mid: 85 },
      { label: '90-100%', min: 90, max: 100, mid: 95 },
    ];

    const buckets: CalibrationBucket[] = [];
    let weightedCalibrationError = 0;
    let validBucketsCount = 0;

    for (const b of bucketDefs) {
      const match = trades.filter((t) => t.confidenceAtEntry >= b.min && (b.max === 100 ? t.confidenceAtEntry <= b.max : t.confidenceAtEntry < b.max));
      const count = match.length;

      if (count < 3) {
        buckets.push({
          bucketRange: b.label,
          midpointConfidence: b.mid,
          sampleCount: count,
          wins: 0,
          realizedWinRate: 0,
          calibrationDelta: 0,
          status: 'INSUFFICIENT_SAMPLE',
        });
        continue;
      }

      validBucketsCount++;
      const wins = match.filter((t) => t.outcome === 'WIN').length;
      const realizedWinRate = Math.round((wins / count) * 10000) / 100;
      const delta = Math.round((realizedWinRate - b.mid) * 10) / 10;

      let status: CalibrationBucket['status'] = 'CALIBRATED';
      if (delta < -15) status = 'OVERCONFIDENT';
      else if (delta > 15) status = 'UNDERCONFIDENT';

      weightedCalibrationError += Math.abs(realizedWinRate - b.mid) * (count / trades.length);

      buckets.push({
        bucketRange: b.label,
        midpointConfidence: b.mid,
        sampleCount: count,
        wins,
        realizedWinRate,
        calibrationDelta: delta,
        status,
      });
    }

    // Check monotonicity: does winRate strictly or generally increase with confidence?
    const validBuckets = buckets.filter((b) => b.status !== 'INSUFFICIENT_SAMPLE');
    let isMonotonic = true;
    for (let i = 1; i < validBuckets.length; i++) {
      if (validBuckets[i].realizedWinRate < validBuckets[i - 1].realizedWinRate - 5) {
        isMonotonic = false;
        break;
      }
    }

    const ece = Math.round(weightedCalibrationError * 10) / 10;
    const isCalibrated = validBucketsCount >= 2 && ece < 20;

    let verdict = 'Модель калибрована: более высокая уверенность статистически транслируется в повышенный винрейт.';
    if (!isCalibrated) {
      verdict = 'Модель требует калибровки (UNCALIBRATED): расхождение между расчётной уверенностью и фактическим винрейтом превышает 20%.';
    } else if (!isMonotonic) {
      verdict = 'Частичная калибровка: зависимость винрейта от уверенности немонотонна.';
    }

    return {
      status: isCalibrated ? 'CALIBRATED' : 'UNCALIBRATED',
      totalEvaluatedTrades: trades.length,
      expectedCalibrationError: ece,
      buckets,
      verdict,
      isMonotonic,
    };
  }
}
