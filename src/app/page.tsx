import Hero from "@/components/Hero";
import UploadTool from "@/components/UploadTool";
import HowItWorks from "@/components/HowItWorks";
import WhyMtonga from "@/components/WhyMtonga";
import FinalCTA from "@/components/FinalCTA";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <main className="relative min-h-screen flex flex-col items-center justify-center">
      <div className="fixed inset-0 z-0 pointer-events-none flex justify-center">
        <div className="w-[800px] h-[600px] bg-blue-600/10 blur-[120px] rounded-full mt-[-200px]" />
      </div>

      <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Hero />
        <UploadTool />
        <HowItWorks />
        <WhyMtonga />
        <FinalCTA />
      </div>
      <Footer />
    </main>
  );
}
