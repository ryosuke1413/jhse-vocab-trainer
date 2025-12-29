const $ = (id) => document.getElementById(id);

const els = {
  setup: $("setup"),
  quiz: $("quiz"),
  result: $("result"),

  userName: $("userName"),
  saveUserBtn: $("saveUserBtn"),

  level: $("level"),
  mode: $("mode"),

  startBtn: $("startBtn"),
  reviewBtn: $("reviewBtn"),
  resetBtn: $("resetBtn"),

  totalOk: $("totalOk"),
  totalAns: $("totalAns"),
  acc: $("acc"),
  missCnt: $("missCnt"),

  progress: $("progress"),
  qTypePill: $("qTypePill"),
  qText: $("qText"),
  choices: $("choices"),

  typing: $("typing"),
  typeMeaning: $("typeMeaning"),
  typeExample: $("typeExample"),
  typeInput: $("typeInput"),
  checkBtn: $("checkBtn"),

  feedback: $("feedback"),
  nextBtn: $("nextBtn"),
  quitBtn: $("quitBtn"),

  resultText: $("resultText"),
  backBtn: $("backBtn"),
  retryMissBtn: $("retryMissBtn"),
  missList: $("missList"),

  rankChip: $("rankChip"),
  rankName: $("rankName"),
  rankRemain: $("rankRemain"),
  barFill: $("barFill"),
  rankList: $("rankList"),
  rankDetails: $("rankDetails")
};

const LS_KEY = "jhse_vocab_users_v2";

const QUIZ_TOTAL = 10;
const MCQ_COUNT = 8;
const TYPE_COUNT = 2;

// ランク（指定）
const RANKS = [
  { key: "beginner",  name: "ビギナー",     needOk: 0,    css: "rank-beginner" },
  { key: "iron",      name: "アイロン",     needOk: 50,   css: "rank-iron" },
  { key: "bronze",    name: "ブロンズ",     needOk: 150,  css: "rank-bronze" },
  { key: "silver",    name: "シルバー",     needOk: 300,  css: "rank-silver" },
  { key: "gold",      name: "ゴールド",     needOk: 500,  css: "rank-gold" },
  { key: "platinum",  name: "プラチナ",     needOk: 800,  css: "rank-platinum" },
  { key: "diamond",   name: "ダイヤモンド", needOk: 1200, css: "rank-diamond" },
  { key: "master",    name: "マスター",     needOk: 1800, css: "rank-master" }
];

let DATA = null;
let users = loadUsers();
let currentUser = null;

let currentQuiz = null;
let answeredLock = false; // ★二重採点防止（入力も4択も共通）

function loadUsers() {
  try { return JSON.parse(localStorage.getItem(LS_KEY)) ?? {}; }
  catch { return {}; }
}
function saveUsers() {
  localStorage.setItem(LS_KEY, JSON.stringify(users));
}

function normalizeEn(s) { return (s ?? "").trim().toLowerCase(); }
function shuffle(arr){
  const a=[...arr];
  for(let i=a.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [a[i],a[j]]=[a[j],a[i]];
  }
  return a;
}
function pickN(arr,n){ return shuffle(arr).slice(0, Math.min(n, arr.length)); }

function show(section){
  els.setup.classList.add("hidden");
  els.quiz.classList.add("hidden");
  els.result.classList.add("hidden");
  section.classList.remove("hidden");

  // ★setup表示時に入力欄が出ないように（念のため）
  if (section === els.setup) {
    els.typing.classList.add("hidden");
    els.typing.setAttribute("aria-hidden", "true");
  }
}

async function loadData(){
  const res = await fetch("./words.json", { cache: "no-store" });
  DATA = await res.json();

  els.level.innerHTML = "";
  for (const lv of DATA.levels) {
    const opt = document.createElement("option");
    opt.value = lv.id;
    opt.textContent = lv.name;
    els.level.appendChild(opt);
  }
}

function ensureUser(name){
  if (!users[name]) {
    users[name] = { totalAns: 0, totalOk: 0, miss: {} };
    saveUsers();
  }
}
function getUser(){ return users[currentUser]; }

function setUserFromInput(){
  const name = els.userName.value.trim();
  if(!name){ alert("ユーザ名を入力してください。"); return false; }
  currentUser = name;
  ensureUser(currentUser);
  users._lastUser = currentUser;
  saveUsers();
  updateUI();
  return true;
}

function loadLastUser(){
  const last = users._lastUser;
  if (last && typeof last === "string") {
    els.userName.value = last;
    currentUser = last;
    ensureUser(currentUser);
  }
  renderRankList();
  // スマホではランク一覧をデフォルトで閉じる
  if (window.matchMedia && window.matchMedia("(max-width: 700px)").matches) {
    els.rankDetails?.removeAttribute("open");
  } else {
    els.rankDetails?.setAttribute("open", "");
  }
  updateUI();
}

function calcRank(totalOk){
  let idx = 0;
  for (let i=0; i<RANKS.length; i++){
    if (totalOk >= RANKS[i].needOk) idx = i;
  }
  const cur = RANKS[idx];
  const next = RANKS[Math.min(idx+1, RANKS.length-1)];
  const isMax = (idx === RANKS.length-1);
  const remain = isMax ? 0 : Math.max(0, next.needOk - totalOk);

  const curFloor = cur.needOk;
  const nextCeil = isMax ? (cur.needOk + 1) : next.needOk;
  const denom = Math.max(1, nextCeil - curFloor);
  const pct = isMax ? 100 : Math.max(0, Math.min(100, ((totalOk - curFloor) / denom) * 100));

  return { cur, next, isMax, remain, pct };
}

function renderRankList(){
  els.rankList.innerHTML = "";
  for (const r of RANKS) {
    const div = document.createElement("div");
    div.className = `rankBadge ${r.css}`;
    div.textContent = r.name;
    div.dataset.rankKey = r.key;
    els.rankList.appendChild(div);
  }
}

function updateRankUI(){
  if(!currentUser){
    els.rankChip.textContent = "RANK";
    els.rankChip.className = "rankChip";
    els.rankName.textContent = "-";
    els.rankRemain.textContent = "-";
    els.barFill.style.width = "0%";
    [...els.rankList.children].forEach(el => el.classList.remove("active"));
    return;
  }

  const u = getUser();
  const { cur, isMax, remain, pct } = calcRank(u.totalOk);

  els.rankChip.textContent = cur.name;
  els.rankChip.className = `rankChip ${cur.css}`;
  els.rankName.textContent = cur.name;
  els.rankRemain.textContent = isMax ? "MAX" : `あと ${remain} 問`;
  els.barFill.style.width = `${pct}%`;

  [...els.rankList.children].forEach(el => {
    el.classList.toggle("active", el.dataset.rankKey === cur.key);
  });
}

function updateStatsUI(){
  if(!currentUser){
    els.totalAns.textContent = "0";
    els.totalOk.textContent = "0";
    els.acc.textContent = "0%";
    els.missCnt.textContent = "0";
    return;
  }
  const u = getUser();
  els.totalAns.textContent = String(u.totalAns);
  els.totalOk.textContent = String(u.totalOk);
  els.missCnt.textContent = String(Object.keys(u.miss).length);
  const acc = u.totalAns === 0 ? 0 : Math.round((u.totalOk / u.totalAns) * 100);
  els.acc.textContent = `${acc}%`;
}

function updateUI(){
  updateStatsUI();
  updateRankUI();
}

function getSelectedLevel(){
  const id = els.level.value;
  return DATA.levels.find(l => l.id === id);
}

function makeMCQ(word, mode, allWords){
  const prompt = (mode === "en_to_ja") ? word.en : word.ja;
  const answer = (mode === "en_to_ja") ? word.ja : word.en;

  const pool = allWords.filter(w => ((mode === "en_to_ja") ? w.ja : w.en) !== answer);
  const dummies = pickN(pool, 3).map(w => (mode === "en_to_ja") ? w.ja : w.en);
  const choices = shuffle([answer, ...dummies]);

  return { type: "mcq", prompt, answer, choices, word };
}

// 入力：意味＋例文( ) を表示（答え自体は表示しない）
function makeTyping(word){
  return {
    type: "type",
    meaning: word.ja,
    example: word.ex ?? "I ( ) every day.",
    answer: word.en,
    word
  };
}

function buildQuiz(words, mode){
  const typingPick = pickN(words, TYPE_COUNT);
  const remaining = words.filter(w => !typingPick.includes(w));
  const mcqPick = pickN(remaining.length ? remaining : words, MCQ_COUNT);

  const qs = [
    ...mcqPick.map(w => makeMCQ(w, mode, words)),
    ...typingPick.map(w => makeTyping(w))
  ];
  return { idx: 0, questions: shuffle(qs), correct: 0, wrongList: [] };
}

function markMiss(word){
  const u = getUser();
  const key = normalizeEn(word.en);
  const prev = u.miss[key];
  u.miss[key] = {
    en: word.en,
    ja: word.ja,
    missCount: (prev?.missCount ?? 0) + 1,
    lastMissAt: Date.now()
  };
}

function unmarkMiss(word){
  const u = getUser();
  const key = normalizeEn(word.en);
  if (u.miss[key]) delete u.miss[key];
}

function commitAnswer(isCorrect, word, correctAnswerText){
  const u = getUser();
  u.totalAns += 1;

  if (isCorrect) {
    u.totalOk += 1;
    currentQuiz.correct += 1;
    unmarkMiss(word);
    els.feedback.textContent = "正解！";
  } else {
    markMiss(word);
    els.feedback.textContent = `不正解。正解：${correctAnswerText}`;
    currentQuiz.wrongList.push({ en: word.en, ja: word.ja });
  }

  saveUsers();
  updateUI();
  els.nextBtn.disabled = false;
}

function renderQuestion(){
  answeredLock = false;
  els.checkBtn.disabled = false;

  const qz = currentQuiz;
  const q = qz.questions[qz.idx];

  els.progress.textContent = `${qz.idx + 1} / ${QUIZ_TOTAL}`;
  els.feedback.textContent = "";
  els.nextBtn.disabled = true;

  // reset views
  els.choices.innerHTML = "";
  els.typing.classList.add("hidden");
  els.typing.setAttribute("aria-hidden", "true");
  els.choices.classList.remove("hidden");

  // fade in
  els.quiz.classList.remove("fadeOut");
  els.quiz.classList.add("fadeIn");
  setTimeout(() => els.quiz.classList.remove("fadeIn"), 240);

  if (q.type === "mcq") {
    els.qTypePill.textContent = "4択";
    els.qText.textContent = q.prompt;

    q.choices.forEach(choice => {
      const btn = document.createElement("button");
      btn.className = "choice";
      btn.textContent = choice;
      btn.onclick = () => onAnswerMCQ(choice, btn);
      els.choices.appendChild(btn);
    });
  } else {
    els.qTypePill.textContent = "入力";
    els.qText.textContent = "次の空欄 ( ) に入る英単語を入力";

    els.choices.classList.add("hidden");
    els.typing.classList.remove("hidden");
    els.typing.setAttribute("aria-hidden", "false");

    els.typeMeaning.textContent = `意味：${q.meaning}`;
    els.typeExample.textContent = `例文：${q.example}`;

    els.typeInput.value = "";
    els.typeInput.focus();
  }
}

function onAnswerMCQ(choice, btnEl){
  if (answeredLock) return;
  answeredLock = true;

  const q = currentQuiz.questions[currentQuiz.idx];
  [...els.choices.querySelectorAll(".choice")].forEach(b => b.disabled = true);

  const isCorrect = choice === q.answer;
  if (isCorrect) {
    btnEl.classList.add("correct", "pulseOk");
  } else {
    btnEl.classList.add("wrong", "pulseNg");
    [...els.choices.querySelectorAll(".choice")].forEach(b => {
      if (b.textContent === q.answer) b.classList.add("correct");
    });
  }

  commitAnswer(isCorrect, q.word, q.answer);

  // 4択は自動遷移
  setTimeout(() => els.nextBtn.click(), 380);
}

function onAnswerTyping(){
  if (answeredLock) return;            // ★連打防止
  answeredLock = true;
  els.checkBtn.disabled = true;

  const q = currentQuiz.questions[currentQuiz.idx];
  const input = normalizeEn(els.typeInput.value);
  const ans = normalizeEn(q.answer);

  const isCorrect = input === ans;

  els.typeInput.classList.remove("pulseOk","pulseNg");
  void els.typeInput.offsetWidth;
  els.typeInput.classList.add(isCorrect ? "pulseOk" : "pulseNg");

  commitAnswer(isCorrect, q.word, q.answer);

  // ★入力も数百msで自動遷移（テンポUP）
  setTimeout(() => els.nextBtn.click(), 650);
}

function finishQuiz(){
  const wrong = QUIZ_TOTAL - currentQuiz.correct;
  els.resultText.textContent = `正解 ${currentQuiz.correct} / ${QUIZ_TOTAL}（ミス ${wrong}）`;

  els.missList.innerHTML = "";
  const uniq = new Map();
  for (const w of currentQuiz.wrongList) uniq.set(w.en, w);

  if (uniq.size === 0) {
    const li = document.createElement("li");
    li.textContent = "ミスはありませんでした。";
    els.missList.appendChild(li);
  } else {
    for (const w of uniq.values()) {
      const li = document.createElement("li");
      li.textContent = `${w.en} — ${w.ja}`;
      els.missList.appendChild(li);
    }
  }

  show(els.result);
}

function startNormalQuiz(){
  if(!setUserFromInput()) return;
  const lv = getSelectedLevel();
  if (!lv || !lv.words || lv.words.length < 12) {
    alert("単語数が少なすぎます。words.json を確認してください。");
    return;
  }
  currentQuiz = buildQuiz(lv.words, els.mode.value);
  show(els.quiz);
  renderQuestion();
}

function startMissQuiz(){
  if(!setUserFromInput()) return;

  const u = getUser();
  const missWords = Object.values(u.miss)
    .sort((a,b) => (b.missCount - a.missCount) || (b.lastMissAt - a.lastMissAt))
    .map(x => ({ en: x.en, ja: x.ja, ex: "I ( ) every day." })); // exは words_v2 なら上書きされる

  if (missWords.length === 0) {
    alert("ミス単語がありません。まず通常テストを解いてください。");
    return;
  }

  currentQuiz = buildQuiz(missWords, els.mode.value);
  show(els.quiz);
  renderQuestion();
}

els.startBtn.onclick = startNormalQuiz;
els.reviewBtn.onclick = startMissQuiz;

els.nextBtn.onclick = () => {
  els.quiz.classList.add("fadeOut");
  setTimeout(() => {
    currentQuiz.idx += 1;
    if (currentQuiz.idx >= currentQuiz.questions.length) finishQuiz();
    else renderQuestion();
  }, 190);
};

els.quitBtn.onclick = () => {
  if (confirm("終了してトップに戻りますか？")) show(els.setup);
};

els.backBtn.onclick = () => show(els.setup);
els.retryMissBtn.onclick = () => startMissQuiz();

els.checkBtn.onclick = onAnswerTyping;
els.typeInput?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") onAnswerTyping();
});

els.saveUserBtn.onclick = () => {
  if (setUserFromInput()) alert("保存しました。");
};

els.resetBtn.onclick = () => {
  if(!setUserFromInput()) return;
  if(!confirm(`ユーザ「${currentUser}」の記録をリセットしますか？`)) return;
  users[currentUser] = { totalAns: 0, totalOk: 0, miss: {} };
  saveUsers();
  updateUI();
  alert("リセットしました。");
};

(async function init(){
  await loadData();
  loadLastUser();
  show(els.setup);
})();
