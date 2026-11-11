
export const QUESTIONS = {
  tamil_exam: {
    options: ["Excellent", "Very Good"],
    positive: ["Excellent", "Very Good"],
  },
  maths_competition: {
    options: ["A", "A*"],
    positive: ["A", "A*"],
  },
  grammar_school: {
    options: ["தேர்ச்சி பெற்றுள்ளேன்", "தேர்ச்சி பெறவில்லை"],
    positive: ["தேர்ச்சி பெற்றுள்ளேன்"],
  },
  gcse: {
    options: ["ஆம்", "இல்லை"],
    positive: ["ஆம்"],
  },
  gce_al: {
    options: ["A", "B"],
    positive: ["A", "B"],
  },
  university_degree: {
    options: ["ஆம்", "இல்லை"],
    positive: ["ஆம்"],
  },
  other_achievements: {
    options: ["ஆம்", "இல்லை"],
    positive: ["ஆம்"],
  },
} as const;

export type QuestionId = keyof typeof QUESTIONS;
export type Answers = Record<QuestionId, string>;

export interface Applicant {
  fullName: string;
  dob: string;
  gender: "Male" | "Female";
  phone: string;
  email: string;
  address: string;
  agreed: boolean;
}

export interface RegistrationInput {
  personal: Applicant;
  language: "ta" | "en";
  answers: Answers;
}

export const QUESTION_IDS = Object.keys(
  QUESTIONS
) as QuestionId[];

export const MAX_FILE_SIZE = 20 * 1024 * 1024;

export const REGISTRATION_DEADLINE =
  "2026-11-30T23:59:00Z";

export function isQuestionId(
  value: string
): value is QuestionId {
  return Object.prototype.hasOwnProperty.call(
    QUESTIONS,
    value
  );
}

export function requiresProof(
  id: QuestionId,
  answer: string
): boolean {
  return (QUESTIONS[id].positive as readonly string[])
    .includes(answer);
}

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value
    .split("-")
    .map(Number);

  const date = new Date(Date.UTC(
    year,
    month - 1,
    day
  ));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day &&
    date.getTime() <= Date.now()
  );
}

function isRecord(
  value: unknown
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

export function validateRegistration(
  value: unknown
):
  | { success: true; data: RegistrationInput }
  | { success: false; error: string } {
  if (!isRecord(value) || !isRecord(value.personal)) {
    return {
      success: false,
      error: "Invalid registration data.",
    };
  }

  const p = value.personal;

  const fullName =
    typeof p.fullName === "string"
      ? p.fullName.trim()
      : "";

  const dob =
    typeof p.dob === "string" ? p.dob : "";

  const gender = p.gender;

  const phone =
    typeof p.phone === "string" ? p.phone : "";

  const email =
    typeof p.email === "string"
      ? p.email.trim().toLowerCase()
      : "";

  const address =
    typeof p.address === "string"
      ? p.address.trim()
      : "";

  if (fullName.length < 3 || fullName.length > 150) {
    return {
      success: false,
      error: "Enter a valid applicant full name.",
    };
  }

  if (!validDate(dob)) {
    return {
      success: false,
      error: "Enter a valid date of birth.",
    };
  }

  if (gender !== "Male" && gender !== "Female") {
    return {
      success: false,
      error: "Select a valid gender.",
    };
  }

  if (!/^\+44\d{10}$/.test(phone)) {
    return {
      success: false,
      error: "Enter a valid UK contact number.",
    };
  }

  if (
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    return {
      success: false,
      error: "Enter a valid email address.",
    };
  }

  if (address.length < 8 || address.length > 1000) {
    return {
      success: false,
      error: "Enter a valid full address.",
    };
  }

  if (p.agreed !== true) {
    return {
      success: false,
      error: "Registration consent is required.",
    };
  }

  if (
    value.language !== "ta" &&
    value.language !== "en"
  ) {
    return {
      success: false,
      error: "Invalid registration language.",
    };
  }

  if (!isRecord(value.answers)) {
    return {
      success: false,
      error: "Achievement answers are required.",
    };
  }

  const answers = {} as Answers;

  for (const id of QUESTION_IDS) {
    const raw = value.answers[id];
    const answer = raw === undefined || raw === null
      ? ""
      : raw;

    if (typeof answer !== "string") {
      return {
        success: false,
        error: `Invalid answer for ${id}.`,
      };
    }

    if (
      answer !== "" &&
      !(QUESTIONS[id].options as readonly string[])
        .includes(answer)
    ) {
      return {
        success: false,
        error: `Invalid answer for ${id}.`,
      };
    }

    answers[id] = answer;
  }

  return {
    success: true,
    data: {
      personal: {
        fullName,
        dob,
        gender,
        phone,
        email,
        address,
        agreed: true,
      },
      language: value.language,
      answers,
    },
  };
}
