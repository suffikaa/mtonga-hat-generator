const steps = [
  {
    num: "01",
    title: "Upload",
    desc: "Drop your favorite PFP or photo. High contrast works best.",
  },
  {
    num: "02",
    title: "Auto Place",
    desc: "Our tech detects your frame and perfectly positions the blue hat.",
  },
  {
    num: "03",
    title: "Join the Tribe",
    desc: "Export your new identity and wear it across X and Telegram.",
  },
];

export default function HowItWorks() {
  return (
    <section className="py-24 relative">
      <div className="text-center mb-16">
        <h2 className="text-3xl font-bold mb-4">How It Works</h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {steps.map((step, idx) => (
          <div
            key={idx}
            className="bg-slate-900/30 border border-slate-800 rounded-2xl p-8 hover:border-blue-500/30 transition-colors"
          >
            <div className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-b from-blue-400 to-slate-800 mb-4">
              {step.num}
            </div>
            <h3 className="text-xl font-bold mb-2">{step.title}</h3>
            <p className="text-slate-400">{step.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
