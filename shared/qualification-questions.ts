// Listener qualification test questions.
// Correct answer index is 0-based (a=0, b=1, c=2, d=3).
// This file is imported by both the server (scoring) and the client (display).

export interface QualificationQuestion {
  id: string;
  text: string;
  options: string[];
  correctIndex: number; // 0-based index into options
  category: "active_listening" | "empathy" | "boundaries" | "crisis";
}

export const QUALIFICATION_QUESTIONS: QualificationQuestion[] = [
  {
    id: "q1",
    category: "active_listening",
    text: "A person tells you they feel completely overwhelmed by work. What is the best first response?",
    options: [
      "You should just work less and take more breaks.",
      "That sounds really heavy — it seems like work is really weighing on you right now.",
      "Everyone feels overwhelmed sometimes, it will pass.",
      "Have you tried meditation or journaling?",
    ],
    correctIndex: 1,
  },
  {
    id: "q2",
    category: "empathy",
    text: "Someone shares that they just lost their job. What do you do first?",
    options: [
      "Immediately suggest job search tips and resources.",
      "Ask them to tell you more about how they are feeling about it.",
      "Tell them it is not that serious and many people go through this.",
      "Share your own experience of losing a job to relate.",
    ],
    correctIndex: 1,
  },
  {
    id: "q3",
    category: "boundaries",
    text: "A user keeps messaging you outside of scheduled sessions asking for support. You should:",
    options: [
      "Always respond immediately so they feel supported.",
      "Block them to protect your own boundaries.",
      "Kindly explain that you are only available during sessions and encourage them to reach out then.",
      "Give them your personal phone number so they have another way to reach you.",
    ],
    correctIndex: 2,
  },
  {
    id: "q4",
    category: "crisis",
    text: 'A user says: "I don\'t want to be here anymore." What should you do?',
    options: [
      'Say "I understand, sometimes we all need a break from everything."',
      "Immediately and gently ask if they are having thoughts of harming themselves, and escalate to crisis resources if needed.",
      "Change the subject to something more positive.",
      'Respond "Everyone feels like that sometimes — things will get better."',
    ],
    correctIndex: 1,
  },
  {
    id: "q5",
    category: "active_listening",
    text: "What does 'reflecting' mean in the context of active listening?",
    options: [
      "Sharing a similar personal experience to show you understand.",
      "Mirroring back what the person said in your own words to show you heard them.",
      "Giving advice based on what you have just heard.",
      "Asking multiple follow-up questions at once to gather more information.",
    ],
    correctIndex: 1,
  },
  {
    id: "q6",
    category: "boundaries",
    text: "A user shares deep personal trauma and asks you for your personal opinion on what they should do. You should:",
    options: [
      "Give detailed personal advice based on what you think is best.",
      "Listen with empathy, validate their feelings, and gently encourage them to also speak with a professional.",
      "Tell them their problem is not as serious as they think.",
      "Share your own trauma to help them feel less alone.",
    ],
    correctIndex: 1,
  },
  {
    id: "q7",
    category: "empathy",
    text: "What is the key difference between empathy and sympathy?",
    options: [
      "They mean the same thing in a support context.",
      "Empathy means feeling for someone from a distance; sympathy means feeling with them.",
      "Sympathy means feeling for someone (pity); empathy means truly feeling with them and understanding their perspective.",
      "Empathy means agreeing with what someone says.",
    ],
    correctIndex: 2,
  },
  {
    id: "q8",
    category: "active_listening",
    text: "During a support session, the most important thing is to:",
    options: [
      "Think ahead about what you are going to say next.",
      "Give the person your full attention and avoid interrupting.",
      "Offer a quick solution so the session does not go too long.",
      "Talk more than the user to keep them engaged.",
    ],
    correctIndex: 1,
  },
  {
    id: "q9",
    category: "crisis",
    text: "A user has mentioned feeling hopeless across several sessions in a row. You should:",
    options: [
      "Ignore it as long as they have not explicitly mentioned self-harm.",
      "Gently ask about their safety, express care, and recommend professional help.",
      "End the session immediately and report them.",
      "Tell them to think positive and focus on the good things in their life.",
    ],
    correctIndex: 1,
  },
  {
    id: "q10",
    category: "boundaries",
    text: "A user asks you to keep a serious safety concern they shared completely secret. You should:",
    options: [
      "Always keep it secret — confidentiality is the foundation of trust.",
      "Explain clearly that while you respect their privacy, safety concerns must be escalated per platform guidelines.",
      "Promise to keep it secret and then decide later.",
      "Refuse to listen any further until they agree to let you report it.",
    ],
    correctIndex: 1,
  },
  {
    id: "q11",
    category: "active_listening",
    text: "Which of these is an open-ended question?",
    options: [
      '"Are you feeling sad about what happened?"',
      '"How are you feeling about what happened?"',
      '"Did that make you angry?"',
      '"Is everything okay with you now?"',
    ],
    correctIndex: 1,
  },
  {
    id: "q12",
    category: "empathy",
    text: "A user expresses strong anger at their family. You should:",
    options: [
      "Take their side and agree that their family is wrong.",
      "Tell them to calm down and think more rationally.",
      "Validate their feelings without judgment and help them explore what is behind the anger.",
      "Immediately remind them of their family's positive qualities.",
    ],
    correctIndex: 2,
  },
];

export const PASSING_THRESHOLD_PCT = 70; // default, can be overridden via app_config

export function scoreAnswers(answers: Record<string, string>): {
  score: number;
  passed: boolean;
  total: number;
  correct: number;
} {
  let correct = 0;
  const total = QUALIFICATION_QUESTIONS.length;

  for (const q of QUALIFICATION_QUESTIONS) {
    const submitted = answers[q.id];
    if (submitted !== undefined && Number(submitted) === q.correctIndex) {
      correct++;
    }
  }

  const score = Math.round((correct / total) * 100);
  const passed = score >= PASSING_THRESHOLD_PCT;
  return { score, passed, total, correct };
}
