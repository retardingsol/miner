import { useState } from 'react';
import { SolanaLogo } from './SolanaLogo';

const TOTAL_SQUARES = 25; // ORE mining grid is 5x5 (25 blocks)

export function WhatIsOreView() {
  const [winChance, setWinChance] = useState(48); // Percentage (4-96% for 1-24 blocks)
  const [betAmount, setBetAmount] = useState(0.1); // SOL amount
  const [musicEnabled, setMusicEnabled] = useState(false);

  // Calculate number of blocks from win chance
  const numBlocks = Math.round((winChance / 100) * TOTAL_SQUARES);
  
  // Calculate bet per block
  const betPerBlock = betAmount / numBlocks;
  
  // Risk level based on win chance (adjusted for 25 blocks)
  const getRiskLevel = (chance: number) => {
    if (chance >= 60) return { level: 'Low', color: 'text-green-400', bg: 'bg-green-500/20' };
    if (chance >= 40) return { level: 'Medium', color: 'text-yellow-400', bg: 'bg-yellow-500/20' };
    return { level: 'High', color: 'text-red-400', bg: 'bg-red-500/20' };
  };

  const risk = getRiskLevel(winChance);

  // Quick bet amounts
  const quickBets = [0.01, 0.1, 0.5, 1.0];

  // Handle slider change
  const handleWinChanceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setWinChance(parseFloat(e.target.value));
  };

  // Handle bet amount change
  const handleBetAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value) || 0;
    setBetAmount(Math.max(0.001, Math.min(100, value))); // Clamp between 0.001 and 100 SOL
  };

  // Increment/decrement bet
  const adjustBet = (delta: number) => {
    setBetAmount(prev => Math.max(0.001, Math.min(100, prev + delta)));
  };

  // Generate bar chart data for win chance visualization
  const generateBarChart = () => {
    const bars = [];
    const barCount = 20;
    const maxHeight = 60;
    
    // Create a bell curve-like distribution centered around the win chance
    for (let i = 0; i < barCount; i++) {
      const position = (i / barCount) * 100;
      const distanceFromCenter = Math.abs(position - winChance);
      const height = Math.max(5, maxHeight - (distanceFromCenter * 0.8));
      bars.push({ height, isWin: position <= winChance });
    }
    
    return bars;
  };

  const bars = generateBarChart();

  // 8-bit music toggle - placeholder for future implementation
  // In a real implementation, you'd want to use actual 8-bit music files
  // For example: const audio = new Audio('/8bit-music.mp3');
  // audio.loop = true;
  // audio.play();

  return (
    <div className="min-h-screen bg-black py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-5xl font-bold text-slate-100 mb-4 flex items-center justify-center gap-3">
            <img src="/orelogo.jpg" alt="ORE" className="w-12 h-12 rounded" />
            What is ORE?
          </h1>
          <p className="text-slate-400 text-lg">
            Learn how to mine ORE with our beginner-friendly interface
          </p>
        </div>

        {/* Music Toggle */}
        <div className="mb-6 flex justify-end">
          <button
            onClick={() => setMusicEnabled(!musicEnabled)}
            className={`px-4 py-2 rounded-lg border transition-colors ${
              musicEnabled
                ? 'bg-amber-500/20 border-amber-500/50 text-amber-400'
                : 'bg-slate-800 border-slate-600 text-slate-400 hover:border-slate-500'
            }`}
          >
            {musicEnabled ? '🔊 8-bit Music ON' : '🔇 8-bit Music OFF'}
          </button>
        </div>

        {/* Main Interactive Section */}
        <div className="bg-[#21252C] border border-slate-700 rounded-lg p-8 mb-6">
          {/* Win Chance Section */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-semibold text-slate-200">Win Chance</h2>
              <div className={`px-4 py-2 rounded-lg ${risk.bg} ${risk.color} font-semibold`}>
                {risk.level} Risk
              </div>
            </div>
            
            {/* Large Percentage Display */}
            <div className="text-center mb-6">
              <div className="text-7xl font-bold text-white mb-2">{winChance}%</div>
              <p className="text-slate-400">You'll win if the winning block is one of your {numBlocks} selected blocks out of 25</p>
            </div>

            {/* Bar Chart Visualization */}
            <div className="mb-6">
              <div className="flex items-end justify-center gap-1 h-20">
                {bars.map((bar, index) => (
                  <div
                    key={index}
                    className={`flex-1 rounded-t transition-all duration-300 ${
                      bar.isWin ? 'bg-green-500' : 'bg-blue-500'
                    }`}
                    style={{ height: `${bar.height}%` }}
                  />
                ))}
              </div>
            </div>

            {/* Slider */}
            <div className="relative">
              <input
                type="range"
                min="4"
                max="96"
                value={winChance}
                onChange={handleWinChanceChange}
                className="w-full h-3 bg-slate-700 rounded-lg appearance-none cursor-pointer slider"
                style={{
                  background: `linear-gradient(to right, #10b981 0%, #10b981 ${winChance}%, #3b82f6 ${winChance}%, #3b82f6 100%)`
                }}
              />
              <div className="flex justify-between mt-2 text-xs text-slate-400">
                <span>4% (1 block)</span>
                <span>52% (13 blocks)</span>
                <span>96% (24 blocks)</span>
              </div>
            </div>
          </div>

          {/* Amount Section */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-semibold text-slate-200">Bet Amount</h2>
              <div className="text-slate-400 text-sm">
                Max Bet: <span className="text-white font-semibold">100 SOL</span>
              </div>
            </div>

            <div className="flex items-center gap-3 mb-4">
              <button
                onClick={() => adjustBet(-0.01)}
                className="w-12 h-12 rounded-full bg-slate-700 hover:bg-slate-600 text-white font-bold text-xl transition-colors flex items-center justify-center"
              >
                −
              </button>
              
              <div className="flex-1 relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2">
                  <SolanaLogo width={20} />
                </div>
                <input
                  type="number"
                  value={betAmount.toFixed(3)}
                  onChange={handleBetAmountChange}
                  step="0.001"
                  min="0.001"
                  max="100"
                  className="w-full pl-12 pr-4 py-4 bg-slate-800 border border-slate-600 rounded-lg text-white text-xl font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
              
              <button
                onClick={() => adjustBet(0.01)}
                className="w-12 h-12 rounded-full bg-slate-700 hover:bg-slate-600 text-white font-bold text-xl transition-colors flex items-center justify-center"
              >
                +
              </button>
            </div>

            {/* Quick Bet Buttons */}
            <div className="flex gap-3">
              {quickBets.map((amount) => (
                <button
                  key={amount}
                  onClick={() => setBetAmount(amount)}
                  className={`px-6 py-3 rounded-lg font-semibold transition-all ${
                    Math.abs(betAmount - amount) < 0.001
                      ? 'bg-green-500 text-white scale-105'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  <SolanaLogo width={16} className="inline mr-1" />
                  {amount}
                </button>
              ))}
            </div>
          </div>

          {/* Bet Summary */}
          <div className="bg-slate-800/50 border border-slate-600 rounded-lg p-6 mb-6">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Chance to Win</span>
                <span className="text-white font-semibold text-lg">{winChance}%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Number of Blocks (out of 25)</span>
                <span className="text-white font-semibold text-lg">{numBlocks} blocks</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Bet per Block</span>
                <span className="text-white font-semibold text-lg">
                  <SolanaLogo width={16} className="inline mr-1" />
                  {betPerBlock.toFixed(4)} SOL
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Your Total Bet</span>
                <span className="text-white font-semibold text-lg">
                  <SolanaLogo width={16} className="inline mr-1" />
                  {betAmount.toFixed(3)} SOL
                </span>
              </div>
              <div className="flex justify-between items-center pt-4 border-t border-slate-600">
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">Potential ORE Reward</span>
                  <div className="w-4 h-4 rounded-full bg-blue-500/20 border border-blue-500/50 flex items-center justify-center cursor-help" title="+1 ORE is split among all winning miners. Half the time, one random winner gets all +1 ORE. Actual payout depends on your share of the winning block.">
                    <span className="text-blue-400 text-xs">i</span>
                  </div>
                </div>
                <span className="text-green-400 font-bold text-xl flex items-center gap-1">
                  +1 <img src="/orelogo.jpg" alt="ORE" className="w-5 h-5 object-contain rounded" /> ORE
                </span>
              </div>
            </div>
          </div>

          {/* Explanation Text */}
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 mb-6">
            <p className="text-amber-200 text-sm">
              <strong>Betting {betAmount.toFixed(3)} SOL at {winChance}%</strong> means you're selecting {numBlocks} blocks out of 25 in the 5x5 grid. 
              If the winning block is one of your selections, you win! You'll receive a share of the SOL from losing blocks proportional to your claimed space, 
              plus a chance to earn +1 ORE reward (split among winners or 50% chance one winner gets all).
            </p>
          </div>

          {/* Place Bet Button (Demo - not functional) */}
          <button
            disabled
            className="w-full py-4 bg-green-500 hover:bg-green-600 disabled:bg-green-500/50 disabled:cursor-not-allowed text-white font-bold text-xl rounded-lg transition-colors"
          >
            PLACE BET (Demo Mode)
          </button>
        </div>

        {/* Educational Sections */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* How It Works */}
          <div className="bg-[#21252C] border border-slate-700 rounded-lg p-6">
            <h3 className="text-xl font-semibold text-slate-200 mb-4 flex items-center gap-2">
              <span className="text-2xl">🎯</span>
              How It Works
            </h3>
            <ul className="space-y-3 text-slate-300">
              <li className="flex items-start gap-2">
                <span className="text-green-400 mt-1">✓</span>
                <span>Select your win chance (4-96%) using the slider - this is your % chance to win</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-400 mt-1">✓</span>
                <span>Choose your bet amount in SOL - distributed across your selected blocks</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-400 mt-1">✓</span>
                <span>Your bet is placed on {numBlocks} blocks out of 25 in the 5x5 grid</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-400 mt-1">✓</span>
                <span>If the winning block is in your selection, you win SOL from losers + chance for +1 ORE!</span>
              </li>
            </ul>
          </div>

          {/* What is a Win */}
          <div className="bg-[#21252C] border border-slate-700 rounded-lg p-6">
            <h3 className="text-xl font-semibold text-slate-200 mb-4 flex items-center gap-2">
              <span className="text-2xl">🏆</span>
              What is a Win?
            </h3>
            <p className="text-slate-300 mb-3">
              Each round lasts one minute. At the end, one block is randomly chosen as the winner. If that block is one you bet on, you're a winner!
            </p>
            <p className="text-slate-300 mb-3">
              <strong className="text-white">As a winner, you receive:</strong>
            </p>
            <ul className="text-slate-300 space-y-2 ml-4">
              <li className="flex items-start gap-2">
                <span className="text-green-400">•</span>
                <span>A share of SOL from losing blocks proportional to your claimed space on the winning block</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-400">•</span>
                <span>+1 ORE reward - either split among all winners OR 50% chance one random winner gets all</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-400">•</span>
                <span>1 in 625 chance to hit the Motherlode and split the accumulated pool! 🎰</span>
              </li>
            </ul>
          </div>

          {/* Risk Guide */}
          <div className="bg-[#21252C] border border-slate-700 rounded-lg p-6">
            <h3 className="text-xl font-semibold text-slate-200 mb-4 flex items-center gap-2">
              <span className="text-2xl">⚖️</span>
              Understanding Risk
            </h3>
            <div className="space-y-3">
              <div className="p-3 bg-green-500/10 border border-green-500/30 rounded">
                <div className="font-semibold text-green-400 mb-1">Low Risk (60%+)</div>
                <div className="text-sm text-slate-300">15+ blocks selected. Higher chance to win, but smaller share of rewards per block</div>
              </div>
              <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded">
                <div className="font-semibold text-yellow-400 mb-1">Medium Risk (40-60%)</div>
                <div className="text-sm text-slate-300">10-15 blocks. Balanced approach - recommended for beginners</div>
              </div>
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded">
                <div className="font-semibold text-red-400 mb-1">High Risk (&lt;40%)</div>
                <div className="text-sm text-slate-300">Less than 10 blocks. Lower chance to win, but higher potential payout if you do</div>
              </div>
            </div>
          </div>

          {/* Tips for Beginners */}
          <div className="bg-[#21252C] border border-slate-700 rounded-lg p-6">
            <h3 className="text-xl font-semibold text-slate-200 mb-4 flex items-center gap-2">
              <span className="text-2xl">💡</span>
              Tips for Beginners
            </h3>
            <ul className="space-y-3 text-slate-300">
              <li className="flex items-start gap-2">
                <span className="text-amber-400 mt-1">→</span>
                <span><strong className="text-white">Start with 40-60% win chance (10-15 blocks)</strong> - Good balance for beginners</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-400 mt-1">→</span>
                <span><strong className="text-white">Don't bet all your SOL on 1 block (4% chance)</strong> - Very risky for beginners!</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-400 mt-1">→</span>
                <span><strong className="text-white">Start small</strong> - Try 0.01-0.1 SOL to learn the game mechanics</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-400 mt-1">→</span>
                <span><strong className="text-white">More blocks = higher win chance</strong> but your bet is split across more blocks, reducing your share of rewards</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-400 mt-1">→</span>
                <span><strong className="text-white">Remember:</strong> 10% refining fee when claiming ORE rewards - longer holds get more rewards!</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <style>{`
        input[type="range"].slider::-webkit-slider-thumb {
          appearance: none;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: white;
          cursor: pointer;
          border: 2px solid #3b82f6;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
        }
        
        input[type="range"].slider::-moz-range-thumb {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: white;
          cursor: pointer;
          border: 2px solid #3b82f6;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
        }
      `}</style>
    </div>
  );
}

