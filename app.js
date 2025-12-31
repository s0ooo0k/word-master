const promptText = document.getElementById("prompt-text");
const promptLabel = document.getElementById("prompt-label");
const answerInput = document.getElementById("answer-input");
const feedback = document.getElementById("feedback");
const scoreCount = document.getElementById("score-count");
const attemptCount = document.getElementById("attempt-count");
const poolCount = document.getElementById("pool-count");
const imageArea = document.getElementById("image-area");
const promptImage = document.getElementById("prompt-image");
const hotspotLayer = document.getElementById("hotspot-layer");
const categoryBar = document.getElementById("category-bar");
const categorySummary = document.getElementById("category-summary");

const imageQuestions = []; // 추가 이미지 문제가 있을 때 채워 넣으세요.

const state = {
  allQuestions: [],
  filtered: [],
  queue: [],
  current: null,
  asked: 0,
  correct: 0,
  category: "ALL",
  categoryCounts: {},
};

const normalize = (value = "") =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .trim();

const shuffle = (list) => {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

const setFeedback = (text, tone = "") => {
  feedback.textContent = text;
  feedback.className = `feedback${tone ? ` ${tone}` : ""}`;
};

const updateSummary = () => {
  const pool = state.queue.length + (state.current ? 1 : 0);
  scoreCount.textContent = state.correct;
  attemptCount.textContent = state.asked;
  poolCount.textContent = pool;

  const total = state.filtered.length;
  const catLabel = state.category === "ALL" ? "전체" : state.category;
  categorySummary.textContent = `${catLabel} · ${total}문제`;
};

const clearHotspots = () => {
  hotspotLayer.innerHTML = "";
  promptImage.src = "";
};

const renderTextQuestion = (question) => {
  promptLabel.textContent = `Definition (${question.category})`;
  promptText.textContent = question.prompt;
  imageArea.classList.add("hidden");
  answerInput.disabled = false;
  answerInput.placeholder = "영어 단어 입력 후 Enter 또는 확인";
  answerInput.value = "";
  answerInput.focus();
};

const renderImageQuestion = (question) => {
  promptLabel.textContent = question.prompt || "이미지 문제";
  promptText.textContent = "그림 위 빈칸에 해당 단어를 입력하세요.";
  imageArea.classList.remove("hidden");
  clearHotspots();

  promptImage.src = question.image;
  hotspotLayer.innerHTML = "";
  question.prompts.forEach((item, idx) => {
    const spot = document.createElement("div");
    spot.className = "hotspot";
    spot.style.left = `${item.x}%`;
    spot.style.top = `${item.y}%`;

    const field = document.createElement("input");
    field.type = "text";
    field.placeholder = `#${idx + 1}`;
    field.dataset.answer = item.answer;
    field.dataset.index = idx + 1;
    if (item.width) {
      field.style.width = typeof item.width === "number" ? `${item.width}px` : item.width;
    }
    spot.appendChild(field);
    hotspotLayer.appendChild(spot);
  });

  answerInput.value = "";
  answerInput.disabled = true;
  answerInput.placeholder = "그림 위 빈칸을 채워주세요";
  const firstHotspot = hotspotLayer.querySelector("input");
  if (firstHotspot) firstHotspot.focus();
};

const renderQuestion = (question) => {
  setFeedback("");
  if (question.type === "image") {
    renderImageQuestion(question);
  } else {
    renderTextQuestion(question);
  }
  updateSummary();
};

const finishQuestion = (isCorrect) => {
  if (!state.current || state.current.answered) return;
  state.current.answered = true;
  state.current.wasCorrect = isCorrect;
  state.asked += 1;
  if (isCorrect) state.correct += 1;
  updateSummary();
};

const checkTextAnswer = () => {
  if (!state.current) return;
  const guess = answerInput.value.trim();
  if (!guess) {
    setFeedback("먼저 단어를 입력하세요.", "error");
    return;
  }
  if (state.current.answered) {
    setFeedback("이미 채점된 문제입니다. 다음으로 이동하세요.");
    return;
  }

  const correct = normalize(guess) === normalize(state.current.answer);
  if (correct) {
    finishQuestion(true);
    setFeedback("정답!", "success");
    return;
  }

  if (!state.current.retryUsed) {
    state.current.retryUsed = true;
    setFeedback("오답! 한 번 더 입력해보세요.", "error");
    answerInput.value = "";
    answerInput.focus();
    return;
  }

  finishQuestion(false);
  setFeedback(`오답! 정답: ${state.current.answer}`, "error");
};

const checkImageAnswer = () => {
  if (!state.current) return;
  const blanks = [...hotspotLayer.querySelectorAll("input[data-answer]")];
  if (!blanks.length) {
    setFeedback("이미지 빈칸 정보가 없습니다.", "error");
    return;
  }
  if (state.current.answered) {
    setFeedback("이미 채점된 문제입니다. 다음으로 이동하세요.");
    return;
  }

  const misses = blanks
    .map((field) => ({
      ok: normalize(field.value) === normalize(field.dataset.answer),
      field,
    }))
    .filter((item) => !item.ok);

  const correct = misses.length === 0;
  if (correct) {
    finishQuestion(true);
    setFeedback("정답! 모든 빈칸을 맞췄습니다.", "success");
  } else if (!state.current.retryUsed) {
    state.current.retryUsed = true;
    const missLabels = misses.map((item) => `#${item.field.dataset.index}`).join(", ");
    setFeedback(`오답! 다시 입력하세요. 놓친 번호: ${missLabels}`, "error");
  } else {
    const missLabels = misses.map((item) => `#${item.field.dataset.index}: ${item.field.dataset.answer}`);
    finishQuestion(false);
    setFeedback(`오답! 정답 확인 → ${missLabels.join(", ")}`, "error");
  }
};

const checkAnswer = () => {
  if (!state.current) return;
  if (state.current.type === "image") {
    checkImageAnswer();
  } else {
    checkTextAnswer();
  }
};

const revealAnswer = () => {
  if (!state.current || state.current.answered) return;
  if (state.current.type === "image") {
    [...hotspotLayer.querySelectorAll("input[data-answer]")].forEach((field) => {
      field.value = field.dataset.answer;
    });
  } else {
    answerInput.value = state.current.answer;
  }
  state.current.answered = true;
  setFeedback("정답을 표시했습니다. 다음 문제로 이동하세요.");
  updateSummary();
};

const freshQuestion = (q) => ({
  ...q,
  answered: false,
  retryUsed: false,
  wasCorrect: false,
});

const nextQuestion = (fromCategoryChange = false) => {
  setFeedback("");
  if (!state.queue.length) {
    if (!state.filtered.length) {
      setFeedback("선택한 카테고리에 문제가 없습니다.", "error");
      promptText.textContent = "";
      return;
    }
    state.queue = shuffle(state.filtered.map(freshQuestion));
    if (!fromCategoryChange) {
      setFeedback("모든 문제를 풀었습니다. 다시 섞어서 이어갑니다.");
    }
  }
  state.current = state.queue.shift();
  renderQuestion(state.current);
};

const setCategory = (category) => {
  state.category = category;
  if (category === "ALL") {
    state.filtered = [...state.allQuestions];
  } else {
    state.filtered = state.allQuestions.filter((q) => q.category === category);
  }
  state.asked = 0;
  state.correct = 0;
  state.queue = shuffle(state.filtered.map(freshQuestion));
  state.current = null;
  updateSummary();
  nextQuestion(true);
};

const buildCategoryBar = (categories) => {
  categoryBar.innerHTML = "";

  const makeChip = (label, key, count) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chip";
    chip.textContent = `${label} (${count})`;
    chip.dataset.key = key;
    if (key === state.category) chip.classList.add("active");
    chip.addEventListener("click", () => {
      [...categoryBar.querySelectorAll(".chip")].forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      setCategory(key);
    });
    return chip;
  };

  const totalCount = state.allQuestions.length;
  categoryBar.appendChild(makeChip("전체", "ALL", totalCount));

  categories.forEach((cat) => {
    const count = state.categoryCounts[cat] || 0;
    categoryBar.appendChild(makeChip(cat, cat, count));
  });
};

const flattenData = (data) => {
  const list = [];
  Object.entries(data || {}).forEach(([category, pairs], catIdx) => {
    if (!pairs || typeof pairs !== "object") return;
    Object.entries(pairs).forEach(([definition, answer], idx) => {
      if (!definition || !answer) return;
      list.push({
        id: `${catIdx}-${idx}`,
        type: "text",
        category,
        prompt: definition,
        answer,
      });
    });
  });
  return list;
};

const loadQuestions = async () => {
  try {
    const res = await fetch("final_word.json");
    const data = await res.json();
    const textQuestions = flattenData(data);
    const preparedImages = imageQuestions.map((item, idx) => ({
      id: `image-${idx}`,
      type: "image",
      category: item.category || "이미지",
      ...item,
    }));

    state.allQuestions = [...textQuestions, ...preparedImages];
    state.categoryCounts = state.allQuestions.reduce((acc, q) => {
      acc[q.category] = (acc[q.category] || 0) + 1;
      return acc;
    }, {});

    const categories = Object.keys(state.categoryCounts);
    buildCategoryBar(categories);
    setCategory("ALL");
  } catch (err) {
    setFeedback("퀴즈 데이터를 불러올 수 없습니다.", "error");
    console.error(err);
  }
};

document.getElementById("check-btn").addEventListener("click", checkAnswer);
document.getElementById("next-btn").addEventListener("click", () => nextQuestion());
document.getElementById("reveal-btn").addEventListener("click", revealAnswer);

answerInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    checkAnswer();
  }
});

hotspotLayer.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    checkAnswer();
  }
});

loadQuestions();
