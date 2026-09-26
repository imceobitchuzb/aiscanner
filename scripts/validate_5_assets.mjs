async function testAsset(symbol) {
  try {
    const res = await fetch(`http://localhost:3000/api/signal?symbol=${symbol}&timeframe=1h`);
    if (!res.ok) {
      console.error(`Error fetching signal for ${symbol}: HTTP ${res.status}`);
      return null;
    }
    const data = await res.json();
    return data;
  } catch (err) {
    console.error(`Failed to fetch signal for ${symbol}:`, err.message);
    return null;
  }
}

async function main() {
  const assets = ['BTCUSDT', 'ETHUSDT', 'XAUUSD', 'EURUSD', 'NVDA'];
  console.log('='.repeat(80));
  console.log('LIVE NEXUS QUANT VALIDATION AUDIT (5 ASSETS)');
  console.log('='.repeat(80));

  const results = [];
  for (const sym of assets) {
    const data = await testAsset(sym);
    if (!data) continue;
    results.push(data);
    console.log(`\nASSET: ${data.asset}`);
    console.log(`- Price: $${data.currentPrice ?? 'N/A'}`);
    console.log(`- Data Source: ${data.dataSource ?? 'N/A'} (Status: ${data.marketStatus ?? 'N/A'}, Freshness: ${data.dataFreshness ?? 'N/A'})`);
    console.log(`- Regime: ${data.marketState?.regime} (Confidence: ${data.marketState?.regimeConfidence}%, ATR%: ${data.marketState?.atrPercent}%)`);
    console.log(`- Structure: ${data.structure?.state} (Support: $${data.structure?.keySupport}, Resistance: $${data.structure?.keyResistance})`);
    console.log(`- MTF Bias: ${data.mtf?.dominantBias} (Alignment: ${data.mtf?.alignmentScore}%)`);
    console.log(`- Setup State: ${data.setup?.state} | Direction: ${data.setup?.direction} | Quality: ${data.setup?.quality}/100 | Confidence: ${data.setup?.confidence}%`);
    if (data.tradePlan) {
      console.log(`- Trade Plan: Entry: $${data.tradePlan.entryPrice} | SL: $${data.tradePlan.stopLoss} (${data.tradePlan.stopLossPercent}%, ${data.tradePlan.stopLossAtrMultiple} ATR) | TP1: $${data.tradePlan.takeProfit1} | TP2: $${data.tradePlan.takeProfit2} | R:R: ${data.tradePlan.riskRewardRatio}`);
    } else {
      console.log(`- Trade Plan: NONE (Gated out)`);
    }
    if (data.rejectionReason) {
      console.log(`- Gate / Rejection: ${data.rejectionReason}`);
    }
    if (data.evidence && data.evidence.length > 0) {
      console.log(`- Evidence Factors (${data.evidence.length}):`);
      for (const e of data.evidence) {
        console.log(`  * [${e.category}] ${e.name} (${e.contribution > 0 ? '+' : ''}${e.contribution} pts): ${e.reason}`);
      }
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('SUMMARY TABLE:');
  console.log('='.repeat(80));
  console.log('| Asset | Price | Source | Regime | Structure | MTF | Setup | Dir | R:R | Rejection Reason |');
  console.log('|---|---|---|---|---|---|---|---|---|---|');
  for (const r of results) {
    const rr = r.tradePlan ? r.tradePlan.riskRewardRatio : 'N/A';
    const reason = r.rejectionReason ? r.rejectionReason.slice(0, 45) + '...' : 'APPROVED';
    console.log(`| ${r.asset} | $${r.currentPrice ?? 'N/A'} | ${r.dataSource ?? 'N/A'} | ${r.marketState?.regime} | ${r.structure?.state} | ${r.mtf?.dominantBias} (${r.mtf?.alignmentScore}%) | ${r.setup?.state} | ${r.setup?.direction} | ${rr} | ${reason} |`);
  }
}

main();
