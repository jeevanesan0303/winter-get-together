
import {
  useEffect,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
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
// EVENT CONFIGURATION
// =====================================================

const EVENT = {
  title: "WINTER GET TOGETHER",
  tamil: "குளிர்கால ஒன்றுகூடல்",
  organizer1: "VALVAI WELFARE ASSOCIATION (UK)",
  organizer2: "VALVAI BLUES SPORTS CLUB (UK)",
  date: "13.12.2026",
  time: "From 5:00 PM TO 10:00 PM",
  venue:
    "Lennox Community Centre, Hayling Road, Croydon, Surrey, CR0 6UA",
  closing: "Nov 30, 2026",
  email: "",
  phone: "00447890185111",
  startsAt: "2026-12-13T17:00:00Z",
};

const IMAGES = {
  logo1: "/images/logo-1.png",
  logo2: "/images/logo-2.png",
  background: "/images/winter-background.png",
};

const STORAGE_KEY = "winter_event_registrations_v2";

const MAX_FILE_SIZE_MB = 20;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

const ALLOWED_FILE_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
];

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

type PersonalInformation = {
  fullName: string;
  dob: string;
  gender: string;
  phone: string;
  address: string;
  agreed: boolean;
};

type QuestionDefinition = {
  id: string;
  question: string;
  options: string[];
  positiveOptions: string[];
  uploadLabel: string;
  required: boolean;
};

type Answers = Record<string, string[]>;
type ProofFiles = Record<string, File | null>;

type SavedRegistration = {
  id: string;
  createdAt: string;
  event: string;
  personal: PersonalInformation;
  answers: Answers;
  documents: Record<string, string | null>;
};

type SnowParticle = {
  id: number;
  left: number;
  size: number;
  duration: number;
  delay: number;
  opacity: number;
  drift: number;
  blur: number;
};

const EMPTY_PERSONAL: PersonalInformation = {
  fullName: "",
  dob: "",
  gender: "",
  phone: "+44",
  address: "",
  agreed: false,
};

// =====================================================
// ACHIEVEMENT QUESTIONS
// ALL QUESTIONS ALLOW ONLY ONE ANSWER
// =====================================================

const QUESTIONS: QuestionDefinition[] = [
  {
    id: "tamil_exam",
    question:
      "தமிழ் மேம்பாட்டுப் பேரவையின் தமிழ்ப் பரீட்சையில் Excellent அல்லது Very Good பெற்றுள்ளீர்களா?",
    options: ["Excellent", "Very Good"],
    positiveOptions: ["Excellent", "Very Good"],
    uploadLabel: "Upload Tamil Examination Certificate",
    required: false,
  },
  {
    id: "maths_competition",
    question:
      "சிதம்பரக் கணிதப் போட்டியில் A அல்லது A* தரத்தைப் பெற்றுள்ளீர்களா?",
    options: ["A", "A*"],
    positiveOptions: ["A", "A*"],
    uploadLabel: "Upload Mathematics Competition Certificate",
    required: false,
  },
  {
    id: "grammar_school",
    question:
      "Grammar School தேர்வில் தேர்ச்சி பெற்றுள்ளீர்களா?",
    options: [
      "தேர்ச்சி பெற்றுள்ளேன்",
      "தேர்ச்சி பெறவில்லை",
    ],
    positiveOptions: ["தேர்ச்சி பெற்றுள்ளேன்"],
    uploadLabel: "Upload Grammar School Result Proof",
    required: true,
  },
  {
    id: "gcse",
    question:
      "GCSE பரீட்சையில் குறைந்தபட்சம் 5A (New Grade 5 Seven) பெற்றுள்ளீர்களா?",
    options: ["ஆம்", "இல்லை"],
    positiveOptions: ["ஆம்"],
    uploadLabel: "Upload GCSE Certificate / Result Sheet",
    required: true,
  },
  {
    id: "gce_al",
    question:
      "GCE A/L பரீட்சையில் A, B பெறுபேறுகளைப் பெற்றுள்ளீர்களா?",
    options: ["A", "B"],
    positiveOptions: ["A", "B"],
    uploadLabel: "Upload GCE A/L Result Sheet",
    required: false,
  },
  {
    id: "university_degree",
    question:
      "பல்கலைக்கழகத்தில் பட்டம் பெற்றுள்ளீர்களா?",
    options: ["ஆம்", "இல்லை"],
    positiveOptions: ["ஆம்"],
    uploadLabel: "Upload University Degree Certificate",
    required: true,
  },
  {
    id: "other_achievements",
    question:
      "கலை, கலாசாரம் மற்றும் விளையாட்டுத் துறைகளில் சாதனைகள் அல்லது பரிசுகள் பெற்றுள்ளீர்களா?",
    options: ["ஆம்", "இல்லை"],
    positiveOptions: ["ஆம்"],
    uploadLabel: "Upload Achievement / Award Certificate",
    required: true,
  },
];

// =====================================================
// HELPERS
// =====================================================

function initialAnswers(): Answers {
  return Object.fromEntries(
    QUESTIONS.map((question) => [question.id, []])
  );
}

function initialProofFiles(): ProofFiles {
  return Object.fromEntries(
    QUESTIONS.map((question) => [question.id, null])
  );
}

function requiresProof(
  question: QuestionDefinition,
  selected: string[]
): boolean {
  return selected.some((option) =>
    question.positiveOptions.includes(option)
  );
}

function generateId(): string {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8).toUpperCase()
      : Math.random().toString(36).slice(2, 10).toUpperCase();

  return `REG-${new Date().getFullYear()}-${random}`;
}

function getToday(): string {
  const now = new Date();

  const local = new Date(
    now.getTime() - now.getTimezoneOffset() * 60000
  );

  return local.toISOString().slice(0, 10);
}

function getCountdown() {
  const difference = Math.max(
    0,
    new Date(EVENT.startsAt).getTime() - Date.now()
  );

  return {
    days: Math.floor(difference / 86400000),
    hours: Math.floor((difference / 3600000) % 24),
    minutes: Math.floor((difference / 60000) % 60),
    seconds: Math.floor((difference / 1000) % 60),
  };
}

function isValidProofFile(file: File): boolean {
  const validExtension = /\.(pdf|jpe?g|png)$/i.test(file.name);

  return (
    validExtension &&
    ALLOWED_FILE_TYPES.includes(file.type) &&
    file.size > 0 &&
    file.size <= MAX_FILE_SIZE_BYTES
  );
}

// =====================================================
// EVENT COUNTDOWN
// =====================================================

function EventCountdown() {
  const [time, setTime] = useState(getCountdown);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setTime(getCountdown());
    }, 1000);

    return () => window.clearInterval(interval);
  }, []);

  const completed =
    time.days === 0 &&
    time.hours === 0 &&
    time.minutes === 0 &&
    time.seconds === 0;

  return (
    <div className="event-countdown">
      {completed ? (
        <h3>The Celebration Has Begun!</h3>
      ) : (
        <>
          <p className="countdown-heading">
            THE CELEBRATION BEGINS IN
          </p>

          <div className="countdown-grid">
            {[
              { label: "DAYS", value: time.days },
              { label: "HOURS", value: time.hours },
              { label: "MINS", value: time.minutes },
              { label: "SECS", value: time.seconds },
            ].map((item) => (
              <div className="countdown-box" key={item.label}>
                <strong>
                  {String(item.value).padStart(2, "0")}
                </strong>
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// =====================================================
// SNOW ANIMATION
// =====================================================

const SNOW_PARTICLES: SnowParticle[] = Array.from(
  { length: 75 },
  (_, index) => ({
    id: index,
    left: (index * 47.37 + 13) % 100,
    size: 2 + ((index * 7) % 7),
    duration: 9 + ((index * 11) % 15),
    delay: -((index * 13.71) % 24),
    opacity: 0.22 + ((index * 3) % 7) / 12,
    drift: -35 + ((index * 17) % 95),
    blur: index % 7 === 0 ? 1.3 : 0,
  })
);

function FallingSnow({ count = 75 }: { count?: number }) {
  return (
    <div className="falling-snow" aria-hidden="true">
      {SNOW_PARTICLES.slice(0, count).map((particle) => {
        const style = {
          "--snow-left": `${particle.left}%`,
          "--snow-size": `${particle.size}px`,
          "--snow-duration": `${particle.duration}s`,
          "--snow-delay": `${particle.delay}s`,
          "--snow-opacity": particle.opacity,
          "--snow-drift": `${particle.drift}px`,
          "--snow-blur": `${particle.blur}px`,
        } as CSSProperties;

        return (
          <span
            key={particle.id}
            className="falling-snow-particle"
            style={style}
          />
        );
      })}
    </div>
  );
}

function SnowDecorations() {
  return (
    <div className="snow-layer" aria-hidden="true">
      <Snowflake className="snowflake snow-1" />
      <Snowflake className="snowflake snow-2" />
      <Snowflake className="snowflake snow-3" />
      <Snowflake className="snowflake snow-4" />
      <Snowflake className="snowflake snow-5" />
      <Snowflake className="snowflake snow-6" />
    </div>
  );
}

function WinterBackground({ light = false }: { light?: boolean }) {
  return (
    <>
      <div
        className="winter-background"
        style={{
          backgroundImage: `url("${IMAGES.background}")`,
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
      <FallingSnow count={light ? 45 : 75} />
    </>
  );
}

// =====================================================
// WINTER WAVE
// =====================================================

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
// TWO ORIGINAL ORGANIZATION LOGOS
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

// =====================================================
// EVENT INFORMATION CARD
// =====================================================

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
      <div className="event-info-icon">{icon}</div>

      <div className="event-info-text">
        <span>{title}</span>
        <strong className={highlight ? "highlight-value" : ""}>
          {value}
        </strong>
      </div>
    </div>
  );
}

// =====================================================
// HOME PAGE
// =====================================================

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

            <h3 className="hero-tamil-title" lang="ta">
              {EVENT.tamil}
            </h3>

            <div className="heading-ornament">
              <span />
              <span className="ornament-star">✦</span>
              <Snowflake size={25} />
              <span className="ornament-star">✦</span>
              <span />
            </div>

            <p className="hero-subtitle">
              Let&apos;s come together to celebrate our
              community and culture
            </p>
          </div>
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

          <EventCountdown />
        </div>
      </div>

      <WinterWave />
    </section>
  );
}

// =====================================================
// ABOUT PAGE
// =====================================================

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
          <h3>Celebrating Community & Culture</h3>

          <p>
            Winter Get Together brings families, friends
            and members of our community together for a
            special celebration of connection, friendship
            and culture.
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

// =====================================================
// CONTACT PAGE
// =====================================================

function ContactPage() {
  return (
    <section className="winter-screen secondary-screen">
      <WinterBackground />

      <div className="info-page-content">
        <span className="section-kicker">GET IN TOUCH</span>

        <h1>Contact Us</h1>
        <h2 lang="ta">{EVENT.tamil}</h2>

        <div className="information-glass-card">
          <Mail size={38} />
          <h3>Event Enquiries</h3>

          <p>
            For event and registration enquiries, please
            contact the organizing associations.
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
// PROGRESS STEPS
// =====================================================

function StepProgress({ step }: { step: Step }) {
  const steps = [
    "Personal Info",
    "Achievements",
    "Review",
  ];

  return (
    <div className="registration-progress">
      {steps.map((label, index) => {
        const number = index + 1;
        const active = number === step;
        const completed = number < step;

        return (
          <div className="progress-group" key={number}>
            <div
              className={`progress-step ${
                active ? "active" : ""
              } ${completed ? "completed" : ""}`}
            >
              <div className="progress-circle">
                {completed ? <Check size={16} /> : number}
              </div>
              <span>{label}</span>
            </div>

            {index < 2 && (
              <div
                className={`progress-line ${
                  completed ? "completed" : ""
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// =====================================================
// FORM FIELD
// =====================================================

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
        {required && <span className="required"> *</span>}
      </label>

      {children}
    </div>
  );
}

// =====================================================
// REVIEW FIELD
// =====================================================

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
      <strong>{value || "Not provided"}</strong>
    </div>
  );
}

// =====================================================
// ACHIEVEMENT QUESTION
// SINGLE ANSWER ONLY
// =====================================================

function AchievementQuestion({
  number,
  question,
  selected,
  proof,
  onSelectionChange,
  onFileChange,
}: {
  number: number;
  question: QuestionDefinition;
  selected: string[];
  proof: File | null;
  onSelectionChange: (option: string) => void;
  onFileChange: (
    event: ChangeEvent<HTMLInputElement>
  ) => void;
}) {
  const uploadRequired = requiresProof(question, selected);

  return (
    <div className="achievement-question">
      <div className="achievement-question-title">
        <span className="achievement-number">{number}</span>

        <h4 lang="ta">
          {question.question}
          {question.required && (
            <span className="required"> *</span>
          )}
        </h4>
      </div>

      <div className="achievement-options">
        {question.options.map((option) => {
          const checked = selected.includes(option);

          return (
            <label
              key={option}
              className={`achievement-option ${
                checked ? "is-selected" : ""
              }`}
            >
              <input
                type="radio"
                name={question.id}
                value={option}
                checked={checked}
                onClick={() => {
                  if (checked && !question.required) {
                    onSelectionChange(option);
                  }
                }}
                onChange={() => {
                  if (!checked) {
                    onSelectionChange(option);
                  }
                }}
              />

              <span>{option}</span>

              {checked && (
                <Check
                  size={16}
                  className="achievement-selected-check"
                />
              )}
            </label>
          );
        })}
      </div>

      {uploadRequired && (
        <div className="achievement-proof">
          <div className="achievement-proof-heading">
            <FileCheck2 size={18} />
            <span>
              {question.uploadLabel}
              <span className="required"> *</span>
            </span>
          </div>

          <label className="file-upload">
            {proof ? (
              <FileCheck2 />
            ) : (
              <UploadCloud />
            )}

            <span>
              {proof
                ? proof.name
                : "Click to upload supporting proof"}
            </span>

            <small>
              PDF, JPG or PNG — Maximum {MAX_FILE_SIZE_MB} MB
            </small>

            {proof && (
              <small>
                File size: {(proof.size / (1024 * 1024)).toFixed(2)} MB
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
}: {
  onSuccess: (id: string) => void;
  onBackHome: () => void;
}) {
  const [step, setStep] = useState<Step>(1);

  const [personal, setPersonal] =
    useState<PersonalInformation>({ ...EMPTY_PERSONAL });

  const [answers, setAnswers] =
    useState<Answers>(initialAnswers);

  const [proofFiles, setProofFiles] =
    useState<ProofFiles>(initialProofFiles);

  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // ---------------------------------------------------
  // PERSONAL INFORMATION
  // ---------------------------------------------------

  function updatePersonal<K extends keyof PersonalInformation>(
    key: K,
    value: PersonalInformation[K]
  ) {
    setPersonal((current) => ({
      ...current,
      [key]: value,
    }));

    setError("");
  }

  // ---------------------------------------------------
  // FIXED UK PHONE CODE +44
  // EXACTLY TEN NATIONAL DIGITS
  // ---------------------------------------------------

  function handleUKPhoneChange(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const digits = event.target.value
      .replace(/\D/g, "")
      .slice(0, 10);

    updatePersonal("phone", `+44${digits}`);
  }

  // ---------------------------------------------------
  // SINGLE ANSWER UPDATE
  // ---------------------------------------------------

  function updateAnswer(
    question: QuestionDefinition,
    option: string
  ) {
    const previous = answers[question.id] || [];

    // For optional questions, selecting the same
    // answer again clears the selection.
    const next =
      !question.required && previous.includes(option)
        ? []
        : [option];

    setAnswers((current) => ({
      ...current,
      [question.id]: next,
    }));

    // Clear the previous proof whenever an answer changes.
    setProofFiles((current) => ({
      ...current,
      [question.id]: null,
    }));

    setError("");
  }

  // ---------------------------------------------------
  // CERTIFICATE UPLOAD — 20 MB MAXIMUM
  // ---------------------------------------------------

  function handleProof(
    questionId: string,
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0] ?? null;

    if (!file) {
      setProofFiles((current) => ({
        ...current,
        [questionId]: null,
      }));
      return;
    }

    const validExtension = /\.(pdf|jpe?g|png)$/i.test(
      file.name
    );

    if (
      !validExtension ||
      !ALLOWED_FILE_TYPES.includes(file.type)
    ) {
      setError(
        "Invalid file type. Upload a PDF, JPG or PNG document."
      );

      event.target.value = "";

      setProofFiles((current) => ({
        ...current,
        [questionId]: null,
      }));

      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setError(
        `File is too large. Maximum allowed size is ${MAX_FILE_SIZE_MB} MB per document.`
      );

      event.target.value = "";

      setProofFiles((current) => ({
        ...current,
        [questionId]: null,
      }));

      return;
    }

    if (file.size === 0) {
      setError("Empty documents cannot be uploaded.");

      event.target.value = "";

      setProofFiles((current) => ({
        ...current,
        [questionId]: null,
      }));

      return;
    }

    setProofFiles((current) => ({
      ...current,
      [questionId]: file,
    }));

    setError("");
  }

  // ---------------------------------------------------
  // PERSONAL VALIDATION
  // ---------------------------------------------------

  function validatePersonal(): string {
    if (personal.fullName.trim().length < 3) {
      return "Please enter your full name.";
    }

    if (
      !personal.dob ||
      !Number.isFinite(Date.parse(personal.dob)) ||
      personal.dob > getToday()
    ) {
      return "Please enter a valid date of birth.";
    }

    if (
      personal.gender !== "Male" &&
      personal.gender !== "Female"
    ) {
      return "Please select Male or Female.";
    }

    if (!/^\+44\d{10}$/.test(personal.phone)) {
      return "Enter exactly 10 digits after +44.";
    }

    if (personal.address.trim().length < 8) {
      return "Please enter your full address.";
    }

    return "";
  }

  // ---------------------------------------------------
  // ACHIEVEMENT VALIDATION
  // ---------------------------------------------------

  function validateAchievements(): string {
    for (let index = 0; index < QUESTIONS.length; index++) {
      const question = QUESTIONS[index];
      const selected = answers[question.id] || [];

      if (selected.length > 1) {
        return `Select only one option for question ${index + 1}.`;
      }

      if (
        selected.some((option) => !question.options.includes(option))
      ) {
        return `Invalid selection for question ${index + 1}.`;
      }

      if (question.required && selected.length === 0) {
        return `Please answer question ${index + 1}.`;
      }

      if (requiresProof(question, selected)) {
        const file = proofFiles[question.id];

        if (!file) {
          return `Please upload a supporting document for question ${
            index + 1
          }.`;
        }

        if (!isValidProofFile(file)) {
          return `Question ${
            index + 1
          }: Upload a valid PDF, JPG or PNG document under ${MAX_FILE_SIZE_MB} MB.`;
        }
      }
    }

    return "";
  }

  // ---------------------------------------------------
  // SCROLL REGISTRATION PAGE TO TOP
  // ---------------------------------------------------

  function scrollRegistrationToTop() {
    const container = document.querySelector(
      ".registration-main-scroll"
    );

    if (container) {
      container.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    }
  }

  // ---------------------------------------------------
  // NEXT STEP
  // ---------------------------------------------------

  function nextStep() {
    const validation =
      step === 1
        ? validatePersonal()
        : validateAchievements();

    if (validation) {
      setError(validation);
      return;
    }

    setError("");

    setStep((current) =>
      Math.min(3, current + 1) as Step
    );

    scrollRegistrationToTop();
  }

  // ---------------------------------------------------
  // PREVIOUS STEP
  // ---------------------------------------------------

  function previousStep() {
    setError("");

    setStep((current) =>
      Math.max(1, current - 1) as Step
    );

    scrollRegistrationToTop();
  }

  // ---------------------------------------------------
  // SUBMIT REGISTRATION
  // ---------------------------------------------------

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validation =
      validatePersonal() || validateAchievements();

    if (validation) {
      setError(validation);
      return;
    }

    if (!personal.agreed) {
      setError(
        "Please confirm that your information is correct."
      );
      return;
    }

    if (submitting) return;

    setSubmitting(true);
    setError("");

    try {
      const raw = localStorage.getItem(STORAGE_KEY);

      const parsed: unknown = raw
        ? JSON.parse(raw)
        : [];

      const saved: SavedRegistration[] =
        Array.isArray(parsed) ? parsed : [];

      const documents: Record<string, string | null> = {};

      QUESTIONS.forEach((question) => {
        const selected = answers[question.id] || [];

        documents[question.id] = requiresProof(
          question,
          selected
        )
          ? proofFiles[question.id]?.name || null
          : null;
      });

      const id = generateId();

      const registration: SavedRegistration = {
        id,
        createdAt: new Date().toISOString(),
        event: EVENT.title,
        personal: {
          ...personal,
          fullName: personal.fullName.trim(),
          phone: personal.phone.trim(),
          address: personal.address.trim(),
        },
        answers,
        documents,
      };

      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify([...saved, registration])
      );

      onSuccess(id);
    } catch {
      setError(
        "Unable to save registration. Please check browser storage."
      );
    } finally {
      setSubmitting(false);
    }
  }

  // ===================================================
  // REGISTRATION UI
  // ===================================================

  return (
    <section className="winter-screen registration-screen">
      <div className="registration-top-banner">
        <Snowflake className="banner-snowflake" />
      </div>

      <div className="registration-main">
        <div className="registration-intro">
          <h1>Winter Get Together</h1>
          <h2 lang="ta">{EVENT.tamil}</h2>

          <div className="registration-heading-line" />

          <h3>Event Registration</h3>

          <p>
            Complete your details to join the event
          </p>
        </div>

        <StepProgress step={step} />

        <form
          className="registration-form"
          onSubmit={submit}
          noValidate
        >
          <div className="registration-card">
            {/* =======================================
                STEP 1 — PERSONAL INFORMATION
            ======================================= */}

            {step === 1 && (
              <>
                <div className="card-heading">
                  <UserRound />
                  <h3>Personal Information</h3>
                </div>

                <div className="fields-grid">
                  <FormField label="Full Name" required>
                    <input
                      type="text"
                      autoComplete="name"
                      placeholder="Enter your full name"
                      value={personal.fullName}
                      onChange={(event) =>
                        updatePersonal(
                          "fullName",
                          event.target.value
                        )
                      }
                    />
                  </FormField>

                  <FormField label="Date of Birth" required>
                    <input
                      type="date"
                      max={getToday()}
                      value={personal.dob}
                      onChange={(event) =>
                        updatePersonal(
                          "dob",
                          event.target.value
                        )
                      }
                    />
                  </FormField>

                  <FormField label="Gender" required>
                    <div className="select-control">
                      <select
                        value={personal.gender}
                        onChange={(event) =>
                          updatePersonal(
                            "gender",
                            event.target.value
                          )
                        }
                      >
                        <option value="">
                          Select gender
                        </option>
                        <option value="Male">
                          Male
                        </option>
                        <option value="Female">
                          Female
                        </option>
                      </select>
                    </div>
                  </FormField>

                  <FormField label="Contact Number" required>
                    <div className="uk-phone-wrapper">
                      <span className="uk-phone-code">
                        🇬🇧 +44
                      </span>

                      <input
                        type="tel"
                        inputMode="numeric"
                        autoComplete="tel-national"
                        placeholder="7700900000"
                        maxLength={10}
                        value={personal.phone.replace(
                          /^\+44/,
                          ""
                        )}
                        onChange={handleUKPhoneChange}
                        aria-label="UK phone number, 10 digits"
                      />
                    </div>

                    <small className="uk-phone-hint">
                      Enter exactly 10 digits after +44
                    </small>
                  </FormField>

                  <div className="grid-full">
                    <FormField label="Full Address" required>
                      <textarea
                        rows={3}
                        autoComplete="street-address"
                        placeholder="House number, street, city, postcode, country"
                        value={personal.address}
                        onChange={(event) =>
                          updatePersonal(
                            "address",
                            event.target.value
                          )
                        }
                      />
                    </FormField>
                  </div>
                </div>
              </>
            )}

            {/* =======================================
                STEP 2 — ACHIEVEMENTS
            ======================================= */}

            {step === 2 && (
              <>
                <div className="card-heading">
                  <GraduationCap />
                  <h3>
                    Achievements & Qualifications
                  </h3>
                </div>

                <p className="achievement-introduction">
                  உங்கள் கல்வித் தகுதிகள் மற்றும்
                  சாதனைகள் தொடர்பான விவரங்களைத்
                  தெரிவுசெய்யவும். பொருத்தமான
                  சான்றிதழ்களை இணைக்கவும்.
                </p>

                <div className="achievement-question-list">
                  {QUESTIONS.map((question, index) => (
                    <AchievementQuestion
                      key={question.id}
                      number={index + 1}
                      question={question}
                      selected={
                        answers[question.id] || []
                      }
                      proof={
                        proofFiles[question.id] || null
                      }
                      onSelectionChange={(option) =>
                        updateAnswer(question, option)
                      }
                      onFileChange={(event) =>
                        handleProof(
                          question.id,
                          event
                        )
                      }
                    />
                  ))}
                </div>
              </>
            )}

            {/* =======================================
                STEP 3 — REVIEW
            ======================================= */}

            {step === 3 && (
              <>
                <div className="card-heading">
                  <ShieldCheck />
                  <h3>Review Registration</h3>
                </div>

                <div className="review-section">
                  <h4>Personal Information</h4>

                  <div className="review-grid">
                    <ReviewItem
                      label="Full Name"
                      value={personal.fullName}
                    />

                    <ReviewItem
                      label="Date of Birth"
                      value={personal.dob}
                    />

                    <ReviewItem
                      label="Gender"
                      value={personal.gender}
                    />

                    <ReviewItem
                      label="Contact Number"
                      value={personal.phone}
                    />

                    <ReviewItem
                      label="Full Address"
                      value={personal.address}
                    />
                  </div>
                </div>

                <div className="review-section">
                  <h4>
                    Achievements & Qualifications
                  </h4>

                  <div className="achievement-review-list">
                    {QUESTIONS.map((question, index) => {
                      const selected =
                        answers[question.id] || [];

                      const proofRequired =
                        requiresProof(
                          question,
                          selected
                        );

                      const file =
                        proofFiles[question.id];

                      return (
                        <div
                          key={question.id}
                          className="achievement-review-item"
                        >
                          <p lang="ta">
                            <strong>
                              {index + 1}.
                            </strong>{" "}
                            {question.question}
                          </p>

                          <div className="achievement-review-answer">
                            <span>Answer:</span>

                            <strong>
                              {selected.length > 0
                                ? selected[0]
                                : "Not selected"}
                            </strong>
                          </div>

                          {proofRequired && (
                            <div className="achievement-review-proof">
                              <FileCheck2 size={16} />

                              <span>
                                {file?.name ||
                                  "No document selected"}
                              </span>

                              {file && (
                                <small>
                                  (
                                  {(
                                    file.size /
                                    (1024 * 1024)
                                  ).toFixed(2)}
                                  {" "}MB)
                                </small>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <label className="confirmation">
                  <input
                    type="checkbox"
                    checked={personal.agreed}
                    onChange={(event) =>
                      updatePersonal(
                        "agreed",
                        event.target.checked
                      )
                    }
                  />

                  I confirm that the information
                  provided is correct and agree
                  to its use for event registration.
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

          {/* =====================================
              ACTION BUTTONS
          ===================================== */}

          <div className="form-bottom-actions">
            {step > 1 ? (
              <button
                type="button"
                className="back-button"
                onClick={previousStep}
              >
                <ArrowLeft size={17} />
                Previous
              </button>
            ) : (
              <button
                type="button"
                className="back-button"
                onClick={onBackHome}
              >
                <ArrowLeft size={17} />
                Home
              </button>
            )}

            {step < 3 ? (
              <button
                type="button"
                className="form-next-button"
                onClick={nextStep}
              >
                Next Step
                <ArrowRight size={17} />
              </button>
            ) : (
              <button
                type="submit"
                className="form-next-button"
                disabled={submitting}
              >
                {submitting
                  ? "Submitting..."
                  : "Submit Registration"}

                <CheckCircle2 size={18} />
              </button>
            )}
          </div>
        </form>
      </div>

      <WinterWave />
    </section>
  );
}

// =====================================================
// SUCCESS PAGE
// =====================================================

function SuccessPage({
  id,
  onHome,
}: {
  id: string;
  onHome: () => void;
}) {
  const [copied, setCopied] = useState(false);

  async function copyId() {
    try {
      await navigator.clipboard.writeText(id);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className="winter-screen success-screen">
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

        <h1>Registration Successful!</h1>

        <p>
          Thank you for registering for
          Winter Get Together.
        </p>

        <div className="success-reference">
          <span>Registration ID</span>

          <div>
            <strong>{id}</strong>

            <button
              type="button"
              onClick={copyId}
              aria-label="Copy registration ID"
            >
              {copied ? (
                <Check size={20} />
              ) : (
                <Copy size={20} />
              )}
            </button>
          </div>

          {copied && <small>Copied!</small>}
        </div>

        <p className="reference-note">
          Please save your registration ID
          for future reference.
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
          Back to Home
        </button>
      </div>

      <WinterWave />
    </section>
  );
}

// =====================================================
// MAIN APP
// =====================================================

export default function App() {
  const [page, setPage] = useState<Page>("home");

  const [registrationId, setRegistrationId] =
    useState("");

  const [formKey, setFormKey] = useState(0);

  function navigate(nextPage: Page) {
    if (
      nextPage === "register" &&
      page !== "register"
    ) {
      setFormKey((previous) => previous + 1);
    }

    setPage(nextPage);
  }

  function handleSuccess(id: string) {
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
            onRegister={() => navigate("register")}
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
            onSuccess={handleSuccess}
            onBackHome={() => navigate("home")}
          />
        )}

        {page === "success" && (
          <SuccessPage
            id={registrationId}
            onHome={() => navigate("home")}
          />
        )}
      </main>
    </div>
  );
}
