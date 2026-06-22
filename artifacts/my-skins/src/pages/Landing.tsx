import { useGetMe } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { useLanguage } from "@/hooks/use-language";
import { motion } from "framer-motion";
import { Sparkles, Wand2, Download, Users, Shirt, Layers, Palette, Image as ImageIcon, ArrowRight, Check } from "lucide-react";

const TEMPLATE_PREVIEWS = [
  { label: "Streetwear", color: "from-orange-600 to-red-800", emoji: "🔥" },
  { label: "Anime", color: "from-pink-500 to-purple-700", emoji: "⚡" },
  { label: "Sport", color: "from-green-500 to-emerald-800", emoji: "⚽" },
  { label: "Cyberpunk", color: "from-cyan-400 to-blue-800", emoji: "🤖" },
  { label: "Minimal", color: "from-slate-400 to-slate-700", emoji: "✨" },
  { label: "Pirate", color: "from-yellow-500 to-amber-800", emoji: "💀" },
  { label: "Military", color: "from-green-700 to-stone-800", emoji: "🪖" },
  { label: "Space", color: "from-indigo-500 to-slate-900", emoji: "🚀" },
];

const HOW_STEPS = [
  {
    step: "01",
    titleEn: "Pick a template",
    titleNo: "Velg en mal",
    descEn: "Start from one of our hundreds of ready-made templates, or from a blank canvas.",
    descNo: "Start fra en av våre hundrevis av ferdige maler, eller fra en blank plate.",
  },
  {
    step: "02",
    titleEn: "Customize your design",
    titleNo: "Tilpass designet ditt",
    descEn: "Use AI, colors, gradients, and patterns to make your Roblox outfit unique.",
    descNo: "Bruk AI, farger, gradienter og mønstre for å gjøre Roblox-antrekket ditt unikt.",
  },
  {
    step: "03",
    titleEn: "Export and wear it",
    titleNo: "Eksporter og bruk det",
    descEn: "Download the PNG template and upload it directly to Roblox. Done!",
    descNo: "Last ned PNG-malen og last den opp direkte til Roblox. Ferdig!",
  },
];

const FEATURES = [
  { icon: Wand2, titleEn: "AI Design Generator", titleNo: "AI-designgenerator", descEn: "Describe your outfit idea and our AI creates a full design instantly.", descNo: "Beskriv antrekksideen din, så lager AI-en et fullstendig design øyeblikkelig.", color: "text-indigo-400" },
  { icon: Layers, titleEn: "Live 3D Preview", titleNo: "Live 3D-forhåndsvisning", descEn: "See your clothing on a real Roblox avatar in 3D before exporting.", descNo: "Se klærne dine på en ekte Roblox-avatar i 3D før eksport.", color: "text-purple-400" },
  { icon: Palette, titleEn: "Full Color Control", titleNo: "Full fargekontroll", descEn: "Colors, gradients, patterns — total creative freedom on a pro canvas.", descNo: "Farger, gradienter, mønstre — total kreativ frihet på et profesjonelt lerret.", color: "text-pink-400" },
  { icon: Download, titleEn: "Roblox-Ready Export", titleNo: "Roblox-klar eksport", descEn: "Export perfect 585×559 PNG templates, ready to upload directly to Roblox.", descNo: "Eksporter perfekte 585×559 PNG-maler, klare til å laste opp direkte til Roblox.", color: "text-green-400" },
  { icon: ImageIcon, titleEn: "Template Library", titleNo: "Malbibliotek", descEn: "Hundreds of community-made templates to start from and customize.", descNo: "Hundrevis av fellesskapsmaler å starte fra og tilpasse.", color: "text-amber-400" },
  { icon: Shirt, titleEn: "Shirts & Pants", titleNo: "Skjorter og bukser", descEn: "Design classic shirts, pants, and matching sets for any Roblox style.", descNo: "Design klassiske skjorter, bukser og matchende sett for enhver Roblox-stil.", color: "text-cyan-400" },
];

export default function Landing() {
  const [, setLocation] = useLocation();
  const { data: user, isLoading } = useGetMe({ query: { queryKey: ["/api/auth/me"], retry: false } });
  const { language } = useLanguage();

  useEffect(() => {
    if (user && !isLoading) {
      setLocation("/dashboard");
    }
  }, [user, isLoading]); // intentionally omit setLocation — it's stable

  if (isLoading || user) return null;

  const isNo = language === "no";

  return (
    <div className="min-h-screen bg-[#060913] text-white font-sans overflow-x-hidden">

      {/* ── Navbar ─────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 border-b border-white/8 bg-[#060913]/90 backdrop-blur">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between max-w-6xl">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white text-sm">MS</div>
            <span className="font-bold text-white text-lg tracking-tight">My Skins</span>
          </div>
          <div className="flex items-center gap-3">
            <a href="/api/login" className="text-sm text-white/60 hover:text-white transition-colors px-3 py-1.5">
              {isNo ? "Logg inn" : "Log in"}
            </a>
            <a
              href={`${import.meta.env.BASE_URL}editor/local`}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              {isNo ? "Start gratis" : "Start for free"}
            </a>
          </div>
        </div>
      </nav>

      {/* ── Hero ───────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-indigo-600/20 rounded-full blur-[120px]" />
          <div className="absolute top-32 left-1/4 w-[300px] h-[300px] bg-purple-600/15 rounded-full blur-[80px]" />
          <div className="absolute top-16 right-1/4 w-[200px] h-[200px] bg-cyan-500/10 rounded-full blur-[60px]" />
        </div>

        <div className="relative container mx-auto px-6 pt-24 pb-20 max-w-5xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-indigo-500/30 bg-indigo-600/10 text-indigo-300 text-xs font-semibold uppercase tracking-wider mb-6"
          >
            <Sparkles className="w-3.5 h-3.5" />
            {isNo ? "AI-drevet Roblox-designer" : "AI-Powered Roblox Designer"}
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.05 }}
            className="text-5xl md:text-7xl font-extrabold tracking-tight leading-[1.08] mb-6"
          >
            {isNo ? (
              <>Lag Roblox-klær<br /><span className="text-indigo-400">som en proff</span></>
            ) : (
              <>Create Roblox Clothes<br /><span className="text-indigo-400">Like a Pro</span></>
            )}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-xl text-white/50 max-w-2xl mx-auto mb-10 leading-relaxed"
          >
            {isNo
              ? "Det premium, raske, kreativ-første verktøyet for å designe klassiske skjorter og bukser med innebygd AI. Brukt av Roblox-skapere over hele verden."
              : "The premium, fast, creator-first tool for designing classic shirts and pants with built-in AI. Used by Roblox creators worldwide."}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-3"
          >
            <a
              href={`${import.meta.env.BASE_URL}editor/local`}
              className="flex items-center gap-2 px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-base rounded-xl transition-all hover:scale-[1.02] active:scale-100 shadow-lg shadow-indigo-600/30"
            >
              <Sparkles className="w-5 h-5" />
              {isNo ? "Begynn å lage nå" : "Start creating now"}
              <ArrowRight className="w-4 h-4" />
            </a>
            <div className="text-white/35 text-sm flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-green-400" />
              {isNo ? "Gratis å starte" : "Free to start"}
            </div>
          </motion.div>
        </div>

        {/* Template preview mosaic */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.25 }}
          className="container mx-auto px-6 pb-20 max-w-5xl"
        >
          <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
            {TEMPLATE_PREVIEWS.map((t, i) => (
              <div
                key={i}
                className={`aspect-square rounded-xl bg-gradient-to-br ${t.color} flex flex-col items-center justify-center gap-1 border border-white/10 hover:scale-105 transition-transform cursor-pointer`}
              >
                <span className="text-2xl">{t.emoji}</span>
                <span className="text-[9px] font-semibold text-white/70 uppercase tracking-wide">{t.label}</span>
              </div>
            ))}
          </div>
          <p className="text-center text-white/25 text-xs mt-3 uppercase tracking-wider">
            {isNo ? "Hundrevis av maler tilgjengelig" : "Hundreds of templates available"}
          </p>
        </motion.div>
      </section>

      {/* ── How it works ───────────────────────────────────────── */}
      <section className="py-24 border-t border-white/8 bg-[#080d1a]">
        <div className="container mx-auto px-6 max-w-5xl">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold mb-3">
              {isNo ? "Slik lager du Roblox-klær" : "How to make Roblox clothes"}
            </h2>
            <p className="text-white/40 text-lg">
              {isNo ? "Tre enkle steg fra idé til ferdig design" : "Three simple steps from idea to finished design"}
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {HOW_STEPS.map((step, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="relative p-6 rounded-2xl bg-white/4 border border-white/8 hover:border-indigo-500/30 transition-colors"
              >
                <div className="text-5xl font-black text-white/8 mb-4 leading-none">{step.step}</div>
                <h3 className="text-lg font-bold mb-2">{isNo ? step.titleNo : step.titleEn}</h3>
                <p className="text-white/45 text-sm leading-relaxed">{isNo ? step.descNo : step.descEn}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ───────────────────────────────────────────── */}
      <section className="py-24 border-t border-white/8">
        <div className="container mx-auto px-6 max-w-5xl">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold mb-3">
              {isNo ? "Alt du trenger for å lage" : "Everything you need to create"}
            </h2>
            <p className="text-white/40 text-lg">
              {isNo ? "Profesjonelle verktøy, tilgjengelige for alle" : "Professional tools, accessible to everyone"}
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            {FEATURES.map((f, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.07 }}
                className="p-5 rounded-2xl bg-white/4 border border-white/8 hover:border-white/15 transition-colors"
              >
                <f.icon className={`w-6 h-6 ${f.color} mb-4`} />
                <h3 className="font-bold mb-1.5">{isNo ? f.titleNo : f.titleEn}</h3>
                <p className="text-white/45 text-sm leading-relaxed">{isNo ? f.descNo : f.descEn}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Banner ─────────────────────────────────────────── */}
      <section className="py-24 border-t border-white/8 bg-[#080d1a]">
        <div className="container mx-auto px-6 max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 text-indigo-300 mb-6">
            <Users className="w-5 h-5" />
            <span className="text-sm font-semibold">
              {isNo ? "Brukt av tusenvis av Roblox-skapere" : "Used by thousands of Roblox creators"}
            </span>
          </div>
          <h2 className="text-4xl md:text-5xl font-extrabold mb-5 leading-tight">
            {isNo ? "Klar til å designe?" : "Ready to design?"}
          </h2>
          <p className="text-white/45 text-lg mb-10">
            {isNo
              ? "Lag ditt første Roblox-antrekk på minutter. Gratis å starte."
              : "Create your first Roblox outfit in minutes. Free to start."}
          </p>
          <a
            href={`${import.meta.env.BASE_URL}editor/local`}
            className="inline-flex items-center gap-2 px-10 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-lg rounded-xl transition-all hover:scale-[1.02] shadow-xl shadow-indigo-600/30"
          >
            <Sparkles className="w-5 h-5" />
            {isNo ? "Begynn gratis" : "Start for free"}
          </a>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────── */}
      <footer className="border-t border-white/8 py-8">
        <div className="container mx-auto px-6 max-w-5xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-indigo-600 flex items-center justify-center text-xs font-bold">MS</div>
            <span className="text-white/40 text-sm">My Skins</span>
          </div>
          <p className="text-white/25 text-xs">
            {isNo ? "Ikke tilknyttet Roblox Corporation." : "Not affiliated with Roblox Corporation."}
          </p>
        </div>
      </footer>
    </div>
  );
}
