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
