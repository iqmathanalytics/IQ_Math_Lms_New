import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield, ArrowRight, Briefcase, ChevronRight,
  BookOpen, Infinity, Award, Headset, Users,
  CheckCircle, Mic, Video, PhoneOff,
  Star, MapPin, Mail, ArrowUp
} from "lucide-react";
import { getHomePath, getValidSession } from "./utils/session";
import FastImage from "./components/FastImage";
import BrandLogo from "./components/BrandLogo";
import { optimizeImageUrl } from "./utils/imageUrl";

// --- 🎨 BRAND CONSTANTS ---
const BRAND_BLUE = "#0088C7";
const BRAND_GREEN = "#8DC63F";
const GITHUB_REPO_URL = "https://github.com/iqmathanalytics/iqmathlms_platform";
const RAZORPAY_PAYLINK_URL = "https://razorpay.me/iqmathtechnologies";

// --- 🔄 HERO SLIDE DATA ---
const SLIDES = [
  {
    id: 0,
    line1: "Learn Every Day With",
    line2: "New Skills Online",
    line3: "On Our IQ Math Platform.",
    sub: "Websites, apps, education platforms, and training — built for enterprise.",
    highlightColor: "text-[#8DC63F]",
    buttonColor: "bg-[#8DC63F]",
    panelGradient: "from-[#6FA32E] via-[#8DC63F] to-[#4F7A22]",
    accent: BRAND_GREEN
  },
  {
    id: 1,
    line1: "We Have Collected The",
    line2: "Best Online Courses",
    line3: "For Your Future.",
    sub: "AI-powered learning products and outcome-driven training across India, Malaysia, USA, and Australia.",
    highlightColor: "text-[#0088C7]",
    buttonColor: "bg-[#0088C7]",
    panelGradient: "from-[#006FA3] via-[#0088C7] to-[#005680]",
    accent: BRAND_BLUE
  },
];

// --- 📝 SECTION DATA (aligned with www.iqmath.in) ---
const DYNAMIC_TEXTS = [
  "IQMath Technologies is a full-service technology partner — not just an EdTech vendor. We develop custom websites and mobile applications, build AI-powered learning products, and run training programs for students, corporates, and colleges.",
  "Whether you need a website or app built, an EdTech platform deployed, or a training program delivered — we cover all three, with scale, security, and measurable impact across India, Malaysia, USA, and Australia.",
  "From institution-grade LMS and assessments to AI bots and custom workflows — production-ready systems for schools, colleges, corporates, and global brands."
];

const VIDEOS = [
  { id: "q6kVdZQLe54", title: "The Report | HackerRank Problem | Joins & SQL" },
  { id: "65aaipcziy0", title: "How to Install MySQL Workbench in Windows" },
  { id: "MC83S5IAQk8", title: "Connect to Database (MySQL) Using Excel" },
];

const FEATURES = [
  { icon: <BookOpen size={24} />, label: "LMS & Online Courses" },
  { icon: <Infinity size={24} />, label: "Lifetime Access" },
  { icon: <Award size={24} />, label: "Startup India Recognized" },
  { icon: <Headset size={24} />, label: "Enterprise Training" },
  { icon: <Users size={24} />, label: "Global Client Network" },
];

const TESTIMONIALS = [
  { id: 1, name: "Logambal", role: "Student", image: optimizeImageUrl("https://img.freepik.com/free-photo/young-student-woman-wearing-graduation-hat-holding-books-pointing-finger-side-looking-camera-with-happy-face-standing-white-background_141793-138374.jpg?w=1000", { width: 480 }), quote: "Thank you so much sir for teaching us. We learned a lot from your teaching. We will miss you. Thanks for making this learning process something different and truly engaging.", rating: 4 },
  { id: 2, name: "Rahul Verma", role: "Data Science Intern", image: optimizeImageUrl("https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?q=80&w=1000&auto=format&fit=crop", { width: 480 }), quote: "The practical approach to Data Structures changed my perspective entirely. The code arena feature helped me practice real-world problems directly in the browser.", rating: 5 },
  { id: 3, name: "Priya Sharma", role: "Web Developer", image: optimizeImageUrl("https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=1000&auto=format&fit=crop", { width: 480 }), quote: "I never thought learning React could be this intuitive. The instructors break down complex concepts into bite-sized, digestible lessons. Highly recommended!", rating: 5 }
];

const CompanyLogo = ({ name }: { name: string }) => {
  switch (name) {
    case "Infosys": return <svg viewBox="0 0 200 60" className="w-full h-full"><text x="50%" y="50%" dominantBaseline="middle" textAnchor="middle" fontFamily="sans-serif" fontWeight="bold" fontSize="40" fill="#007CC3">Infosys</text></svg>;
    case "Zoho": return <svg viewBox="0 0 200 60" className="w-full h-full"><rect x="20" y="10" width="35" height="40" rx="4" fill="#e3262e" opacity="0.9" /><rect x="60" y="10" width="35" height="40" rx="4" fill="#2d9a46" opacity="0.9" /><rect x="100" y="10" width="35" height="40" rx="4" fill="#1b6eb4" opacity="0.9" /><rect x="140" y="10" width="35" height="40" rx="4" fill="#fbb034" opacity="0.9" /><text x="37.5" y="38" textAnchor="middle" fill="white" fontSize="24" fontWeight="bold">Z</text><text x="77.5" y="38" textAnchor="middle" fill="white" fontSize="24" fontWeight="bold">O</text><text x="117.5" y="38" textAnchor="middle" fill="white" fontSize="24" fontWeight="bold">H</text><text x="157.5" y="38" textAnchor="middle" fill="white" fontSize="24" fontWeight="bold">O</text></svg>;
    case "TCS": return <svg viewBox="0 0 200 60" className="w-full h-full"><text x="50%" y="50%" dominantBaseline="middle" textAnchor="middle" fontFamily="sans-serif" fontWeight="900" fontSize="45" fill="#5F259F" letterSpacing="-2">tcs</text></svg>;
    case "Amazon": return <svg viewBox="0 0 200 60" className="w-full h-full"><text x="100" y="35" textAnchor="middle" fontFamily="sans-serif" fontWeight="bold" fontSize="38" fill="#232F3E">amazon</text><path d="M 45 45 Q 100 65 155 45" stroke="#FF9900" strokeWidth="4" fill="none" /></svg>;
    case "Cognizant": return <svg viewBox="0 0 200 60" className="w-full h-full"><text x="110" y="40" textAnchor="middle" fontFamily="sans-serif" fontWeight="bold" fontSize="30" fill="#0033A0">Cognizant</text><path d="M 30 30 L 45 15 L 60 30 L 45 45 Z" fill="#26A8E0" /></svg>;
    case "NielsenIQ": return <svg viewBox="0 0 200 60" className="w-full h-full"><path d="M 20 15 L 40 45 L 60 15" stroke="#8DC63F" strokeWidth="4" fill="none" /><text x="120" y="40" textAnchor="middle" fontFamily="sans-serif" fontWeight="bold" fontSize="28" fill="#666">NielsenIQ</text></svg>;
    default: return <div className="text-gray-400 font-bold">{name}</div>;
  }
};

const COMPANIES = ["Infosys", "Zoho", "TCS", "Amazon", "Cognizant", "NielsenIQ"];

const LandingPage = () => {
  const navigate = useNavigate();
  const [index, setIndex] = useState(0);
  const [textIndex, setTextIndex] = useState(0);
  const [testimonialIndex, setTestimonialIndex] = useState(0);
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    const heroTimer = setInterval(() => setIndex((prev) => (prev + 1) % SLIDES.length), 6000);
    const textTimer = setInterval(() => setTextIndex((prev) => (prev + 1) % DYNAMIC_TEXTS.length), 5000);
    const reviewTimer = setInterval(() => setTestimonialIndex((prev) => (prev + 1) % TESTIMONIALS.length), 5000);
    return () => { clearInterval(heroTimer); clearInterval(textTimer); clearInterval(reviewTimer); };
  }, []);

  useEffect(() => {
    const session = getValidSession();
    if (!session) return;
    navigate(getHomePath(session.role), { replace: true });
  }, [navigate]);

  const goLearner = () => {
    const session = getValidSession();
    if (session) {
      navigate(getHomePath(session.role));
      return;
    }
    navigate("/login");
  };

  const goAdmin = () => {
    const session = getValidSession();
    if (session?.role === "instructor") {
      navigate("/dashboard");
      return;
    }
    if (session?.role === "student") {
      navigate("/student-dashboard");
      return;
    }
    navigate("/admin-login");
  };

  useEffect(() => {
    const handleScroll = () => setShowScrollTop(window.scrollY > 300);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const currentSlide = SLIDES[index];
  const currentReview = TESTIMONIALS[testimonialIndex];

  return (
    <div className="min-h-screen w-full bg-white font-sans overflow-x-hidden selection:bg-[#0088C7] selection:text-white relative">

      {/* 🛡️ ADMIN ACCESS */}
      <div className="fixed top-4 right-4 md:top-6 md:right-6 z-50">
        <button onClick={goAdmin} className="p-2 md:p-3 bg-white/5 backdrop-blur-md border border-black/5 rounded-full hover:bg-white/50 transition-all group shadow-sm" title="Instructor / Admin login">
          <Shield className="w-5 h-5 md:w-6 md:h-6 text-slate-400 group-hover:text-[#0088C7]" />
        </button>
      </div>

      {/* ================= SECTION 1: HERO (SHARP PARTITION) ================= */}
      <div className="min-h-screen w-full relative flex flex-col lg:flex-row overflow-hidden">
        {/* LEFT CONTENT */}
        <div className="w-full lg:w-[50%] flex flex-col justify-center px-6 py-12 md:px-12 lg:px-20 bg-white relative z-20 text-center lg:text-left">
          <div className="absolute top-6 left-6 lg:left-20">
            <BrandLogo size="lg" showTagline />
          </div>

          <AnimatePresence mode="wait">
            <motion.div key={index} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.5 }} className="mt-20 lg:mt-12">
              <div className="space-y-0 text-slate-800">
                <h2 className="text-3xl sm:text-4xl lg:text-4xl font-bold tracking-tight mb-1">{currentSlide.line1}</h2>
                <h1 className={`text-4xl sm:text-5xl lg:text-6xl font-black leading-tight ${currentSlide.highlightColor} tracking-tighter`}>{currentSlide.line2}</h1>
                <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight mt-1">{currentSlide.line3}</h2>
              </div>
              <p className="text-base sm:text-lg text-slate-500 mt-6 mb-8 lg:mb-10 font-medium max-w-lg mx-auto lg:mx-0 leading-relaxed">{currentSlide.sub}</p>
            </motion.div>
          </AnimatePresence>

          <div className="flex flex-col sm:flex-row items-center gap-4 justify-center lg:justify-start">
            <button onClick={goLearner} className={`w-full sm:w-auto px-8 py-3.5 ${currentSlide.buttonColor} text-white font-bold rounded-full shadow-lg flex items-center justify-center gap-2 hover:brightness-110 transition-all`}>
              <ChevronRight size={20} strokeWidth={3} /> Our Courses
            </button>
            <button className="w-full sm:w-auto px-8 py-3.5 bg-white border border-slate-200 text-slate-700 font-bold rounded-full shadow-sm flex items-center justify-center gap-2 hover:bg-slate-50 transition-all">
              <Briefcase size={18} className="text-slate-400" /> Join Internship
            </button>
          </div>
        </div>

        {/* RIGHT VISUAL PANEL (HIDDEN ON MOBILE/TABLET FOR SIMPLICITY, OR VISIBLE IF DESIRED) */}
        <div className="hidden lg:flex w-[50%] h-auto min-h-screen relative items-center justify-center">
          <div className="absolute top-0 bottom-0 -left-28 w-56 bg-white transform skew-x-[-18deg] z-10 shadow-[-20px_0_40px_rgba(0,0,0,0.05)]"></div>
          <motion.div animate={{ backgroundColor: currentSlide.accent }} className="absolute top-0 bottom-0 -left-14 w-4 transform skew-x-[-18deg] z-10 opacity-30" />
          <motion.div key={`bg-${index}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8 }} className={`absolute inset-0 bg-gradient-to-br ${currentSlide.panelGradient}`} />
          <div className="relative z-20">
            <AnimatePresence mode="wait">
              <motion.div key={`logo-${index}`} initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 1.05, opacity: 0 }} transition={{ duration: 0.5 }} className="drop-shadow-[0_25px_40px_rgba(0,0,0,0.3)]">
                {index === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full">
                    <h1 className="text-5xl lg:text-7xl font-black text-white leading-tight tracking-tighter text-center drop-shadow-xl">
                      World<br />Class<br />Courses
                    </h1>
                    <div className="h-1 w-32 bg-white/50 mt-6 rounded-full" />
                  </div>
                ) : (
                  <div className="flex flex-col items-center rounded-3xl bg-white/95 px-10 py-8 shadow-2xl ring-1 ring-black/5">
                    <BrandLogo size="xl" showTagline />
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* ================= SECTION 2: FEATURES & VIDEOS ================= */}
      <div className="w-full bg-[#F8FAFC] py-16 lg:py-20 px-6 lg:px-24 border-t border-slate-200">
        <div className="flex flex-wrap justify-center gap-6 lg:gap-16 mb-16 lg:mb-24">
          {FEATURES.map((feature, i) => (
            <div key={i} className="flex items-center gap-4 group">
              <div className="w-12 h-12 lg:w-14 lg:h-14 rounded-full bg-[#0088C7]/10 flex items-center justify-center text-[#0088C7] group-hover:bg-[#0088C7] group-hover:text-white transition-all shadow-sm">{feature.icon}</div>
              <span className="text-slate-700 font-bold text-base lg:text-lg">{feature.label}</span>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8 mb-16 lg:mb-24">
          {VIDEOS.map((video) => (
            <div key={video.id} className="bg-white rounded-2xl overflow-hidden shadow-xl border border-slate-100">
              <div className="relative pt-[56.25%] bg-black">
                <iframe src={`https://www.youtube.com/embed/${video.id}`} title={video.title} className="absolute top-0 left-0 w-full h-full" allowFullScreen></iframe>
              </div>
              <div className="p-5">
                <h3 className="font-bold text-slate-800 text-sm leading-relaxed line-clamp-2 min-h-[40px]">{video.title}</h3>
                <div className="flex items-center gap-2 mt-4 text-xs text-[#0088C7] font-extrabold uppercase">
                  <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse"></span> Watch Now
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ================= SECTION 3: LIVE CLASS SECTION ================= */}
      <div className="w-full bg-white py-16 lg:py-24 px-6 lg:px-24 flex flex-col lg:flex-row items-center gap-12 lg:gap-16 border-t border-slate-100">
        <div className="w-full lg:w-1/2 text-center lg:text-left">
          <h2 className="text-3xl lg:text-5xl font-black text-[#0f172a] mb-8 leading-tight">Websites, Apps, Education & Training</h2>
          <div className="min-h-[100px] lg:min-h-[120px] mb-8">
            <AnimatePresence mode="wait">
              <motion.p key={textIndex} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.5 }} className="text-lg text-slate-500 leading-relaxed">
                {DYNAMIC_TEXTS[textIndex]}
              </motion.p>
            </AnimatePresence>
          </div>
          <div className="space-y-4 mb-10 inline-block text-left">
            {["Web & App Development", "AI-Powered EdTech Products", "Student, Corporate & College Training"].map((item, i) => (
              <div key={i} className="flex items-center gap-3"><CheckCircle size={20} className="text-[#0088C7] fill-blue-50" /><span className="text-slate-700 font-bold text-sm">{item}</span></div>
            ))}
          </div>
          <div className="flex justify-center lg:justify-start">
            <button onClick={goLearner} className="px-8 py-4 bg-[#0088C7] text-white font-bold rounded-xl shadow-lg hover:bg-[#006FA3] flex items-center gap-2">EXPLORE OUR COURSES <ArrowRight size={18} /></button>
          </div>
        </div>
        <div className="w-full lg:w-1/2 relative">
          <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-slate-100 bg-slate-900">
            <FastImage
              src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=1000&auto=format&fit=crop"
              alt="Live Instructor"
              widthHint={900}
              priority
              fit="cover"
              className="h-[250px] w-full opacity-90 md:h-[350px] lg:h-[400px]"
              skeletonClassName="h-[250px] w-full md:h-[350px] lg:h-[400px]"
            />
            <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-slate-900"><Mic size={18} /></div>
              <div className="w-12 h-12 rounded-full bg-[#0088C7] flex items-center justify-center text-white shadow-lg animate-pulse"><Video size={20} /></div>
              <div className="w-10 h-10 rounded-full bg-red-500 flex items-center justify-center text-white"><PhoneOff size={18} /></div>
            </div>
          </div>
        </div>
      </div>

      {/* ================= SECTION 4: TESTIMONIALS ================= */}
      <div className="w-full bg-white py-16 lg:py-24 px-6 lg:px-24 border-t border-slate-100">
        <div className="text-center mb-16"><h2 className="text-3xl lg:text-5xl font-black text-[#0f172a]">What Our Students Say</h2></div>
        <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-20">
          <div className="w-full lg:w-1/2 flex justify-center lg:justify-end">
            <div className="relative w-full max-w-[300px] lg:max-w-md aspect-square bg-slate-100 rounded-2xl overflow-hidden">
              <AnimatePresence mode="wait">
                <motion.div key={currentReview.id} initial={{ opacity: 0, scale: 1.05 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }} className="w-full h-full relative">
                  <FastImage
                    src={currentReview.image}
                    alt={currentReview.name}
                    widthHint={480}
                    priority
                    fit="cover"
                    className="h-full w-full object-top"
                    skeletonClassName="absolute inset-0 h-full w-full"
                  />
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
          <div className="w-full lg:w-1/2">
            <AnimatePresence mode="wait">
              <motion.div key={currentReview.id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.5 }}>
                <h3 className="text-xl lg:text-2xl font-medium text-slate-600 italic mb-8">"{currentReview.quote}"</h3>
                <div className="w-full h-px bg-slate-200 mb-8"></div>
                <h4 className="text-2xl font-black text-slate-900">{currentReview.name}</h4>
                <span className="text-[#0088C7] font-bold text-sm mb-2">{currentReview.role}</span>
                <div className="flex gap-1">{[...Array(5)].map((_, i) => (<Star key={i} size={18} className={`${i < currentReview.rating ? "fill-blue-500 text-blue-500" : "text-slate-300"}`} />))}</div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* ================= SECTION 5: COMPANY LOGOS ================= */}
      <div className="w-full bg-[#F1F5F9] py-16 px-6 lg:px-24 border-t border-slate-200">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-12">
          <div className="w-full lg:w-[35%] text-center lg:text-left"><h2 className="text-2xl lg:text-4xl font-black text-[#0f172a] leading-tight">Our Learners Work at <span className="text-[#0088C7]">10+</span> Global Companies</h2></div>
          <div className="w-full lg:w-[60%] grid grid-cols-2 md:grid-cols-3 gap-4 lg:gap-8">
            {COMPANIES.map((company, i) => (
              <div key={i} className="flex items-center justify-center p-4 h-20 lg:h-24 bg-white rounded-xl shadow-sm border border-slate-100 group overflow-hidden">
                <div className="w-full h-full filter grayscale opacity-60 group-hover:grayscale-0 group-hover:opacity-100 group-hover:scale-110 transition-all duration-300 ease-in-out flex items-center justify-center"><CompanyLogo name={company} /></div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ================= SECTION 6: FOOTER ================= */}
      <footer className="w-full bg-[#020617] text-slate-300 py-12 lg:py-16 px-6 lg:px-24 border-t border-slate-800">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
          <div className="md:col-span-2 lg:col-span-2">
            <h4 className="text-white text-lg font-bold mb-6 relative pb-2 inline-block">
              About Company
              <span className="absolute bottom-0 left-0 w-8 h-1 bg-[#0088C7] rounded-full"></span>
            </h4>
            <BrandLogo size="md" showTagline className="mt-1" />
            <p className="mt-4 text-sm font-semibold text-white/90 leading-snug">
              Websites, apps, education platforms, and training — built for enterprise.
            </p>
            <p className="mt-3 text-sm text-slate-400 leading-relaxed max-w-md">
              IQMath Technologies designs and ships custom websites and mobile apps, builds AI-powered learning products,
              and runs outcome-driven training for students, corporates, and colleges across India, Malaysia, USA, and Australia.
              Startup India Recognized · StartupTN Registered.
            </p>
            <a
              href="https://www.iqmath.in"
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-block text-sm font-bold text-[#0088C7] hover:underline"
            >
              www.iqmath.in
            </a>
          </div>
          <div className="hidden" aria-hidden>
            <h4 className="text-white text-lg font-bold mb-6 relative pb-2 inline-block">Quick Links<span className="absolute bottom-0 left-0 w-8 h-1 bg-[#0088C7] rounded-full"></span></h4>
            <ul className="space-y-3 text-sm font-medium">{["Marketing", "Data Science", "Business"].map((item) => (<li key={item} className="hover:text-[#0088C7] cursor-pointer transition-colors">{item}</li>))}</ul>
          </div>
          <div className="hidden" aria-hidden>
            <h4 className="text-white text-lg font-bold mb-6 relative pb-2 inline-block">Resources<span className="absolute bottom-0 left-0 w-8 h-1 bg-[#0088C7] rounded-full"></span></h4>
            <ul className="space-y-3 text-sm font-medium">
              <li><a href={GITHUB_REPO_URL} target="_blank" rel="noreferrer" className="hover:text-[#0088C7] transition-colors">GitHub Repository</a></li>
              <li><a href={RAZORPAY_PAYLINK_URL} target="_blank" rel="noreferrer" className="hover:text-[#0088C7] transition-colors">Razorpay Payment Link</a></li>
              <li className="hover:text-[#0088C7] cursor-pointer transition-colors">Documentation</li>
            </ul>
          </div>
          <div>
            <h4 className="text-white text-lg font-bold mb-6 relative pb-2 inline-block">
              Get in touch!
              <span className="absolute bottom-0 left-0 w-8 h-1 bg-[#0088C7] rounded-full"></span>
            </h4>
            <ul className="space-y-4 text-sm">
              <li className="flex gap-3">
                <MapPin size={18} className="text-[#0088C7] flex-shrink-0" />
                <span className="flex-1">Chennai, Tamil Nadu</span>
              </li>
              <li className="flex gap-3">
                <Mail size={18} className="text-[#0088C7] flex-shrink-0" />
                <a href="mailto:contact@iqmath.in" className="hover:text-[#0088C7] transition-colors">
                  contact@iqmath.in
                </a>
              </li>
            </ul>
          </div>
        </div>
        <div className="pt-8 border-t border-slate-800 text-center text-xs text-slate-500">
          <p>Copyright © 2026 IQMath Technologies. All Rights Reserved.</p>
        </div>
      </footer>

      {/* SCROLL TO TOP */}
      <AnimatePresence>{showScrollTop && (<motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="fixed bottom-8 right-8 p-3 bg-[#0088C7] text-white rounded-full shadow-lg z-50 hover:bg-[#006FA3] transition-colors"><ArrowUp size={24} /></motion.button>)}</AnimatePresence>

    </div>
  );
};

export default LandingPage;