import { SolanaLogo } from './SolanaLogo';

export function StrategiesView() {
  return (
    <div className="min-h-screen bg-black py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-100 mb-2">ORE Mining Strategies</h1>
        </div>

        {/* BTC Comparison - Top Section */}
        <div className="bg-[#21252C] border border-slate-700 rounded-lg p-6 mb-8">
          <h2 className="text-2xl font-semibold text-slate-100 mb-4 flex items-center gap-2">
            <svg className="w-6 h-6 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
            </svg>
            ORE Mining vs Bitcoin Mining
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
              <h3 className="text-lg font-semibold text-slate-200 mb-3">Bitcoin Mining</h3>
              <ul className="space-y-2 text-sm text-slate-300">
                <li className="flex items-start gap-2">
                  <span className="text-slate-500 mt-0.5">✗</span>
                  <span>Requires expensive ASIC mining rigs ($1,000-$10,000+)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-slate-500 mt-0.5">✗</span>
                  <span>High electricity costs (hundreds of dollars monthly)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-slate-500 mt-0.5">✗</span>
                  <span>Physical hardware maintenance and cooling</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-slate-500 mt-0.5">✗</span>
                  <span>Noise, heat, and space requirements</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-slate-500 mt-0.5">✗</span>
                  <span>Competition with massive mining farms</span>
                </li>
              </ul>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
              <h3 className="text-lg font-semibold text-slate-200 mb-3">ORE Mining</h3>
              <ul className="space-y-2 text-sm text-slate-300">
                <li className="flex items-start gap-2">
                  <span className="text-amber-400 mt-0.5">✓</span>
                  <span><strong>No hardware required</strong> - mine directly from your wallet</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-400 mt-0.5">✓</span>
                  <span><strong>No electricity costs</strong> - all computation on-chain</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-400 mt-0.5">✓</span>
                  <span>No physical setup or maintenance needed</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-400 mt-0.5">✓</span>
                  <span>Mine from anywhere with internet access</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-400 mt-0.5">✓</span>
                  <span>Level playing field - no advantage from expensive equipment</span>
                </li>
              </ul>
            </div>
          </div>
          <p className="mt-4 text-slate-300 text-sm">
            <strong className="text-amber-400">Key Difference:</strong> ORE mining uses your <SolanaLogo width={16} height={16} className="inline" /> SOL deployment as "computational power" instead of physical hardware. Just like BTC miners compete with hash power, ORE miners compete with SOL deployment. The more <SolanaLogo width={16} height={16} className="inline" /> SOL you deploy, the higher your chance of winning rewards - but unlike BTC, you don't need to buy expensive rigs or pay electricity bills.
          </p>
        </div>

        {/* Guaranteed Win Strategy */}
        <div className="bg-[#21252C] border border-slate-700 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold text-slate-100 mb-3 flex items-center gap-2">
            <svg className="w-6 h-6 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            Guaranteed Win Strategy: Bid on All 25 Squares
          </h2>
          <p className="text-slate-300 mb-4">
            <strong className="text-amber-400">To accumulate unrefined ORE consistently, bid on all 25 squares.</strong> Since one square always wins each round, deploying <SolanaLogo width={16} height={16} className="inline" /> SOL to every square guarantees you'll win every round. This ensures a steady stream of unrefined <img src="/orelogo.jpg" alt="ORE" className="w-4 h-4 object-contain rounded inline mx-1" /> ORE rewards.
          </p>
          <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
            <p className="text-slate-300 text-sm mb-2">
              <strong className="text-amber-400">How it works:</strong> If you deploy <SolanaLogo width={14} height={14} className="inline" /> 0.1 SOL to each of the 25 squares (<SolanaLogo width={14} height={14} className="inline" /> 2.5 SOL total), you're guaranteed to win the round. Your reward share will be:
            </p>
            <p className="text-slate-200 font-mono text-sm">
              Your Share = (<SolanaLogo width={14} height={14} className="inline" /> 0.1 SOL / Total SOL on Winning Square) × Reward Pool
            </p>
            <p className="text-slate-400 text-xs mt-2">
              This strategy prioritizes consistent <img src="/orelogo.jpg" alt="ORE" className="w-3 h-3 object-contain rounded inline mx-1" /> ORE accumulation over maximizing reward percentage. Perfect for miners who want steady, predictable returns.
            </p>
          </div>
        </div>

        {/* Key Concepts */}
        <div className="bg-[#21252C] border border-slate-700 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold text-slate-100 mb-4 flex items-center gap-2">
            <svg className="w-6 h-6 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            How ORE Mining Works
          </h2>
          <div className="grid md:grid-cols-3 gap-4 text-sm mb-4">
            <div>
              <p className="text-slate-300 font-semibold mb-1">5×5 Grid</p>
              <p className="text-slate-400">25 squares, 1 winner per round determined by on-chain randomness</p>
            </div>
            <div>
              <p className="text-slate-300 font-semibold mb-1">4% Win Chance</p>
              <p className="text-slate-400">Equal probability for each square (1 in 25 chance)</p>
            </div>
            <div>
              <p className="text-slate-300 font-semibold mb-1">Proportional Rewards</p>
              <p className="text-slate-400">Your share = Your <SolanaLogo width={14} height={14} className="inline" /> SOL / Total <SolanaLogo width={14} height={14} className="inline" /> SOL on winning square</p>
            </div>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
            <p className="text-slate-300 text-sm">
              <strong className="text-amber-400">Reward Distribution:</strong> After each round, the winning square is selected randomly. All miners who deployed <SolanaLogo width={14} height={14} className="inline" /> SOL to that square receive rewards proportional to their deployment. The reward pool comes from the treasury (minus 11% protocol fees: 10% protocol + 1% admin). The more <SolanaLogo width={14} height={14} className="inline" /> SOL you deploy relative to others on the winning square, the larger your reward share.
            </p>
          </div>
        </div>

        {/* Strategies Grid */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {/* Strategy 1: Diversification */}
          <div className="bg-[#21252C] border border-slate-700 rounded-lg p-6 hover:border-slate-600 transition-colors">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center">
                <span className="text-amber-400 font-bold text-lg">1</span>
              </div>
              <h3 className="text-xl font-semibold text-slate-100">Diversification</h3>
              <span className="ml-auto px-2 py-1 bg-slate-700 text-slate-300 text-xs font-semibold rounded">LOW RISK</span>
            </div>
            <p className="text-slate-300 mb-4">
              Spread your SOL deployment across multiple squares to reduce risk and increase your probability of winning at least one square. This strategy balances risk and reward by not putting all your SOL in one basket.
            </p>
            <div className="space-y-2 mb-4">
              <div className="flex items-start gap-2 text-sm">
                <span className="text-amber-400 mt-0.5">✓</span>
                <div>
                  <span className="text-slate-300 font-semibold">Higher win probability:</span>
                  <span className="text-slate-400"> Deploying to 5 squares gives you 5 chances to win (20% total probability vs 4% for one square)</span>
                </div>
              </div>
              <div className="flex items-start gap-2 text-sm">
                <span className="text-amber-400 mt-0.5">✓</span>
                <div>
                  <span className="text-slate-300 font-semibold">Reduced risk:</span>
                  <span className="text-slate-400"> If one square loses, you still have chances on other squares</span>
                </div>
              </div>
              <div className="flex items-start gap-2 text-sm">
                <span className="text-amber-400 mt-0.5">✓</span>
                <div>
                  <span className="text-slate-300 font-semibold">More consistent results:</span>
                  <span className="text-slate-400"> Over multiple rounds, diversification provides steadier returns</span>
                </div>
              </div>
              <div className="flex items-start gap-2 text-sm">
                <span className="text-slate-500 mt-0.5">✗</span>
                <div>
                  <span className="text-slate-300 font-semibold">Lower reward per square:</span>
                  <span className="text-slate-400"> Your <SolanaLogo width={14} height={14} className="inline" /> SOL is split, so if you win, your share is smaller</span>
                </div>
              </div>
              <div className="flex items-start gap-2 text-sm">
                <span className="text-slate-500 mt-0.5">✗</span>
                <div>
                  <span className="text-slate-300 font-semibold">Transaction costs:</span>
                  <span className="text-slate-400"> Deploying to many squares means more transactions and fees</span>
                </div>
              </div>
            </div>
            <div className="bg-slate-800/50 rounded p-3 text-sm text-slate-400 mb-3">
              <p className="font-semibold text-slate-300 mb-2">Example Calculation:</p>
              <p className="mb-1">You have <SolanaLogo width={14} height={14} className="inline" /> 1 SOL to deploy:</p>
              <p className="mb-2"><strong className="text-slate-200">Strategy A (Concentrated):</strong> Deploy all <SolanaLogo width={14} height={14} className="inline" /> 1 SOL to Square A1</p>
              <p className="mb-2">- Win probability: 4% (1 in 25)</p>
              <p className="mb-2">- If Square A1 wins: You get (<SolanaLogo width={14} height={14} className="inline" /> 1 SOL / Total <SolanaLogo width={14} height={14} className="inline" /> SOL on A1) × Reward Pool</p>
              <p className="mb-2"><strong className="text-slate-200">Strategy B (Diversified):</strong> Deploy <SolanaLogo width={14} height={14} className="inline" /> 0.2 SOL each to 5 different squares</p>
              <p className="mb-1">- Win probability: ~18.5% (1 - (0.96)^5)</p>
              <p>- If any of your 5 squares wins: You get (<SolanaLogo width={14} height={14} className="inline" /> 0.2 SOL / Total <SolanaLogo width={14} height={14} className="inline" /> SOL on that square) × Reward Pool</p>
            </div>
            <p className="text-xs text-slate-500 italic">Best for: Conservative miners who want to reduce risk while maintaining multiple win opportunities.</p>
          </div>

          {/* Strategy 2: High-Value */}
          <div className="bg-[#21252C] border border-slate-700 rounded-lg p-6 hover:border-slate-600 transition-colors">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center">
                <span className="text-amber-400 font-bold text-lg">2</span>
              </div>
              <h3 className="text-xl font-semibold text-slate-100">High-Value</h3>
              <span className="ml-auto px-2 py-1 bg-slate-700 text-slate-300 text-xs font-semibold rounded">HIGH RISK</span>
            </div>
            <p className="text-slate-300 mb-4">
              Target squares that already have high SOL deployments, assuming they attract more miners and may indicate "popular" or "strategic" positions. This strategy follows the assumption that squares with more activity are more likely to win, or that joining high-competition squares gives you access to larger reward pools.
            </p>
            <div className="space-y-2 mb-4">
              <div className="flex items-start gap-2 text-sm">
                <span className="text-amber-400 mt-0.5">✓</span>
                <div>
                  <span className="text-slate-300 font-semibold">Access to larger reward pools:</span>
                  <span className="text-slate-400"> High-value squares often have more total <SolanaLogo width={14} height={14} className="inline" /> SOL, meaning larger absolute rewards if they win</span>
                </div>
              </div>
              <div className="flex items-start gap-2 text-sm">
                <span className="text-amber-400 mt-0.5">✓</span>
                <div>
                  <span className="text-slate-300 font-semibold">Follow "smart money":</span>
                  <span className="text-slate-400"> Experienced miners may identify patterns or strategic squares</span>
                </div>
              </div>
              <div className="flex items-start gap-2 text-sm">
                <span className="text-amber-400 mt-0.5">✓</span>
                <div>
                  <span className="text-slate-300 font-semibold">Higher absolute rewards:</span>
                  <span className="text-slate-400"> Even with a smaller percentage, the total reward pool may be larger</span>
                </div>
              </div>
              <div className="flex items-start gap-2 text-sm">
                <span className="text-slate-500 mt-0.5">✗</span>
                <div>
                  <span className="text-slate-300 font-semibold">Lower percentage share:</span>
                  <span className="text-slate-400"> More competition means your <SolanaLogo width={14} height={14} className="inline" /> SOL represents a smaller portion of the total</span>
                </div>
              </div>
              <div className="flex items-start gap-2 text-sm">
                <span className="text-slate-500 mt-0.5">✗</span>
                <div>
                  <span className="text-slate-300 font-semibold">No guarantee of winning:</span>
                  <span className="text-slate-400"> High activity doesn't increase win probability (still 4% per square)</span>
                </div>
              </div>
            </div>
            <div className="bg-slate-800/50 rounded p-3 text-sm text-slate-400 mb-3">
              <p className="font-semibold text-slate-300 mb-2">Example Calculation:</p>
              <p className="mb-1">Round statistics: Treasury = <img src="/orelogo.jpg" alt="ORE" className="w-4 h-4 object-contain rounded inline mx-1" /> 100 ORE, Reward Pool = <img src="/orelogo.jpg" alt="ORE" className="w-4 h-4 object-contain rounded inline mx-1" /> 89 ORE (after 11% fees)</p>
              <p className="mb-2"><strong className="text-slate-200">Square A1 (High Value):</strong> <SolanaLogo width={14} height={14} className="inline" /> 5 SOL total, you deploy <SolanaLogo width={14} height={14} className="inline" /> 1 SOL</p>
              <p className="mb-1">- Your share: (<SolanaLogo width={14} height={14} className="inline" /> 1 / <SolanaLogo width={14} height={14} className="inline" /> 5) × <img src="/orelogo.jpg" alt="ORE" className="w-4 h-4 object-contain rounded inline mx-1" /> 89 = <img src="/orelogo.jpg" alt="ORE" className="w-4 h-4 object-contain rounded inline mx-1" /> 17.8 ORE (20% of rewards)</p>
              <p className="mb-2"><strong className="text-slate-200">Square B2 (Low Value):</strong> <SolanaLogo width={14} height={14} className="inline" /> 0.5 SOL total, you deploy <SolanaLogo width={14} height={14} className="inline" /> 1 SOL</p>
              <p className="mb-1">- Your share: (<SolanaLogo width={14} height={14} className="inline" /> 1 / <SolanaLogo width={14} height={14} className="inline" /> 0.5) × <img src="/orelogo.jpg" alt="ORE" className="w-4 h-4 object-contain rounded inline mx-1" /> 89 = <img src="/orelogo.jpg" alt="ORE" className="w-4 h-4 object-contain rounded inline mx-1" /> 178 ORE (200% of rewards)</p>
              <p className="text-xs text-slate-500 mt-2">Analysis: While Square A1 has more total <SolanaLogo width={14} height={14} className="inline" /> SOL, your percentage share is much smaller. High-value strategy assumes Square A1 is more likely to win, but this is not guaranteed.</p>
            </div>
            <p className="text-xs text-slate-500 italic">Best for: Miners who want to follow popular squares and are comfortable with lower reward percentages for potentially larger absolute rewards.</p>
          </div>

          {/* Strategy 3: Low-Competition */}
          <div className="bg-[#21252C] border border-slate-700 rounded-lg p-6 hover:border-slate-600 transition-colors">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center">
                <span className="text-amber-400 font-bold text-lg">3</span>
              </div>
              <h3 className="text-xl font-semibold text-slate-100">Low-Competition</h3>
              <span className="ml-auto px-2 py-1 bg-slate-700 text-slate-300 text-xs font-semibold rounded">HIGH RISK</span>
            </div>
            <p className="text-slate-300 mb-4">
              Target squares with below-average SOL deployments to maximize your reward share percentage if that square wins. This strategy assumes that any square has an equal probability of winning (since selection is random), so you might as well maximize your percentage ownership.
            </p>
            <div className="space-y-2 mb-4">
              <div className="flex items-start gap-2 text-sm">
                <span className="text-amber-400 mt-0.5">✓</span>
                <div>
                  <span className="text-slate-300 font-semibold">Maximum reward share:</span>
                  <span className="text-slate-400"> Your <SolanaLogo width={14} height={14} className="inline" /> SOL represents a much larger percentage of the total on that square</span>
                </div>
              </div>
              <div className="flex items-start gap-2 text-sm">
                <span className="text-amber-400 mt-0.5">✓</span>
                <div>
                  <span className="text-slate-300 font-semibold">Can dominate a square:</span>
                  <span className="text-slate-400"> With relatively small deployment, you can become the majority holder</span>
                </div>
              </div>
              <div className="flex items-start gap-2 text-sm">
                <span className="text-amber-400 mt-0.5">✓</span>
                <div>
                  <span className="text-slate-300 font-semibold">Higher potential rewards:</span>
                  <span className="text-slate-400"> If the square wins, your percentage share can exceed 100% (if you deploy more than current total)</span>
                </div>
              </div>
              <div className="flex items-start gap-2 text-sm">
                <span className="text-slate-500 mt-0.5">✗</span>
                <div>
                  <span className="text-slate-300 font-semibold">Win probability unchanged:</span>
                  <span className="text-slate-400"> Still only 4% chance (1 in 25) - same as any other square</span>
                </div>
              </div>
              <div className="flex items-start gap-2 text-sm">
                <span className="text-slate-500 mt-0.5">✗</span>
                <div>
                  <span className="text-slate-300 font-semibold">High risk of total loss:</span>
                  <span className="text-slate-400"> If the square doesn't win, you lose all deployed <SolanaLogo width={14} height={14} className="inline" /> SOL</span>
                </div>
              </div>
            </div>
            <div className="bg-slate-800/50 rounded p-3 text-sm text-slate-400 mb-3">
              <p className="font-semibold text-slate-300 mb-2">Example Calculation:</p>
              <p className="mb-1">Round statistics: Treasury = <img src="/orelogo.jpg" alt="ORE" className="w-4 h-4 object-contain rounded inline mx-1" /> 100 ORE, Reward Pool = <img src="/orelogo.jpg" alt="ORE" className="w-4 h-4 object-contain rounded inline mx-1" /> 89 ORE</p>
              <p className="mb-2"><strong className="text-slate-200">Square A1 (High Competition):</strong> <SolanaLogo width={14} height={14} className="inline" /> 5 SOL total, you deploy <SolanaLogo width={14} height={14} className="inline" /> 0.5 SOL</p>
              <p className="mb-1">- Your share: (<SolanaLogo width={14} height={14} className="inline" /> 0.5 / <SolanaLogo width={14} height={14} className="inline" /> 5) × <img src="/orelogo.jpg" alt="ORE" className="w-4 h-4 object-contain rounded inline mx-1" /> 89 = <img src="/orelogo.jpg" alt="ORE" className="w-4 h-4 object-contain rounded inline mx-1" /> 8.9 ORE (10% of rewards)</p>
              <p className="mb-2"><strong className="text-slate-200">Square B2 (Low Competition):</strong> <SolanaLogo width={14} height={14} className="inline" /> 0.2 SOL total, you deploy <SolanaLogo width={14} height={14} className="inline" /> 0.5 SOL</p>
              <p className="mb-1">- Your share: (<SolanaLogo width={14} height={14} className="inline" /> 0.5 / <SolanaLogo width={14} height={14} className="inline" /> 0.2) × <img src="/orelogo.jpg" alt="ORE" className="w-4 h-4 object-contain rounded inline mx-1" /> 89 = <img src="/orelogo.jpg" alt="ORE" className="w-4 h-4 object-contain rounded inline mx-1" /> 222.5 ORE (250% of rewards - you're the majority!)</p>
              <p className="text-xs text-slate-500 mt-2">Analysis: Low-competition squares offer much higher reward shares, but the probability of winning is identical (4%). This strategy maximizes potential rewards but doesn't increase win probability.</p>
            </div>
            <p className="text-xs text-slate-500 italic">Best for: Risk-tolerant miners who want to maximize reward percentage and are comfortable with the 4% win probability.</p>
          </div>

          {/* Strategy 4: Average-Following */}
          <div className="bg-[#21252C] border border-slate-700 rounded-lg p-6 hover:border-slate-600 transition-colors">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center">
                <span className="text-amber-400 font-bold text-lg">4</span>
              </div>
              <h3 className="text-xl font-semibold text-slate-100">Average-Following</h3>
              <span className="ml-auto px-2 py-1 bg-slate-700 text-slate-300 text-xs font-semibold rounded">MODERATE</span>
            </div>
            <p className="text-slate-300 mb-4">
              Calculate the average SOL per square for the round and deploy to squares that are near this average. This strategy avoids both extreme competition (high-value squares) and extreme isolation (low-value squares), aiming for a balanced risk-reward profile.
            </p>
            <div className="space-y-2 mb-4">
              <div className="flex items-start gap-2 text-sm">
                <span className="text-amber-400 mt-0.5">✓</span>
                <div>
                  <span className="text-slate-300 font-semibold">Balanced risk-reward:</span>
                  <span className="text-slate-400"> Avoids extremes of too much or too little competition</span>
                </div>
              </div>
              <div className="flex items-start gap-2 text-sm">
                <span className="text-amber-400 mt-0.5">✓</span>
                <div>
                  <span className="text-slate-300 font-semibold">More predictable outcomes:</span>
                  <span className="text-slate-400"> Moderate competition means more consistent reward percentages</span>
                </div>
              </div>
              <div className="flex items-start gap-2 text-sm">
                <span className="text-amber-400 mt-0.5">✓</span>
                <div>
                  <span className="text-slate-300 font-semibold">Reasonable reward share:</span>
                  <span className="text-slate-400"> Typically 20-50% depending on your deployment size</span>
                </div>
              </div>
              <div className="flex items-start gap-2 text-sm">
                <span className="text-slate-500 mt-0.5">✗</span>
                <div>
                  <span className="text-slate-300 font-semibold">May miss opportunities:</span>
                  <span className="text-slate-400"> Low-competition squares might offer better reward shares</span>
                </div>
              </div>
              <div className="flex items-start gap-2 text-sm">
                <span className="text-slate-500 mt-0.5">✗</span>
                <div>
                  <span className="text-slate-300 font-semibold">Requires monitoring:</span>
                  <span className="text-slate-400"> Need to track average throughout the round as it changes</span>
                </div>
              </div>
            </div>
            <div className="bg-slate-800/50 rounded p-3 text-sm text-slate-400 mb-3">
              <p className="font-semibold text-slate-300 mb-2">Example Calculation:</p>
              <p className="mb-1">Round statistics: Total <SolanaLogo width={14} height={14} className="inline" /> SOL deployed = <SolanaLogo width={14} height={14} className="inline" /> 25 SOL across 25 squares</p>
              <p className="mb-2">- Average per square: <SolanaLogo width={14} height={14} className="inline" /> 25 / 25 = <SolanaLogo width={14} height={14} className="inline" /> 1 SOL</p>
              <p className="mb-2">- Target range: <SolanaLogo width={14} height={14} className="inline" /> 0.8-1.2 SOL per square (80-120% of average)</p>
              <p className="mb-1">You identify squares with <SolanaLogo width={14} height={14} className="inline" /> 0.8-1.2 SOL total deployment and distribute your <SolanaLogo width={14} height={14} className="inline" /> SOL there.</p>
              <p className="mb-1">This gives you:</p>
              <p className="mb-1">- Moderate competition (not too high, not too low)</p>
              <p className="mb-1">- Reasonable reward share (typically 20-50% depending on your deployment)</p>
              <p>- Balanced risk-reward profile</p>
            </div>
            <p className="text-xs text-slate-500 italic">Best for: Miners who want a balanced approach without the extremes of high or low competition strategies.</p>
          </div>
        </div>

        {/* Quick Reference Table */}
        <div className="bg-[#21252C] border border-slate-700 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold text-slate-100 mb-4">Strategy Comparison</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-300">Strategy</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-slate-300">Risk</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-slate-300">Reward</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-300">Best For</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                <tr>
                  <td className="py-3 px-4 text-slate-200 font-medium">Diversification</td>
                  <td className="py-3 px-4 text-center">
                    <span className="px-2 py-1 bg-slate-700 text-slate-300 text-xs font-semibold rounded">Low</span>
                  </td>
                  <td className="py-3 px-4 text-center text-slate-300">Moderate</td>
                  <td className="py-3 px-4 text-slate-400 text-sm">Conservative miners</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 text-slate-200 font-medium">High-Value</td>
                  <td className="py-3 px-4 text-center">
                    <span className="px-2 py-1 bg-slate-700 text-slate-300 text-xs font-semibold rounded">High</span>
                  </td>
                  <td className="py-3 px-4 text-center text-slate-300">High (if win)</td>
                  <td className="py-3 px-4 text-slate-400 text-sm">Following smart money</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 text-slate-200 font-medium">Low-Competition</td>
                  <td className="py-3 px-4 text-center">
                    <span className="px-2 py-1 bg-slate-700 text-slate-300 text-xs font-semibold rounded">High</span>
                  </td>
                  <td className="py-3 px-4 text-center text-slate-300">Very High (if win)</td>
                  <td className="py-3 px-4 text-slate-400 text-sm">Risk-tolerant miners</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 text-slate-200 font-medium">Average-Following</td>
                  <td className="py-3 px-4 text-center">
                    <span className="px-2 py-1 bg-slate-700 text-slate-300 text-xs font-semibold rounded">Moderate</span>
                  </td>
                  <td className="py-3 px-4 text-center text-slate-300">Moderate</td>
                  <td className="py-3 px-4 text-slate-400 text-sm">Balanced approach</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Key Takeaways */}
        <div className="bg-[#21252C] border border-slate-700 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-slate-100 mb-4">Key Takeaways</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-amber-400 text-sm">1</span>
              </div>
              <div>
                <p className="text-slate-200 font-semibold mb-1">4% Win Probability</p>
                <p className="text-slate-400 text-sm">Each square has equal chance (1 in 25). Your strategy doesn't change this.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-amber-400 text-sm">2</span>
              </div>
              <div>
                <p className="text-slate-200 font-semibold mb-1">Reward Share Matters</p>
                <p className="text-slate-400 text-sm">Your SOL / Total SOL on winning square = Your reward percentage</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-amber-400 text-sm">3</span>
              </div>
              <div>
                <p className="text-slate-200 font-semibold mb-1">Guaranteed Win Strategy</p>
                <p className="text-slate-400 text-sm">Bid on all 25 squares to guarantee winning every round and accumulate unrefined ORE consistently.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-amber-400 text-sm">4</span>
              </div>
              <div>
                <p className="text-slate-200 font-semibold mb-1">Monitor Statistics</p>
                <p className="text-slate-400 text-sm">Use the dashboard to track SOL per square, averages, and treasury balance.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

