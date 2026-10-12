// Champion data comes live from Riot's Data Dragon, so the roster
// stays current with every patch (new champions appear automatically).
const DD = "https://ddragon.leagueoflegends.com";
const LANG = "en_US";

const state = {
  version: null,
  champions: [],
  tag: "All",
  query: "",
  sort: "name",
  current: null,
  skinIndex: 0,
};

const $ = (sel) => document.querySelector(sel);
const grid = $("#grid");

// Riot ability text contains HTML-ish markup; turn it into plain text.
function cleanText(str = "") {
  return str
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function esc(str = "") {
  return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

async function getJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} for ${url}`);
  return res.json();
}

async function init() {
  try {
    const versions = await getJSON(`${DD}/api/versions.json`);
    state.version = versions[0];
    $("#patch").textContent = state.version;

    const data = await getJSON(`${DD}/cdn/${state.version}/data/${LANG}/champion.json`);
    state.champions = Object.values(data.data);

    const count = state.champions.length;
    $("#champCountHero").textContent = count;
    $("#champCountStat").textContent = count;

    setHeroBackground();
    render();
  } catch (err) {
    console.error(err);
    grid.innerHTML = `<p class="empty">Couldn't reach Riot's Data Dragon. Check your internet connection and refresh the page.</p>`;
  }
}

function setHeroBackground() {
  const pick = state.champions[Math.floor(Math.random() * state.champions.length)];
  $("#heroBg").style.backgroundImage = `url("${DD}/cdn/img/champion/splash/${pick.id}_0.jpg")`;
}

function filtered() {
  const q = state.query.trim().toLowerCase();
  let list = state.champions.filter((c) => {
    const tagOk = state.tag === "All" || c.tags.includes(state.tag);
    const qOk = !q || c.name.toLowerCase().includes(q) || c.title.toLowerCase().includes(q);
    return tagOk && qOk;
  });
  const byName = (a, b) => a.name.localeCompare(b.name);
  const sorters = {
    "name": byName,
    "name-desc": (a, b) => byName(b, a),
    "diff-asc": (a, b) => a.info.difficulty - b.info.difficulty || byName(a, b),
    "diff-desc": (a, b) => b.info.difficulty - a.info.difficulty || byName(a, b),
  };
  return list.sort(sorters[state.sort]);
}

function render() {
  const list = filtered();
  $("#resultCount").textContent = `Showing ${list.length} of ${state.champions.length} champions`;

  if (!list.length) {
    grid.innerHTML = `<p class="empty">No champions match your search.</p>`;
    return;
  }

  grid.innerHTML = list.map((c) => `
    <button class="champ-card" data-id="${c.id}" aria-label="${esc(c.name)}, ${esc(c.title)}">
      <img src="${DD}/cdn/img/champion/loading/${c.id}_0.jpg" alt="" loading="lazy">
      <div class="champ-info">
        <h3>${esc(c.name)}</h3>
        <p>${esc(c.title)}</p>
        <div class="champ-tags">${c.tags.map((t) => `<span class="tag">${t}</span>`).join("")}</div>
      </div>
    </button>`).join("");
}

// ---------- Modal ----------
async function openChampion(id) {
  const modal = $("#modal");
  modal.hidden = false;
  document.body.classList.add("no-scroll");
  $("#mName").textContent = "Loading…";
  $("#mTitle").textContent = "";
  $("#mTags").innerHTML = "";
  $("#mSkin").textContent = "";
  $("#mBody").innerHTML = `<p class="loading">Reading the archives…</p>`;
  $("#mHero").style.backgroundImage = `url("${DD}/cdn/img/champion/splash/${id}_0.jpg")`;

  try {
    const data = await getJSON(`${DD}/cdn/${state.version}/data/${LANG}/champion/${id}.json`);
    const c = data.data[id];
    state.current = c;
    state.skinIndex = 0;
    fillModal(c);
  } catch (err) {
    console.error(err);
    $("#mBody").innerHTML = `<p class="empty">Couldn't load this champion. Please try again.</p>`;
  }
}

function fillModal(c) {
  const v = state.version;
  $("#mName").textContent = c.name;
  $("#mTitle").textContent = c.title;
  $("#mTags").innerHTML = c.tags.map((t) => `<span class="tag">${t}</span>`).join("") +
    (c.partype ? `<span class="tag">${esc(c.partype)}</span>` : "");
  showSkin();

  const ratings = [
    ["Attack", c.info.attack, ""],
    ["Defense", c.info.defense, ""],
    ["Magic", c.info.magic, ""],
    ["Difficulty", c.info.difficulty, "blue"],
  ].map(([label, val, cls]) => `
    <div class="rating"><span>${label}</span>
      <div class="bar ${cls}"><span style="width:${val * 10}%"></span></div>
      <b>${val}</b></div>`).join("");

  const s = c.stats;
  const stats = [
    ["Health", `${s.hp} (+${s.hpperlevel})`],
    ["Armor", `${s.armor} (+${s.armorperlevel})`],
    ["Magic Resist", `${s.spellblock} (+${s.spellblockperlevel})`],
    ["Attack Damage", `${s.attackdamage} (+${s.attackdamageperlevel})`],
    ["Attack Speed", `${s.attackspeed}`],
    ["Move Speed", `${s.movespeed}`],
    ["Attack Range", `${s.attackrange}`],
    ["Health Regen", `${s.hpregen}`],
  ].map(([k, val]) => `<div><span>${k}</span><b>${val}</b></div>`).join("");

  const passive = `
    <div class="ability">
      <div class="ability-icon"><img src="${DD}/cdn/${v}/img/passive/${c.passive.image.full}" alt=""><span class="ability-key">P</span></div>
      <div><h4>${esc(c.passive.name)}</h4><p>${esc(cleanText(c.passive.description))}</p></div>
    </div>`;

  const keys = ["Q", "W", "E", "R"];
  const spells = c.spells.map((sp, i) => `
    <div class="ability">
      <div class="ability-icon"><img src="${DD}/cdn/${v}/img/spell/${sp.image.full}" alt=""><span class="ability-key">${keys[i]}</span></div>
      <div>
        <h4>${esc(sp.name)}</h4>
        <p>${esc(cleanText(sp.description))}</p>
        <p class="meta">Cooldown: ${esc(sp.cooldownBurn)}s${sp.costBurn && sp.costBurn !== "0" ? ` · Cost: ${esc(sp.costBurn)}` : ""} · Range: ${esc(sp.rangeBurn)}</p>
      </div>
    </div>`).join("");

  const tips = (list, title) => list && list.length
    ? `<div><h3>${title}</h3><ul class="tips">${list.map((t) => `<li>${esc(t)}</li>`).join("")}</ul></div>` : "";

  $("#mBody").innerHTML = `
    <div><h3>Lore</h3><p class="lore">${esc(cleanText(c.lore))}</p></div>
    <div class="two-col">
      <div><h3>Ratings</h3>${ratings}</div>
      <div><h3>Base Stats</h3><div class="stat-table">${stats}</div></div>
    </div>
    <div><h3>Abilities</h3>${passive}${spells}</div>
    <div class="two-col">
      ${tips(c.allytips, `Playing as ${esc(c.name)}`)}
      ${tips(c.enemytips, `Playing against ${esc(c.name)}`)}
    </div>
    <div><h3>Skins (${c.skins.length})</h3><p class="lore">${c.skins.map((sk) => esc(sk.name === "default" ? c.name : sk.name)).join(" · ")}</p></div>`;
}

function showSkin() {
  const c = state.current;
  if (!c) return;
  const skin = c.skins[state.skinIndex];
  $("#mHero").style.backgroundImage = `url("${DD}/cdn/img/champion/splash/${c.id}_${skin.num}.jpg")`;
  const name = skin.name === "default" ? `Classic ${c.name}` : skin.name;
  $("#mSkin").textContent = `${name} — skin ${state.skinIndex + 1} of ${c.skins.length}`;
}

function stepSkin(dir) {
  const c = state.current;
  if (!c) return;
  state.skinIndex = (state.skinIndex + dir + c.skins.length) % c.skins.length;
  showSkin();
}

function closeModal() {
  $("#modal").hidden = true;
  document.body.classList.remove("no-scroll");
  state.current = null;
}

// ---------- Events ----------
grid.addEventListener("click", (e) => {
  const card = e.target.closest(".champ-card");
  if (card) openChampion(card.dataset.id);
});

$("#filters").addEventListener("click", (e) => {
  const btn = e.target.closest(".chip");
  if (!btn) return;
  document.querySelectorAll("#filters .chip").forEach((b) => b.classList.toggle("active", b === btn));
  state.tag = btn.dataset.tag;
  render();
});

$("#search").addEventListener("input", (e) => { state.query = e.target.value; render(); });
$("#sort").addEventListener("change", (e) => { state.sort = e.target.value; render(); });

$("#modal").addEventListener("click", (e) => { if (e.target.closest("[data-close]")) closeModal(); });
$("#skinPrev").addEventListener("click", () => stepSkin(-1));
$("#skinNext").addEventListener("click", () => stepSkin(1));

document.addEventListener("keydown", (e) => {
  if ($("#modal").hidden) return;
  if (e.key === "Escape") closeModal();
  if (e.key === "ArrowLeft") stepSkin(-1);
  if (e.key === "ArrowRight") stepSkin(1);
});

init();
