const features = [
  "Premium Crypto Aesthetic",
  "Unstoppable Viral Energy",
  "One Unified Visual Culture",
];

export default function WhyMtonga() {
  return (
    <section id="why" className="py-24 border-t border-slate-800/50">
      <div className="flex flex-col md:flex-row items-center gap-16">
        <div className="flex-1">
          <h2 className="text-4xl font-bold mb-6">
            More than a meme.
            <br />A digital identity.
          </h2>
          <p className="text-slate-400 text-lg mb-6 leading-relaxed">
            The blue hat isn&apos;t just an accessory. It&apos;s a signal. When
            you wear MTONGA, you&apos;re recognized instantly by a community
            built on hype, loyalty, and premium execution.
          </p>
          <ul className="space-y-4">
            {features.map((item, i) => (
              <li
                key={i}
                className="flex items-center gap-3 text-slate-300 font-medium"
              >
                <div className="w-6 h-6 rounded-full bg-blue-900/50 flex items-center justify-center border border-blue-500/30">
                  <div className="w-2 h-2 rounded-full bg-blue-400" />
                </div>
                {item}
              </li>
            ))}
          </ul>
        </div>
        <div className="flex-1 relative">
          <div className="w-full aspect-square max-w-md mx-auto bg-gradient-to-tr from-blue-600/20 to-cyan-400/5 rounded-[2rem] border border-slate-800 flex items-center justify-center glow-box">
            <div className="text-8xl font-black text-slate-800/50 rotate-[-10deg]">
              MTONGA
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
