"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  HeartHandshake,
  Brain,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Users,
  MapPin,
  Building2,
  Stethoscope,
  ArrowRight,
  BookOpen,
  Phone,
  Navigation,
  Loader2,
  Sparkles,
  Map,
} from "lucide-react";

interface SlpCenterItem {
  id: string;
  name: string;
  type: string;
  city: string;
  address: string;
  coverage: string;
  description: string;
  phone: string;
  url: string;
  googleMapsUrl: string;
  badge: string;
  lat: number;
  lng: number;
}

const SLP_CENTERS: SlpCenterItem[] = [
  {
    id: "aiims-delhi",
    name: "All India Institute of Medical Sciences (AIIMS) — Speech & Hearing Unit",
    type: "Apex Central Government Medical Institute",
    city: "New Delhi",
    address: "Ansari Nagar East, New Delhi, Delhi 110029",
    coverage: "Delhi NCR & Northern India",
    description:
      "Multidisciplinary neurological and motor speech rehabilitation clinic offering acoustic evaluation, stroke/Parkinson's dysarthria therapy, and swallow rehabilitation.",
    phone: "+91-11-26588500",
    url: "https://www.aiims.edu",
    googleMapsUrl:
      "https://www.google.com/maps/search/?api=1&query=AIIMS+Ansari+Nagar+New+Delhi",
    badge: "Apex Medical Center",
    lat: 28.5672,
    lng: 77.21,
  },
  {
    id: "ayjnishd-noida",
    name: "Ali Yavar Jung National Institute (AYJNISHD) — Northern Regional Center",
    type: "National Institute (DEPwD, Ministry of Social Justice)",
    city: "Noida (Delhi NCR)",
    address: "Plot No. 44A, Block C, Sector 40, Noida, Uttar Pradesh 201303",
    coverage: "Noida, Delhi NCR & UP",
    description:
      "Specialized government speech-language pathology and audiology diagnostic center offering subsidized motor speech therapy and assistive communication devices.",
    phone: "+91-120-2500474",
    url: "https://ayjnihh.nic.in",
    googleMapsUrl:
      "https://www.google.com/maps/search/?api=1&query=AYJNISHD+NRC+Sector+40+Noida",
    badge: "Government Regional Center",
    lat: 28.5636,
    lng: 77.3598,
  },
  {
    id: "rci-delhi",
    name: "Rehabilitation Council of India (RCI) — Central Registry HQ",
    type: "Statutory Central Government Regulatory Body",
    city: "New Delhi",
    address: "B-22, Qutab Institutional Area, New Delhi, Delhi 110016",
    coverage: "All India (Nationwide Registry)",
    description:
      "Search the official Central Rehabilitation Register (CRR) to verify government-licensed Audiologists and Speech-Language Pathologists across all Indian states.",
    phone: "+91-11-26532408",
    url: "https://rehabcouncil.nic.in",
    googleMapsUrl:
      "https://www.google.com/maps/search/?api=1&query=Rehabilitation+Council+of+India+Qutab+Institutional+Area+New+Delhi",
    badge: "Official Regulatory Body",
    lat: 28.5398,
    lng: 77.1855,
  },
  {
    id: "pgimer-chandigarh",
    name: "PGIMER — Speech & Hearing Rehabilitation Unit",
    type: "Institute of National Importance",
    city: "Chandigarh",
    address: "Sector 12, Chandigarh 160012",
    coverage: "Chandigarh, Punjab, Haryana & Himachal",
    description:
      "Comprehensive clinical speech pathology and neurogenic communication disorders unit specializing in post-stroke, TBI, and movement disorder dysarthria.",
    phone: "+91-172-2747585",
    url: "https://pgimer.edu.in",
    googleMapsUrl:
      "https://www.google.com/maps/search/?api=1&query=PGIMER+Sector+12+Chandigarh",
    badge: "National Institute",
    lat: 30.7649,
    lng: 76.7751,
  },
  {
    id: "ayjnishd-mumbai",
    name: "Ali Yavar Jung National Institute (AYJNISHD) — National Headquarters",
    type: "National Institute (DEPwD, MSJE)",
    city: "Mumbai",
    address: "K.C. Marg, Bandra Reclamation, Bandra (West), Mumbai, Maharashtra 400050",
    coverage: "Mumbai & Western India",
    description:
      "National headquarters featuring full diagnostic speech laboratories, voice prosthetics, motor speech rehabilitation units, and tele-therapy consultation.",
    phone: "+91-22-26400215",
    url: "https://ayjnihh.nic.in",
    googleMapsUrl:
      "https://www.google.com/maps/search/?api=1&query=Ali+Yavar+Jung+National+Institute+Bandra+Mumbai",
    badge: "National Headquarters",
    lat: 19.0469,
    lng: 72.8203,
  },
  {
    id: "aiish-mysore",
    name: "All India Institute of Speech and Hearing (AIISH)",
    type: "Autonomous Apex Institute (Ministry of Health & Family Welfare)",
    city: "Mysuru",
    address: "Manasagangothri, Mysuru, Karnataka 570006",
    coverage: "Mysuru / Pan-India Tele-Rehabilitation",
    description:
      "India's premier apex institute dedicated to speech-language pathology, motor speech disorder diagnostics, clinical second opinions, and remote tele-rehabilitation.",
    phone: "+91-821-2502000",
    url: "https://aiishmysore.in",
    googleMapsUrl:
      "https://www.google.com/maps/search/?api=1&query=All+India+Institute+of+Speech+and+Hearing+Mysore",
    badge: "Apex National Institute",
    lat: 12.3182,
    lng: 76.6186,
  },
  {
    id: "nimhans-bangalore",
    name: "NIMHANS — Dept. of Speech Pathology & Audiology",
    type: "Institute of National Importance (Neuro-Clinical)",
    city: "Bengaluru",
    address: "Hosur Road, Lakkasandra, Bengaluru, Karnataka 560029",
    coverage: "Bengaluru & Southern India",
    description:
      "Specialized neuro-speech pathology clinic focused exclusively on neurological communication disorders including Parkinson's, ALS, cerebellar ataxia, and stroke.",
    phone: "+91-80-26995568",
    url: "https://nimhans.ac.in",
    googleMapsUrl:
      "https://www.google.com/maps/search/?api=1&query=NIMHANS+Speech+Pathology+and+Audiology+Bangalore",
    badge: "Neuro-Speech Apex",
    lat: 12.9428,
    lng: 77.5966,
  },
  {
    id: "isha-directory",
    name: "Indian Speech and Hearing Association (ISHA)",
    type: "National Professional Association",
    city: "Mysuru / Pan-India",
    address: "C/o AIISH Campus, Manasagangothri, Mysuru, Karnataka 570006",
    coverage: "Pan-India Clinical Directory",
    description:
      "Verified clinical professional directory connecting patients with certified speech-language therapists across major metropolitan and tier-2 hospitals.",
    phone: "+91-821-2514313",
    url: "https://ishaindia.org.in",
    googleMapsUrl:
      "https://www.google.com/maps/search/?api=1&query=Indian+Speech+and+Hearing+Association+Mysore",
    badge: "Professional Association",
    lat: 12.3175,
    lng: 76.619,
  },
  {
    id: "ayjnishd-kolkata",
    name: "AYJNISHD — Eastern Regional Center (ERC)",
    type: "National Institute Regional Center",
    city: "Kolkata",
    address: "B.T. Road, Bonhooghly, Kolkata, West Bengal 700090",
    coverage: "Kolkata & Eastern India",
    description:
      "Comprehensive speech and hearing diagnostic clinic serving Eastern and North-Eastern states with adult neurogenic speech rehabilitation programs.",
    phone: "+91-33-25311427",
    url: "https://ayjnihh.nic.in",
    googleMapsUrl:
      "https://www.google.com/maps/search/?api=1&query=AYJNISHD+Eastern+Regional+Centre+Bonhooghly+Kolkata",
    badge: "Government Regional Center",
    lat: 22.6512,
    lng: 88.3775,
  },
  {
    id: "ayjnishd-secunderabad",
    name: "AYJNISHD — Southern Regional Center (SRC)",
    type: "National Institute Regional Center",
    city: "Secunderabad / Hyderabad",
    address: "Manovikas Nagar, Bowenpally, Secunderabad, Telangana 500009",
    coverage: "Hyderabad, Telangana & Andhra Pradesh",
    description:
      "Regional clinical speech therapy unit providing diagnostic motor speech assessments, acoustic evaluations, and intensive caregiver training.",
    phone: "+91-40-27952715",
    url: "https://ayjnihh.nic.in",
    googleMapsUrl:
      "https://www.google.com/maps/search/?api=1&query=AYJNISHD+Southern+Regional+Centre+Secunderabad",
    badge: "Government Regional Center",
    lat: 17.4728,
    lng: 78.4852,
  },
];

const QUICK_CITY_COORDS: { label: string; lat: number; lng: number }[] = [
  { label: "New Delhi / NCR", lat: 28.6139, lng: 77.209 },
  { label: "Chandigarh", lat: 30.7333, lng: 76.7794 },
  { label: "Mumbai", lat: 19.076, lng: 72.8777 },
  { label: "Bengaluru", lat: 12.9716, lng: 77.5946 },
  { label: "Mysuru", lat: 12.2958, lng: 76.6394 },
  { label: "Hyderabad", lat: 17.385, lng: 78.4867 },
  { label: "Kolkata", lat: 22.5726, lng: 88.3639 },
];

const CAREGIVER_RULES = [
  {
    number: 1,
    title: "Eliminate Background Noise",
    subtitle: "Caregiver muting the TV before speaking",
    image: "/images/caregiver-rule-1.png",
    description:
      "Turn off televisions, radios, and loud kitchen appliances before starting a conversation. Dysarthric speech often has reduced decibel volume; eliminating competing room noise makes vocal separation effortless for both listener and speaker.",
  },
  {
    number: 2,
    title: "Maintain Face-to-Face Eye Contact",
    subtitle: "Sitting opposite each other in clear view",
    image: "/images/caregiver-rule-2.png",
    description:
      "Sit directly opposite the speaker at eye level in good lighting. Humans decode up to 40% of speech cues visually through lip postures, facial dynamics, and jaw movement. Avoid conversing from another room.",
  },
  {
    number: 3,
    title: "Never Finish Their Sentences Prematurely",
    subtitle: "Patient speaking while caregiver listens patiently",
    image: "/images/caregiver-rule-3.png",
    description:
      "While intended to be helpful, guessing words or interrupting can cause frustration and strip away communicative autonomy. Grant generous, unhurried time and allow your loved one to complete their full thought.",
  },
  {
    number: 4,
    title: "Practice Piece-by-Piece Verification",
    subtitle: "Repeating and confirming the understood phrase",
    image: "/images/caregiver-rule-4.png",
    description:
      "Instead of saying \"I didn't understand, repeat the whole thing,\" echo back the specific portion you grasped: \"I heard you say you want to go outside—what did you say next?\" This prevents exhausting full-sentence repetitions.",
  },
  {
    number: 5,
    title: "Simplify Questions When Fatigue Strikes",
    subtitle: "Offering clear choices like tea or water",
    image: "/images/caregiver-rule-5.png",
    description:
      "Motor speech muscle fatigue peaks late in the day or after physical exertion. When you notice vocal fatigue, reframe open-ended questions into simple binary choices (\"Would you like warm tea or water?\") or yes/no questions.",
  },
  {
    number: 6,
    title: "Utilize Multimodal Backups (Writing & Gestures)",
    subtitle: "Using a notebook, written keywords, and hand gestures",
    image: "/images/caregiver-rule-6.png",
    description:
      "Keep a small notepad, tablet, or alphabet board within reach. If a critical keyword remains unclear after two spoken attempts, encourage writing the key word or gesturing to immediately relieve vocal pressure.",
  },
];

function computeHaversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371; // Earth radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

export default function ResourcesPage() {
  const [activeTab, setActiveTab] = useState<
    "what-is-dysarthria" | "caregiver-tips" | "find-slp"
  >("what-is-dysarthria");
  const [searchQuery, setSearchQuery] = useState("");

  // Geolocation state for Find an SLP
  const [userCoords, setUserCoords] = useState<{
    lat: number;
    lng: number;
    sourceLabel: string;
  } | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  const handleDetectLocation = () => {
    setLocating(true);
    setLocationError(null);

    if (typeof window === "undefined" || !("geolocation" in navigator)) {
      setLocationError(
        "Geolocation is not supported by this browser. You can select your city below to find the closest center."
      );
      setLocating(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setUserCoords({
          lat,
          lng,
          sourceLabel: `Live GPS (${lat.toFixed(3)}°N, ${lng.toFixed(3)}°E)`,
        });
        setLocating(false);
        const nearest = SLP_CENTERS.reduce((best, cur) => {
          const dBest = computeHaversineKm(lat, lng, best.lat, best.lng);
          const dCur = computeHaversineKm(lat, lng, cur.lat, cur.lng);
          return dCur < dBest ? cur : best;
        }, SLP_CENTERS[0]);
        if (typeof window !== "undefined") {
          try {
            localStorage.setItem("dysarthrianet_detected_city", nearest.city);
            fetch("/api/analytics", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                eventType: "slp_locator_used",
                path: "/resources",
                city: nearest.city,
                country: "India",
                metadata: { lat: Number(lat.toFixed(3)), lng: Number(lng.toFixed(3)) },
              }),
            }).catch(() => {});
          } catch {
            // ignore
          }
        }
      },
      (err) => {
        setLocating(false);
        setLocationError(
          err.code === 1
            ? "Location permission was declined. Select your nearest city below or enable browser location access."
            : "Could not lock GPS signal quickly. Select your city below for instant distance sorting."
        );
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    );
  };

  // Compute distances and sort centers when userCoords is available
  const centersWithDistance = useMemo(() => {
    const mapped = SLP_CENTERS.map((center) => {
      const distanceKm = userCoords
        ? computeHaversineKm(
            userCoords.lat,
            userCoords.lng,
            center.lat,
            center.lng
          )
        : null;
      return { ...center, distanceKm };
    });

    if (userCoords) {
      mapped.sort((a, b) => (a.distanceKm ?? 99999) - (b.distanceKm ?? 99999));
    }
    return mapped;
  }, [userCoords]);

  const closestCenter = useMemo(() => {
    if (!userCoords || centersWithDistance.length === 0) return null;
    return centersWithDistance[0];
  }, [userCoords, centersWithDistance]);

  const filteredSlpList = useMemo(() => {
    return centersWithDistance.filter(
      (item) =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.coverage.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.address.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [centersWithDistance, searchQuery]);

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-20 pt-2">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-200/70 text-slate-700 text-xs font-semibold mb-2">
            <HeartHandshake className="h-3.5 w-3.5 text-clinical-cyan animate-pulse" />
            <span>PATIENT &amp; CAREGIVER CLINICAL HUB</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
            Patient &amp; Family{" "}
            <span className="text-clinical-cyan">Resource Center</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl">
            Evidence-based educational guidance, illustrated daily caregiver
            conversational strategies, and location-aware Speech-Language
            Pathologist (SLP) clinical centers with direct contact numbers and
            Google Maps navigation.
          </p>
        </div>

        {/* CTA to Voice Screener */}
        <Link
          href="/screen"
          className="inline-flex items-center gap-2 bg-[#14171A] hover:bg-black text-white px-5 py-2.5 rounded-full text-xs font-bold shadow-soft-sm transition-all hover:scale-105 shrink-0"
        >
          <Stethoscope className="h-3.5 w-3.5 text-vitality" />
          <span>Screen Voice Now</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* Tab Switcher */}
      <div className="flex flex-wrap items-center gap-2 bg-white p-2 rounded-2xl border border-slate-200/80 shadow-soft-sm">
        <button
          onClick={() => setActiveTab("what-is-dysarthria")}
          className={`flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === "what-is-dysarthria"
              ? "bg-[#14171A] text-white shadow-soft-sm"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
          }`}
        >
          <Brain
            className={`h-4 w-4 ${
              activeTab === "what-is-dysarthria"
                ? "text-vitality"
                : "text-slate-400"
            }`}
          />
          <span>1. What Is Dysarthria?</span>
          <span className="hidden sm:inline text-[10px] opacity-70 font-mono">
            (Patient Guide)
          </span>
        </button>

        <button
          onClick={() => setActiveTab("caregiver-tips")}
          className={`flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === "caregiver-tips"
              ? "bg-[#14171A] text-white shadow-soft-sm"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
          }`}
        >
          <Users
            className={`h-4 w-4 ${
              activeTab === "caregiver-tips" ? "text-vitality" : "text-slate-400"
            }`}
          />
          <span>2. Caregiver Communication Tips</span>
          <span className="hidden sm:inline text-[10px] opacity-70 font-mono">
            (6 Illustrated Rules)
          </span>
        </button>

        <button
          onClick={() => setActiveTab("find-slp")}
          className={`flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === "find-slp"
              ? "bg-[#14171A] text-white shadow-soft-sm"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
          }`}
        >
          <Building2
            className={`h-4 w-4 ${
              activeTab === "find-slp" ? "text-vitality" : "text-slate-400"
            }`}
          />
          <span>3. Find an SLP Near You</span>
          <span className="hidden sm:inline text-[10px] opacity-70 font-mono">
            (Maps &amp; Contacts)
          </span>
        </button>
      </div>

      {/* Tab 1: What is Dysarthria? */}
      {activeTab === "what-is-dysarthria" && (
        <div className="space-y-6">
          {/* Critical Family Reassurance Card */}
          <div className="bg-gradient-to-r from-emerald-50 via-teal-50/70 to-emerald-50 rounded-3xl p-6 sm:p-8 border border-emerald-200/70 shadow-soft-sm space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold shrink-0">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <h2 className="text-base sm:text-lg font-black text-emerald-950 tracking-tight">
                Crucial Fact for Families: Dysarthria Affects Motor Muscles, NOT
                Intelligence
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-emerald-900/90 leading-relaxed">
              Dysarthria is purely a{" "}
              <strong>neuromotor execution disorder</strong>. The neurological
              signals controlling the physical muscles of the lips, tongue,
              vocal folds, and diaphragm are weakened or uncoordinated.{" "}
              <strong>
                It does NOT damage cognitive ability, memory, intelligence, or
                language understanding.
              </strong>{" "}
              The person knows precisely what they wish to communicate, but
              their articulators require extra time and therapeutic adaptation.
            </p>
          </div>

          {/* Core Explanatory Cards */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-100 shadow-soft-md space-y-6">
            <div>
              <h3 className="text-xl font-black text-slate-900 tracking-tight">
                Understanding Motor Speech Impairment
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Clinical educational reference synthesized from Mayo Clinic, NIH
                (NIDCD), and ASHA patient literature.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2 p-5 bg-slate-50/80 rounded-2xl border border-slate-100">
                <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-clinical-cyan"></span>
                  What Causes Dysarthria?
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Dysarthria occurs when damage to the central or peripheral
                  nervous system disrupts nerve transmission to the speech
                  muscles. Common causes include:
                </p>
                <ul className="text-xs text-slate-600 space-y-1 list-disc pl-4 pt-1">
                  <li>
                    <strong>Stroke &amp; Cerebrovascular Events:</strong> Sudden
                    unilateral muscle weakness.
                  </li>
                  <li>
                    <strong>Parkinson&apos;s Disease:</strong> Rigidity and
                    hypokinesia leading to low volume.
                  </li>
                  <li>
                    <strong>ALS (Motor Neuron Disease):</strong> Progressive
                    motor nerve degeneration.
                  </li>
                  <li>
                    <strong>Cerebral Palsy:</strong> Congenital motor
                    coordination impairment.
                  </li>
                  <li>
                    <strong>Multiple Sclerosis &amp; TBI:</strong> Articulatory
                    ataxia and scanning speech.
                  </li>
                </ul>
              </div>

              <div className="space-y-2 p-5 bg-slate-50/80 rounded-2xl border border-slate-100">
                <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-vitality-hover"></span>
                  Common Auditory Signs
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Speech patterns differ based on the underlying anatomical
                  subsystem affected:
                </p>
                <ul className="text-xs text-slate-600 space-y-1 list-disc pl-4 pt-1">
                  <li>
                    <strong>Slurred articulation:</strong> Consonants sound
                    muffled or imprecise.
                  </li>
                  <li>
                    <strong>Hypophonia:</strong> Abnormally quiet voice or
                    fadeout toward sentence ends.
                  </li>
                  <li>
                    <strong>Vocal strain / Breathiness:</strong>{" "}
                    Strained-strangled or airy vocal quality.
                  </li>
                  <li>
                    <strong>Rate festination:</strong> Rapid, rushing bursts of
                    words that blur together.
                  </li>
                  <li>
                    <strong>Hypernasality:</strong> Incomplete velopharyngeal
                    closure leaking air into the nose.
                  </li>
                </ul>
              </div>
            </div>

            {/* Differential Diagnosis Callout */}
            <div className="p-5 bg-sky-50/70 rounded-2xl border border-sky-100 flex items-start gap-3">
              <HelpCircle className="h-5 w-5 text-clinical-cyan shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="text-xs font-bold text-sky-950 uppercase tracking-wider">
                  Dysarthria vs. Aphasia vs. Apraxia
                </h4>
                <p className="text-xs text-sky-900 leading-relaxed">
                  <strong>Dysarthria:</strong> The patient knows the words, but
                  the speech muscles are weak or stiff. <br />
                  <strong>Aphasia:</strong> A language center impairment
                  (difficulty finding words or understanding grammar). <br />
                  <strong>Apraxia of Speech:</strong> A motor planning disorder
                  where the brain struggles to coordinate the sequence of
                  movements despite normal muscle strength.
                </p>
              </div>
            </div>

            {/* Hope and Rehabilitation Section */}
            <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h4 className="font-bold text-sm text-slate-900">
                  Can Speech Therapy Improve Communication?
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Yes. Targeted syllable pacing, loud vocal projection (LSVT
                  LOUD), and articulatory contrast drills substantially boost
                  intelligibility and quality of life.
                </p>
              </div>
              <Link
                href="/therapy"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-vitality text-[#14171A] font-bold text-xs hover:bg-vitality-hover transition-colors shrink-0"
              >
                <span>Try Rehabilitation Drills</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: 6 Practical Conversation Rules for Family & Caregivers (Illustrated) */}
      {activeTab === "caregiver-tips" && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-100 shadow-soft-md space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-clinical-cyan"></span>
                  <span className="text-xs font-bold uppercase tracking-wider text-clinical-cyan">
                    Clinical Best Practice Protocol (ASHA &amp; Freed, 2020)
                  </span>
                </div>
                <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mt-1">
                  6 Practical Conversation Rules for Family &amp; Caregivers
                </h3>
                <p className="text-xs text-slate-500 mt-1 max-w-2xl">
                  Visual guide to daily conversational strategies that minimize
                  communicative fatigue and empower your loved one at home.
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold shrink-0">
                <Sparkles className="h-3.5 w-3.5" />
                <span>Illustrated Family Guide</span>
              </span>
            </div>

            {/* 6 Illustrated Strategy Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {CAREGIVER_RULES.map((rule) => (
                <div
                  key={rule.number}
                  className="rounded-3xl bg-slate-50/80 border border-slate-200/70 overflow-hidden shadow-soft-sm hover:shadow-soft-md hover:border-clinical-cyan/40 transition-all flex flex-col group"
                >
                  {/* Illustration Banner */}
                  <div className="relative w-full aspect-[16/9] bg-slate-100 overflow-hidden border-b border-slate-200/60">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={rule.image}
                      alt={rule.title}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute top-3 left-3 flex items-center gap-2 bg-[#14171A]/90 backdrop-blur-md text-white px-3 py-1 rounded-full shadow-md">
                      <span className="h-5 w-5 rounded-full bg-vitality text-[#14171A] flex items-center justify-center text-xs font-black">
                        {rule.number}
                      </span>
                      <span className="text-[11px] font-bold tracking-wide">
                        Rule #{rule.number}
                      </span>
                    </div>
                  </div>

                  {/* Text Content */}
                  <div className="p-5 sm:p-6 space-y-2 flex-1 flex flex-col justify-between">
                    <div className="space-y-1.5">
                      <h4 className="font-extrabold text-base text-slate-900 group-hover:text-clinical-cyan transition-colors">
                        {rule.title}
                      </h4>
                      <p className="text-[11px] font-semibold text-clinical-cyan">
                        {rule.subtitle}
                      </p>
                      <p className="text-xs text-slate-600 leading-relaxed pt-1">
                        {rule.description}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Caregiver Reminder Alert */}
            <div className="p-4 bg-amber-50/70 rounded-2xl border border-amber-100 flex items-start gap-3 text-xs text-amber-950">
              <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Emotional Wellbeing Note: </span>
                Communication difficulties frequently lead to social withdrawal
                and frustration in neurological patients. Regular, unhurried,
                reassuring conversation with family members is the single
                strongest determinant of emotional resilience.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Find a Certified Speech-Language Pathologist (SLP) with Geolocation & Closest Center */}
      {activeTab === "find-slp" && (
        <div className="space-y-6">
          {/* Location Finder Banner */}
          <div className="bg-[#14171A] text-white rounded-3xl p-6 sm:p-8 shadow-soft-lg space-y-5 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-72 h-72 bg-clinical-cyan/15 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>

            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1.5 max-w-xl">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-vitality text-[11px] font-bold">
                  <Navigation className="h-3.5 w-3.5" />
                  <span>NEAREST CLINICAL CENTER LOCATOR</span>
                </div>
                <h2 className="text-xl sm:text-2xl font-black tracking-tight">
                  Find the Closest Speech-Language Pathology Center
                </h2>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Detect your current location via GPS (or choose your city) to
                  instantly calculate distances, get direct phone numbers, and
                  open turn-by-turn Google Maps directions.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={handleDetectLocation}
                  disabled={locating}
                  className="inline-flex items-center gap-2 bg-vitality hover:bg-vitality-hover text-[#14171A] px-5 py-3 rounded-full text-xs font-extrabold shadow-glow-vitality transition-all hover:scale-105 cursor-pointer disabled:opacity-60"
                >
                  {locating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Detecting GPS Location...</span>
                    </>
                  ) : (
                    <>
                      <Navigation className="h-4 w-4" />
                      <span>
                        {userCoords
                          ? "Update My Location"
                          : "Use My Current Location"}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Quick City Selector Pills (Fallback or Instant Selection) */}
            <div className="relative z-10 pt-3 border-t border-white/10 flex flex-wrap items-center gap-2">
              <span className="text-[11px] text-slate-400 font-semibold mr-1">
                Or select city:
              </span>
              {QUICK_CITY_COORDS.map((c) => {
                const isSelected = userCoords?.sourceLabel === c.label;
                return (
                  <button
                    key={c.label}
                    type="button"
                    onClick={() => {
                      setLocationError(null);
                      setUserCoords({
                        lat: c.lat,
                        lng: c.lng,
                        sourceLabel: c.label,
                      });
                    }}
                    className={`px-3 py-1 rounded-full text-[11px] font-bold transition-all cursor-pointer ${
                      isSelected
                        ? "bg-clinical-cyan text-white shadow-sm"
                        : "bg-white/10 hover:bg-white/20 text-slate-300"
                    }`}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>

            {locationError && (
              <div className="relative z-10 p-3 rounded-2xl bg-amber-500/20 border border-amber-400/40 text-amber-200 text-xs">
                {locationError}
              </div>
            )}

            {/* Highlighted Closest Center Result */}
            {closestCenter && (
              <div className="relative z-10 bg-white text-slate-900 rounded-2xl p-5 sm:p-6 border-2 border-vitality shadow-soft-md space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 rounded-full bg-emerald-600 text-white text-[11px] font-extrabold uppercase tracking-wider">
                      Closest Center to You ({closestCenter.distanceKm} km away)
                    </span>
                    <span className="text-xs text-slate-500 font-medium">
                      Based on: {userCoords?.sourceLabel}
                    </span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold text-[10px] uppercase border border-slate-200">
                    {closestCenter.badge}
                  </span>
                </div>

                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="space-y-1.5 max-w-2xl">
                    <h3 className="text-base sm:text-lg font-black text-slate-900">
                      {closestCenter.name}
                    </h3>
                    <p className="text-xs text-slate-600 flex items-center gap-1.5 font-medium">
                      <MapPin className="h-3.5 w-3.5 text-clinical-cyan shrink-0" />
                      <span>{closestCenter.address}</span>
                    </p>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      {closestCenter.description}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                    <a
                      href={`tel:${closestCenter.phone}`}
                      className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold transition-all"
                    >
                      <Phone className="h-3.5 w-3.5 text-emerald-600" />
                      <span>{closestCenter.phone}</span>
                    </a>

                    <a
                      href={closestCenter.googleMapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-clinical-cyan hover:bg-sky-600 text-white text-xs font-bold transition-all shadow-sm"
                    >
                      <Map className="h-3.5 w-3.5" />
                      <span>Google Maps</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>

                    <a
                      href={closestCenter.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-[#14171A] hover:bg-black text-white text-xs font-bold transition-all shadow-sm"
                    >
                      <span>Official Website</span>
                      <ExternalLink className="h-3 w-3 text-vitality" />
                    </a>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* All Verified SLP Centers & Directories List */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-100 shadow-soft-md space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-600">
                    Official Clinical Centers, Maps &amp; Direct Helplines
                  </span>
                </div>
                <h3 className="text-xl font-black text-slate-900 tracking-tight mt-1">
                  Verified Speech-Language Pathology Centers &amp; Registries
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  {userCoords
                    ? `Sorted by proximity to ${userCoords.sourceLabel}`
                    : "Includes direct telephone numbers, physical addresses, and Google Maps links."}
                </p>
              </div>

              {/* Search Filter */}
              <div className="w-full sm:w-64">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by city, hospital, or state..."
                  className="w-full text-xs px-3.5 py-2.5 rounded-full bg-slate-50 border border-slate-200 text-slate-800 focus:outline-none focus:ring-2 focus:ring-clinical-cyan focus:bg-white"
                />
              </div>
            </div>

            {/* List of Verified Centers */}
            <div className="space-y-4">
              {filteredSlpList.map((dir, index) => {
                const isClosest = userCoords && index === 0 && !searchQuery;
                return (
                  <div
                    key={dir.id}
                    className={`p-5 rounded-2xl border transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-4 group ${
                      isClosest
                        ? "bg-emerald-50/40 border-emerald-300 shadow-soft-sm"
                        : "bg-slate-50/70 border-slate-100 hover:border-slate-300"
                    }`}
                  >
                    <div className="space-y-2 max-w-2xl">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-full bg-white text-slate-700 font-bold text-[10px] uppercase border border-slate-200">
                          {dir.badge}
                        </span>
                        <span className="text-[11px] font-semibold text-clinical-cyan flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {dir.city} • {dir.coverage}
                        </span>
                        {dir.distanceKm !== null && (
                          <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-mono font-bold text-[11px]">
                            {dir.distanceKm} km away
                          </span>
                        )}
                      </div>

                      <h4 className="text-sm sm:text-base font-extrabold text-slate-900 group-hover:text-clinical-cyan transition-colors">
                        {dir.name}
                      </h4>

                      <p className="text-xs text-slate-600 leading-relaxed">
                        {dir.description}
                      </p>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-xs text-slate-600">
                        <span className="flex items-center gap-1 font-medium text-slate-700">
                          <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          {dir.address}
                        </span>
                        <a
                          href={`tel:${dir.phone}`}
                          className="inline-flex items-center gap-1 font-bold text-emerald-700 hover:underline"
                        >
                          <Phone className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                          <span>{dir.phone}</span>
                        </a>
                      </div>
                    </div>

                    {/* Action Links: Call, Google Maps, Portal */}
                    <div className="flex flex-wrap items-center gap-2 shrink-0 self-start lg:self-center">
                      <a
                        href={`tel:${dir.phone}`}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 border border-slate-200 text-xs font-bold transition-all"
                        title={`Call ${dir.name}`}
                      >
                        <Phone className="h-3.5 w-3.5 text-emerald-600" />
                        <span>Call Center</span>
                      </a>

                      <a
                        href={dir.googleMapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-white hover:bg-sky-50 text-slate-700 hover:text-clinical-cyan border border-slate-200 text-xs font-bold transition-all"
                        title="Open center location in Google Maps"
                      >
                        <Map className="h-3.5 w-3.5 text-clinical-cyan" />
                        <span>Google Maps</span>
                      </a>

                      <a
                        href={dir.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#14171A] hover:bg-black text-white text-xs font-bold transition-all hover:scale-105 shadow-soft-sm cursor-pointer"
                      >
                        <span>Website</span>
                        <ExternalLink className="h-3.5 w-3.5 text-vitality" />
                      </a>
                    </div>
                  </div>
                );
              })}

              {filteredSlpList.length === 0 && (
                <div className="text-center py-8 text-xs text-slate-500">
                  No center found matching &ldquo;{searchQuery}&rdquo;.
                </div>
              )}
            </div>

            {/* What to Expect at an SLP Assessment Card */}
            <div className="p-6 bg-slate-900 text-white rounded-2xl space-y-3">
              <h4 className="font-extrabold text-sm text-vitality flex items-center gap-2">
                <BookOpen className="h-4 w-4" />
                <span>What to Expect at Your In-Person SLP Evaluation</span>
              </h4>
              <p className="text-xs text-slate-300 leading-relaxed">
                When consulting a certified Speech-Language Pathologist, they
                will perform a comprehensive{" "}
                <strong>Motor Speech Examination (MSE)</strong>, including:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 text-xs text-slate-300">
                <div className="p-3 bg-white/5 rounded-xl border border-white/10">
                  <strong className="text-white block mb-1">
                    1. Oral Motor Exam
                  </strong>
                  Structural strength and range of motion of tongue, lips, and
                  soft palate.
                </div>
                <div className="p-3 bg-white/5 rounded-xl border border-white/10">
                  <strong className="text-white block mb-1">
                    2. Acoustic &amp; Aerodynamic
                  </strong>
                  Diadochokinetic rates (/pa-ta-ka/), maximum phonation time,
                  and vocal stability.
                </div>
                <div className="p-3 bg-white/5 rounded-xl border border-white/10">
                  <strong className="text-white block mb-1">
                    3. Personalized Plan
                  </strong>
                  Prescription of pacing strategies, respiratory support, and
                  augmentative tools.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
