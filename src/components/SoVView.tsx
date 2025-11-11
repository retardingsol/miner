import { useState } from 'react';
import { SolanaLogo } from './SolanaLogo';

export function SoVView() {
  const [expandedFaqs, setExpandedFaqs] = useState<Set<number>>(new Set());

  const toggleFaq = (index: number) => {
    setExpandedFaqs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  return (
    <div className="min-h-screen bg-black py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-100 mb-2">Store of Value</h1>
        </div>

        {/* Intro Section */}
        <div className="bg-[#21252C] border border-slate-700 rounded-lg p-6 mb-8">
          <h2 className="text-2xl font-semibold text-slate-100 mb-4 flex items-center gap-3">
            <img 
              src="/orelogo.jpg" 
              alt="ORE" 
              className="w-8 h-8 object-contain rounded"
            />
            What is ORE?
          </h2>
          <p className="text-slate-300 text-lg mb-4">
            <strong className="text-amber-400">ORE is a digital store of value on the Solana blockchain.</strong> Think of it like digital gold that lives entirely on Solana - no bridges, no wrapping, no middlemen. Just pure, native Solana money that you can save and use.
          </p>
          <p className="text-slate-300">
            Unlike other cryptocurrencies that need to be "wrapped" or "bridged" from other blockchains (which adds risk), ORE was built from the ground up to be Solana's own store of value. This means it works perfectly with all Solana apps, exchanges, and DeFi platforms without any extra steps or risks.
          </p>
        </div>

        {/* Why ORE is Special */}
        <div className="mb-8">
          <h2 className="text-2xl font-semibold text-slate-100 mb-6">Why ORE is Special</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-[#21252C] border border-slate-700 rounded-lg p-6">
              <div className="flex items-center gap-3 mb-4">
                <SolanaLogo width={32} height={32} />
                <h3 className="text-xl font-semibold text-slate-100">100% Solana Native</h3>
              </div>
              <p className="text-slate-300">
                ORE lives entirely on Solana. No bridges, no wrapping, no risky third-party services. This means it's faster, cheaper, and safer than wrapped tokens from other blockchains.
              </p>
            </div>

            <div className="bg-[#21252C] border border-slate-700 rounded-lg p-6">
              <div className="flex items-center gap-3 mb-4">
                <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h3 className="text-xl font-semibold text-slate-100">Fair Launch</h3>
              </div>
              <p className="text-slate-300">
                No team allocations, no insider tokens, no pre-mine. Everyone starts equal. All 5 million ORE tokens are distributed fairly through mining - first come, first served.
              </p>
            </div>

            <div className="bg-[#21252C] border border-slate-700 rounded-lg p-6">
              <div className="flex items-center gap-3 mb-4">
                <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <h3 className="text-xl font-semibold text-slate-100">Capped Supply</h3>
              </div>
              <p className="text-slate-300">
                Only 5 million ORE will ever exist. Once that cap is reached, no more ORE can be created. This scarcity helps maintain value over time, just like gold.
              </p>
            </div>

            <div className="bg-[#21252C] border border-slate-700 rounded-lg p-6">
              <div className="flex items-center gap-3 mb-4">
                <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
                <h3 className="text-xl font-semibold text-slate-100">Automatic Buybacks</h3>
              </div>
              <p className="text-slate-300">
                The protocol automatically buys back ORE from the market using mining fees. This creates constant demand and helps the price stay stable or grow over time.
              </p>
            </div>
          </div>
        </div>

        {/* How It Works - Simple Explanation */}
        <div className="bg-[#21252C] border border-slate-700 rounded-lg p-6 mb-8">
          <h2 className="text-2xl font-semibold text-slate-100 mb-6">How ORE Works (Simple Version)</h2>
          
          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0">
                <span className="text-amber-400 font-bold text-lg">1</span>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-200 mb-2">
                  Mining Creates New ORE
                </h3>
                <p className="text-slate-300">
                  Every minute, about 1 new ORE token is created through mining. People use <SolanaLogo width={16} height={16} className="inline" /> SOL (Solana's main currency) to mine and earn ORE. This continues until we reach 5 million total ORE tokens.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0">
                <span className="text-amber-400 font-bold text-lg">2</span>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-200 mb-2 flex items-center gap-2">
                  <SolanaLogo width={20} height={20} />
                  Fees Create Buybacks
                </h3>
                <p className="text-slate-300">
                  When people mine, 10% of their SOL rewards go to the protocol. This money is automatically used to buy ORE tokens from the market, which are then "buried" (removed from circulation). This creates constant demand and helps the price.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0">
                <span className="text-amber-400 font-bold text-lg">3</span>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-200 mb-2">
                  Stakers Get Rewards
                </h3>
                <p className="text-slate-300">
                  People who "stake" (lock up) their ORE tokens earn rewards. 10% of all ORE bought back by the protocol goes to stakers as yield. This encourages people to hold ORE long-term.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0">
                <span className="text-amber-400 font-bold text-lg">4</span>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-200 mb-2">
                  Supply Stays Limited
                </h3>
                <p className="text-slate-300">
                  With only 5 million ORE ever existing, and buybacks removing tokens from circulation, the available supply gets smaller over time. This scarcity helps maintain and grow value.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Key Numbers */}
        <div className="bg-[#21252C] border border-slate-700 rounded-lg p-6 mb-8">
          <h2 className="text-2xl font-semibold text-slate-100 mb-6">Key Numbers</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <img 
                  src="/orelogo.jpg" 
                  alt="ORE" 
                  className="w-8 h-8 object-contain rounded"
                />
                <div className="text-4xl font-bold text-amber-400">5 Million</div>
              </div>
              <p className="text-slate-300">Maximum ORE tokens that will ever exist</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <img 
                  src="/orelogo.jpg" 
                  alt="ORE" 
                  className="w-8 h-8 object-contain rounded"
                />
                <div className="text-4xl font-bold text-amber-400">~1/min</div>
              </div>
              <p className="text-slate-300">New ORE created through mining</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <SolanaLogo width={32} height={32} />
                <div className="text-4xl font-bold text-amber-400">10%</div>
              </div>
              <p className="text-slate-300">Of SOL mining rewards used for buybacks</p>
            </div>
          </div>
        </div>

        {/* Why Store of Value */}
        <div className="bg-[#21252C] border border-slate-700 rounded-lg p-6 mb-8">
          <h2 className="text-2xl font-semibold text-slate-100 mb-4 flex items-center gap-3">
            <img 
              src="/orelogo.jpg" 
              alt="ORE" 
              className="w-8 h-8 object-contain rounded"
            />
            Why ORE is a Great Store of Value
          </h2>
          <div className="space-y-4 text-slate-300">
            <div className="flex items-start gap-3">
              <span className="text-amber-400 font-bold mt-1">1.</span>
              <div>
                <strong className="text-amber-400">Scarcity:</strong> Only 5 million tokens will ever exist. As more people want ORE and the supply stays limited, the value tends to increase.
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-amber-400 font-bold mt-1">2.</span>
              <div>
                <strong className="text-amber-400">Automatic Demand:</strong> The buyback system creates constant demand. Every time someone mines, money flows back into buying ORE, supporting the price.
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-amber-400 font-bold mt-1">3.</span>
              <div>
                <strong className="text-amber-400">No Dependencies:</strong> Unlike wrapped tokens that depend on bridges or custodians (which can be hacked or shut down), ORE is 100% Solana-native and self-contained.
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-amber-400 font-bold mt-1">4.</span>
              <div>
                <strong className="text-amber-400">Fair Distribution:</strong> No insiders, no team tokens, no unfair advantages. Everyone has an equal chance to get ORE through mining.
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-amber-400 font-bold mt-1">5.</span>
              <div>
                <strong className="text-amber-400">Works Everywhere:</strong> Since ORE is native to Solana, it works with all Solana apps, exchanges, and DeFi platforms without any extra steps or risks.
              </div>
            </div>
          </div>
        </div>

        {/* ORE vs Others */}
        <div className="bg-[#21252C] border border-slate-700 rounded-lg p-6 mb-8">
          <h2 className="text-2xl font-semibold text-slate-100 mb-6">ORE vs Other Stores of Value</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-300">Feature</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-slate-300">ORE</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-slate-300">Wrapped Tokens (wBTC, wETH)</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-slate-300">Bitcoin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                <tr>
                  <td className="py-3 px-4 text-slate-200 font-medium">Native to Solana</td>
                  <td className="py-3 px-4 text-center">
                    <span className="text-green-400 text-xl">✓</span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className="text-red-400 text-xl">✗</span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className="text-red-400 text-xl">✗</span>
                  </td>
                </tr>
                <tr>
                  <td className="py-3 px-4 text-slate-200 font-medium">No Bridge Risk</td>
                  <td className="py-3 px-4 text-center">
                    <span className="text-green-400 text-xl">✓</span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className="text-red-400 text-xl">✗</span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className="text-red-400 text-xl">✗</span>
                  </td>
                </tr>
                <tr>
                  <td className="py-3 px-4 text-slate-200 font-medium">Automatic Buybacks</td>
                  <td className="py-3 px-4 text-center">
                    <span className="text-green-400 text-xl">✓</span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className="text-red-400 text-xl">✗</span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className="text-red-400 text-xl">✗</span>
                  </td>
                </tr>
                <tr>
                  <td className="py-3 px-4 text-slate-200 font-medium">Fast & Cheap Transactions</td>
                  <td className="py-3 px-4 text-center">
                    <span className="text-green-400 text-xl">✓</span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className="text-yellow-400 text-xl">~</span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className="text-red-400 text-xl">✗</span>
                  </td>
                </tr>
                <tr>
                  <td className="py-3 px-4 text-slate-200 font-medium">Fair Launch (No Pre-mine)</td>
                  <td className="py-3 px-4 text-center">
                    <span className="text-green-400 text-xl">✓</span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className="text-slate-400 text-xl">N/A</span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className="text-green-400 text-xl">✓</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* FAQs */}
        <div className="bg-[#21252C] border border-slate-700 rounded-lg p-6 mb-8">
          <h2 className="text-2xl font-semibold text-slate-100 mb-6">Frequently Asked Questions</h2>
          <div className="space-y-4">
            {[
              {
                question: "What is ORE?",
                answer: "ORE is a Solana-native cryptocurrency designed as a digital store of value. Think of it like digital gold that lives entirely on Solana. It operates through smart contracts (computer programs that run automatically) and provides a decentralized, transparent alternative to wrapped tokens from other blockchains."
              },
              {
                question: "How is ORE mined?",
                answer: "Approximately 1 ORE is created (minted) every minute through on-chain mining. People use SOL (Solana's currency) to participate in mining rounds and earn ORE. This continues as long as the total supply stays below 5 million tokens."
              },
              {
                question: "What is the maximum supply of ORE?",
                answer: "The total supply of ORE is capped at 5 million tokens. Once this limit is reached, no more ORE can be created. This hard cap ensures long-term scarcity and helps maintain value over time."
              },
              {
                question: "How does ORE maintain demand?",
                answer: "The protocol automatically collects 10% of all SOL mining rewards. This money is used to buy back ORE tokens from the open market, which are then removed from circulation. This creates constant demand and helps support the token's value, even as new ORE is being mined."
              },
              {
                question: "Does ORE have any team or insider allocations?",
                answer: "No! ORE was launched fairly with zero insider tokens, zero team allocations, and zero investor distributions. All tokens are distributed transparently through the mining process - everyone has an equal chance to earn ORE."
              },
              {
                question: "Why is ORE better than wrapped tokens?",
                answer: "Wrapped tokens (like wBTC or wETH) require bridges and custodians to work on Solana. These can be hacked, shut down, or controlled by third parties. ORE is 100% native to Solana, meaning it works directly with all Solana apps without any middlemen or extra risks."
              },
              {
                question: "How do buybacks work?",
                answer: "When people mine ORE, 10% of their SOL rewards go to the protocol. This money is automatically used to buy ORE from exchanges and markets. The bought ORE is then \"buried\" (removed from circulation), reducing the available supply and creating upward pressure on price."
              },
              {
                question: "Can I stake ORE?",
                answer: "Yes! When you stake (lock up) your ORE tokens, you earn rewards. 10% of all ORE bought back by the protocol is distributed to stakers as yield. This encourages long-term holding and helps stabilize the token."
              }
            ].map((faq, index) => {
              const isExpanded = expandedFaqs.has(index);
              return (
                <div
                  key={index}
                  className="border border-slate-700 rounded-lg overflow-hidden hover:border-slate-600 transition-colors"
                >
                  <button
                    onClick={() => toggleFaq(index)}
                    className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-slate-800/50 transition-colors"
                  >
                    <h3 className="text-lg font-semibold text-amber-400 pr-4">{faq.question}</h3>
                    <svg
                      className={`w-5 h-5 text-amber-400 flex-shrink-0 transition-transform ${
                        isExpanded ? 'rotate-180' : ''
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {isExpanded && (
                    <div className="px-4 pb-3 pt-0">
                      <p className="text-slate-300 leading-relaxed">{faq.answer}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Conclusion */}
        <div className="bg-[#21252C] border border-slate-700 rounded-lg p-6">
          <h2 className="text-2xl font-semibold text-slate-100 mb-4 flex items-center gap-3">
            <img 
              src="/orelogo.jpg" 
              alt="ORE" 
              className="w-8 h-8 object-contain rounded"
            />
            The Bottom Line
          </h2>
          <p className="text-slate-300 text-lg mb-4">
            ORE represents the next evolution of digital stores of value - one that is native to Solana, fair in distribution, and designed to last.
          </p>
          <p className="text-slate-300">
            With a capped supply of 5 million tokens, automatic buybacks, and fully transparent smart contract operations, ORE provides Solana users with a reliable and trustless alternative to wrapped assets. As Solana's ecosystem grows, ORE stands out as a foundational Solana-native asset built for the long term.
          </p>
        </div>
      </div>
    </div>
  );
}

