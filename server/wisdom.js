const { PASSAGES } = require("./wisdom-passages");

const traditions = new Set(["gita", "bible", "either", "secular"]);
const validMessage = value => typeof value === "string" && value.length <= 1000 && value.trim().length > 0;

const harmfulAction = /(?:kill myself|end my life|take my (?:own )?life|(?:hurt|harm|kill) (?:myself|someone|somebody|them|him|her)|die by suicide)/;
const immediateDanger = [
  new RegExp(String.raw`\bi (?:just |really |still )?(?:want|need|intend|plan|am planning|am going|am about|have decided|have a plan|am ready|am tempted) to ${harmfulAction.source}\b`),
  new RegExp(String.raw`\bi (?:will|might|may) ${harmfulAction.source}\b`),
  /\bi (?:am (?:actively suicidal|in immediate danger|not safe right now)|(?:cut|hurt) myself on purpose)\b/,
  /\bi (?:already )?(?:took|have taken) (?:an overdose|too many pills|pills to (?:kill myself|end my life))\b/,
  /\bi (?:do not think i can|cannot) (?:stay|keep myself) safe\b/,
];
const safetyLanguage = /\b(?:suicid(?:e|al)|self[- ]harm|(?:kill|hurt|harm|cut) myself|(?:end|take) my (?:own )?life|want to die|wish i (?:were dead|could disappear)|(?:do not|no longer) want to (?:live|be alive|be here anymore|wake up)|cannot (?:go on|keep going|do this anymore)|everyone would be better off without me|(?:think|feel) (?:about|like) giving up)\b/;
const uncertainViolence = /\bi (?:am afraid|am scared|worry|think) (?:that )?i (?:could|might) (?:hurt|harm|kill) (?:someone|somebody|them|him|her)\b/;
const reportedSpeech = /\b(?:he|she|they|my friend|the character|someone) (?:said|says|asked|wrote) (?:that )?i\b/;
const safeAnswer = /^(?:(?:no|(?:this|it|that) is not about safety|i am not thinking about hurting (?:myself|anyone|myself or anyone else))[.!?]*$|(?:no[,.]? )?i am safe(?: right now| now)?(?:[.!?,]|$))/;
const affirmativeAnswer = /^(?:(?:yes|yeah|yep)(?:[,.]? (?:i am|i might|i think so))?|i might|i think so)[.!?]*$/;

const vagueFailure = /^(?:i )?(?:just )?(?:failed|messed up|blew it|screwed up)$/;
const vagueLoss = /^(?:i )?(?:just )?lost(?: (?:something|someone)(?: (?:very )?important(?: to me)?)?)?$/;
const exam = /\b(?:exam|test|midterm|final)\b/;
const examSetback = /\b(?:fail(?:ed|ing)?|bomb(?:ed|ing)?|flunk(?:ed|ing)?|bad|badly|poor(?:ly)?|terrible|low score|did not pass)\b/;
const relationshipHarm = /\bi (?:just |really |accidentally )?(?:hurt (?:someone|a friend|my (?:friend|partner|sibling)|their feelings)|said something (?:cruel|mean|hurtful)|was (?:cruel|mean) to|snapped at|let (?:a friend|someone) down)\b/;
const ordinaryDistress = /\b(?:overwhelmed|stressed|worried|lonely|homesick|burned out|burnt out|disappointed|grieving|grief|lost my (?:pet|dog|cat|grandfather|grandmother)|miss my (?:friend|family|home))\b/;

const scenes = {
  chariot: "A chariot waits in the quiet before dawn. The destination is out of sight. The reins are still within reach.",
  lantern: "A lantern warms the doorstep. You stop before knocking and think about the first honest thing you can say.",
  shore: "At the shore, one wave recedes and another arrives. You watch the edge of the water for a moment.",
};

const reflections = {
  exam: {
    opening: "It hurts when an exam goes badly, especially when you hoped for a different result.",
    secular: "The result is one piece of information. Which part of what happened can help you choose your next move?",
    passage: "The verse asks Arjuna to attend to the work within his reach without clinging to its result. Your score may still matter to you. What part of preparing again is in your hands?",
    application: "Think back to what made the test difficult. Was it a topic you hadn’t practiced, the time limit, or something else?",
    step: "Pick one question you missed. Try it untimed, or ask someone to walk through it with you.",
  },
  repair: {
    opening: "It can be hard to sit with the fact that you hurt someone you care about.",
    secular: "You can own what happened and give the other person space to decide what they need.",
    passage: "The verse calls for kindness, tenderness, and forgiveness. You can offer kindness through an honest apology and give the other person room to respond in their own time.",
    application: "Before you speak, consider how your words or actions may have landed for them.",
    step: "If it is safe and welcome to reach out, write one sentence naming what you did and acknowledging its impact. Give them space to answer when they are ready.",
  },
  everyday: {
    opening: "It sounds like there’s a lot to carry right now.",
    secular: "Give yourself a moment to notice what feels hardest. You can take the rest one piece at a time.",
    application: "You can take a moment before deciding what to do next.",
    step: "Name one small thing that would make the next ten minutes easier. It could be a pause or a message to someone you trust.",
  },
};

function normalize(message) {
  return message.toLowerCase().replace(/[’‘]/g, "'")
    .replace(/\bi'm\b/g, "i am")
    .replace(/\bi'll\b/g, "i will")
    .replace(/\bi've\b/g, "i have")
    .replace(/\bdon't\b/g, "do not")
    .replace(/\b(?:can't|can not)\b/g, "cannot")
    .replace(/\bgonna\b/g, "going to")
    .replace(/\s+/g, " ").trim();
}

function riskOf(message) {
  const unquoted = message.replace(/["“][^"”]*["”]/g, "");
  const clauses = unquoted.split(/[.!?,;]|\b(?:but|however)\b/);
  if (clauses.some(clause => !reportedSpeech.test(clause) && immediateDanger.some(pattern => pattern.test(clause)))) {
    return "support_now";
  }
  if (safetyLanguage.test(message) || uncertainViolence.test(message)) return "check_safety";
  return null;
}

function updateRisk(previous, message) {
  const current = riskOf(message);
  if (previous === "support_now" || current === "support_now") return "support_now";
  if (previous === "check_safety") {
    if (affirmativeAnswer.test(message)) return "support_now";
    if (!current && safeAnswer.test(message)) return null;
  }
  return current || previous;
}

function situationOf(message, previous) {
  const phrase = message.replace(/[.!?]+$/, "");
  if (exam.test(phrase) && examSetback.test(phrase)) return "exam";
  if (relationshipHarm.test(phrase)) return "repair";
  if (vagueFailure.test(previous) && /^(?:my |the |a )?(?:[a-z0-9-]+ ){0,3}(?:exam|test|midterm|final)$/.test(phrase)) return "exam";
  if (vagueFailure.test(phrase)) return "clarify_failure";
  if (vagueLoss.test(phrase)) return "clarify_loss";
  if (ordinaryDistress.test(phrase)) return "everyday";
  return null;
}

function experience(situation, tradition) {
  const reflection = reflections[situation];
  const scene = tradition === "gita" ? "chariot" : tradition === "bible" ? "lantern" : "shore";
  const { text, ...source } = PASSAGES[tradition] || {};
  const cards = [
    { title: "What I heard", text: reflection.opening },
    { title: "A moment to pause", text: scenes[scene], scene },
    text ? { title: "The passage", text, source } : { title: "A reflection", text: reflection.secular },
    { title: "One thought to carry", text: text ? reflection.passage : reflection.application },
    { title: "One small next step", text: reflection.step },
  ];
  return { kind: "experience", cards };
}

function getWisdomResponse(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const { message, history = [], tradition } = input;
  if (!validMessage(message) || !Array.isArray(history) || history.length > 6 || ![...history].every(validMessage)
    || (tradition !== undefined && !traditions.has(tradition))) return null;

  const current = normalize(message);
  const previous = history.map(normalize);
  const risk = [...previous, current].reduce(updateRisk, null);
  if (risk === "support_now") {
    return {
      kind: "support_now",
      message: "I’m glad you told me. If you or someone else is in immediate danger, call local emergency services now. If you can do so safely, tell someone you trust nearby what’s happening and ask for help.",
    };
  }
  if (risk === "check_safety") {
    return {
      kind: "check_safety",
      message: "Are you thinking about hurting yourself or someone else right now? If there’s immediate danger, call local emergency services. If you can, reach out to someone you trust nearby.",
    };
  }

  const situation = situationOf(current, previous.at(-1)?.replace(/[.!?]+$/, ""));
  if (situation === "clarify_failure") {
    return { kind: "clarify", message: "That sounds hard. What happened?" };
  }
  if (situation === "clarify_loss") {
    return { kind: "clarify", message: "I’m listening. Would you like to say a little about what happened?" };
  }
  if (!situation) {
    return { kind: "listen", message: "I’m listening. What part of this is weighing on you most?" };
  }
  if (tradition === undefined) {
    return { kind: "choose_tradition", message: "Would you like a reflection from the Bhagavad Gita, the Bible, either tradition, or a non-religious reflection?" };
  }
  if ((tradition === "gita" && situation !== "exam") || (tradition === "bible" && situation !== "repair")) {
    return { kind: "choose_tradition", message: "I don’t have a reviewed passage for this situation in the tradition you chose. Would you like to choose another source or a non-religious reflection?" };
  }
  const matchedTradition = { exam: "gita", repair: "bible", everyday: "secular" };
  return experience(situation, tradition === "either" ? matchedTradition[situation] : tradition);
}

module.exports = { getWisdomResponse };
