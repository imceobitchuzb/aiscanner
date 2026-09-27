export type AlertEventType = 
  | 'WATCH_CREATED'
  | 'SETUP_CONFIRMED'
  | 'ENTRY_TRIGGERED'
  | 'TP1_REACHED'
  | 'TP2_REACHED'
  | 'INVALIDATED';

export interface MarketAlert {
  id: string;
  eventType: AlertEventType;
  asset: string;
  timeframe: string;
  direction: 'LONG' | 'SHORT';
  timestamp: number;
  triggerPrice: number;
  quality: number;
  message: string;
  metadata?: Record<string, any>;
}

export class AlertEngine {
  private static alertLog: MarketAlert[] = [];

  /**
   * Generates a deterministic, timestamped alert event.
   */
  public static createAlert(
    eventType: AlertEventType,
    asset: string,
    timeframe: string,
    direction: 'LONG' | 'SHORT',
    triggerPrice: number,
    quality: number,
    customMessage?: string,
    metadata?: Record<string, any>
  ): MarketAlert {
    const timestamp = Date.now();
    const id = `alt-${asset}-${eventType}-${timestamp}`;

    let defaultMsg = '';
    switch (eventType) {
      case 'WATCH_CREATED':
        defaultMsg = `[WATCH] ${asset} (${timeframe}) ${direction}: условия сетапа формируются (Качество: ${quality}/100, цена: $${triggerPrice}).`;
        break;
      case 'SETUP_CONFIRMED':
        defaultMsg = `[CONFIRMED] ${asset} (${timeframe}) ${direction}: сетап подтверждён институциональными фильтрами (Качество: ${quality}/100).`;
        break;
      case 'ENTRY_TRIGGERED':
        defaultMsg = `[ENTRY] ${asset} (${timeframe}) ${direction}: позиция открыта по цене $${triggerPrice}.`;
        break;
      case 'TP1_REACHED':
        defaultMsg = `[TP1] ${asset} (${timeframe}) ${direction}: достигнута первая цель прибыли ($${triggerPrice}). Стоп переведён в безубыток.`;
        break;
      case 'TP2_REACHED':
        defaultMsg = `[TP2] ${asset} (${timeframe}) ${direction}: достигнута ключевая цель ($${triggerPrice}). Позиция зафиксирована.`;
        break;
      case 'INVALIDATED':
        defaultMsg = `[INVALIDATED] ${asset} (${timeframe}) ${direction}: сценарий отменён по причине нарушения структуры на уровне $${triggerPrice}.`;
        break;
    }

    const alert: MarketAlert = {
      id,
      eventType,
      asset,
      timeframe,
      direction,
      timestamp,
      triggerPrice,
      quality,
      message: customMessage || defaultMsg,
      metadata,
    };

    this.alertLog.unshift(alert);
    if (this.alertLog.length > 500) {
      this.alertLog.pop();
    }

    return alert;
  }

  public static getRecentAlerts(limit = 50): MarketAlert[] {
    return this.alertLog.slice(0, limit);
  }

  public static getAlerts(limit = 50): MarketAlert[] {
    return this.getRecentAlerts(limit);
  }

  public static clear(): void {
    this.alertLog = [];
  }

  public static clearAlerts(): void {
    this.clear();
  }
}
