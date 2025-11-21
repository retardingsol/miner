import { useState, useEffect } from 'react';

type AboutSection = 'intro' | 'mining' | 'staking' | 'tokenomics' | 'links';

export function AboutView() {
  const [activeSection, setActiveSection] = useState<AboutSection>('intro');

  // Handle hash-based navigation
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (hash && ['intro', 'mining', 'staking', 'tokenomics', 'links'].includes(hash)) {
      setActiveSection(hash as AboutSection);
    }
  }, []);

  const sections: AboutSection[] = ['intro', 'mining', 'staking', 'tokenomics', 'links'];

  const getNextSection = (): AboutSection | null => {
    const currentIndex = sections.indexOf(activeSection);
    return currentIndex < sections.length - 1 ? sections[currentIndex + 1] : null;
  };

  const getPreviousSection = (): AboutSection | null => {
    const currentIndex = sections.indexOf(activeSection);
    return currentIndex > 0 ? sections[currentIndex - 1] : null;
  };

  const handleSectionChange = (section: AboutSection) => {
    setActiveSection(section);
    window.location.hash = section;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const renderSectionContent = () => {
    switch (activeSection) {
      case 'intro':
        return (
          <div>
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-2">Intro</h1>
            <p className="text-sm text-slate-400 mb-8">Learn about the protocol.</p>
            
            <p className="text-base text-slate-300 leading-relaxed mb-8">
              ORE is a digital store of value on the Solana blockchain.
            </p>

            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6 mt-12">Motivation</h2>
            
            <div className="space-y-4 text-base text-slate-300 leading-relaxed">
              <p>
                Blockchains enable trustless digital currencies that are independent of central banks and governments. 
                These currencies can serve as stores of value, mediums of exchange, and units of account for users worldwide.
              </p>
              
              <p>
                Solana is one of the fastest and most widely used blockchains in the world. Its high throughput and low 
                transaction costs make it an ideal platform for new digital assets and financial applications.
              </p>
              
              <p>
                However, existing digital stores of value are not native to Solana. They rely on risky third-party 
                intermediaries and bridges, creating unnecessary counterparty risk and complexity.
              </p>
              
              <p>
                ORE is designed from the ground up to serve as a Solana-native store of value with maximal freedom and 
                minimal trust assumptions.
              </p>
            </div>
          </div>
        );

      case 'mining':
        return (
          <div>
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-2">Mining</h1>
            <p className="text-sm text-slate-400 mb-8">Learn how to mine.</p>
            
            <p className="text-base text-slate-300 leading-relaxed mb-8">
              Mining is the process by which new ORE tokens are created and distributed to users.
            </p>

            <h2 className="text-3xl md:text-4xl font-bold text-white mb-6 mt-12">How it works</h2>
            
            <p className="text-base text-slate-300 leading-relaxed mb-8">
              Each round, miners have one minute to prospect on blocks in a 5x5 grid. At the end of the round, one winning block is chosen by a secure random number generator on the Solana blockchain. All SOL deployed on losing blocks is split amongst miners in proportion to the size of their claimed space on the winning block. In addition, the protocol will split a +1 ORE reward amongst all winning miners on the winning block. Alternatively, half of the time, one winning miner will be selected by weighted random chance to receive the entire +1 ORE reward.
            </p>

            <h2 className="text-3xl md:text-4xl font-bold text-white mb-6 mt-12">Motherlode</h2>
            
            <p className="text-base text-slate-300 leading-relaxed mb-8">
              Each round, +0.2 ORE is minted and added to the motherlode pool. When the winning block is revealed, there is a 1 in 625 chance that those winning miners will also hit the motherlode. If the motherlode is hit, the pool is split by the winning miners in proportion to the size of their claimed space on the winning block. Alternatively, if the motherlode is not hit, the pool keeps accumulating and will be distributed to winning miners when it is hit in a future round.
            </p>

            <h2 className="text-3xl md:text-4xl font-bold text-white mb-6 mt-12">Refining</h2>
            
            <p className="text-base text-slate-300 leading-relaxed mb-8">
              A "refining fee" of 10% is applied to all ORE mining rewards when claimed. The proceeds from this fee are automatically redistributed to other miners in proportion to their unclaimed ORE mining rewards. Thus, the longer a miner holds onto their mined ORE, the more refined ORE they will receive. The net effect of this process is to redistribute tokens to longer term holders.
            </p>
          </div>
        );

      case 'staking':
        return (
          <div>
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-2">Staking</h1>
            <p className="text-sm text-slate-400 mb-8">Learn how to stake.</p>
            
            <p className="text-base text-slate-300 leading-relaxed mb-8">
              ORE holders can stake their assets to earn yield via protocol revenue sharing.
            </p>

            <h2 className="text-3xl md:text-4xl font-bold text-white mb-6 mt-12">How it works</h2>
            
            <div className="space-y-4 text-base text-slate-300 leading-relaxed">
              <p>
                10% of all SOL mining rewards are automatically collected by the protocol as revenue.
              </p>
              
              <p>
                All of this SOL is used to buyback the ORE token off open market.
              </p>
              
              <p>
                Of the ORE that is purchased in the buyback program, 90% is automatically buried and 10% is distributed to stakers as yield.
              </p>
              
              <p>
                This effectively allows stakers to "double-dip" on protocol revenue, earning from both value appreciation of the buyback and revenue share.
              </p>
            </div>
          </div>
        );

      case 'tokenomics':
        return (
          <div>
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-2">Tokenomics</h1>
            <p className="text-sm text-slate-400 mb-8">Learn about the token.</p>
            
            <p className="text-base text-slate-300 leading-relaxed mb-8">
              ORE tokenomics are optimized for longterm holders.
            </p>

            <h2 className="text-3xl md:text-4xl font-bold text-white mb-6 mt-12">Supply</h2>
            
            <p className="text-base text-slate-300 leading-relaxed mb-8">
              ORE is a fair launch cryptocurrency. It has a capped maximum supply of 5 million tokens and zero insider or team allocations. All minting is programmatically controlled by a smart contract on the Solana blockchain. The protocol mints approximately +1 ORE per minute as part of the standard mining process. New tokens can always be mined as long as the current circulating supply is below the maximum supply limit.
            </p>

            <h2 className="text-3xl md:text-4xl font-bold text-white mb-6 mt-12">Demand</h2>
            
            <p className="text-base text-slate-300 leading-relaxed mb-8">
              10% of all SOL mining rewards are collected by the protocol as revenue. The protocol automatically uses this revenue to buyback the ORE token off open market, reducing circulating supply. These buybacks help offset the cost to holders of mining new tokens. The term "bury" is used here to indicate that burned tokens can be reminted as long as circulating supply is below the maximum supply limit.
            </p>

            <h2 className="text-3xl md:text-4xl font-bold text-white mb-6 mt-12">Fees</h2>
            
            <ul className="space-y-3 text-base text-slate-300 leading-relaxed list-disc list-inside mb-8">
              <li>10% of all SOL mining rewards are collected by the protocol as revenue.</li>
              <li>10% of all ORE purchased through the buyback program is distributed to stakers as yield.</li>
              <li>10% of all ORE mining rewards are redistributed to other miners in proportion to their unclaimed mining rewards.</li>
              <li>1% of all SOL deployed by miners is collected as an admin fee to support development, operations, and maintenance.</li>
              <li>0.00001 SOL is collected by the protocol as a deposit when opening a new miner account in case the account needs to be checkpointed to avoid losing mining rewards.</li>
              <li>0.000005 SOL is collected by the protocol per automated transaction when scheduling the autominer to offset baseline Solana transaction costs.</li>
            </ul>
          </div>
        );

      case 'links':
        return (
          <div>
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-2">Links</h1>
            <p className="text-sm text-slate-400 mb-8">Key links and information.</p>
            
            <div className="space-y-8 text-base text-slate-300 leading-relaxed">
              <div>
                <h2 className="text-2xl font-semibold text-white mb-4">Mint</h2>
                <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700 mb-3">
                  <p className="font-mono text-slate-200 break-all">oreoU2P8bN6jkk3jbaiVxYnG1dCXcYxwhwyK9jSybcp</p>
                </div>
                <p className="text-sm text-slate-400">
                  The mint address uniquely identifies the ORE token on the Solana blockchain.
                </p>
              </div>
              
              <div>
                <h2 className="text-2xl font-semibold text-white mb-4">Treasury</h2>
                <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700 mb-3">
                  <p className="font-mono text-slate-200 break-all">45db2FSR4mcXdSVVZbKbwojU6uYDpMyhpEi7cC8nHaWG</p>
                </div>
                <p className="text-sm text-slate-400">
                  The protocol treasury is a smart contract account which has the sole authority to mint new ORE tokens. It additionally manages all refined ORE, unrefined ORE, and ORE staking yield held by the protocol.
                </p>
              </div>
              
              <div>
                <h2 className="text-2xl font-semibold text-white mb-4">Connect</h2>
                <ul className="space-y-2">
                  <li>
                    <a href="/" className="text-amber-400 hover:text-amber-300 underline">
                      Home
                    </a>
                  </li>
                  <li>
                    <a
                      href="https://discord.com/invite/4TQfshAAsT"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-amber-400 hover:text-amber-300 underline"
                    >
                      Discord
                    </a>
                  </li>
                  <li>
                    <a href="https://jup.ag/swap/SOL-ORE" target="_blank" rel="noopener noreferrer" className="text-amber-400 hover:text-amber-300 underline">
                      Jupiter
                    </a>
                  </li>
                  <li>
                    <a href="https://birdeye.so/solana/token/oreoU2P8bN6jkk3jbaiVxYnG1dCXcYxwhwyK9jSybcp" target="_blank" rel="noopener noreferrer" className="text-amber-400 hover:text-amber-300 underline">
                      Birdeye
                    </a>
                  </li>
                  <li>
                    <a
                      href="https://x.com/oredotmonster"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-amber-400 hover:text-amber-300 underline"
                    >
                      X
                    </a>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const nextSection = getNextSection();
  const previousSection = getPreviousSection();

  return (
    <div className="min-h-screen bg-black">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-12">
          {/* Main Content */}
          <div className="lg:col-span-3">
            <div className="max-w-3xl">
              {renderSectionContent()}
              
              {/* Navigation */}
              <div className="flex items-center justify-between mt-16 pt-8 border-t border-slate-700">
                {previousSection ? (
                  <button
                    onClick={() => handleSectionChange(previousSection)}
                    className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors group"
                  >
                    <svg className="w-5 h-5 transform group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    <div className="flex flex-col">
                      <span className="text-xs text-slate-500">Previous</span>
                      <span className="text-base font-medium capitalize">{previousSection}</span>
                    </div>
                  </button>
                ) : (
                  <div></div>
                )}
                
                {nextSection ? (
                  <button
                    onClick={() => handleSectionChange(nextSection)}
                    className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors group ml-auto"
                  >
                    <div className="flex flex-col items-end">
                      <span className="text-xs text-slate-500">Next</span>
                      <span className="text-base font-medium capitalize">{nextSection}</span>
                    </div>
                    <svg className="w-5 h-5 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          {/* Sidebar Navigation */}
          <div className="lg:col-span-1">
            <div className="sticky top-24">
              <nav className="relative">
                {/* Vertical Line */}
                <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-slate-700"></div>
                
                <ul className="space-y-1">
                  {sections.map((section) => (
                    <li key={section}>
                      <button
                        onClick={() => handleSectionChange(section)}
                        className={`relative w-full text-left pl-6 py-2 transition-colors ${
                          activeSection === section
                            ? 'text-white font-semibold'
                            : 'text-slate-400 hover:text-slate-300'
                        }`}
                      >
                        {/* Active Indicator */}
                        {activeSection === section && (
                          <div className="absolute left-0 top-1/2 transform -translate-y-1/2 -translate-x-1/2 w-2 h-2 bg-white rounded-full"></div>
                        )}
                        <span className="capitalize">{section === 'intro' ? 'Intro' : section === 'tokenomics' ? 'Tokenomics' : section.charAt(0).toUpperCase() + section.slice(1)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </nav>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
