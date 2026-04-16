export default function Footer() {
  return (
    <footer className="w-full border-t border-slate-800 bg-slate-950 py-12 relative z-10">
      <div className="max-w-7xl mx-auto px-4 text-center">
        <div className="text-2xl font-black text-white mb-6 tracking-wider">
          MTONGA
        </div>
        <div className="flex justify-center gap-6 mb-8">
          <a
            href="#"
            className="text-slate-500 hover:text-blue-400 transition-colors font-medium"
          >
            X (Twitter)
          </a>
          <a
            href="#"
            className="text-slate-500 hover:text-blue-400 transition-colors font-medium"
          >
            Telegram
          </a>
          <a
            href="#"
            className="text-slate-500 hover:text-blue-400 transition-colors font-medium"
          >
            Chart
          </a>
        </div>
        <p className="text-slate-600 text-sm">
          © {new Date().getFullYear()} MTONGA Movement. All rights reserved. Not
          financial advice. Wear the hat.
        </p>
      </div>
    </footer>
  );
}
