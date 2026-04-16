export default function Hero() {
  return (
    <section className="pt-32 pb-20 text-center flex flex-col items-center">
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-950/50 border border-blue-500/30 text-blue-400 text-sm font-medium mb-8">
        <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
        The Movement is Live
      </div>

      <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6">
        Wear the{" "}
        <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300 glow-text">
          Signal.
        </span>
        <br /> Join MTONGA.
      </h1>

      <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
        One hat. One unstoppable community. Turn your avatar into a premium
        digital identity and become part of the most viral tribe in crypto.
      </p>

      <div className="flex flex-col sm:flex-row gap-4">
        <a
          href="#generator"
          className="px-8 py-4 rounded-full bg-blue-600 hover:bg-blue-500 text-white font-bold transition-all shadow-[0_0_20px_rgba(37,99,235,0.4)] hover:shadow-[0_0_30px_rgba(56,189,248,0.6)]"
        >
          Get Your Hat
        </a>
        <a
          href="#why"
          className="px-8 py-4 rounded-full bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 font-bold transition-all"
        >
          Explore the Cult
        </a>
      </div>
    </section>
  );
}
