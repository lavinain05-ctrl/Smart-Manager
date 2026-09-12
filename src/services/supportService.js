import { doc, setDoc, onSnapshot, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase/firebase";

// ==========================================
// Default Templates & Initial Fallback Data
// ==========================================

export const DEFAULT_HELPDESK_CONFIG = {
  sectionTitle: "RWA Management & Helpdesk",
  tagline: "Need direct assistance? Get in touch with our office bearers or visit the society office.",
  officeTimingsWeekday: "Mon - Sat: 9:00 AM - 6:00 PM",
  officeTimingsWeekend: "Sunday: 10:00 AM - 2:00 PM",
  helplinePhone: "011-23456789",
  helplineNote: "Available 24/7 for urgent matters",
  officialEmail: "rwa.dblock@indraprastha.org",
  emailNote: "Responses within 24 hours",
  officeAddress: "Community Center, D Block, Indraprastha Society, Delhi",
};

export const DEFAULT_SUPPORT_FAQS = [
  // ─── GARBAGE COLLECTION ───
  {
    id: "gc-1",
    category: "garbage",
    question: "What is the Society Door-to-Door Garbage Collection service?",
    answer:
      "D Block RWA Indraprastha operates an organized, daily door-to-door waste collection service for all enrolled flats. Authorized RWA collectors visit your doorstep every morning to collect segregated household waste and transport it to the designated municipal disposal facility.",
    badge: "Garbage Service",
    tips: "Please keep wet and dry waste segregated in green and blue bins for eco-friendly society disposal.",
    actionLink: "/resident/garbage",
    actionText: "View Garbage Overview",
    active: true,
  },
  {
    id: "gc-2",
    category: "garbage",
    question: "What are the collection timings and schedule?",
    answer:
      "Doorstep collection takes place daily between 7:00 AM and 10:30 AM. Timely collection ensures our corridors and society blocks remain clean and hygienic.",
    badge: "Timings & Schedule",
    tips: "Ensure waste is placed outside your door before 7:30 AM so the collector does not miss your flat.",
    active: true,
  },
  {
    id: "gc-3",
    category: "garbage",
    question: "How do I enroll (Opt-In) in Door-to-Door Garbage Collection?",
    answer:
      "If your flat is currently not participating, you can send an Opt-In request to the admin with one click. Simply click the 'Send Request to Admin to Join GC' button on your Resident Dashboard or the Garbage Overview tab. The RWA Admin will review and activate your flat within 24 hours.",
    badge: "Enrollment",
    tips: "Once activated, you will be assigned a block collector and your monthly bills will appear under 'My Bills'.",
    actionLink: "/resident/garbage",
    actionText: "Go to Opt-In Form",
    active: true,
  },
  {
    id: "gc-4",
    category: "garbage",
    question: "Can I pause or Opt-Out of garbage collection if my flat is vacant or I am travelling?",
    answer:
      "Yes. If your flat is temporarily locked or you are travelling out of station, you can submit an 'Opt-Out / Pause' request from your Garbage Overview page. State the reason and expected duration. While paused or not enrolled, no garbage charges or pending dues will be levied on your flat.",
    badge: "Pause / Opt-Out",
    tips: "Please inform the RWA at least 3 days before the start of the billing month to avoid bill generation.",
    actionLink: "/resident/garbage",
    actionText: "Manage GC Status",
    active: true,
  },
  {
    id: "gc-5",
    category: "garbage",
    question: "What should I do if the collector misses collecting waste from my flat?",
    answer:
      "First, check your Garbage Overview tab to ensure your flat is marked 'Participating'. If active, you can call the assigned collector whose phone number is displayed on your Garbage tab, or file a quick ticket under 'Complaints' with category 'Garbage Collection'.",
    badge: "Support",
    tips: "Emergency helpline contacts are also available 24/7 on your Emergency directory page.",
    actionLink: "/resident/complaints",
    actionText: "Register a Complaint",
    active: true,
  },

  // ─── SPECIAL COLLECTIONS ───
  {
    id: "sc-1",
    category: "special",
    question: "What are Special Collections and why are they organized?",
    answer:
      "Special Collections are designated, community-driven fundraising drives organized by the RWA Executive Committee for specific society causes. Examples include Festival Celebrations (Diwali, Holi, Independence Day), Infrastructure Upgrades (CCTV security networks, boom barrier gates, LED streetlighting, park beautification), and Relief / Welfare Funds.",
    badge: "Contributions",
    tips: "Every campaign includes complete transparency with targets, collected amounts, and donor listings.",
    actionLink: "/resident/special-collections",
    actionText: "View Active Campaigns",
    active: true,
  },
  {
    id: "sc-2",
    category: "special",
    question: "How do I contribute to an active Special Collection campaign?",
    answer:
      "Contributing is simple and 100% digital:\n1. Go to 'Special Collections' in your portal sidebar.\n2. Choose any active campaign (e.g. Festival Drive or CCTV Upgrade).\n3. Click 'Contribute Now'.\n4. Enter your contribution amount (or choose a suggested tier).\n5. Pay using your preferred method: UPI / QR Code, Bank Transfer (NEFT/IMPS), or Cash.\n6. Enter your UPI Reference / UTR number and optionally upload a payment screenshot.\n7. Click 'Submit Contribution'.",
    badge: "How to Pay",
    tips: "Keep your 12-digit UTR / Reference number from Google Pay, PhonePe, or Paytm handy for quick verification.",
    actionLink: "/resident/special-collections",
    actionText: "Contribute Now",
    active: true,
  },
  {
    id: "sc-3",
    category: "special",
    question: "What happens after I submit my contribution?",
    answer:
      "Your contribution is submitted to the RWA Treasury with status 'Pending Verification'. The Finance Administrator verifies the bank credit or cash entry against your reference number. Once verified (usually within a few hours), the status changes to 'Verified' and an official digital RWA receipt is generated.",
    badge: "Verification",
    tips: "You will receive an in-app confirmation notification as soon as your contribution is verified.",
    active: true,
  },
  {
    id: "sc-4",
    category: "special",
    question: "Where can I download my Special Collection contribution receipts?",
    answer:
      "Go to 'Special Collections' → click the campaign → 'My Contributions' or check the 'Receipts' section. You will see your verified contribution with a 'Download Receipt' button. Receipts include society letterhead, unique receipt number, donor details, and QR verification.",
    badge: "Receipts",
    tips: "All digital receipts are permanently stored in your portal archive and can be downloaded anytime.",
    actionLink: "/resident/special-collections",
    actionText: "View My Contributions",
    active: true,
  },
  {
    id: "sc-5",
    category: "special",
    question: "Can non-residents, relatives, or external donors contribute?",
    answer:
      "Yes! Campaigns configured as 'Public Open' have a public donation page with a shareable link and society QR code. Non-residents can contribute directly through UPI without logging in, and their receipt is generated upon verification.",
    badge: "Public Access",
    tips: "You can copy and share the public contribution link with friends and well-wishers via WhatsApp.",
    active: true,
  },

  // ─── BILLING & RECEIPTS ───
  {
    id: "bill-1",
    category: "billing",
    question: "How and when are monthly bills generated?",
    answer:
      "Monthly garbage and maintenance bills are generated on the 1st of every month for all enrolled, participating flats. The standard due date is the 10th of each month. You can review all current and past bills in the 'My Bills' section.",
    badge: "Monthly Bills",
    tips: "Paying before the 10th ensures uninterrupted doorstep collection service.",
    actionLink: "/resident/bills",
    actionText: "Check My Bills",
    active: true,
  },
  {
    id: "bill-2",
    category: "billing",
    question: "Can I pay for multiple months in advance?",
    answer:
      "Yes! Many residents choose to pay 3, 6, or 12 months in advance to avoid monthly follow-ups. When you pay in advance to the RWA Collector or Admin, a consolidated receipt covering all months is issued immediately, and your future bills are marked 'Paid (Advance)'.",
    badge: "Advance Payment",
    tips: "Advance payment receipts clearly state the start and end month covered.",
    active: true,
  },
  {
    id: "bill-3",
    category: "billing",
    question: "How do I verify if my payment was properly recorded?",
    answer:
      "Every payment generates an official RWA receipt number (e.g. REC-178...). Check 'Garbage Module → Payment History' or 'Receipts' in your sidebar. If your payment does not reflect within 24 hours, contact the collector or RWA Office with your payment screenshot.",
    badge: "Payment Records",
    actionLink: "/resident/payments",
    actionText: "View Payment History",
    active: true,
  },

  // ─── COMPLAINTS & MAINTENANCE ───
  {
    id: "comp-1",
    category: "complaints",
    question: "How do I register a complaint or service request?",
    answer:
      "Go to 'Complaints' in your sidebar and click 'New Complaint'. Select the relevant category (Garbage Collection, Water Supply, Electricity, Streetlight, Security, Lift, or General Maintenance), enter the description, and submit. An official tracking ticket will be assigned to society staff.",
    badge: "Tickets",
    tips: "You can track the resolution progress in real-time: Open → In Progress → Resolved.",
    actionLink: "/resident/complaints",
    actionText: "Open Complaint Ticket",
    active: true,
  },
  {
    id: "comp-2",
    category: "complaints",
    question: "How long does it take for a complaint to be resolved?",
    answer:
      "Urgent issues (water supply, electrical faults, security) are attended to within 2 to 6 hours. Routine maintenance and cleaning complaints are typically resolved within 24 to 48 hours. You will receive updates directly on your portal dashboard.",
    badge: "SLA & Timelines",
    active: true,
  },

  // ─── SOCIETY & CONTACTS ───
  {
    id: "soc-1",
    category: "society",
    question: "Who are the current RWA Committee members and how do I contact them?",
    answer:
      "You can view the full list of elected Executive Committee members (President, Vice President, General Secretary, Joint Secretary, Treasurer, and Executive Members) with their official contact numbers under 'RWA Committee' in the sidebar.",
    badge: "Executive Body",
    actionLink: "/resident/committee",
    actionText: "View RWA Committee",
    active: true,
  },
  {
    id: "soc-2",
    category: "society",
    question: "How do I update my registered mobile number or resident details?",
    answer:
      "Visit 'Account → Profile' from the sidebar. Click 'Request Profile Update', select the field you need to change (e.g. Mobile Number, Email, Owner Name), enter your new detail, and submit for admin approval. Once approved by the RWA Admin, your login and records will update instantly.",
    badge: "Profile",
    actionLink: "/resident/profile",
    actionText: "Go to Profile",
    active: true,
  },
  {
    id: "soc-3",
    category: "society",
    question: "What numbers should I dial during an emergency?",
    answer:
      "Check the 'Emergency' page in your portal for immediate one-tap calling to: Society Main Gate Security, Night Patrol Guard, Local Police Station, Nearest Fire Station, and Ambulance Service.",
    badge: "24/7 Helpline",
    actionLink: "/resident/emergency",
    actionText: "Emergency Numbers",
    active: true,
  },
];

// Document references
const helpdeskDocRef = doc(db, "settings", "helpdesk");
const faqsDocRef = doc(db, "settings", "support_faqs");

// ==========================================
// 1. Helpdesk Info Listeners & Updaters
// ==========================================

export function subscribeSupportConfig(callback) {
  return onSnapshot(
    helpdeskDocRef,
    (snapshot) => {
      if (snapshot.exists()) {
        callback({ ...DEFAULT_HELPDESK_CONFIG, ...snapshot.data() });
      } else {
        callback(DEFAULT_HELPDESK_CONFIG);
      }
    },
    (err) => {
      console.error("[Firestore] Helpdesk config subscription error:", err.message);
      callback(DEFAULT_HELPDESK_CONFIG);
    }
  );
}

export async function saveSupportConfig(config) {
  return await setDoc(
    helpdeskDocRef,
    {
      ...config,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function resetSupportConfig() {
  return await setDoc(helpdeskDocRef, {
    ...DEFAULT_HELPDESK_CONFIG,
    updatedAt: serverTimestamp(),
  });
}

// ==========================================
// 2. Support FAQs Listeners & Updaters
// ==========================================

export function subscribeSupportFaqs(callback) {
  return onSnapshot(
    faqsDocRef,
    (snapshot) => {
      if (snapshot.exists() && Array.isArray(snapshot.data().faqs)) {
        callback(snapshot.data().faqs);
      } else {
        callback(DEFAULT_SUPPORT_FAQS);
      }
    },
    (err) => {
      console.error("[Firestore] FAQs subscription error:", err.message);
      callback(DEFAULT_SUPPORT_FAQS);
    }
  );
}

export async function saveSupportFaqs(faqsList) {
  return await setDoc(faqsDocRef, {
    faqs: faqsList,
    updatedAt: serverTimestamp(),
  });
}

export async function resetSupportFaqs() {
  return await setDoc(faqsDocRef, {
    faqs: DEFAULT_SUPPORT_FAQS,
    updatedAt: serverTimestamp(),
  });
}
