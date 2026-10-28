{ // bloc isolé : aucune variable ne fuit vers les autres cartes
/*
 * Vigieau Water Restrictions Card (FR)
 * Carte Home Assistant pour l'intégration Vigieau : niveau d'alerte sécheresse et usages de l'eau
 * (arrosage, lavage, piscines…) autorisés ou interdits. Détection automatique des entités Vigieau,
 * style verre, thème clair/sombre automatique, éditeur visuel, textes en français.
 */

const CARD_VERSION = "1.1.0";

/* === NUANCE COMMUNE v2 (cartes Johan854) ===
 * Bloc identique dans toutes les cartes. Options : nuance, nuance_perso, intensite.
 * nuance "theme" (par défaut) : suit la variable carte-nuance du thème Home Assistant ;
 * si elle n'existe pas, la carte garde ses couleurs d'origine. Intensité : 0 = neutre, 1 = normal, 2 = très coloré. */
const GV_NUANCES = [["braise", "Braise (rouge)", "#e0524f"], ["ocean", "Océan (bleu)", "#2f8fd8"], ["lagon", "Lagon (turquoise)", "#1fb5a8"], ["foret", "Forêt (vert)", "#3fae5a"], ["lavande", "Lavande (violet)", "#8a63d8"], ["framboise", "Framboise (rose)", "#e05597"], ["ambre", "Ambre (orange)", "#e8902c"], ["ardoise", "Ardoise (neutre)", "#7d8595"]];
const GV_DEFAULTS = { nuance: "theme", intensite: 1 };
const gvAccent = (c) => {
  const p = c && c.nuance_perso;
  if (c && c.nuance === "perso") {
    if (Array.isArray(p) && p.length === 3) return "#" + p.map((v) => Math.max(0, Math.min(255, Math.round(+v || 0))).toString(16).padStart(2, "0")).join("");
    if (typeof p === "string" && /^#?[0-9a-f]{6}$/i.test(p.trim())) return "#" + p.trim().replace("#", "");
  }
  const n = GV_NUANCES.find((x) => x[0] === (c && c.nuance));
  return n ? n[2] : "var(--carte-nuance)";
};
/* Variables posées sur <ha-card> : --g-bg-x (fond dégradé teinté) et --acc-ui-x (couleur d'accent).
 * Sans nuance (thème sans carte-nuance), elles sont invalides : chaque carte retombe alors sur ses couleurs d'origine. */
const gvStyle = (c, dark) => {
  const i = Number(c && c.intensite), ai = Number.isFinite(i) ? Math.max(0, Math.min(2, i)) : 1;
  const m = (pct, base) => `color-mix(in srgb,var(--acc-ui) ${+(pct * ai).toFixed(1)}%,${base})`;
  const bg = dark ? `linear-gradient(160deg,${m(5, "#1b1e32")} 0%,${m(11, "#1f1b2c")} 55%,${m(22, "#1c1620")} 100%)`
    : `linear-gradient(160deg,${m(2, "#f8f9fd")} 0%,${m(5, "#eef1f8")} 55%,${m(11, "#f8f8fa")} 100%)`;
  return `--acc-ui:${gvAccent(c)};--g-bg-x:${bg};--acc-ui-x:color-mix(in srgb,var(--acc-ui) ${dark ? "80%,#fff" : "82%,#000"})`;
};
const GV_FIELDS = [
  { name: "nuance", selector: { select: { mode: "dropdown", options: [{ value: "theme", label: "Selon le thème (couleurs d'origine)" }, ...GV_NUANCES.map((n) => ({ value: n[0], label: n[1] })), { value: "perso", label: "Personnalisée" }] } } },
  { name: "nuance_perso", selector: { color_rgb: {} } },
  { name: "intensite", selector: { number: { min: 0, max: 2, step: 0.1, mode: "slider" } } }];
const GV_LABELS = { nuance: "Nuance de couleur", nuance_perso: "Couleur personnalisée (nuance « Personnalisée »)", intensite: "Intensité de la nuance" };
/* === FIN NUANCE COMMUNE === */

const DEFAULTS = {
  title: "Restrictions d'eau",
  theme: "auto", nuance: "theme", intensite: 1, // auto | light | dark
  commune: "", // ex. la_chapelle_themer (vide = détection automatique)
  level_entity: "", // vide = détection automatique
  level_numeric_entity: "", // vide = détection automatique
  only_restricted: false, // n'afficher que les usages interdits
  columns: 0, // colonnes (0 = automatique)
  usages: [], // liste manuelle (avancé) : { name, icon, allowed_entity, restriction_entity }
};

const LEVELS = [
  { n: 0, label: "Pas de restriction", tone: "ok" },
  { n: 1, label: "Vigilance", tone: "vig" },
  { n: 2, label: "Alerte", tone: "warn" },
  { n: 3, label: "Alerte renforcée", tone: "err" },
  { n: 4, label: "Crise", tone: "crit" },
];

const ICONS = [
  [/fontaine/, "mdi:fountain"], [/arbres|plantes/, "mdi:tree"], [/golf/, "mdi:golf"], [/potager/, "mdi:carrot"],
  [/pelouse/, "mdi:grass"], [/voirie|trottoir/, "mdi:road-variant"], [/nautique/, "mdi:sail-boat"], [/toiture|facade/, "mdi:home-roof"],
  [/vehicule/, "mdi:car-wash"], [/maraichage|culture/, "mdi:tractor"], [/navigation/, "mdi:ferry"], [/canaux/, "mdi:waves"],
  [/plans?_d_eau/, "mdi:water"], [/specifique/, "mdi:alert-circle-outline"], [/cours_d_eau/, "mdi:excavator"], [/animaux/, "mdi:paw"],
  [/piscine/, "mdi:pool"],
];

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const isNum = (v) => v !== undefined && v !== null && v !== "" && !isNaN(Number(v));
const missing = (st) => !st || st.state === "unavailable" || st.state === "unknown" || st.state === "none" || st.state === "";
const pretty = (s) => { const t = String(s).replace(/_/g, " "); return t.charAt(0).toUpperCase() + t.slice(1); };

class VigieauWaterCard extends HTMLElement {
  static getConfigElement() {
    return document.createElement("vigieau-water-card-editor");
  }

  static getStubConfig() {
    return { ...DEFAULTS };
  }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._sig = "";
    this._open = new Set();
  }

  setConfig(config) {
    if (!config) throw new Error("Configuration invalide");
    this._config = { ...DEFAULTS, ...config };
    if (!Array.isArray(this._config.usages)) this._config.usages = [];
    this._sig = "";
    if (this._hass) this._render();
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._config) return;
    const model = this._model(hass);
    const sig = JSON.stringify(model.sigParts) + "#" + (this._isDark() ? "d" : "l") + "#" + [...this._open].join(",");
    if (sig !== this._sig) {
      this._sig = sig;
      this._model_ = model;
      this._render();
    }
  }

  getCardSize() { return 7; }

  _isDark() {
    const t = this._config && this._config.theme;
    if (t === "dark") return true;
    if (t === "light") return false;
    const dm = this._hass && this._hass.themes && this._hass.themes.darkMode;
    if (typeof dm === "boolean") return dm;
    return !!(window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
  }

  _more(id) {
    if (id) this.dispatchEvent(new CustomEvent("hass-more-info", { bubbles: true, composed: true, detail: { entityId: id } }));
  }

  // Détection automatique des entités Vigieau à partir de leurs identifiants
  _model(hass) {
    const c = this._config;
    const ids = Object.keys(hass.states);
    let commune = c.commune;
    const specific = !!c.commune;
    const reBin = commune
      ? new RegExp("^binary_sensor\\.vigieau_" + commune + "_aep_(.+)_autorise_a_" + commune + "$")
      : /^binary_sensor\.vigieau_(.+?)_aep_(.+)_autorise_a_\1$/;
    const usages = [];
    if (c.usages.length) {
      c.usages.forEach((u) => usages.push({ key: u.allowed_entity || u.name, name: u.name, icon: u.icon, allowed: u.allowed_entity, restriction: u.restriction_entity }));
    } else {
      ids.forEach((id) => {
        const m = id.match(reBin);
        if (!m) return;
        const com = specific ? commune : m[1];
        const key = specific ? m[1] : m[2];
        const st = hass.states[id];
        const fname = (st.attributes.friendly_name || key).replace(/\s+autorisé.*$/i, "");
        const rid = "sensor.vigieau_aep_restrictions_" + key + "_a_" + com;
        usages.push({ key, name: fname, allowed: id, restriction: hass.states[rid] ? rid : "" });
      });
      usages.sort((a, b) => a.name.localeCompare(b.name, "fr"));
    }
    usages.forEach((u) => {
      if (!u.icon) { const hit = ICONS.find(([re]) => re.test(String(u.key))); u.icon = hit ? hit[1] : "mdi:water"; }
    });
    let level = c.level_entity, levelNum = c.level_numeric_entity;
    if (!level) level = ids.find((i) => /^sensor\.vigieau_.+_aep_niveau_d_alerte_a_.+/.test(i) && !/_numerique$/.test(i)) || "";
    if (!levelNum) levelNum = ids.find((i) => /^sensor\.vigieau_.+_aep_niveau_d_alerte_a_.+_numerique$/.test(i)) || "";
    const sigParts = [level, levelNum, ...usages.map((u) => u.allowed), ...[level, levelNum, ...usages.flatMap((u) => [u.allowed, u.restriction])].filter(Boolean).map((e) => { const s = hass.states[e]; return s ? s.state : "x"; })];
    return { usages, level, levelNum, sigParts };
  }

  _levelInfo(model) {
    const h = this._hass;
    let n = null;
    const sn = model.levelNum && h.states[model.levelNum];
    if (sn && isNum(sn.state)) n = Math.max(0, Math.min(4, Math.round(Number(sn.state))));
    const st = model.level && h.states[model.level];
    const text = st && !missing(st) ? String(st.state) : "";
    if (n === null && text) {
      const t = text.toLowerCase();
      n = /crise/.test(t) ? 4 : /renforc/.test(t) ? 3 : /alerte/.test(t) ? 2 : /vigilance/.test(t) ? 1 : 0;
    }
    return { n, text };
  }

  _render() {
    const c = this._config, h = this._hass;
    if (!c || !h) return;
    const model = this._model_ || this._model(h);
    const dark = this._isDark();
    const { n, text } = this._levelInfo(model);
    const lv = n === null ? null : LEVELS[n];
    const levelLabel = text ? pretty(text) : lv ? lv.label : "Indisponible";

    const items = model.usages.map((u) => {
      const st = h.states[u.allowed];
      const known = st && st.state !== "unavailable" && st.state !== "unknown";
      const allowed = known && st.state === "on";
      const rs = u.restriction ? h.states[u.restriction] : null;
      const rtext = rs && !missing(rs) ? String(rs.state) : "";
      const desc = rs && rs.attributes ? (rs.attributes.description || rs.attributes.details || rs.attributes.detail || "") : "";
      // Autorisé mais avec une restriction annoncée (horaires, conditions…) : « Sous conditions »
      const plain = /^(autoris[ée]e?s?|aucune restriction|pas de restriction|aucune)\.?$/i.test(rtext.trim());
      const cond = known && allowed && !!rtext && !plain;
      return { ...u, known, allowed, cond, rtext, desc: typeof desc === "string" ? desc : "" };
    });
    const restricted = items.filter((i) => i.known && !i.allowed).length;
    const conds = items.filter((i) => i.cond).length;
    const rank = (i) => (!i.known ? 3 : !i.allowed ? 0 : i.cond ? 1 : 2);
    const shown = items
      .filter((i) => !c.only_restricted || (i.known && !i.allowed))
      .sort((a, b) => rank(a) - rank(b));
    const cols = Number(c.columns) > 0 ? Number(c.columns) : 0;

    const rows = shown.map((i) => {
      const open = this._open.has(i.key);
      const tone = !i.known ? "na" : !i.allowed ? "ko" : i.cond ? "cond" : "ok";
      const label = !i.known ? "Indisponible" : !i.allowed ? "Interdit" : i.cond ? "Sous conditions" : "Autorisé";
      const hasDetail = !!(i.rtext || i.desc);
      return `<div class="it ${tone} ${open ? "open" : ""}">
        <button class="top" data-k="${esc(i.key)}" ${hasDetail ? "" : 'data-nodetail="1"'}>
          <span class="ic"><ha-icon icon="${esc(i.icon)}"></ha-icon></span>
          <span class="nm"><b>${esc(i.name)}</b>${i.rtext && !open ? `<small>${esc(i.rtext)}</small>` : ""}</span>
          <span class="bd">${label}</span>
        </button>
        ${open && hasDetail ? `<div class="dt">${i.rtext ? `<p>${esc(i.rtext)}</p>` : ""}${i.desc ? `<p class="d2">${esc(i.desc)}</p>` : ""}<button class="mi" data-more="${esc(i.restriction || i.allowed)}">Détails de l'entité</button></div>` : ""}
      </div>`;
    }).join("");

    const meter = LEVELS.map((l) => `<i class="seg ${n !== null && l.n <= n ? "on t-" + (lv ? lv.tone : "ok") : ""} ${n === l.n ? "cur" : ""}" title="${esc(l.label)}"></i>`).join("");

    this.shadowRoot.innerHTML = `
      <style>
        * { box-sizing:border-box; }
        ha-card.dark {
          --vg-text:#f4f6fb; --vg-muted:#a9afc0; --vg-bg:var(--g-bg-x,linear-gradient(160deg,#1b1e32 0%,#241a2a 55%,#2d1519 100%));
          --vg-border:rgba(255,255,255,.14); --vg-shadow:0 .6em 2em rgba(0,0,0,.35);
          --vg-glass:rgba(255,255,255,.07); --vg-glass-b:rgba(255,255,255,.13); --vg-fill:rgba(255,255,255,.09); --vg-fill-b:rgba(255,255,255,.16);
          --vg-ok:#3ddc84; --vg-vig:#d6e04a; --vg-warn:#ffb86b; --vg-err:#ff6a4d; --vg-crit:#ff3b5c; --vg-ko:#ff5a5f; --vg-na:#8a8f9c;
        }
        ha-card.light {
          --vg-text:#1c2030; --vg-muted:#5d6477; --vg-bg:var(--g-bg-x,linear-gradient(160deg,#f8f9fd 0%,#eef1f8 55%,#f8eff0 100%));
          --vg-border:rgba(20,24,40,.12); --vg-shadow:0 .4em 1.4em rgba(20,24,40,.12);
          --vg-glass:rgba(255,255,255,.7); --vg-glass-b:rgba(20,24,40,.1); --vg-fill:rgba(20,24,40,.06); --vg-fill-b:rgba(20,24,40,.14);
          --vg-ok:#1a9d55; --vg-vig:#8a9a00; --vg-warn:#c77a14; --vg-err:#d4401f; --vg-crit:#c4163d; --vg-ko:#d32f35; --vg-na:#8a8f9c;
        }
        ha-card { display:flex; flex-direction:column; gap:12px; padding:16px; overflow:hidden; color:var(--vg-text);
          border-radius:24px; border:1px solid var(--vg-border); background:var(--vg-bg); box-shadow:var(--vg-shadow); }
        ha-icon { --mdc-icon-size:1.3em; flex:none; }
        button { font:inherit; color:inherit; cursor:pointer; border:0; background:none; padding:0; text-align:left; -webkit-tap-highlight-color:transparent; }
        h2 { margin:0; font-size:1.1em; font-weight:650; display:flex; align-items:center; gap:.5em; }
        .lvl { display:flex; flex-direction:column; gap:10px; padding:14px; border-radius:18px; background:var(--vg-glass); border:1px solid var(--vg-glass-b);
          -webkit-backdrop-filter:blur(18px) saturate(140%); backdrop-filter:blur(18px) saturate(140%); }
        .lvl .row { display:flex; align-items:center; justify-content:space-between; gap:10px; }
        .lvl .lab { font-size:.74em; color:var(--vg-muted); text-transform:uppercase; letter-spacing:.08em; }
        .lvl .val { font-size:1.45em; font-weight:750; color:var(--vg-${lv ? lv.tone : "na"}); }
        .lvl .sum { font-size:.82em; color:var(--vg-muted); text-align:right; }
        .meter { display:grid; grid-template-columns:repeat(5,1fr); gap:5px; }
        .seg { height:.55em; border-radius:.3em; background:var(--vg-fill-b); display:block; }
        .seg.on.t-ok { background:var(--vg-ok); } .seg.on.t-vig { background:var(--vg-vig); } .seg.on.t-warn { background:var(--vg-warn); }
        .seg.on.t-err { background:var(--vg-err); } .seg.on.t-crit { background:var(--vg-crit); }
        .seg.cur { box-shadow:0 0 .7em currentColor; }
        .tabs { display:flex; gap:.5em; }
        .tab { padding:.4em .9em; border-radius:2em; font-size:.8em; font-weight:650; background:var(--vg-fill); border:1px solid var(--vg-fill-b); color:var(--vg-muted); }
        .tab.sel { color:var(--vg-text); border-color:var(--vg-text); }
        .list { display:grid; gap:8px; grid-template-columns:${cols ? `repeat(${cols},minmax(0,1fr))` : "repeat(auto-fit,minmax(min(100%,17em),1fr))"}; align-items:start; }
        .it { border-radius:1.05em; background:var(--vg-glass); border:1px solid var(--vg-glass-b); min-width:0; overflow:hidden; }
        .it.ko { border-color:color-mix(in srgb, var(--vg-ko) 55%, transparent); }
        .top { display:flex; align-items:center; gap:.7em; padding:.6em .75em; width:100%; }
        .ic { display:grid; place-items:center; width:2.3em; height:2.3em; border-radius:50%; background:var(--vg-fill); border:1px solid var(--vg-fill-b); flex:none; }
        .it.cond .ic, .it.cond .bd { color:var(--vg-warn); }
        .it.ok .ic { color:var(--vg-ok); } .it.ko .ic { color:var(--vg-ko); } .it.na .ic { color:var(--vg-na); }
        .nm { display:flex; flex-direction:column; min-width:0; flex:1; }
        .nm b { font-size:.86em; font-weight:650; line-height:1.2; }
        .nm small { font-size:.72em; color:var(--vg-muted); display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
        .bd { font-size:.72em; font-weight:700; padding:.25em .7em; border-radius:2em; white-space:nowrap; border:1px solid currentColor; }
        .it.ok .bd { color:var(--vg-ok); } .it.ko .bd { color:var(--vg-ko); background:color-mix(in srgb, var(--vg-ko) 14%, transparent); } .it.na .bd { color:var(--vg-na); }
        .dt { padding:0 .75em .7em; font-size:.8em; display:flex; flex-direction:column; gap:.4em; }
        .dt p { margin:0; line-height:1.35; } .dt .d2 { color:var(--vg-muted); }
        .mi { align-self:flex-start; font-size:.85em; color:var(--vg-muted); text-decoration:underline; }
        .empty { color:var(--vg-muted); font-size:.9em; padding:.4em 0; }
      </style>
      <ha-card class="${dark ? "dark" : "light"}" style="${gvStyle(this._config, dark)}">
        ${c.title ? `<h2><ha-icon icon="mdi:water-alert"></ha-icon>${esc(c.title)}</h2>` : ""}
        <button class="lvl" ${model.level ? `data-more="${esc(model.level)}"` : ""}>
          <span class="row"><span><span class="lab">Niveau d'alerte</span><br><span class="val">${esc(levelLabel)}</span></span>
            <span class="sum">${items.length ? (restricted ? `${restricted} usage${restricted > 1 ? "s" : ""} interdit${restricted > 1 ? "s" : ""}${conds ? ` · ${conds} sous conditions` : ""}<br>sur ${items.length}` : conds ? `${conds} usage${conds > 1 ? "s" : ""} sous conditions<br>sur ${items.length}` : `Tous les usages<br>autorisés`) : ""}</span></span>
          <span class="meter">${meter}</span>
        </button>
        ${items.length ? `<div class="tabs"><button class="tab ${c.only_restricted ? "" : "sel"}" data-f="all">Tous (${items.length})</button><button class="tab ${c.only_restricted ? "sel" : ""}" data-f="ko">Interdits (${restricted})</button></div>` : ""}
        <div class="list">${rows || `<div class="empty">${items.length ? "Aucun usage interdit 🎉" : "Aucune entité Vigieau trouvée. Vérifiez que l'intégration est configurée et ajoutez la commune dans l'éditeur."}</div>`}</div>
      </ha-card>`;

    const root = this.shadowRoot;
    root.querySelectorAll("[data-more]").forEach((el) => el.addEventListener("click", (e) => { e.stopPropagation(); this._more(el.dataset.more); }));
    root.querySelectorAll(".top").forEach((el) => el.addEventListener("click", () => {
      if (el.dataset.nodetail) { this._more((shown.find((s) => s.key === el.dataset.k) || {}).allowed); return; }
      const k = el.dataset.k;
      this._open.has(k) ? this._open.delete(k) : this._open.add(k);
      this._sig = ""; this._model_ = null; this._render();
    }));
    root.querySelectorAll(".tab").forEach((el) => el.addEventListener("click", () => {
      this._config = { ...this._config, only_restricted: el.dataset.f === "ko" };
      this._model_ = null; this._render();
    }));
  }
}

/* ---------- Éditeur visuel ---------- */
const LABELS = { ...GV_LABELS,
  title: "Titre", theme: "Thème", commune: "Commune (identifiant, ex. la_chapelle_themer ; vide = automatique)",
  level_entity: "Niveau d'alerte (vide = automatique)", level_numeric_entity: "Niveau d'alerte numérique (vide = automatique)",
  only_restricted: "N'afficher que les usages interdits", columns: "Colonnes (0 = automatique)",
};
const SCHEMA = [
  { name: "title", selector: { text: {} } },
  { type: "grid", name: "", schema: [
    { name: "theme", selector: { select: { mode: "dropdown", options: [
      { value: "auto", label: "Automatique (thème de Home Assistant)" }, { value: "light", label: "Clair" }, { value: "dark", label: "Sombre" } ] } } }, ...GV_FIELDS,
    { name: "columns", selector: { number: { min: 0, max: 6, mode: "box" } } },
  ] },
  { name: "only_restricted", selector: { boolean: {} } },
  { type: "expandable", title: "Entités (détection automatique par défaut)", name: "", schema: [
    { name: "commune", selector: { text: {} } },
    { name: "level_entity", selector: { entity: { domain: "sensor" } } },
    { name: "level_numeric_entity", selector: { entity: { domain: "sensor" } } },
  ] },
];

class VigieauWaterCardEditor extends HTMLElement {
  setConfig(config) {
    this._config = { ...DEFAULTS, ...config };
    this._build();
  }
  set hass(hass) {
    this._hass = hass;
    if (this._form) this._form.hass = hass;
  }
  _build() {
    if (!this._form) {
      this._form = document.createElement("ha-form");
      this._form.computeLabel = (s) => LABELS[s.name] || s.name;
      this._form.schema = SCHEMA;
      this._form.addEventListener("value-changed", (ev) => {
        ev.stopPropagation();
        this._config = { ...this._config, ...ev.detail.value };
        this.dispatchEvent(new CustomEvent("config-changed", { detail: { config: this._config }, bubbles: true, composed: true }));
      });
      this.appendChild(this._form);
    }
    this._form.hass = this._hass;
    this._form.data = this._config;
  }
}

customElements.define("vigieau-water-card", VigieauWaterCard);
customElements.define("vigieau-water-card-editor", VigieauWaterCardEditor);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "vigieau-water-card",
  name: "Vigieau Water Card (FR)",
  description: "Niveau d'alerte sécheresse et usages de l'eau autorisés ou interdits (intégration Vigieau).",
  preview: true,
});

console.info(
  `%c VIGIEAU-WATER-CARD %c v${CARD_VERSION} `,
  "color:#fff;background:#1a76d2;font-weight:700;border-radius:3px 0 0 3px;padding:2px 4px",
  "color:#1a76d2;background:#fff;font-weight:700;border-radius:0 3px 3px 0;padding:2px 4px"
);
}
