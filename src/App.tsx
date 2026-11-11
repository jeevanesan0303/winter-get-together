
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
  type KeyboardEvent,
} from "react";

import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  Copy,
  FileCheck2,
  GraduationCap,
  Home,
  Hourglass,
  Languages,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  Snowflake,
  Sparkles,
  UploadCloud,
  UserRound,
  UsersRound,
} from "lucide-react";

import "./index.css";

// =====================================================
// BACKEND API CONFIGURATION
// =====================================================

// Local:
// http://127.0.0.1:8787
//
// Before final deployment, set VITE_API_URL in the
// frontend build environment to your actual API URL.
//
// Do not place API secrets in frontend environment values.

const API_BASE_URL = (
  import.meta.env.VITE_API_URL ||
  "http://127.0.0.1:8787"
).replace(/\/+$/, "");

const MAX_FILE_SIZE_MB = 20;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

// =====================================================
// EVENT CONFIGURATION - PRESERVED
// =====================================================

const EVENT = {
  title: "WINTER GET TOGETHER",
  tamil: "குளிர்கால ஒன்றுகூடல்",
  organizer1: "VALVAI WELFARE ASSOCIATION (UK)",
  organizer2: "VALVAI BLUES SPORTS CLUB (UK)",
  date: "13.12.2026",
  time: "From 5:00 PM TO 10:00 PM",
  venue:
    "St Boniface Social Club, 185 Mitcham Road, London SW17 9PG",
  closing: "Nov 30, 2026",
  registrationClosesAt: "2026-11-30T23:59:00Z",
  phone: "00447890185111",
  email: "",
};

const IMAGES = {
  logo1: "/images/logo-1.png",
  logo2: "/images/logo-2.png",
  background: "/images/winter-background.png",
};

// =====================================================
// TYPES
// =====================================================

type Page =
  | "home"
  | "about"
  | "contact"
  | "register"
  | "success";

type Step = 1 | 2 | 3;
type FormLanguage = "ta" | "en";

type PersonalInformation = {
  fullName: string;
  dob: string;
  gender: string;
  phone: string;
  email: string;
  address: string;
  agreed: boolean;
};

type QuestionDefinition = {
  id: string;
  tamilQuestion: string;
  englishQuestion: string;
  options: string[];
  positiveOptions: string[];
  uploadLabel: string;
};

type Answers = Record<string, string>;
type ProofFiles = Record<string, File | null>;

type StartRegistrationResponse = {
  success: boolean;
  registrationId: string;
  uploadToken: string;
  expiresAt: string;
  requiredDocuments: string[];
  message?: string;
};

type UploadDocumentResponse = {
  success: boolean;
  documentId: string;
  questionId: string;
  message?: string;
};

type CompleteRegistrationResponse = {
  success: boolean;
  registrationId: string;
  status: string;
  emailStatus: string;
  message?: string;
};

type ApiErrorResponse = {
  success?: boolean;
  message?: string;
};

type PendingSubmission = {
  fingerprint: string;
  registrationId: string;
  uploadToken: string;
  expiresAt: string;
  requiredDocuments: string[];
  uploadedDocuments: Set<string>;
};

type SubmitStage =
  | "idle"
  | "saving"
  | "uploading"
  | "finalizing";

// =====================================================
// UK PHONE CONFIGURATION
// =====================================================

const UK_DIAL_CODE = "+44";
const UK_PHONE_LENGTH = 10;
const UK_PHONE_PLACEHOLDER = "7700900000";

const EMPTY_PERSONAL: PersonalInformation = {
  fullName: "",
  dob: "",
  gender: "",
  phone: "",
  email: "",
  address: "",
  agreed: false,
};

// =====================================================
// BILINGUAL TEXT
// =====================================================

const FORM_TEXT = {
  ta: {
    language: "படிவ மொழி",
    pageTitle: "நிகழ்வுப் பதிவு",
    subtitle:
      "நிகழ்வில் கலந்துகொள்ள உங்கள் விவரங்களைப் பதிவு செய்யவும்",
    personalStep: "தனிப்பட்ட விவரங்கள்",
    achievementsStep: "சாதனைகள்",
    reviewStep: "சரிபார்ப்பு",
    personalTitle: "தனிப்பட்ட தகவல்கள்",
    achievementsTitle: "சாதனைகள் மற்றும் தகுதிகள்",
    reviewTitle: "பதிவு விவரங்களைச் சரிபார்க்கவும்",
    fullName: "விண்ணப்பதாரரின் முழுப் பெயர்",
    namePlaceholder:
      "விண்ணப்பதாரரின் முழுப் பெயரை உள்ளிடவும்",
    dob: "பிறந்த தேதி",
    dobHint:
      "எதிர்காலத் தேதிகளைத் தெரிவுசெய்ய முடியாது.",
    gender: "பாலினம்",
    selectGender: "பாலினத்தைத் தெரிவுசெய்யவும்",
    male: "ஆண்",
    female: "பெண்",
    phone: "தொடர்பு இலக்கம்",
    email: "மின்னஞ்சல் முகவரி",
    emailPlaceholder:
      "உங்கள் மின்னஞ்சல் முகவரியை உள்ளிடவும்",
    address: "முழு முகவரி",
    addressPlaceholder:
      "வீட்டு இலக்கம், வீதி, நகரம், அஞ்சல் குறியீடு, நாடு",
    country: "நாடு",
    previous: "முந்தையது",
    next: "அடுத்த படி",
    home: "முகப்பு",
    submit: "பதிவைச் சமர்ப்பிக்கவும்",
    submitting: "சமர்ப்பிக்கப்படுகிறது...",
    savingRegistration:
      "பதிவு விவரங்கள் சேமிக்கப்படுகின்றன...",
    uploadingDocuments:
      "சான்றிதழ்கள் பதிவேற்றப்படுகின்றன...",
    finalizingRegistration:
      "பதிவு உறுதிசெய்யப்படுகிறது...",
    clear: "நீக்கு",
    notSelected: "தெரிவுசெய்யப்படவில்லை",
    answer: "பதில்",
    upload: "சான்றிதழைப் பதிவேற்றவும்",
    uploadHint:
      "PDF, JPG அல்லது PNG — அதிகபட்சம் 20 MB",
    selectedFile: "தேர்ந்தெடுக்கப்பட்ட கோப்பு",
    reviewPersonal: "தனிப்பட்ட தகவல்கள்",
    reviewAchievements: "சாதனைகள் மற்றும் தகுதிகள்",
    confirmation:
      "நான் வழங்கிய தகவல்கள் சரியானவை என்றும் நிகழ்வுப் பதிவிற்காக அவற்றைப் பயன்படுத்த ஒப்புக்கொள்கிறேன் என்றும் உறுதிப்படுத்துகிறேன்.",
    introduction:
      "உங்களுக்குப் பொருந்தும் சாதனைகளை மட்டும் தெரிவுசெய்யவும். அனைத்துக் கேள்விகளுக்கும் பதிலளிக்க வேண்டிய அவசியமில்லை. சாதனையைத் தெரிவுசெய்தால் அதற்கான சான்றிதழை இணைக்கவும்.",
    invalidName:
      "விண்ணப்பதாரரின் முழுப் பெயரை உள்ளிடவும்.",
    invalidDob:
      "சரியான பிறந்த தேதியை உள்ளிடவும். எதிர்காலத் தேதி அனுமதிக்கப்படாது.",
    invalidGender: "பாலினத்தைத் தெரிவுசெய்யவும்.",
    invalidAddress:
      "உங்கள் முழு முகவரியை உள்ளிடவும்.",
    invalidPhone:
      "சரியான தொடர்பு இலக்கத்தை உள்ளிடவும்.",
    invalidEmail:
      "சரியான மின்னஞ்சல் முகவரியை உள்ளிடவும்.",
    missingProof:
      "தெரிவுசெய்த சாதனைக்கான சான்றிதழைப் பதிவேற்றவும்.",
    invalidFile:
      "PDF, JPG அல்லது PNG கோப்பை மட்டும் பதிவேற்றவும்.",
    fileSize:
      "கோப்பு அளவு 20 MB-ஐ விட அதிகமாக இருக்கக்கூடாது.",
    invalidAnswer:
      "தெரிவுசெய்த பதில் சரியானதல்ல.",
    confirmRequired:
      "விவரங்கள் சரியானவை என்பதை உறுதிப்படுத்தவும்.",
    saveFailed:
      "பதிவைச் சமர்ப்பிக்க முடியவில்லை. மீண்டும் முயற்சிக்கவும்.",
    networkError:
      "சேவையகத்துடன் இணைக்க முடியவில்லை. இணைய இணைப்பையும் உள்ளூர் backend சேவையையும் சரிபார்க்கவும்.",
    closed:
      "நிகழ்வுக்கான பதிவு முடிவடைந்துவிட்டது.",
    sessionExpired:
      "பதிவு அமர்வு காலாவதியாகிவிட்டது. மீண்டும் சமர்ப்பிக்கவும்.",
    success: "பதிவு வெற்றிகரமாக முடிந்தது!",
    thankYou:
      "Winter Get Together நிகழ்விற்கு பதிவு செய்ததற்கு நன்றி.",
    registrationId: "பதிவு இலக்கம்",
    copy: "பதிவு இலக்கத்தை நகலெடுக்கவும்",
    copied: "நகலெடுக்கப்பட்டது!",
    saveReference:
      "உங்கள் பதிவு இலக்கத்தைச் சேமித்து வைத்துக்கொள்ளவும்.",
    backHome: "முகப்பிற்குத் திரும்பவும்",
  },

  en: {
    language: "Form Language",
    pageTitle: "Event Registration",
    subtitle: "Complete your details to join the event",
    personalStep: "Personal Info",
    achievementsStep: "Achievements",
    reviewStep: "Review",
    personalTitle: "Personal Information",
    achievementsTitle: "Achievements & Qualifications",
    reviewTitle: "Review Registration",
    fullName: "Applicant Full Name",
    namePlaceholder: "Enter applicant full name",
    dob: "Date of Birth",
    dobHint: "Future dates are not allowed.",
    gender: "Gender",
    selectGender: "Select gender",
    male: "Male",
    female: "Female",
    phone: "Contact Number",
    email: "Email Address",
    emailPlaceholder: "Enter your email address",
    address: "Full Address",
    addressPlaceholder:
      "House number, street, city, postcode, country",
    country: "Country",
    previous: "Previous",
    next: "Next Step",
    home: "Home",
    submit: "Submit Registration",
    submitting: "Submitting...",
    savingRegistration: "Saving registration...",
    uploadingDocuments: "Uploading certificates...",
    finalizingRegistration: "Finalizing registration...",
    clear: "Clear",
    notSelected: "Not selected",
    answer: "Answer",
    upload: "Upload supporting proof",
    uploadHint:
      "PDF, JPG or PNG — Maximum 20 MB",
    selectedFile: "Selected file",
    reviewPersonal: "Personal Information",
    reviewAchievements: "Achievements & Qualifications",
    confirmation:
      "I confirm that the information provided is correct and agree to its use for event registration.",
    introduction:
      "Select only the achievements that apply to you. All questions are optional. If you select an achievement, you must upload the relevant supporting certificate.",
    invalidName:
      "Please enter the applicant full name.",
    invalidDob:
      "Enter a valid date of birth. Future dates are not allowed.",
    invalidGender: "Please select your gender.",
    invalidAddress:
      "Please enter your full address.",
    invalidPhone:
      "Please enter a valid contact number.",
    invalidEmail:
      "Please enter a valid email address.",
    missingProof:
      "Please upload a certificate for the selected achievement.",
    invalidFile:
      "Only PDF, JPG and PNG documents are allowed.",
    fileSize: "The maximum file size is 20 MB.",
    invalidAnswer:
      "An invalid answer was selected.",
    confirmRequired:
      "Please confirm that your details are correct.",
    saveFailed:
      "Unable to submit registration. Please try again.",
    networkError:
      "Cannot connect to the server. Check your connection and ensure the local backend is running.",
    closed: "Event registration has closed.",
    sessionExpired:
      "Your registration session expired. Please submit again.",
    success: "Registration Successful!",
    thankYou:
      "Thank you for registering for Winter Get Together.",
    registrationId: "Registration ID",
    copy: "Copy registration ID",
    copied: "Copied!",
    saveReference:
      "Please save your registration ID for future reference.",
    backHome: "Back to Home",
  },
} as const;

// =====================================================
// SEVEN ACHIEVEMENT QUESTIONS
// =====================================================

const QUESTIONS: QuestionDefinition[] = [
  {
    id: "tamil_exam",
    tamilQuestion:
      "தமிழ் மேம்பாட்டுப் பேரவையின் தமிழ்ப் பரீட்சையில் Excellent அல்லது Very Good பெற்றுள்ளீர்களா?",
    englishQuestion:
      "Have you achieved Excellent or Very Good in the Tamil examination conducted by the Tamil Development Council?",
    options: ["Excellent", "Very Good"],
    positiveOptions: ["Excellent", "Very Good"],
    uploadLabel: "Tamil Examination Certificate",
  },
  {
    id: "maths_competition",
    tamilQuestion:
      "சிதம்பரக் கணிதப் போட்டியில் A அல்லது A* தரத்தைப் பெற்றுள்ளீர்களா?",
    englishQuestion:
      "Have you achieved Grade A or A* in the Chithambara Mathematics Competition?",
    options: ["A", "A*"],
    positiveOptions: ["A", "A*"],
    uploadLabel: "Mathematics Competition Certificate",
  },
  {
    id: "grammar_school",
    tamilQuestion:
      "Grammar School தேர்வில் தேர்ச்சி பெற்றுள்ளீர்களா?",
    englishQuestion:
      "Have you passed the Grammar School entrance examination?",
    options: [
      "தேர்ச்சி பெற்றுள்ளேன்",
      "தேர்ச்சி பெறவில்லை",
    ],
    positiveOptions: ["தேர்ச்சி பெற்றுள்ளேன்"],
    uploadLabel: "Grammar School Result Proof",
  },
  {
    id: "gcse",
    tamilQuestion:
      "GCSE பரீட்சையில் குறைந்தபட்சம் 5A (New Grade 5 Seven) பெற்றுள்ளீர்களா?",
    englishQuestion:
      "Have you achieved at least five A grades (New Grade 5 Seven) in your GCSE examinations?",
    options: ["ஆம்", "இல்லை"],
    positiveOptions: ["ஆம்"],
    uploadLabel: "GCSE Certificate / Result Sheet",
  },
  {
    id: "gce_al",
    tamilQuestion:
      "GCE A/L பரீட்சையில் A, B பெறுபேறுகளைப் பெற்றுள்ளீர்களா?",
    englishQuestion:
      "Have you achieved Grade A or B in your GCE A-Level examinations?",
    options: ["A", "B"],
    positiveOptions: ["A", "B"],
    uploadLabel: "GCE A/L Result Sheet",
  },
  {
    id: "university_degree",
    tamilQuestion:
      "பல்கலைக்கழகத்தில் பட்டம் பெற்றுள்ளீர்களா?",
    englishQuestion:
      "Have you obtained a university degree?",
    options: ["ஆம்", "இல்லை"],
    positiveOptions: ["ஆம்"],
    uploadLabel: "University Degree Certificate",
  },
  {
    id: "other_achievements",
    tamilQuestion:
      "கலை, கலாசாரம் மற்றும் விளையாட்டுத் துறைகளில் சாதனைகள் அல்லது பரிசுகள் பெற்றுள்ளீர்களா?",
    englishQuestion:
      "Have you received any awards, prizes or achievements in arts, culture or sports?",
    options: ["ஆம்", "இல்லை"],
    positiveOptions: ["ஆம்"],
    uploadLabel: "Achievement / Award Certificate",
  },
];

// =====================================================
// FORM HELPERS
// =====================================================

function initialAnswers(): Answers {
  return Object.fromEntries(
    QUESTIONS.map((q) => [q.id, ""])
  );
}

function initialProofFiles(): ProofFiles {
  return Object.fromEntries(
    QUESTIONS.map((q) => [q.id, null])
  );
}

function needsProof(
  question: QuestionDefinition,
  answer: string
): boolean {
  return question.positiveOptions.includes(answer);
}

function optionLabel(
  option: string,
  language: FormLanguage
): string {
  if (language === "ta") return option;

  const translations: Record<string, string> = {
    ஆம்: "Yes",
    இல்லை: "No",
    "தேர்ச்சி பெற்றுள்ளேன்": "Passed",
    "தேர்ச்சி பெறவில்லை": "Not Passed",
  };

  return translations[option] ?? option;
}

function todayLocal(): string {
  const now = new Date();

  const adjusted = new Date(
    now.getTime() -
      now.getTimezoneOffset() * 60000
  );

  return adjusted.toISOString().slice(0, 10);
}

function validDOB(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value
    .split("-")
    .map(Number);

  const date = new Date(
    Date.UTC(year, month - 1, day)
  );

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day &&
    value <= todayLocal()
  );
}

function getNationalPhone(phone: string): string {
  return phone.startsWith(UK_DIAL_CODE)
    ? phone.slice(UK_DIAL_CODE.length)
    : "";
}

function validPhone(
  personal: PersonalInformation
): boolean {
  return /^\+44\d{10}$/.test(personal.phone);
}

function validProof(file: File): boolean {
  return (
    /\.(pdf|jpe?g|png)$/i.test(file.name) &&
    [
      "application/pdf",
      "image/jpeg",
      "image/png",
    ].includes(file.type) &&
    file.size > 0 &&
    file.size <= MAX_FILE_SIZE_BYTES
  );
}

// =====================================================
// API HELPERS
// =====================================================

class RegistrationApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "RegistrationApiError";
    this.status = status;
  }
}

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(
      `${API_BASE_URL}${endpoint}`,
      {
        ...options,
        cache: "no-store",
      }
    );
  } catch {
    throw new RegistrationApiError(
      "Unable to connect to the registration server.",
      0
    );
  }

  let result: ApiErrorResponse;

  try {
    result =
      (await response.json()) as ApiErrorResponse;
  } catch {
    throw new RegistrationApiError(
      `Unexpected server response (${response.status}).`,
      response.status
    );
  }

  if (!response.ok || result.success === false) {
    throw new RegistrationApiError(
      result.message ||
        `Registration request failed (${response.status}).`,
      response.status
    );
  }

  return result as T;
}

function getSubmissionFingerprint(
  personal: PersonalInformation,
  answers: Answers,
  files: ProofFiles,
  language: FormLanguage
): string {
  const fileDetails = QUESTIONS.map((q) => {
    const file = files[q.id];

    return {
      id: q.id,
      name: file?.name ?? null,
      size: file?.size ?? null,
      lastModified: file?.lastModified ?? null,
    };
  });

  return JSON.stringify({
    personal: {
      fullName: personal.fullName.trim(),
      dob: personal.dob,
      gender: personal.gender,
      phone: personal.phone,
      email: personal.email.trim().toLowerCase(),
      address: personal.address.trim(),
      agreed: personal.agreed,
    },
    language,
    answers,
    files: fileDetails,
  });
}

function getApiErrorMessage(
  error: unknown,
  language: FormLanguage
): string {
  const t = FORM_TEXT[language];

  if (error instanceof RegistrationApiError) {
    if (error.status === 0) {
      return t.networkError;
    }

    if (error.status === 403) {
      return t.closed;
    }

    return error.message;
  }

  if (error instanceof Error) {
    return error.message || t.saveFailed;
  }

  return t.saveFailed;
}

// =====================================================
// COUNTDOWN
// =====================================================

function getCountdown() {
  const remaining = Math.max(
    0,
    Date.parse(EVENT.registrationClosesAt) -
      Date.now()
  );

  return {
    remaining,
    days: Math.floor(remaining / 86400000),
    hours: Math.floor(
      (remaining / 3600000) % 24
    ),
    minutes: Math.floor(
      (remaining / 60000) % 60
    ),
    seconds: Math.floor(
      (remaining / 1000) % 60
    ),
  };
}

function RegistrationCountdown() {
  const [time, setTime] = useState(getCountdown);

  useEffect(() => {
    const timer = window.setInterval(
      () => setTime(getCountdown()),
      1000
    );

    return () => window.clearInterval(timer);
  }, []);

  if (time.remaining === 0) {
    return (
      <div className="event-countdown">
        <h3>Registration Has Closed</h3>
      </div>
    );
  }

  const units = [
    {
      label: "DAYS",
      value: time.days,
    },
    {
      label: "HOURS",
      value: time.hours,
    },
    {
      label: "MINS",
      value: time.minutes,
    },
    {
      label: "SECS",
      value: time.seconds,
    },
  ];

  return (
    <div
      className="event-countdown"
      aria-live="off"
    >
      <p className="countdown-heading">
        REGISTRATION ENDS IN
      </p>

      <div className="countdown-grid">
        {units.map((unit) => (
          <div
            className="countdown-box"
            key={unit.label}
          >
            <strong>
              {String(unit.value).padStart(2, "0")}
            </strong>
            <span>{unit.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// =====================================================
// WINTER BACKGROUND AND SNOW
// =====================================================

const SNOW_PARTICLES = Array.from(
  { length: 75 },
  (_, i) => ({
    id: i,
    left: (i * 47.37 + 13) % 100,
    size: 2 + ((i * 7) % 7),
    duration: 9 + ((i * 11) % 15),
    delay: -((i * 13.71) % 24),
    opacity: 0.22 + ((i * 3) % 7) / 12,
    drift: -35 + ((i * 17) % 95),
    blur: i % 7 === 0 ? 1.3 : 0,
  })
);

function FallingSnow({
  count = 75,
}: {
  count?: number;
}) {
  return (
    <div
      className="falling-snow"
      aria-hidden="true"
    >
      {SNOW_PARTICLES.slice(0, count).map(
        (p) => (
          <span
            key={p.id}
            className="falling-snow-particle"
            style={
              {
                "--snow-left": `${p.left}%`,
                "--snow-size": `${p.size}px`,
                "--snow-duration":
                  `${p.duration}s`,
                "--snow-delay": `${p.delay}s`,
                "--snow-opacity": p.opacity,
                "--snow-drift": `${p.drift}px`,
                "--snow-blur": `${p.blur}px`,
              } as CSSProperties
            }
          />
        )
      )}
    </div>
  );
}

function SnowDecorations() {
  return (
    <div
      className="snow-layer"
      aria-hidden="true"
    >
      {[1, 2, 3, 4, 5, 6].map((n) => (
        <Snowflake
          key={n}
          className={`snowflake snow-${n}`}
        />
      ))}
    </div>
  );
}

function WinterBackground({
  light = false,
}: {
  light?: boolean;
}) {
  return (
    <>
      <div
        className="winter-background"
        style={{
          backgroundImage:
            `url("${IMAGES.background}")`,
        }}
      />

      <div
        className={
          light
            ? "success-background-overlay"
            : "winter-overlay"
        }
      />

      <SnowDecorations />

      <FallingSnow
        count={light ? 45 : 75}
      />
    </>
  );
}

function WinterWave() {
  return (
    <svg
      className="winter-wave"
      viewBox="0 0 1600 140"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path
        fill="#a3c8ff"
        d="M0 22C240 10 400 110 760 94c300-13 460-90 840-49v95H0Z"
      />
      <path
        fill="#ffffff"
        d="M0 48C265 22 421 131 790 111c306-16 506-93 810-43v72H0Z"
      />
      <path
        fill="#1769d8"
        d="M0 94c285-52 457 49 799 23 341-26 555-38 801-20v43H0Z"
      />
      <path
        fill="#e9f4ff"
        d="M0 109c307-33 513 51 827 24 305-26 548-45 773-14v21H0Z"
      />
    </svg>
  );
}

// =====================================================
// HOME PAGE - DESIGN PRESERVED
// =====================================================

function OrganizationLogos() {
  return (
    <div className="organization-logos">
      <div className="logo-frame animated-logo">
        <img
          src={IMAGES.logo1}
          alt="Valvettithurai Welfare Association UK"
          className="organization-logo-img"
          draggable={false}
        />
      </div>

      <div className="logo-vertical-divider" />

      <div className="logo-frame animated-logo">
        <img
          src={IMAGES.logo2}
          alt="Valvai Blues Sports Club UK"
          className="organization-logo-img"
          draggable={false}
        />
      </div>
    </div>
  );
}

function EventInfoCard({
  icon,
  title,
  value,
  highlight = false,
}: {
  icon: ReactNode;
  title: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="event-info-item">
      <div className="event-info-icon">
        {icon}
      </div>

      <div className="event-info-text">
        <span>{title}</span>

        <strong
          className={
            highlight
              ? "highlight-value"
              : ""
          }
        >
          {value}
        </strong>
      </div>
    </div>
  );
}

function HomePage({
  onRegister,
}: {
  onRegister: () => void;
}) {
  return (
    <section className="winter-screen home-screen">
      <WinterBackground />

      <div className="home-layout">
        <div className="hero-top">
          <OrganizationLogos />

          <div className="organization-headings">
            <h2>{EVENT.organizer1}</h2>
            <h2>{EVENT.organizer2}</h2>
          </div>

          <div className="hero-heading-group">
            <h1 className="hero-main-title">
              {EVENT.title}
            </h1>

            <h3
              className="hero-tamil-title"
              lang="ta"
            >
              {EVENT.tamil}
            </h3>

            <div className="heading-ornament">
              <span />
              <span className="ornament-star">
                ✦
              </span>

              <Snowflake size={25} />

              <span className="ornament-star">
                ✦
              </span>
              <span />
            </div>

            <p className="hero-subtitle">
              Let&apos;s come together to
              celebrate our community and
              culture
            </p>
          </div>
        </div>

        {/* One countdown only */}
        <div className="home-countdown-placement">
          <RegistrationCountdown />
        </div>

        <div className="hero-bottom">
          <div className="event-info-bar">
            <EventInfoCard
              icon={<CalendarDays />}
              title="Event Date"
              value={EVENT.date}
            />

            <EventInfoCard
              icon={<Clock3 />}
              title="Event Time"
              value={EVENT.time}
            />

            <EventInfoCard
              icon={<MapPin />}
              title="Event Venue"
              value={EVENT.venue}
            />

            <EventInfoCard
              icon={<Hourglass />}
              title="Registration Closes"
              value={EVENT.closing}
              highlight
            />
          </div>

          <button
            type="button"
            className="hero-register-button"
            onClick={onRegister}
          >
            <span>Register Now</span>
            <ArrowRight size={25} />
          </button>
        </div>
      </div>

      <WinterWave />
    </section>
  );
}

function AboutPage() {
  return (
    <section className="winter-screen secondary-screen">
      <WinterBackground />

      <div className="info-page-content">
        <span className="section-kicker">
          <Sparkles size={15} />
          OUR COMMUNITY EVENT
        </span>

        <h1>About Winter Get Together</h1>
        <h2 lang="ta">{EVENT.tamil}</h2>

        <div className="information-glass-card">
          <UsersRound size={38} />

          <h3>
            Celebrating Community & Culture
          </h3>

          <p>
            Winter Get Together brings
            families, friends and members
            of our community together for
            a special celebration of
            connection, friendship and culture.
          </p>

          <div className="about-organizers">
            <span>{EVENT.organizer1}</span>
            <span>{EVENT.organizer2}</span>
          </div>
        </div>
      </div>

      <WinterWave />
    </section>
  );
}

function ContactPage() {
  return (
    <section className="winter-screen secondary-screen">
      <WinterBackground />

      <div className="info-page-content">
        <span className="section-kicker">
          GET IN TOUCH
        </span>

        <h1>Contact Us</h1>
        <h2 lang="ta">{EVENT.tamil}</h2>

        <div className="information-glass-card">
          <Mail size={38} />

          <h3>Event Enquiries</h3>

          <p>
            For event and registration
            enquiries, please contact the
            organizing associations.
          </p>

          <div className="contact-items">
            {EVENT.email && (
              <a href={`mailto:${EVENT.email}`}>
                <Mail size={19} />
                {EVENT.email}
              </a>
            )}

            {EVENT.phone && (
              <a href={`tel:${EVENT.phone}`}>
                <Phone size={19} />
                {EVENT.phone}
              </a>
            )}
          </div>
        </div>
      </div>

      <WinterWave />
    </section>
  );
}

// =====================================================
// LANGUAGE SELECTION POPUP - PRESERVED
// =====================================================

const LANGUAGE_POPUP_STYLES = `
.language-modal-overlay {
  position: fixed; inset: 0; z-index: 99999;
  display: flex; justify-content: center; align-items: center;
  padding: 20px; background: rgba(3, 13, 42, .76);
  backdrop-filter: blur(9px); -webkit-backdrop-filter: blur(9px);
}
.language-modal {
  width: min(100%, 420px); max-height: min(90dvh, 560px);
  overflow-y: auto; padding: 30px 26px; text-align: center;
  border: 1px solid rgba(210,224,255,.9); border-radius: 24px;
  background: linear-gradient(145deg, #fff, #eef4ff);
  box-shadow: 0 24px 80px rgba(0,9,45,.45);
  animation: language-pop .25s ease-out;
}
.language-modal-icon {
  width: 62px; height: 62px; margin: 0 auto 16px;
  display: grid; place-items: center; border-radius: 18px;
  background: #e8e4ff; color: #5b3cda;
}
.language-modal h2 {
  margin: 0 0 8px; color: #0b1c4a;
  font-size: 24px; line-height: 1.3;
}
.language-modal > p {
  margin: 0; color: #5b6a8b; line-height: 1.7;
}
.language-modal-options {
  display: grid;
  grid-template-columns: repeat(2,minmax(0,1fr));
  gap: 12px; margin: 25px 0 16px;
}
.language-modal-options button {
  min-width: 0; min-height: 115px; border-radius: 15px;
  border: 1px solid #d3ddf4; background: #fff; color: #19255a;
  display: flex; align-items: center; justify-content: center;
  flex-direction: column; gap: 7px; cursor: pointer;
  transition: transform .2s, box-shadow .2s, border-color .2s;
}
.language-modal-options button:hover {
  transform: translateY(-3px);
  border-color: #7961ed;
  box-shadow: 0 9px 26px rgba(81,55,180,.14);
}
.language-modal-options button:focus-visible {
  outline: 3px solid #6041da; outline-offset: 3px;
}
.language-option-title {
  font-size: 20px; font-weight: 800;
}
.language-option-subtitle {
  font-size: 12px; color: #637393;
}
.language-modal-note { font-size: 12px; }
@keyframes language-pop {
  from {
    opacity: 0;
    transform: translateY(14px) scale(.97);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
@media (max-width:700px) {
  .language-modal {
    padding: 24px 18px; border-radius: 20px;
  }
  .language-modal h2 { font-size: 21px; }
  .language-modal-options button { min-height: 105px; }
}
@media (prefers-reduced-motion:reduce) {
  .language-modal { animation: none; }
}
`;

function LanguageSelectionModal({
  onSelect,
}: {
  onSelect: (
    language: FormLanguage
  ) => void;
}) {
  const firstButtonRef =
    useRef<HTMLButtonElement>(null);

  const secondButtonRef =
    useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previousFocus =
      document.activeElement;

    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow =
      "hidden";

    firstButtonRef.current?.focus();

    return () => {
      document.body.style.overflow =
        previousOverflow;

      if (previousFocus instanceof HTMLElement) {
        previousFocus.focus();
      }
    };
  }, []);

  function handleModalKeyDown(
    event: KeyboardEvent<HTMLDivElement>
  ) {
    if (event.key !== "Tab") return;

    const first =
      firstButtonRef.current;

    const last =
      secondButtonRef.current;

    if (
      event.shiftKey &&
      document.activeElement === first
    ) {
      event.preventDefault();
      last?.focus();
    } else if (
      !event.shiftKey &&
      document.activeElement === last
    ) {
      event.preventDefault();
      first?.focus();
    }
  }

  return (
    <div className="language-modal-overlay">
      <div
        className="language-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="language-modal-title"
        aria-describedby="language-modal-description"
        onKeyDown={handleModalKeyDown}
      >
        <div className="language-modal-icon">
          <Languages size={30} />
        </div>

        <h2 id="language-modal-title">
          Choose Your Language
        </h2>

        <p
          id="language-modal-description"
          lang="ta"
        >
          படிவ மொழியைத் தெரிவுசெய்யவும்
        </p>

        <div className="language-modal-options">
          <button
            ref={firstButtonRef}
            type="button"
            onClick={() => onSelect("ta")}
          >
            <span
              className="language-option-title"
              lang="ta"
            >
              தமிழ்
            </span>

            <span className="language-option-subtitle">
              Tamil
            </span>

            <ArrowRight
              size={18}
              aria-hidden="true"
            />
          </button>

          <button
            ref={secondButtonRef}
            type="button"
            onClick={() => onSelect("en")}
          >
            <span className="language-option-title">
              English
            </span>

            <span className="language-option-subtitle">
              English Form
            </span>

            <ArrowRight
              size={18}
              aria-hidden="true"
            />
          </button>
        </div>

        <p className="language-modal-note">
          Select your preferred language
          to continue registration.
        </p>
      </div>
    </div>
  );
}

// =====================================================
// PROGRESS INDICATOR
// =====================================================

function StepProgress({
  step,
  language,
}: {
  step: Step;
  language: FormLanguage;
}) {
  const t = FORM_TEXT[language];

  const steps = [
    t.personalStep,
    t.achievementsStep,
    t.reviewStep,
  ];

  return (
    <div className="registration-progress">
      {steps.map((label, index) => {
        const number = index + 1;
        const completed = number < step;

        return (
          <div
            className="progress-group"
            key={number}
          >
            <div
              className={`progress-step ${
                number === step
                  ? "active"
                  : ""
              } ${
                completed
                  ? "completed"
                  : ""
              }`}
            >
              <div className="progress-circle">
                {completed ? (
                  <Check size={16} />
                ) : (
                  number
                )}
              </div>

              <span>{label}</span>
            </div>

            {index < 2 && (
              <div
                className={`progress-line ${
                  completed
                    ? "completed"
                    : ""
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function FormField({
  label,
  required = false,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="form-field">
      <label>
        {label}
        {required && (
          <span className="required">
            {" "}*
          </span>
        )}
      </label>

      {children}
    </div>
  );
}

function ReviewItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="review-item">
      <span>{label}</span>
      <strong>{value || "—"}</strong>
    </div>
  );
}

// =====================================================
// ACHIEVEMENT QUESTION
// =====================================================

function AchievementQuestion({
  number,
  question,
  answer,
  proof,
  language,
  onAnswer,
  onClear,
  onFileChange,
}: {
  number: number;
  question: QuestionDefinition;
  answer: string;
  proof: File | null;
  language: FormLanguage;
  onAnswer: (option: string) => void;
  onClear: () => void;
  onFileChange: (
    event: ChangeEvent<HTMLInputElement>
  ) => void;
}) {
  const t = FORM_TEXT[language];

  const proofRequired =
    needsProof(question, answer);

  return (
    <div className="achievement-question">
      <div className="achievement-question-title">
        <span className="achievement-number">
          {number}
        </span>

        <h4 lang={language}>
          {language === "ta"
            ? question.tamilQuestion
            : question.englishQuestion}
        </h4>
      </div>

      <div className="achievement-options">
        {question.options.map((option) => {
          const checked =
            answer === option;

          return (
            <label
              key={option}
              className={`achievement-option ${
                checked
                  ? "is-selected"
                  : ""
              }`}
            >
              <input
                type="radio"
                name={`achievement-${question.id}`}
                checked={checked}
                value={option}
                onChange={() =>
                  onAnswer(option)
                }
              />

              <span>
                {optionLabel(
                  option,
                  language
                )}
              </span>

              {checked && (
                <Check
                  size={16}
                  className="achievement-selected-check"
                />
              )}
            </label>
          );
        })}

        {answer && (
          <button
            type="button"
            className="achievement-clear-button"
            onClick={onClear}
          >
            {t.clear}
          </button>
        )}
      </div>

      {proofRequired && (
        <div className="achievement-proof">
          <div className="achievement-proof-heading">
            <FileCheck2 size={18} />

            <span>
              {language === "ta"
                ? `${question.uploadLabel} — சான்றிதழ்`
                : `Upload ${question.uploadLabel}`}
              <span className="required">
                {" "}*
              </span>
            </span>
          </div>

          <label className="file-upload">
            {proof ? (
              <FileCheck2 />
            ) : (
              <UploadCloud />
            )}

            <span>
              {proof?.name || t.upload}
            </span>

            <small>
              {t.uploadHint}
            </small>

            {proof && (
              <small>
                {(
                  proof.size / 1048576
                ).toFixed(2)} MB
              </small>
            )}

            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={onFileChange}
            />
          </label>
        </div>
      )}
    </div>
  );
}

// =====================================================
// REGISTRATION PAGE
// =====================================================

function RegistrationPage({
  onSuccess,
  onBackHome,
  language,
  onLanguageChange,
}: {
  onSuccess: (id: string) => void;
  onBackHome: () => void;
  language: FormLanguage;
  onLanguageChange: (
    value: FormLanguage
  ) => void;
}) {
  const t = FORM_TEXT[language];

  const [step, setStep] =
    useState<Step>(1);

  const [
    showLanguagePopup,
    setShowLanguagePopup,
  ] = useState(true);

  const [
    personal,
    setPersonal,
  ] = useState<PersonalInformation>(
    () => ({ ...EMPTY_PERSONAL })
  );

  const [answers, setAnswers] =
    useState<Answers>(initialAnswers);

  const [proofFiles, setProofFiles] =
    useState<ProofFiles>(
      initialProofFiles
    );

  const [error, setError] =
    useState("");

  const [
    submitting,
    setSubmitting,
  ] = useState(false);

  const [
    submitStage,
    setSubmitStage,
  ] = useState<SubmitStage>("idle");

  // Retained only while this registration form is mounted.
  // Never stored in localStorage.
  const pendingSubmissionRef =
    useRef<PendingSubmission | null>(null);

  // Blocks rapid repeated clicks before state has rendered.
  const submittingRef = useRef(false);

  const nationalPhone =
    getNationalPhone(personal.phone);

  function selectLanguage(
    next: FormLanguage
  ) {
    onLanguageChange(next);
    setShowLanguagePopup(false);
    setError("");
  }

  function updatePersonal<
    K extends keyof PersonalInformation
  >(
    field: K,
    value: PersonalInformation[K]
  ) {
    setPersonal((current) => ({
      ...current,
      [field]: value,
    }));

    setError("");
  }

  function changePhone(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const digits =
      event.target.value
        .replace(/\D/g, "")
        .slice(
          0,
          UK_PHONE_LENGTH
        );

    setPersonal((current) => ({
      ...current,
      phone: digits
        ? `${UK_DIAL_CODE}${digits}`
        : "",
    }));

    setError("");
  }

  function updateAnswer(
    q: QuestionDefinition,
    option: string
  ) {
    setAnswers((current) => ({
      ...current,
      [q.id]: option,
    }));

    setProofFiles((current) => ({
      ...current,
      [q.id]: null,
    }));

    setError("");
  }

  function clearAnswer(
    questionId: string
  ) {
    setAnswers((current) => ({
      ...current,
      [questionId]: "",
    }));

    setProofFiles((current) => ({
      ...current,
      [questionId]: null,
    }));

    setError("");
  }

  function handleProof(
    questionId: string,
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file =
      event.target.files?.[0] ?? null;

    if (!file) return;

    if (
      !/\.(pdf|jpe?g|png)$/i.test(file.name) ||
      ![
        "application/pdf",
        "image/jpeg",
        "image/png",
      ].includes(file.type)
    ) {
      setError(t.invalidFile);
      event.target.value = "";
      return;
    }

    if (
      file.size === 0 ||
      file.size > MAX_FILE_SIZE_BYTES
    ) {
      setError(t.fileSize);
      event.target.value = "";
      return;
    }

    setProofFiles((current) => ({
      ...current,
      [questionId]: file,
    }));

    setError("");
  }

  function validatePersonal(): string {
    if (
      personal.fullName.trim().length < 3 ||
      personal.fullName.trim().length > 150
    ) {
      return t.invalidName;
    }

    if (!validDOB(personal.dob)) {
      return t.invalidDob;
    }

    if (
      !["Male", "Female"].includes(
        personal.gender
      )
    ) {
      return t.invalidGender;
    }

    if (!validPhone(personal)) {
      return (
        `${t.invalidPhone} ` +
        `(${UK_DIAL_CODE}, ` +
        `${UK_PHONE_LENGTH} digits)`
      );
    }

    if (
      personal.email.trim().length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        personal.email.trim()
      )
    ) {
      return t.invalidEmail;
    }

    if (
      personal.address.trim().length < 8 ||
      personal.address.trim().length > 1000
    ) {
      return t.invalidAddress;
    }

    return "";
  }

  function validateAchievements(): string {
    // All questions are optional.
    // A positive answer requires a real file.

    for (const q of QUESTIONS) {
      const answer =
        answers[q.id] || "";

      if (!answer) continue;

      if (
        !q.options.includes(answer)
      ) {
        return t.invalidAnswer;
      }

      if (
        needsProof(q, answer)
      ) {
        const proof =
          proofFiles[q.id];

        if (!proof) {
          return (
            `${t.missingProof} ` +
            `(${q.id})`
          );
        }

        if (!validProof(proof)) {
          return t.invalidFile;
        }
      }
    }

    return "";
  }

  function scrollToTop() {
    const container =
      document.querySelector(
        ".registration-main-scroll"
      );

    if (
      container instanceof HTMLElement
    ) {
      container.scrollTo({
        top: 0,
        behavior: "instant",
      });
    }
  }

  function nextStep() {
    if (submittingRef.current) return;

    const problem =
      step === 1
        ? validatePersonal()
        : validateAchievements();

    if (problem) {
      setError(problem);
      return;
    }

    setError("");

    setStep(
      (current) =>
        Math.min(3, current + 1) as Step
    );

    scrollToTop();
  }

  function previousStep() {
    if (submittingRef.current) return;

    setError("");

    setStep(
      (current) =>
        Math.max(1, current - 1) as Step
    );

    scrollToTop();
  }

  // ===================================================
  // REAL BACKEND SUBMISSION
  // ===================================================

  async function submit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (
      submittingRef.current ||
      submitting
    ) {
      return;
    }

    const problem =
      validatePersonal() ||
      validateAchievements();

    if (problem) {
      setError(problem);
      return;
    }

    if (!personal.agreed) {
      setError(t.confirmRequired);
      return;
    }

    // Match the backend registration deadline.
    if (
      Date.now() >
      Date.parse(EVENT.registrationClosesAt)
    ) {
      setError(t.closed);
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    setSubmitStage("saving");
    setError("");

    try {
      const normalizedPersonal = {
        fullName: personal.fullName.trim(),
        dob: personal.dob,
        gender: personal.gender as
          "Male" | "Female",
        phone: personal.phone,
        email:
          personal.email
            .trim()
            .toLowerCase(),
        address: personal.address.trim(),
        agreed: true,
      };

      const normalizedAnswers: Answers =
        Object.fromEntries(
          QUESTIONS.map((q) => [
            q.id,
            answers[q.id] || "",
          ])
        );

      const fingerprint =
        getSubmissionFingerprint(
          personal,
          normalizedAnswers,
          proofFiles,
          language
        );

      let pending =
        pendingSubmissionRef.current;

      // Reuse a pending application after an upload error.
      // Only reuse it for exactly the same form data.
      if (
        !pending ||
        pending.fingerprint !== fingerprint ||
        Date.parse(pending.expiresAt) <= Date.now()
      ) {
        pending = null;
        pendingSubmissionRef.current = null;

        const start =
          await apiRequest<StartRegistrationResponse>(
            "/api/registrations/start",
            {
              method: "POST",
              headers: {
                "Content-Type":
                  "application/json",
              },
              body: JSON.stringify({
                personal: normalizedPersonal,
                language,
                answers: normalizedAnswers,
              }),
            }
          );

        if (
          !start.success ||
          !start.registrationId ||
          !start.uploadToken
        ) {
          throw new Error(t.saveFailed);
        }

        pending = {
          fingerprint,
          registrationId:
            start.registrationId,
          uploadToken:
            start.uploadToken,
          expiresAt:
            start.expiresAt,
          requiredDocuments:
            start.requiredDocuments,
          uploadedDocuments:
            new Set<string>(),
        };

        pendingSubmissionRef.current =
          pending;
      }

      // Each certificate is uploaded to private R2
      // through the existing backend API.
      for (
        const questionId of
        pending.requiredDocuments
      ) {
        if (
          pending.uploadedDocuments.has(
            questionId
          )
        ) {
          continue;
        }

        const file =
          proofFiles[questionId];

        if (!file) {
          throw new Error(
            `${t.missingProof} (${questionId})`
          );
        }

        if (!validProof(file)) {
          throw new Error(t.invalidFile);
        }

        setSubmitStage("uploading");

        const formData = new FormData();
        formData.append(
          "file",
          file,
          file.name
        );

        const upload =
          await apiRequest<UploadDocumentResponse>(
            `/api/registrations/${encodeURIComponent(
              pending.registrationId
            )}/documents/${encodeURIComponent(
              questionId
            )}`,
            {
              method: "POST",
              headers: {
                Authorization:
                  `Bearer ${pending.uploadToken}`,
              },
              body: formData,
            }
          );

        if (!upload.success) {
          throw new Error(
            upload.message ||
              t.saveFailed
          );
        }

        pending.uploadedDocuments.add(
          questionId
        );
      }

      // Complete registration ONLY after all
      // certificates have uploaded successfully.
      setSubmitStage("finalizing");

      const completed =
        await apiRequest<CompleteRegistrationResponse>(
          `/api/registrations/${encodeURIComponent(
            pending.registrationId
          )}/complete`,
          {
            method: "POST",
            headers: {
              Authorization:
                `Bearer ${pending.uploadToken}`,
            },
          }
        );

      if (
        !completed.success ||
        completed.status !== "submitted" ||
        !completed.registrationId
      ) {
        throw new Error(t.saveFailed);
      }

      // Successful ID comes from the server.
      // The frontend no longer generates registration IDs.
      pendingSubmissionRef.current = null;

      onSuccess(
        completed.registrationId
      );
    } catch (error) {
      // A pending application remains available
      // for retry if the same form is submitted again.
      // An expired token is discarded.
      if (
        error instanceof RegistrationApiError &&
        (error.status === 401 ||
          error.status === 409)
      ) {
        pendingSubmissionRef.current =
          null;
      }

      const message =
        getApiErrorMessage(
          error,
          language
        );

      setError(message);
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
      setSubmitStage("idle");
    }
  }

  function submitButtonLabel(): string {
    if (!submitting) {
      return t.submit;
    }

    if (
      submitStage === "saving"
    ) {
      return t.savingRegistration;
    }

    if (
      submitStage === "uploading"
    ) {
      return t.uploadingDocuments;
    }

    if (
      submitStage === "finalizing"
    ) {
      return t.finalizingRegistration;
    }

    return t.submitting;
  }

  return (
    <section
      className="winter-screen registration-screen"
      lang={language}
    >
      <div className="registration-top-banner">
        <Snowflake className="banner-snowflake" />
      </div>

      <div className="registration-main">
        <div className="registration-intro">
          <h1>
            Winter Get Together
          </h1>

          <h2 lang="ta">
            {EVENT.tamil}
          </h2>

          <div className="registration-heading-line" />

          <h3>{t.pageTitle}</h3>
          <p>{t.subtitle}</p>
        </div>

        <StepProgress
          step={step}
          language={language}
        />

        <form
          className="registration-form"
          onSubmit={submit}
          noValidate
          aria-busy={submitting}
        >
          <div className="registration-card">
            {/* ===================================
                STEP 1 - PERSONAL INFORMATION
            =================================== */}

            {step === 1 && (
              <>
                <div className="card-heading">
                  <UserRound />

                  <h3>
                    {t.personalTitle}
                  </h3>
                </div>

                <div className="fields-grid">
                  <FormField
                    label={t.fullName}
                    required
                  >
                    <input
                      type="text"
                      autoComplete="name"
                      placeholder={
                        t.namePlaceholder
                      }
                      value={
                        personal.fullName
                      }
                      onChange={(e) =>
                        updatePersonal(
                          "fullName",
                          e.target.value
                        )
                      }
                    />
                  </FormField>

                  <FormField
                    label={t.dob}
                    required
                  >
                    <input
                      type="date"
                      max={todayLocal()}
                      value={personal.dob}
                      onChange={(e) =>
                        updatePersonal(
                          "dob",
                          e.target.value <=
                            todayLocal()
                            ? e.target.value
                            : ""
                        )
                      }
                    />

                    <small className="field-help">
                      {t.dobHint}
                    </small>
                  </FormField>

                  <FormField
                    label={t.gender}
                    required
                  >
                    <div className="select-control">
                      <select
                        value={
                          personal.gender
                        }
                        onChange={(e) =>
                          updatePersonal(
                            "gender",
                            e.target.value
                          )
                        }
                      >
                        <option value="">
                          {t.selectGender}
                        </option>

                        <option value="Male">
                          {t.male}
                        </option>

                        <option value="Female">
                          {t.female}
                        </option>
                      </select>
                    </div>
                  </FormField>

                  <FormField
                    label={t.phone}
                    required
                  >
                    <div className="international-phone-wrapper">
                      <span
                        className="phone-country-select"
                        aria-label="United Kingdom calling code +44"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        🇬🇧 +44
                      </span>

                      <input
                        type="tel"
                        inputMode="numeric"
                        autoComplete="tel-national"
                        placeholder={
                          UK_PHONE_PLACEHOLDER
                        }
                        maxLength={
                          UK_PHONE_LENGTH
                        }
                        value={
                          nationalPhone
                        }
                        onChange={
                          changePhone
                        }
                        aria-label={t.phone}
                      />
                    </div>

                    <small className="uk-phone-hint">
                      {UK_DIAL_CODE}
                      {" — "}
                      {UK_PHONE_LENGTH}
                      {" "}
                      {language === "ta"
                        ? "இலக்கங்கள்"
                        : "digits"}
                    </small>
                  </FormField>

                  <div className="grid-full">
                    <FormField
                      label={t.email}
                      required
                    >
                      <input
                        type="email"
                        inputMode="email"
                        autoComplete="email"
                        maxLength={254}
                        placeholder={
                          t.emailPlaceholder
                        }
                        value={
                          personal.email
                        }
                        onChange={(e) =>
                          updatePersonal(
                            "email",
                            e.target.value
                          )
                        }
                        aria-label={t.email}
                      />
                    </FormField>
                  </div>

                  <div className="grid-full">
                    <FormField
                      label={t.address}
                      required
                    >
                      <textarea
                        rows={3}
                        autoComplete="street-address"
                        placeholder={
                          t.addressPlaceholder
                        }
                        value={
                          personal.address
                        }
                        onChange={(e) =>
                          updatePersonal(
                            "address",
                            e.target.value
                          )
                        }
                      />
                    </FormField>
                  </div>
                </div>
              </>
            )}

            {/* ===================================
                STEP 2 - ACHIEVEMENTS
            =================================== */}

            {step === 2 && (
              <>
                <div className="card-heading">
                  <GraduationCap />

                  <h3>
                    {t.achievementsTitle}
                  </h3>
                </div>

                <p className="achievement-introduction">
                  {t.introduction}
                </p>

                <div className="achievement-question-list">
                  {QUESTIONS.map(
                    (q, index) => (
                      <AchievementQuestion
                        key={q.id}
                        number={index + 1}
                        question={q}
                        language={language}
                        answer={
                          answers[q.id] ||
                          ""
                        }
                        proof={
                          proofFiles[q.id] ||
                          null
                        }
                        onAnswer={(option) =>
                          updateAnswer(
                            q,
                            option
                          )
                        }
                        onClear={() =>
                          clearAnswer(q.id)
                        }
                        onFileChange={(e) =>
                          handleProof(q.id, e)
                        }
                      />
                    )
                  )}
                </div>
              </>
            )}

            {/* ===================================
                STEP 3 - REVIEW
            =================================== */}

            {step === 3 && (
              <>
                <div className="card-heading">
                  <ShieldCheck />

                  <h3>
                    {t.reviewTitle}
                  </h3>
                </div>

                <div className="review-section">
                  <h4>
                    {t.reviewPersonal}
                  </h4>

                  <div className="review-grid">
                    <ReviewItem
                      label={t.fullName}
                      value={
                        personal.fullName
                      }
                    />

                    <ReviewItem
                      label={t.dob}
                      value={personal.dob}
                    />

                    <ReviewItem
                      label={t.gender}
                      value={
                        personal.gender ===
                        "Male"
                          ? t.male
                          : personal.gender ===
                              "Female"
                            ? t.female
                            : ""
                      }
                    />

                    <ReviewItem
                      label={t.phone}
                      value={
                        personal.phone
                      }
                    />

                    <ReviewItem
                      label={t.email}
                      value={
                        personal.email
                      }
                    />

                    <ReviewItem
                      label={t.address}
                      value={
                        personal.address
                      }
                    />
                  </div>
                </div>

                <div className="review-section">
                  <h4>
                    {t.reviewAchievements}
                  </h4>

                  <div className="achievement-review-list">
                    {QUESTIONS.map(
                      (q, index) => {
                        const answer =
                          answers[q.id] ||
                          "";

                        const file =
                          proofFiles[q.id];

                        return (
                          <div
                            key={q.id}
                            className="achievement-review-item"
                          >
                            <p lang={language}>
                              <strong>
                                {index + 1}.
                              </strong>
                              {" "}
                              {language ===
                              "ta"
                                ? q.tamilQuestion
                                : q.englishQuestion}
                            </p>

                            <div className="achievement-review-answer">
                              <span>
                                {t.answer}:
                              </span>

                              <strong>
                                {answer
                                  ? optionLabel(
                                      answer,
                                      language
                                    )
                                  : t.notSelected}
                              </strong>
                            </div>

                            {needsProof(
                              q,
                              answer
                            ) &&
                              file && (
                                <div className="achievement-review-proof">
                                  <FileCheck2
                                    size={16}
                                  />

                                  <span>
                                    {file.name}
                                  </span>

                                  <small>
                                    (
                                    {(
                                      file.size /
                                      1048576
                                    ).toFixed(2)}
                                    {" MB)"}
                                  </small>
                                </div>
                              )}
                          </div>
                        );
                      }
                    )}
                  </div>
                </div>

                <label className="confirmation">
                  <input
                    type="checkbox"
                    checked={
                      personal.agreed
                    }
                    onChange={(e) =>
                      updatePersonal(
                        "agreed",
                        e.target.checked
                      )
                    }
                  />

                  {t.confirmation}
                </label>
              </>
            )}

            {error && (
              <div
                className="form-error"
                role="alert"
              >
                {error}
              </div>
            )}
          </div>

          {/* ===================================
              NAVIGATION BUTTONS
          =================================== */}

          <div className="form-bottom-actions">
            {step > 1 ? (
              <button
                type="button"
                className="back-button"
                disabled={submitting}
                onClick={
                  previousStep
                }
              >
                <ArrowLeft size={17} />
                {t.previous}
              </button>
            ) : (
              <button
                type="button"
                className="back-button"
                disabled={submitting}
                onClick={
                  onBackHome
                }
              >
                <ArrowLeft size={17} />
                {t.home}
              </button>
            )}

            {step < 3 ? (
              <button
                type="button"
                className="form-next-button"
                disabled={submitting}
                onClick={
                  nextStep
                }
              >
                {t.next}
                <ArrowRight size={17} />
              </button>
            ) : (
              <button
                type="submit"
                className="form-next-button"
                disabled={submitting}
              >
                {submitButtonLabel()}
                <CheckCircle2 size={18} />
              </button>
            )}
          </div>
        </form>
      </div>

      <WinterWave />

      <style>
        {LANGUAGE_POPUP_STYLES}
      </style>

      {showLanguagePopup && (
        <LanguageSelectionModal
          onSelect={selectLanguage}
        />
      )}
    </section>
  );
}

// =====================================================
// SUCCESS PAGE - PRESERVED
// =====================================================

function SuccessPage({
  id,
  language,
  onHome,
}: {
  id: string;
  language: FormLanguage;
  onHome: () => void;
}) {
  const [copied, setCopied] =
    useState(false);

  const t = FORM_TEXT[language];

  async function copyId() {
    try {
      await navigator.clipboard.writeText(
        id
      );

      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section
      className="winter-screen success-screen"
      lang={language}
    >
      <WinterBackground light />

      <div className="success-container">
        <div className="success-icon-outer">
          <div className="success-icon">
            <Check
              size={56}
              strokeWidth={3.5}
            />
          </div>
        </div>

        <h1>
          {t.success}
        </h1>

        <p>
          {t.thankYou}
        </p>

        <div className="success-reference">
          <span>
            {t.registrationId}
          </span>

          <div>
            <strong>
              {id}
            </strong>

            <button
              type="button"
              onClick={copyId}
              aria-label={t.copy}
            >
              {copied ? (
                <Check size={20} />
              ) : (
                <Copy size={20} />
              )}
            </button>
          </div>

          {copied && (
            <small>
              {t.copied}
            </small>
          )}
        </div>

        <p className="reference-note">
          {t.saveReference}
        </p>

        <button
          type="button"
          className="success-home-button"
          onClick={onHome}
        >
          <Home
            size={18}
            fill="currentColor"
          />

          {t.backHome}
        </button>
      </div>

      <WinterWave />
    </section>
  );
}

// =====================================================
// MAIN APP - PRESERVED
// =====================================================

export default function App() {
  const [page, setPage] =
    useState<Page>("home");

  const [
    language,
    setLanguage,
  ] = useState<FormLanguage>("ta");

  const [
    registrationId,
    setRegistrationId,
  ] = useState("");

  const [
    formKey,
    setFormKey,
  ] = useState(0);

  function navigate(
    nextPage: Page
  ) {
    if (
      nextPage === "register" &&
      page !== "register"
    ) {
      setLanguage("ta");

      setFormKey(
        (current) => current + 1
      );
    }

    setPage(nextPage);
  }

  function handleSuccess(
    id: string
  ) {
    setRegistrationId(id);
    setPage("success");
  }

  return (
    <div className="app-shell">
      <main
        className={`app-main ${
          page === "register"
            ? "registration-main-scroll"
            : ""
        }`}
      >
        {page === "home" && (
          <HomePage
            onRegister={() =>
              navigate("register")
            }
          />
        )}

        {page === "about" && (
          <AboutPage />
        )}

        {page === "contact" && (
          <ContactPage />
        )}

        {page === "register" && (
          <RegistrationPage
            key={formKey}
            language={language}
            onLanguageChange={
              setLanguage
            }
            onSuccess={
              handleSuccess
            }
            onBackHome={() =>
              navigate("home")
            }
          />
        )}

        {page === "success" && (
          <SuccessPage
            id={registrationId}
            language={language}
            onHome={() =>
              navigate("home")
            }
          />
        )}
      </main>
    </div>
  );
}
