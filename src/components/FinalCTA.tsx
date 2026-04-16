export default function FinalCTA() {
  return (
    <section className="py-32 text-center">
      <div className="max-w-3xl mx-auto bg-blue-900/20 border border-blue-500/20 rounded-3xl p-12 backdrop-blur-sm relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-blue-500/10 to-transparent" />
        <div className="relative z-10">
          <h2 className="text-4xl font-bold mb-6">Ready to wear the hat?</h2>
          <p className="text-xl text-slate-300 mb-8">
            Join thousands of others making MTONGA the most recognizable symbol
            in Web3.
          </p>
          <a
            href="#generator"
            className="inline-block px-10 py-4 rounded-full bg-blue-600 hover:bg-blue-500 text-white font-bold transition-all shadow-lg shadow-blue-500/25"
          >
            Generate PFP Now
          </a>
        </div>
      </div>
    </section>
  );
}
