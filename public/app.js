/* ============================================================================
   ORBIT — AFE intern connection platform (Supabase-backed, no custom server)
   Emphasis: Profile cards + login · Pair Up · Filters · real-time Messaging
   (1:1 DMs + group chats via Supabase Realtime) · brown-bag group chats ·
   AFE map with face pins across Amazon's North American hubs.
   Handoff = in-app DM + "Connect on LinkedIn" (opens the profile). No email.
   Profiles, messages, and groups all persist in Supabase (Postgres + Realtime).
   The PEOPLE array below is a design-time reference/seed source only — at
   runtime doLogin() replaces it with live rows from the `users` table.
   ========================================================================== */

/* ---------- Amazon corporate hub geo (approximate centers — never exact) ---
   Publicly listed North American Amazon HQ / Tech Hub locations:
   HQ1 = Seattle, HQ2 = Arlington (National Landing), plus the Tech Hubs.
   Ordered roughly west -> east so the filter list reads geographically. ------ */
const CITIES = {
  "Seattle, WA":      { lat:47.6062, lng:-122.3321, tz:"PT" }, // HQ1
  "Bellevue, WA":     { lat:47.6101, lng:-122.2015, tz:"PT" },
  "Portland, OR":     { lat:45.5152, lng:-122.6784, tz:"PT" },
  "Vancouver, BC":    { lat:49.2827, lng:-123.1207, tz:"PT" },
  "San Francisco, CA":{ lat:37.7749, lng:-122.4194, tz:"PT" },
  "Sunnyvale, CA":    { lat:37.3688, lng:-122.0363, tz:"PT" },
  "Santa Monica, CA": { lat:34.0195, lng:-118.4912, tz:"PT" },
  "Irvine, CA":       { lat:33.6846, lng:-117.8265, tz:"PT" },
  "San Diego, CA":    { lat:32.7157, lng:-117.1611, tz:"PT" },
  "Tempe, AZ":        { lat:33.4255, lng:-111.9400, tz:"MT" },
  "Boulder, CO":      { lat:40.0150, lng:-105.2705, tz:"MT" },
  "Denver, CO":       { lat:39.7392, lng:-104.9903, tz:"MT" },
  "Dallas, TX":       { lat:32.7767, lng:-96.7970,  tz:"CT" },
  "Austin, TX":       { lat:30.2672, lng:-97.7431,  tz:"CT" },
  "Minneapolis, MN":  { lat:44.9778, lng:-93.2650,  tz:"CT" },
  "Chicago, IL":      { lat:41.8781, lng:-87.6298,  tz:"CT" },
  "Nashville, TN":    { lat:36.1627, lng:-86.7816,  tz:"CT" },
  "Detroit, MI":      { lat:42.3314, lng:-83.0458,  tz:"ET" },
  "Pittsburgh, PA":   { lat:40.4406, lng:-79.9959,  tz:"ET" },
  "Atlanta, GA":      { lat:33.7490, lng:-84.3880,  tz:"ET" },
  "Toronto, ON":      { lat:43.6532, lng:-79.3832,  tz:"ET" },
  "Arlington, VA":    { lat:38.8799, lng:-77.1068,  tz:"ET" }, // HQ2 / National Landing
  "Herndon, VA":      { lat:38.9696, lng:-77.3861,  tz:"ET" },
  "New York, NY":     { lat:40.7128, lng:-74.0060,  tz:"ET" },
  "Boston, MA":       { lat:42.3601, lng:-71.0589,  tz:"ET" },
  "Remote / Virtual": { lat:39.5,    lng:-98.35,    tz:"—"  }
};
const INTERESTS = ["backend systems","frontend","ML / AI","distributed systems","mobile","security","data eng","design systems","UX research","accessibility","devtools","gaming","rock climbing","coffee","running","board games","cooking","photography","music"];

/* ---------- Building suggestions per hub ------------------------------------
   The building field is FREE-TEXT (users type their real building, e.g. "SEA40")
   — these are just autocomplete SUGGESTIONS shown in a <datalist>, keyed by city.
   They are a SAMPLE starter set, NOT the authoritative Amazon directory. To load
   the full, real list, paste the atoz workplace directory export here (same
   shape: "City, ST": ["CODE1","CODE2", ...]). Anything a user types that's not
   listed is still accepted and becomes filterable. ------------------------- */
const BUILDINGS = {
  "Seattle, WA":      ["SEA40","SEA41","SEA10","SEA20","SEA21","SEA22","SEA23","SEA43","SEA48","SEA61","SEA62","SEA83"],
  "Bellevue, WA":     ["BEL10","BEL11","BEL15","BEL25","BEL27","BEL30","BEL33"],
  "Portland, OR":     ["PDX10","PDX11","PDX12"],
  "Vancouver, BC":    ["YVR12","YVR14","YVR16"],
  "San Francisco, CA":["SFO12","SFO16","SFO18","SFO40"],
  "Sunnyvale, CA":    ["SVL10","SVL12","SVL14","SVL16"],
  "Santa Monica, CA": ["SMF1","LADC","SNA1"],
  "Irvine, CA":       ["IRV1","IRV7","IRV11"],
  "San Diego, CA":    ["SAN1","SAN10","SAN13"],
  "Tempe, AZ":        ["PHX1","PHX2","TPE1"],
  "Boulder, CO":      ["BOU1","BOU2"],
  "Denver, CO":       ["DEN1","DEN10","DEN11"],
  "Dallas, TX":       ["DAL1","DFW1","DFW7"],
  "Austin, TX":       ["AUS1","AUS2","AUS10","AUS12"],
  "Minneapolis, MN":  ["MSP1","MSP10"],
  "Chicago, IL":      ["CHI1","CHI10","ORD5"],
  "Nashville, TN":    ["BNA1","BNA2","NOC1"],
  "Detroit, MI":      ["DTW1","DET1"],
  "Pittsburgh, PA":   ["PIT1","PIT2"],
  "Atlanta, GA":      ["ATL1","ATL10","ATL5"],
  "Toronto, ON":      ["YYZ12","YYZ14","TOR5"],
  "Arlington, VA":    ["ARL01","ARL02","ARL03","ARL05"],
  "Herndon, VA":      ["HER1","HER2","IAD12"],
  "New York, NY":     ["NYC5","NYC7","NYC8","NYC12","NYC21"],
  "Boston, MA":       ["BOS7","BOS15","BOS27"],
  "Remote / Virtual": []
};
function buildingsForCity(city){ return BUILDINGS[city] || []; }

/* ---------- Seed people (fake AFE directory — mirrors supabase-seed-users.sql;
   replaced at runtime by live `users` rows in doLogin) --------------------- */
let PEOPLE = [
  { "id":"p01", "name":"Maya Chen", "track":"SDE", "city":"Seattle, WA", "school":"University of Washington", "org":"Cloud · Compute", "interests":["backend systems","coffee"], "avail":"coffee", "newToo":true, "linkedin":"maya-chen", "email":"maya.chen@example.com", "bio":"First internship — pumped to learn backend systems and hunt down good coffee." },
  { "id":"p02", "name":"Diego Ramirez", "track":"SDE", "city":"San Francisco, CA", "school":"UC Berkeley", "org":"Payments · Risk", "interests":["distributed systems","rock climbing"], "avail":"coffee", "newToo":true, "linkedin":"diego-ramirez", "email":"diego.ramirez@example.com", "bio":"New intern who loves distributed systems and weekend climbing trips." },
  { "id":"p03", "name":"Aisha Patel", "track":"HDE", "city":"New York, NY", "school":"Parsons School of Design", "org":"Design · Systems", "interests":["design systems","UX research","coffee"], "avail":"coffee", "newToo":true, "linkedin":"aisha-patel", "email":"aisha.patel@example.com", "bio":"First-time intern in design systems — always up for coffee and sketching." },
  { "id":"p04", "name":"Liam O'Connor", "track":"SDE", "city":"Boston, MA", "school":"Northeastern University", "org":"Data · Pipelines", "interests":["data eng","backend systems","running"], "avail":"dm", "newToo":false, "linkedin":"liam-oconnor", "email":"liam.oconnor@example.com", "bio":"Back for round two on data pipelines; ask me about my running routes." },
  { "id":"p05", "name":"Priya Nair", "track":"SDE", "city":"Austin, TX", "school":"University of Texas at Austin", "org":"ML · Platform", "interests":["ML / AI","distributed systems"], "avail":"coffee", "newToo":true, "linkedin":"priya-nair", "email":"priya.nair@example.com", "bio":"First internship and I'm all in on ML and distributed systems." },
  { "id":"p06", "name":"Kenji Tanaka", "track":"SDE", "city":"Bellevue, WA", "school":"University of Washington", "org":"Mobile · iOS", "interests":["mobile","gaming"], "avail":"lunch", "newToo":true, "linkedin":"kenji-tanaka", "email":"kenji.tanaka@example.com", "bio":"New here, building for iOS by day and gaming by night." },
  { "id":"p07", "name":"Fatima Al-Rashid", "track":"HDE", "city":"Arlington, VA", "school":"Rhode Island School of Design", "org":"Design · Research", "interests":["UX research","accessibility","photography"], "avail":"coffee", "newToo":true, "linkedin":"fatima-alrashid", "email":"fatima.alrashid@example.com", "bio":"First-time intern in UX research — I care a lot about accessible design." },
  { "id":"p08", "name":"Noah Kim", "track":"SDE", "city":"Sunnyvale, CA", "school":"Stanford University", "org":"Search · Ranking", "interests":["ML / AI","backend systems","music"], "avail":"dm", "newToo":false, "linkedin":"noah-kim", "email":"noah.kim@example.com", "bio":"Returning intern on search ranking; happy to talk ML or share playlists." },
  { "id":"p09", "name":"Sofia Rossi", "track":"HDE", "city":"Chicago, IL", "school":"ArtCenter College of Design", "org":"Design · Systems", "interests":["design systems","frontend","cooking"], "avail":"coffee", "newToo":true, "linkedin":"sofia-rossi", "email":"sofia.rossi@example.com", "bio":"New to the design team — I love design systems and cooking for friends." },
  { "id":"p10", "name":"Marcus Johnson", "track":"SDE", "city":"New York, NY", "school":"Georgia Tech", "org":"Security · Identity", "interests":["security","backend systems"], "avail":"coffee", "newToo":true, "linkedin":"marcus-johnson", "email":"marcus.johnson@example.com", "bio":"First internship, diving into security and backend work. Let's grab coffee!" },
  { "id":"p11", "name":"Yuki Yamamoto", "track":"HDE", "city":"Vancouver, BC", "school":"Emily Carr University", "org":"Design · Research", "interests":["UX research","design systems","board games"], "avail":"lunch", "newToo":true, "linkedin":"yuki-yamamoto", "email":"yuki.yamamoto@example.com", "bio":"New intern in UX research — board games fan, always down to prototype." },
  { "id":"p12", "name":"Omar Hassan", "track":"SDE", "city":"Toronto, ON", "school":"University of Toronto", "org":"Infra · Networking", "interests":["distributed systems","devtools"], "avail":"dm", "newToo":true, "linkedin":"omar-hassan", "email":"omar.hassan@example.com", "bio":"First-time intern on networking infra; ping me about devtools anytime." },
  { "id":"p13", "name":"Emma Larsson", "track":"SDE", "city":"Seattle, WA", "school":"University of Michigan", "org":"Web · Frontend Platform", "interests":["frontend","accessibility","coffee"], "avail":"coffee", "newToo":true, "linkedin":"emma-larsson", "email":"emma.larsson@example.com", "bio":"New here and passionate about frontend and accessible interfaces." },
  { "id":"p14", "name":"Raj Gupta", "track":"SDE", "city":"San Diego, CA", "school":"Carnegie Mellon University", "org":"ML · Recommendations", "interests":["ML / AI","data eng"], "avail":"busy", "newToo":false, "linkedin":"raj-gupta", "email":"raj.gupta@example.com", "bio":"Returning intern heads-down on recommendations and data work right now." },
  { "id":"p15", "name":"Chloe Dubois", "track":"HDE", "city":"Remote / Virtual", "school":"Rhode Island School of Design", "org":"Design · Systems", "interests":["design systems","UX research","music"], "avail":"coffee", "newToo":true, "linkedin":"chloe-dubois", "email":"chloe.dubois@example.com", "bio":"First internship, remote and loving it — design systems and music nerd." },
  { "id":"p16", "name":"David Okafor", "track":"SDE", "city":"New York, NY", "school":"Cornell University", "org":"Fintech · Ledger", "interests":["backend systems","distributed systems","running"], "avail":"coffee", "newToo":false, "linkedin":"david-okafor", "email":"david.okafor@example.com", "bio":"Second internship on the ledger team; long runs keep me sane." },
  { "id":"p17", "name":"Hana Nguyen", "track":"SDE", "city":"Dallas, TX", "school":"University of Texas at Austin", "org":"Data · Analytics", "interests":["data eng","ML / AI","coffee"], "avail":"lunch", "newToo":true, "linkedin":"hana-nguyen", "email":"hana.nguyen@example.com", "bio":"New intern in analytics — into data eng, ML, and finding the best coffee." },
  { "id":"p18", "name":"Ivan Petrov", "track":"SDE", "city":"Boston, MA", "school":"MIT", "org":"DevTools · CI/CD", "interests":["devtools","distributed systems"], "avail":"dm", "newToo":false, "linkedin":"ivan-petrov", "email":"ivan.petrov@example.com", "bio":"Back again for devtools work; I like tools that make builds fast." },
  { "id":"p19", "name":"Zara Ahmed", "track":"HDE", "city":"Minneapolis, MN", "school":"School of the Art Institute of Chicago", "org":"Design · Research", "interests":["UX research","accessibility","photography"], "avail":"coffee", "newToo":true, "linkedin":"zara-ahmed", "email":"zara.ahmed@example.com", "bio":"First-time intern in UX research, focused on accessibility and photography." },
  { "id":"p20", "name":"Lucas Silva", "track":"SDE", "city":"Remote / Virtual", "school":"University of Waterloo", "org":"Games · Client", "interests":["gaming","frontend","mobile"], "avail":"coffee", "newToo":true, "linkedin":"lucas-silva", "email":"lucas.silva@example.com", "bio":"New remote intern building game clients — mobile and frontend curious." },
  { "id":"p21", "name":"Mei Lin", "track":"SDE", "city":"Seattle, WA", "school":"University of Washington", "org":"Cloud · Storage", "interests":["backend systems","distributed systems","cooking"], "avail":"coffee", "newToo":true, "linkedin":"mei-lin", "email":"mei.lin@example.com", "bio":"First internship on storage; I love backend systems and home cooking." },
  { "id":"p22", "name":"Andre Laurent", "track":"SDE", "city":"Santa Monica, CA", "school":"UCLA", "org":"Growth · Experimentation", "interests":["data eng","frontend"], "avail":"dm", "newToo":false, "linkedin":"andre-laurent", "email":"andre.laurent@example.com", "bio":"Returning intern running experiments; I bridge data and frontend." },
  { "id":"p23", "name":"Grace Park", "track":"HDE", "city":"Portland, OR", "school":"Parsons School of Design", "org":"Design · Systems", "interests":["design systems","accessibility","running"], "avail":"coffee", "newToo":true, "linkedin":"grace-park", "email":"grace.park@example.com", "bio":"New to design systems — accessibility first, and I run every morning." },
  { "id":"p24", "name":"Tomás Herrera", "track":"SDE", "city":"Herndon, VA", "school":"Virginia Tech", "org":"Security · Identity", "interests":["security","backend systems","gaming"], "avail":"lunch", "newToo":true, "linkedin":"tomas-herrera", "email":"tomas.herrera@example.com", "bio":"First internship in identity security; ask me about co-op games." },
  { "id":"p25", "name":"Nadia Volkova", "track":"SDE", "city":"New York, NY", "school":"New York University", "org":"Web · Frontend Platform", "interests":["frontend","design systems","photography"], "avail":"coffee", "newToo":true, "linkedin":"nadia-volkova", "email":"nadia.volkova@example.com", "bio":"New intern on frontend platform — design-minded and always shooting photos." },
  { "id":"p26", "name":"Isaac Goldberg", "track":"SDE", "city":"Pittsburgh, PA", "school":"University of Wisconsin–Madison", "org":"ML · Platform", "interests":["ML / AI","distributed systems","board games"], "avail":"dm", "newToo":false, "linkedin":"isaac-goldberg", "email":"isaac.goldberg@example.com", "bio":"Back for another summer on ML platform; board game night is my thing." },
  { "id":"p27", "name":"Amara Okoye", "track":"HDE", "city":"Denver, CO", "school":"Emily Carr University", "org":"Design · Systems", "interests":["design systems","UX research","cooking"], "avail":"coffee", "newToo":true, "linkedin":"amara-okoye", "email":"amara.okoye@example.com", "bio":"First-time intern in design systems — I research, sketch, and cook." },
  { "id":"p28", "name":"Ravi Deshmukh", "track":"SDE", "city":"Tempe, AZ", "school":"Purdue University", "org":"Data · Pipelines", "interests":["data eng","backend systems"], "avail":"busy", "newToo":true, "linkedin":"ravi-deshmukh", "email":"ravi.deshmukh@example.com", "bio":"New intern heads-down on data pipelines this sprint — say hi later!" },
  { "id":"p29", "name":"Lena Schmidt", "track":"SDE", "city":"Remote / Virtual", "school":"University of Illinois Urbana-Champaign", "org":"Infra · Networking", "interests":["distributed systems","security","rock climbing"], "avail":"dm", "newToo":true, "linkedin":"lena-schmidt", "email":"lena.schmidt@example.com", "bio":"First internship, remote on networking — into security and climbing." },
  { "id":"p30", "name":"Malik Robinson", "track":"SDE", "city":"Nashville, TN", "school":"University of Maryland", "org":"Search · Ranking", "interests":["ML / AI","backend systems","music"], "avail":"coffee", "newToo":true, "linkedin":"malik-robinson", "email":"malik.robinson@example.com", "bio":"New here working on search ranking; ML by day, music always." },
  { "id":"p31", "name":"Yuna Choi", "track":"HDE", "city":"Atlanta, GA", "school":"ArtCenter College of Design", "org":"Design · Research", "interests":["UX research","design systems","coffee"], "avail":"lunch", "newToo":true, "linkedin":"yuna-choi", "email":"yuna.choi@example.com", "bio":"First-time intern in UX research — coffee chats and design systems, please." },
  { "id":"p32", "name":"Gabriel Santos", "track":"SDE", "city":"Toronto, ON", "school":"University of Toronto", "org":"Mobile · Android", "interests":["mobile","frontend","gaming"], "avail":"dm", "newToo":true, "linkedin":"gabriel-santos", "email":"gabriel.santos@example.com", "bio":"New intern building for Android; mobile, frontend, and games fan." },
  { "id":"p33", "name":"Ingrid Nilsson", "track":"HDE", "city":"Irvine, CA", "school":"Carnegie Mellon University", "org":"Design · Systems", "interests":["design systems","UX research","accessibility"], "avail":"busy", "newToo":false, "linkedin":"ingrid-nilsson", "email":"ingrid.nilsson@example.com", "bio":"Returning design intern, heads-down on systems and research this week." },
  { "id":"p34", "name":"Hassan Farah", "track":"SDE", "city":"Detroit, MI", "school":"University of British Columbia", "org":"DevTools · CI/CD", "interests":["devtools","distributed systems","running"], "avail":"lunch", "newToo":true, "linkedin":"hassan-farah", "email":"hassan.farah@example.com", "bio":"First internship on CI/CD in Detroit — devtools nerd who loves a good run." },
  { "id":"p35", "name":"Elena Popescu", "track":"alumni", "city":"Seattle, WA", "school":"University of Washington → SDE II", "org":"Cloud · Compute", "interests":["backend systems","distributed systems","coffee"], "avail":"coffee", "newToo":false, "linkedin":"elena-popescu", "email":"elena.popescu@example.com", "bio":"Former intern, now SDE II — happy to demystify system design and growth.", "topics":["system design","intern to full-time","career growth"] },
  { "id":"p36", "name":"Carlos Mendoza", "track":"alumni", "city":"Boulder, CO", "school":"UC Berkeley → SDE III", "org":"ML · Platform", "interests":["ML / AI","data eng","running"], "avail":"coffee", "newToo":false, "linkedin":"carlos-mendoza", "email":"carlos.mendoza@example.com", "bio":"Intern turned SDE III on ML platform; ask me anything about code reviews.", "topics":["system design","code review culture","career growth"] },
  { "id":"p37", "name":"Sarah Goldstein", "track":"alumni", "city":"New York, NY", "school":"New York University → SDE II", "org":"Web · Frontend Platform", "interests":["frontend","design systems","coffee"], "avail":"coffee", "newToo":false, "linkedin":"sarah-goldstein", "email":"sarah.goldstein@example.com", "bio":"Was an intern here too — now SDE II and glad to talk impostor syndrome.", "topics":["impostor syndrome","intern to full-time"] },
  { "id":"p38", "name":"Jin Wei Tan", "track":"alumni", "city":"Remote / Virtual", "school":"University of Waterloo → SDE II", "org":"Data · Pipelines", "interests":["data eng","distributed systems"], "avail":"dm", "newToo":false, "linkedin":"jin-wei-tan", "email":"jinwei.tan@example.com", "bio":"Ex-intern, now SDE II working remote; first standups are scarier than prod.", "topics":["first standup nerves","system design","career growth"] },
  { "id":"p39", "name":"Aaliyah Williams", "track":"alumni", "city":"Chicago, IL", "school":"School of the Art Institute of Chicago → Design Lead", "org":"Design · Systems", "interests":["design systems","UX research","photography"], "avail":"lunch", "newToo":false, "linkedin":"aaliyah-williams", "email":"aaliyah.williams@example.com", "bio":"Started as a design intern, now a lead — let's review your portfolio.", "topics":["design portfolio","impostor syndrome","career growth"] },
  { "id":"p40", "name":"Daniel Cho", "track":"alumni", "city":"Arlington, VA", "school":"Georgia Tech → SDE II", "org":"Security · Identity", "interests":["security","backend systems","board games"], "avail":"busy", "newToo":false, "linkedin":"daniel-cho", "email":"daniel.cho@example.com", "bio":"Former intern, now SDE II in security; I love a good design-doc chat.", "topics":["system design","code review culture"] }
];

/* ---------- "Me" ---------------------------------------------------------- */
let ME = null;
const DEFAULT_PRIVACY = { onMap:true, city:true, office:true, school:true, interests:true, linkedin:true, email:true, availability:true };

/* ---------- State --------------------------------------------------------- */
const state = {
  view:"map", q:"",
  quick:new Set(), tracks:new Set(), cities:new Set(), buildings:new Set(), interests:new Set(),
  cadence:"week" // Pair Up cadence: week | biweek
};

let GROUPS = []; // loaded from the `groups` table in doLogin
let CONVOS = {}; // key -> { key, type:'dm'|'group', peerId?, groupId?, title, messages:[{from,text,ts}], unread }
let OPEN_CHAT = null; // key of the currently-open chat modal (null if none)

/* ============================================================================
   UTIL
   ========================================================================== */
const $  = (s,r=document)=>r.querySelector(s);
const $$ = (s,r=document)=>[...r.querySelectorAll(s)];
const byId = id => PEOPLE.find(p=>p.id===id) || (ME&&ME.id===id?ME:null);
const initials = n => (n||"?").split(/\s+/).map(w=>w[0]).slice(0,2).join("").toUpperCase();
function hashHue(str){ let h=0; for(const c of (str||"")) h=(h*31+c.charCodeAt(0))>>>0; return h%360; }
function avatarStyle(name){ const h=hashHue(name); return `background:linear-gradient(150deg,hsl(${h} 80% 68%),hsl(${(h+40)%360} 80% 58%))`; }
function tzOf(city){ return (CITIES[city]||{}).tz || "—"; }
// Normalize a school for comparison: strip any "→ SDE II" alumni suffix, lowercase, trim.
// (Comparing on the first word alone collapses "University of Washington" and
// "University of Texas" into "University" — so we compare the full name.)
function schoolKey(s){ return (s||"").split("→")[0].trim().toLowerCase(); }
function sameSchool(a,b){ const x=schoolKey(a); return !!x && x===schoolKey(b); }
// Building match: case-insensitive exact match on a non-empty building code.
function sameBuilding(a,b){ const x=(a||"").trim().toLowerCase(); return !!x && x===(b||"").trim().toLowerCase(); }

/* avatar that supports an uploaded photo (data URL) or falls back to initials */
// Sanitize a photo value for use inside a single-quoted CSS url(...): drop quotes,
// parens, and whitespace so it can't break out of the style attribute. esc() alone
// doesn't cover single quotes, so photo URLs get this stricter treatment.
function safePhotoUrl(u){ return String(u||"").replace(/['"()\s]/g,""); }
function avStyleFor(p){ return p.photo ? `background-image:url('${safePhotoUrl(p.photo)}')` : avatarStyle(p.name); }
function avInner(p){ return p.photo ? "" : initials(p.name); }
function avatarHTML(p, cls){ return `<div class="${cls}" style="${avStyleFor(p)}">${avInner(p)}</div>`; }

function toast(msg){
  const t=document.createElement("div"); t.className="toast"; t.textContent=msg;
  $("#toasts").appendChild(t); setTimeout(()=>{ t.style.opacity="0"; t.style.transition="opacity .4s"; setTimeout(()=>t.remove(),400); },2600);
}
function copyText(txt){
  navigator.clipboard?.writeText(txt).then(()=>toast("Copied to clipboard ✓"),
    ()=>{ const ta=document.createElement("textarea"); ta.value=txt; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove(); toast("Copied ✓"); });
}
// Deterministic jitter so a person's pin is stable but never exact (privacy).
function jitter(city, seed){
  const c=CITIES[city]; if(!c) return null;
  let h=0; for(const ch of seed) h=(h*33+ch.charCodeAt(0))>>>0;
  const dx=((h%1000)/1000-0.5), dy=(((h>>10)%1000)/1000-0.5);
  return { lat:c.lat+dy*0.16, lng:c.lng+dx*0.20 };
}
function esc(s){ return (s||"").replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
const EMOJI_MAP={bento:"🥗",microphone:"🎤",bar_chart:"📊",standing_person:"🧍",coffee:"☕"};
function safeEmoji(e){ if(!e) return "☕"; if(e.startsWith(":")) { const k=e.replace(/:/g,""); return EMOJI_MAP[k]||"☕"; } return e; }

/* ============================================================================
   CONNECTION REASONS + MESSAGE GENERATORS (DM opener + LinkedIn note)
   ========================================================================== */
function connectionReasons(person){
  const r=[];  // t = second-person (UI chips) · me = first-person (messages I send)
  if(ME){
    if(sameBuilding(person.building, ME.building)) r.push({t:`you're both in building ${person.building}`, me:`we're both in building ${person.building}`, key:"building"});
    else if(person.city===ME.city && person.city!=="Remote / Virtual") r.push({t:`you're both in ${person.city}`, me:`we're both in ${person.city}`, key:"city"});
    if(sameSchool(person.school, ME.school)) r.push({t:`you both went to ${person.school}`, me:`we both go to ${person.school}`, key:"school"});
    if(tzOf(person.city)===tzOf(ME.city) && tzOf(ME.city)!=="—") r.push({t:`same timezone (${tzOf(person.city)})`, me:`we're in the same timezone (${tzOf(person.city)})`, key:"tz"});
    if(person.track===ME.track && ME.track!=="alumni") r.push({t:`you're both ${person.track} interns`, me:`we're both ${person.track} interns`, key:"track"});
    if(person.newToo && ME.newToo) r.push({t:"you're both new to this", me:"we're both new to this", key:"new"});
    const shared=(person.interests||[]).filter(i=>(ME.interests||[]).includes(i));
    if(shared.length) r.push({t:`shared interest in ${shared.slice(0,2).join(" & ")}`, me:`we're both into ${shared.slice(0,2).join(" & ")}`, key:"interest", shared});
  }
  if(person.track==="alumni") r.unshift({t:`${person.name.split(" ")[0]} is an AFE alum paying it forward`, me:`you're an AFE alum paying it forward`, key:"alum"});
  return r;
}
// A short opener for an in-app Orbit DM (used to seed a new conversation).
function coffeeMessage(person){
  return `Hey ${person.name.split(" ")[0]}!`;
}
/* LinkedIn logic (normalizeLinkedIn, linkedinURL, linkedinNote, openLinkedIn)
   lives in linkedin.js — loaded after this file. */

/* ============================================================================
   SUPABASE CLIENT + MESSAGING ENGINE
   ============================================================================
   Real-time messaging via Supabase Realtime subscriptions on the messages table.
   No custom server needed — the frontend talks directly to Supabase.
   ========================================================================== */
const SUPABASE_URL = 'https://lftvfvwazgqqldqhlhsr.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxmdHZmdndhemdxcWxkcWhsaHNyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ1ODEzNjgsImV4cCI6MjEwMDE1NzM2OH0.RA-i-yMVailDEdBiq0Eis4ThadYIawMsChQqffYirz8';
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

function now(){ return Date.now(); }
function dmKey(peerId){ return "dm:"+peerId; }
function grpKey(groupId){ return "grp:"+groupId; }

// Consistent DM convo key (sorted so both sides match)
function dmConvoKey(a, b){ return "dm:" + [a,b].sort().join(":"); }

function ensureDM(peerId){
  const key=dmKey(peerId);
  if(!CONVOS[key]){ const p=byId(peerId); CONVOS[key]={ key, type:"dm", peerId, title:p?p.name:"", messages:[], unread:0 }; }
  return CONVOS[key];
}
function ensureGroup(groupId){
  const key=grpKey(groupId);
  if(!CONVOS[key]){ const g=GROUPS.find(x=>x.id===groupId); CONVOS[key]={ key, type:"group", groupId, title:g?g.title:"", messages:[], unread:0 }; }
  return CONVOS[key];
}
function convMembers(c){
  if(c.type==="dm") return [ME, byId(c.peerId)].filter(Boolean);
  const g=GROUPS.find(x=>x.id===c.groupId); if(!g) return [ME].filter(Boolean);
  return g.members.map(byId).filter(Boolean); // members are user-id strings
}
function lastMessage(c){ return c.messages[c.messages.length-1]; }
function totalUnread(){ return Object.values(CONVOS).reduce((n,c)=>n+(c.unread||0),0); }

let _loadingHistory = false;
function getLastSeen(key){ return parseInt(localStorage.getItem("orbit-seen-"+key)||"0",10); }
function setLastSeen(key){ localStorage.setItem("orbit-seen-"+key, String(Date.now())); }

function pushMessage(key, fromId, text, ts){
  const c=CONVOS[key]; if(!c) return;
  if(c.messages.find(m=>m.from===fromId && m.text===text && m.ts===ts)) return;
  c.messages.push({ from:fromId, text, ts: ts||now() });
  const msgTs = ts || now();
  if(fromId!==ME.id && OPEN_CHAT!==key){
    if(_loadingHistory){
      if(msgTs > getLastSeen(key)) c.unread=(c.unread||0)+1;
    } else {
      c.unread=(c.unread||0)+1;
      // Live notification toast
      const sender = PEOPLE.find(p=>p.id===fromId);
      const senderName = sender ? sender.name.split(" ")[0] : "Someone";
      toast(`${senderName}: ${text.length>40?text.slice(0,40)+"…":text}`);
    }
  }
  refreshMessagingUI();
}

async function sendMessage(key, text){
  text=(text||"").trim(); if(!text) return;
  const c=CONVOS[key]; if(!c) return;
  let convoKey;
  if(c.type==="dm"){
    convoKey = dmConvoKey(ME.id, c.peerId);
  } else {
    convoKey = "grp:" + c.groupId;
  }
  const ts = Date.now();
  const { error } = await db.from('messages').insert({ convo_key: convoKey, from_id: ME.id, text, ts });
  if(error){ console.error('sendMessage failed:', error); throw error; }
}

// Supabase Realtime subscription for new messages
function subscribeToMessages(){
  db.channel('messages-realtime')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
      if(!ME) return;
      const msg = payload.new;
      let localKey = msg.convo_key;
      if(msg.convo_key.startsWith('dm:')){
        // DM keys are "dm:<a>:<b>" (sorted). Only handle if I'm a participant —
        // otherwise a client would ingest and display strangers' private DMs.
        const parts = msg.convo_key.slice(3).split(':');
        if(!parts.includes(ME.id)) return;               // not my conversation — ignore
        const peerId = parts.find(id => id !== ME.id);
        if(!peerId) return;
        localKey = dmKey(peerId);
        ensureDM(peerId);
      } else if(msg.convo_key.startsWith('grp:')){
        // Only handle group messages for groups I've actually joined.
        const groupId = msg.convo_key.slice(4);
        const g = GROUPS.find(x=>x.id===groupId);
        if(!g || !ME || !g.members.includes(ME.id)) return;  // not my group — ignore
        localKey = grpKey(groupId);
        ensureGroup(groupId);
      } else {
        return; // unknown convo_key shape
      }
      pushMessage(localKey, msg.from_id, msg.text, msg.ts);
    })
    .subscribe();
}

// Load message history for a conversation from Supabase
async function loadMessages(convoKey){
  const { data } = await db.from('messages')
    .select('*')
    .eq('convo_key', convoKey)
    .order('ts', { ascending: true })
    .limit(200);
  return (data||[]).map(m => ({ from: m.from_id, text: m.text, ts: m.ts }));
}

function refreshMessagingUI(){
  updateMsgBadge();
  if(state.view==="messages") renderInbox();
  if(OPEN_CHAT) renderChatBody();
}
function updateMsgBadge(){
  const tab=$("#tab-messages"); if(!tab) return;
  const n=totalUnread();
  tab.innerHTML = `<span>Messages</span>${n?`<span class="badge">${n}</span>`:""}`;
}

/* ---------- Chat modal ---------- */
function openChat(key){
  const c=CONVOS[key]; if(!c) return;
  OPEN_CHAT=key; c.unread=0; setLastSeen(key); updateMsgBadge();
  const members=convMembers(c);
  const sub = c.type==="dm"
    ? `${byId(c.peerId)?.org||""} · ${byId(c.peerId)?.city||""}`
    : `${members.length} members`;
  const headAvatar = c.type==="dm"
    ? avatarHTML(byId(c.peerId)||{name:c.title}, "av")
    : `<div class="chat-members">${members.slice(0,4).map(m=>avatarHTML(m,"av")).join("")}</div>`;
  $("#modal").className="modal chat-modal";
  $("#modal").innerHTML=`
    <div class="chat-head">
      ${headAvatar}
      <div class="ct"><div class="t">${c.type==="group"?"":""}${esc(c.title)}</div><div class="s">${esc(sub)}</div></div>
      ${c.type==="dm" && byId(c.peerId)?.linkedin ? `<button class="btn sm linkedin" onclick="openLinkedIn('${c.peerId}')"><span class="li-ic">in</span>Connect</button>`:""}
      ${c.type==="group"?`<button class="btn sm danger" onclick="leaveGroup('${c.groupId}')">Leave</button>`:""}
      <button class="x" onclick="closeChat()">×</button>
    </div>
    <div class="chat-body" id="chat-body"></div>
    <div class="chat-foot">
      <textarea id="chat-input" rows="1" placeholder="Type a message to ${esc(c.type==="dm"?c.title.split(" ")[0]:"the group")}…"></textarea>
      <button class="btn primary" id="chat-send">Send</button>
    </div>`;
  $("#modal-back").classList.add("open");
  const input=$("#chat-input"), send=async()=>{
    const v=input.value.trim(); if(!v) return;
    input.value=""; input.style.height="auto"; input.focus();
    try{ await sendMessage(key,v); }
    catch(e){ input.value=v; toast("Message failed to send — try again"); } // restore text on failure
  };
  // Auto-expand as the user types (or when a suggestion is inserted)
  const autosize=()=>{ input.style.height="auto"; input.style.height=Math.min(input.scrollHeight,140)+"px"; };
  input.addEventListener("input", autosize);
  $("#chat-send").addEventListener("click", send);
  input.addEventListener("keydown", e=>{ if(e.key==="Enter" && !e.shiftKey){ e.preventDefault(); send(); } });
  renderChatBody(); setTimeout(()=>input.focus(),50);
}
function closeChat(){ OPEN_CHAT=null; $("#modal").className="modal"; closeModal(); }
window.leaveGroup=async function(gid){
  if(!ME) return;
  const g=GROUPS.find(x=>x.id===gid); if(!g) return;
  if(!confirm(`Leave "${g.title}"? You can rejoin later if it's public.`)) return;
  const { error } = await db.from('group_members').delete().eq('group_id', gid).eq('user_id', ME.id);
  if(error){ console.error('leaveGroup failed:', error); toast("Couldn't leave — try again"); return; }
  g.members = g.members.filter(id=>id!==ME.id);
  delete CONVOS[grpKey(gid)];
  closeChat(); renderGroups(); toast(`Left "${g.title}"`);
};
function renderChatBody(){
  const body=$("#chat-body"); if(!body||!OPEN_CHAT) return;
  const c=CONVOS[OPEN_CHAT];
  if(!c.messages.length){
    body.innerHTML=`<div class="chat-empty">👋 Say hi! This is the start of your ${c.type==="dm"?"conversation with "+esc(c.title.split(" ")[0]):"group chat"}.</div>`;
    return;
  }
  const rows=c.messages.map(m=>{
    const mine=m.from===ME.id;
    const sender=byId(m.from)||{name:"?"};
    const showName = c.type==="group" && !mine;
    return `<div class="msg-row ${mine?'me':'them'}">
      ${mine?"":avatarHTML(sender,"av")}
      <div>${showName?`<div class="msg-sender">${esc(sender.name.split(" ")[0])}</div>`:""}<div class="msg-b">${esc(m.text)}</div></div>
    </div>`;
  }).join("");
  body.innerHTML=rows;
  body.scrollTop=body.scrollHeight;
}

/* ---------- Messages inbox ---------- */
function renderInbox(){
  const wrap=$("#inbox");
  const convos=Object.values(CONVOS).filter(c=>{
    if(c.type==="dm") return c.messages.length>0;
    // group chats only appear once you've joined them
    const g=GROUPS.find(x=>x.id===c.groupId);
    return g && ME && g.members.includes(ME.id);
  });
  convos.sort((a,b)=>{ const la=lastMessage(a)?.ts||0, lb=lastMessage(b)?.ts||0; return lb-la; });
  wrap.innerHTML=`<h2>Messages</h2><p class="muted">Your Orbit DMs and brown-bag group chats.</p>`;
  if(!convos.length){
    wrap.innerHTML+=`<div class="empty"><div class="big" style="font-size:32px">No messages</div>No conversations yet.<br><span class="muted">Hit <b>Message</b> on someone's card, or join a brown bag to start chatting.</span></div>`;
    return;
  }
  for(const c of convos){
    const last=lastMessage(c);
    const preview = last ? `${last.from===ME.id?"You: ":""}${last.text}` : "No messages yet — say hi!";
    const icon = c.type==="dm" ? avatarHTML(byId(c.peerId)||{name:c.title},"av-lg") : `<div class="grp-ic">${safeEmoji(GROUPS.find(g=>g.id===c.groupId)?.emoji)}</div>`;
    const row=document.createElement("div"); row.className="conv"; row.onclick=()=>openChat(c.key);
    row.innerHTML=`
      ${icon}
      <div class="mid">
        <div class="nm">${esc(c.title)} ${c.type==="group"?'<span class="track-badge" style="background:var(--panel-2);color:var(--ink-dim)">GROUP</span>':""}</div>
        <div class="prev">${esc(preview)}</div>
      </div>
      ${c.unread?`<div class="unread">${c.unread}</div>`:""}`;
    wrap.appendChild(row);
  }
}

/* ============================================================================
   FILTERING
   ========================================================================== */
function visiblePeople(){
  const q=state.q.trim().toLowerCase();
  return PEOPLE.filter(p=>{
    if(ME && p.id===ME.id) return false;
    if(state.tracks.size){ const t=p.track; if(!state.tracks.has(t)) return false; }
    if(state.cities.size && !state.cities.has(p.city)) return false;
    if(state.buildings.size && !state.buildings.has(p.building)) return false;
    if(state.interests.size && !(p.interests||[]).some(i=>state.interests.has(i))) return false;
    if(state.quick.has("coffee") && p.avail!=="coffee") return false;
    if(state.quick.has("newToo") && !p.newToo) return false;
    if(ME){
      if((state.quick.has("sameCity")||state.quick.has("nearby")) && p.city!==ME.city) return false;
      if(state.quick.has("sameBuilding") && !sameBuilding(p.building, ME.building)) return false;
      if(state.quick.has("sameSchool") && !sameSchool(p.school, ME.school)) return false;
      if(state.quick.has("sameTz") && tzOf(p.city)!==tzOf(ME.city)) return false;
    }
    if(q){
      const hay=[p.name,p.city,p.building,p.school,p.org,(p.interests||[]).join(" "),(p.topics||[]).join(" ")].join(" ").toLowerCase();
      if(!hay.includes(q)) return false;
    }
    return true;
  });
}

/* ============================================================================
   RENDER — cards / map / speed dating / groups
   ========================================================================== */
function trackColor(t){ return t==="SDE"?"#5ea0ff": t==="HDE"?"#c58bff":"#ff8a4c"; }
function trackLabel(t){ return t==="alumni"?"ALUM":t; }
function availText(a){ return {coffee:"Open to coffee", dm:"Open to DMs", lunch:"Looking for lunch group", busy:"Busy this week"}[a]; }

function renderCards(){
  const list=visiblePeople(), wrap=$("#cards"); wrap.innerHTML="";
  $("#count-bar-list").innerHTML=`<b>${list.length}</b> ${list.length===1?"AFE":"AFEs"} match your filters`;
  if(!list.length){ wrap.innerHTML=`<div class="empty" style="grid-column:1/-1"><div class="big"></div>No one matches yet — try loosening a filter.</div>`; return; }
  for(const p of list){
    const reasons=connectionReasons(p);
    const sharedSet=new Set((reasons.find(r=>r.shared)?.shared)||[]);
    const card=document.createElement("div"); card.className="card";
    card.innerHTML=`
      <div class="top">
        ${avatarHTML(p,"av-lg")}
        <div style="flex:1">
          <div class="name">${esc(p.name)} <span class="track-badge ${p.track}">${trackLabel(p.track)}</span></div>
          <div class="sub">${esc(p.org)} · ${p.city==="Remote / Virtual"?"Virtual":esc(p.city)}${p.building?` · ${esc(p.building)}`:""} · ${tzOf(p.city)}</div>
        </div>
      </div>
      <div style="margin-top:10px">${p.avail&&p.avail!=='coffee'?`<span class="avail ${p.avail}">${availText(p.avail)}</span> `:""}<span class="muted" style="font-size:12.5px">${esc(p.school)}</span></div>
      <div class="meta">${(p.interests||[]).slice(0,5).map(i=>`<span class="tag ${sharedSet.has(i)?'match':''}">${esc(i)}</span>`).join("")}</div>
      ${p.topics?`<div class="meta">${p.topics.map(t=>`<span class="tag" style="border-color:var(--accent);color:var(--accent-2)">${esc(t)}</span>`).join("")}</div>`:""}
      ${reasons.length?`<div class="prompt"><div><b>Why reach out:</b> ${reasons.slice(0,2).map(r=>r.t).join(", ")}.</div></div>`:""}
      <div class="actions">
        <button class="btn primary sm" data-act="message" data-id="${p.id}">Message</button>
        ${p.linkedin?`<button class="btn sm linkedin" data-act="linkedin" data-id="${p.id}"><span class="li-ic">in</span>Connect</button>`:""}
      </div>`;
    wrap.appendChild(card);
  }
}

let map, markerLayer, heatLayer=null;
let heatOn = (localStorage.getItem("orbit-heat")||"on")!=="off";
// Snapchat/Strava-style density heatmap: warm glow where AFEs cluster.
// Each person contributes a small spray of weighted points around their jittered
// spot so overlapping people build up intensity (a real density field).
function renderHeat(list){
  if(!map || typeof L.heatLayer!=="function") return;
  if(heatLayer){ map.removeLayer(heatLayer); heatLayer=null; }
  if(!heatOn) return;
  const pts=[];
  const add=(lat,lng,w)=>pts.push([lat,lng,w]);
  const seed=s=>{ let h=0; for(const c of s) h=(h*33+c.charCodeAt(0))>>>0; return h; };
  for(const p of list){
    const j=jitter(p.city, p.id); if(!j) continue;
    add(j.lat, j.lng, 1.0);
    // Dense halo so each person already glows and clusters bloom hot (Snapchat/Strava feel).
    const h=seed(p.id);
    for(let k=0;k<7;k++){
      const dx=(((h>>(k*3))%100)/100-0.5)*0.09, dy=(((h>>(k*3+1))%100)/100-0.5)*0.09;
      add(j.lat+dy, j.lng+dx, 0.6);
    }
  }
  if(ME && ME.privacy.onMap){ const jm=jitter(ME.city, ME.id+"me"); if(jm){ add(jm.lat,jm.lng,1.0); for(let k=0;k<5;k++){ add(jm.lat+(Math.sin(k)*0.03), jm.lng+(Math.cos(k)*0.03), 0.6); } } }
  heatLayer=L.heatLayer(pts, {
    radius:48, blur:38, minOpacity:0.45, max:3.5, maxZoom:12,
    // Bold Strava/Snapchat warm ramp: transparent → blue → teal → gold → orange → hot red core
    gradient:{ 0.0:"rgba(74,134,224,0)", 0.2:"#4a86e0", 0.4:"#46d6a4", 0.58:"#ffcf5c", 0.75:"#ff8a4c", 0.9:"#ff5a2e", 1.0:"#ff2d1a" }
  }).addTo(map);
  // The heat layer draws in Leaflet's overlayPane (below the markerPane), so
  // pins stay clickable above the glow automatically — no manual re-stacking.
}
function renderMap(){
  if(!map) return;
  markerLayer.clearLayers();
  const list=visiblePeople();
  renderHeat(list);
  updateOnlineCount();
  if(ME && ME.privacy.onMap){
    const j=jitter(ME.city, ME.id+"me");
    if(j) L.marker([j.lat,j.lng], {icon:facePin(ME, "#46d6a4", true)}).addTo(markerLayer).bindPopup(`<b>You</b><br>${esc(ME.city)}<br><a href="#" onclick="viewMyProfile();return false" style="font-weight:700">View my profile →</a>`);
  }
  for(const p of list){
    const j=jitter(p.city, p.id); if(!j) continue;
    const m=L.marker([j.lat,j.lng], {icon:facePin(p, trackColor(p.track), false, p.track==='alumni')}).addTo(markerLayer);
    const reasons=connectionReasons(p);
    m.bindPopup(`
      <div style="min-width:200px">
        <div style="display:flex;gap:8px;align-items:center;margin-bottom:4px">
          <div style="width:38px;height:38px;border-radius:50%;flex:0 0 auto;display:grid;place-items:center;font-weight:800;color:#10182b;background-size:cover;background-position:center;${p.photo?`background-image:url('${safePhotoUrl(p.photo)}')`:avatarStyle(p.name)}">${p.photo?"":initials(p.name)}</div>
          <div><b>${esc(p.name)}</b> <span style="font-size:10px;color:#888">${trackLabel(p.track)}</span><br><span style="color:#666;font-size:12px">${esc(p.org)}</span></div>
        </div>
        <div style="color:#777;font-size:12px">${p.city==="Remote / Virtual"?"Virtual":esc(p.city)}${p.building?` · ${esc(p.building)}`:""} · ${tzOf(p.city)} · ${esc(p.school)}</div>
        ${reasons.length?`<div style="margin-top:6px;color:#0a7;font-size:12px">${reasons[0].t}</div>`:""}
        <div style="display:flex;gap:6px;margin-top:9px">
          <button onclick="startDM('${p.id}')" style="flex:1;padding:7px;border:none;border-radius:8px;background:linear-gradient(180deg,#ffb27a,#ff8a4c);color:#26140a;font-weight:800;cursor:pointer">Message</button>
          ${p.linkedin?`<button onclick="openLinkedIn('${p.id}')" title="Connect on LinkedIn" style="padding:7px 10px;border:none;border-radius:8px;background:#0a66c2;color:#fff;font-weight:800;cursor:pointer">in</button>`:""}
        </div>
      </div>`);
  }
  renderGlobe();
}
// Circular avatar map pin (profile photo if present, else initials on the track color).
function facePin(p, color, me=false, alum=false){
  const size=me?40:34;
  const badge = alum ? `<div style="position:absolute;right:-2px;top:-2px;width:15px;height:15px;border-radius:50%;background:#ff8a4c;border:2px solid #0e1424;display:grid;place-items:center;font-size:9px">★</div>` : "";
  const inner = p.photo
    ? `background-image:url('${safePhotoUrl(p.photo)}');background-size:cover;background-position:center`
    : `${avatarStyle(p.name)};display:grid;place-items:center;font-weight:800;font-size:${me?13:12}px;color:#10182b`;
  const label = p.photo ? "" : initials(p.name);
  const isOnline = me || ONLINE_IDS.has(p.id);
  const pulse = isOnline ? `<div class="presence-pulse"></div>` : "";
  return L.divIcon({
    className:"", iconSize:[size,size], iconAnchor:[size/2,size/2],
    html:`<div style="position:relative;width:${size}px;height:${size}px;border-radius:50%;border:3px solid ${isOnline&&!me?"#46d6a4":color};box-shadow:0 2px 8px rgba(0,0,0,.5);overflow:visible;">
            ${pulse}
            <div style="width:100%;height:100%;border-radius:50%;overflow:hidden;${inner}">${label}</div>${badge}
          </div>`
  });
}

/* ---------- Speed dating (1:1, weekly / biweekly) ---------- */
function daysSinceEpoch(){ return Math.floor(Date.now()/86400000); }
function currentRound(){ const period=state.cadence==="week"?7:14; return Math.floor(daysSinceEpoch()/period); }
function daysUntilNextRound(){ const period=state.cadence==="week"?7:14; return period - (daysSinceEpoch()%period); }
function pairScore(p){
  if(!ME) return 0; let s=0;
  const sharedInterests = (p.interests||[]).filter(i=>(ME.interests||[]).includes(i));
  s += sharedInterests.length * 3;
  if(p.city===ME.city && p.city!=="Remote / Virtual") s+=4;
  if(sameBuilding(p.building, ME.building)) s+=5;
  if(tzOf(p.city)===tzOf(ME.city) && tzOf(ME.city)!=="---") s+=2;
  if(p.track===ME.track) s+=2;
  if(p.track!==ME.track) s+=1; // slight diversity bonus
  if(sameSchool(p.school, ME.school)) s+=4;
  if(p.newToo && ME.newToo) s+=2;
  if(p.afe_class && ME.afe_class && p.afe_class===ME.afe_class) s+=3;
  // Penalize if no overlap at all
  if(sharedInterests.length===0 && p.city!==ME.city && !sameSchool(p.school,ME.school)) s-=3;
  return Math.max(0, s);
}
function getSkippedIds(){ try{ return JSON.parse(localStorage.getItem("orbit-skipped")||"[]"); }catch(e){ return []; } }
function addSkippedId(id){ const s=getSkippedIds(); if(!s.includes(id)){ s.push(id); localStorage.setItem("orbit-skipped",JSON.stringify(s.slice(-20))); } }
function pairForRound(round){
  const skipped = getSkippedIds();
  const pool=PEOPLE.filter(p=>p.avail!=="busy" && !(ME&&p.id===ME.id) && !skipped.includes(p.id));
  if(!pool.length) return null;
  const ranked=pool.map(p=>({p,s:pairScore(p)})).sort((a,b)=>b.s-a.s);
  // Pick from top candidates with some deterministic variety per round
  const topN=Math.min(5, ranked.length);
  const seed=hashHue(ME?.id||"me");
  const idx=(round+seed)%topN;
  return ranked[idx];
}
function compatPercent(score){ return Math.min(99, Math.max(40, Math.round(50 + score * 4))); }
function renderSpeed(){
  const wrap=$("#sd-wrap");
  const round=currentRound();
  const result=pairForRound(round);
  const partner=result?.p||null;
  const score=result?.s||0;
  const past=[pairForRound(round-1), pairForRound(round-2)].filter(Boolean);
  wrap.innerHTML=`
    <div class="sd-hero">
      <h2>Pair Up</h2>
      <p>Matched on shared interests, location, track, and school. One intro per round — skip if it's not the right fit.</p>
    </div>
    <div class="sd-controls">
      <div class="seg" id="cadence-seg">
        <button data-cad="week" class="${state.cadence==='week'?'on':''}">Weekly</button>
        <button data-cad="biweek" class="${state.cadence==='biweek'?'on':''}">Biweekly</button>
      </div>
      <div class="sd-round">Round <b>#${round}</b> — next in <b>${daysUntilNextRound()}d</b></div>
    </div>
    ${partner?matchCardHTML(partner,score):`<div class="empty"><div class="big" style="font-size:32px">No matches</div><p class="muted">Everyone's paired or skipped. Check back next round.</p></div>`}
    ${past.length?`
      <div class="sd-history">
        <h3>Previous</h3>
        ${past.map((r,i)=>r?.p?`
          <div class="row">
            ${avatarHTML(r.p,"av")}
            <div><div class="nm">${esc(r.p.name)}</div><div class="muted" style="font-size:12px">${esc(r.p.org)} · ${r.p.city==="Remote / Virtual"?"Virtual":esc(r.p.city)}</div></div>
            <button class="btn sm" onclick="startDM('${r.p.id}')">Message</button>
            <span class="rn">#${round-1-i}</span>
          </div>`:"").join("")}
      </div>`:""}`;
}
function matchCardHTML(p, score){
  const reasons=connectionReasons(p);
  const why=reasons.length?reasons.slice(0,3):[{t:"A fresh connection this week"}];
  const pct=compatPercent(score);
  return `
    <div class="match-card">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
        <div class="wholine">YOUR MATCH</div>
        <div style="background:var(--accent);color:#000;padding:4px 10px;border-radius:var(--radius-pill);font-size:12px;font-weight:800">${pct}% match</div>
      </div>
      <div style="display:flex;gap:16px;align-items:center">
        ${avatarHTML(p,"av-xl")}
        <div>
          <div class="nm">${esc(p.name)} <span class="track-badge ${p.track}" style="vertical-align:middle">${trackLabel(p.track)}</span>${p.afe_class?` <span class="track-badge" style="background:var(--accent-tint);color:var(--accent)">AFE '${p.afe_class.slice(-2)}</span>`:""}</div>
          <div class="role">${esc(p.org)}${p.org?" · ":""}${p.city==="Remote / Virtual"?"Virtual":esc(p.city)}${p.building?` · ${esc(p.building)}`:""}</div>
          <div class="role" style="margin-top:4px">${esc(p.school)} · ${tzOf(p.city)}</div>
        </div>
      </div>
      <div class="why" style="margin-top:14px">${why.map(r=>`<span class="r">${r.t}</span>`).join("")}</div>
      <div class="cta">
        <button class="btn primary" onclick="startDM('${p.id}')">Message ${esc(p.name.split(" ")[0])}</button>
        ${p.linkedin?`<button class="btn linkedin" onclick="openLinkedIn('${p.id}')"><span class="li-ic">in</span>Connect</button>`:""}
        <button class="btn ghost" onclick="skipMatch('${p.id}')" style="margin-left:auto">Skip</button>
      </div>
    </div>`;
}
window.skipMatch=function(id){
  addSkippedId(id);
  toast("Skipped — you won't see them again");
  renderSpeed();
};

/* ---------- Groups ---------- */
function renderGroups(){
  const wrap=$("#groups"); wrap.innerHTML="";
  for(const g of GROUPS){
    if(g.private && ME && !g.members.includes(ME.id)) continue;
    const mem=g.members.map(byId).filter(Boolean);
    const joined=ME && g.members.includes(ME.id);
    const card=document.createElement("div"); card.className="group-card";
    card.innerHTML=`
      <div style="display:flex;gap:12px;align-items:center">
        <div class="emoji">${safeEmoji(g.emoji)}</div>
        <div style="flex:1"><div class="title">${esc(g.title)}${g.private?` <span style="font-size:10px;opacity:.6"></span>`:""}</div>${g.city?`<div class="muted" style="font-size:12px">${esc(g.city)}</div>`:`<div class="muted" style="font-size:12px">Anywhere</div>`}</div>
      </div>
      <div class="muted">${esc(g.desc)}</div>
      <div style="display:flex;align-items:center;justify-content:space-between">
        <div class="members" title="${mem.map(m=>esc(m.name)).join(', ')}">
          ${mem.slice(0,5).map(m=>avatarHTML(m,"av")).join("")}
          ${mem.length>5?`<span class="av" style="background:var(--panel-2);color:var(--ink-dim)">+${mem.length-5}</span>`:""}
        </div>
        <span class="muted" style="font-size:12px">${mem.length} members</span>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn ${joined?'':'primary'}" style="flex:1" data-group="${g.id}">${joined?'✓ Joined':'Join brown bag'}</button>
        ${joined?`<button class="btn primary" data-openchat="${g.id}">Open chat</button>`:""}
      </div>`;
    wrap.appendChild(card);
  }
}

function renderAll(){ renderCards(); renderMap(); renderSpeed(); renderGroups(); updateMeChip(); updateMsgBadge(); }

/* ============================================================================
   FILTER UI
   ========================================================================== */
function buildFilterChips(){
  const cf=$("#city-filters"); cf.innerHTML="";
  Object.keys(CITIES).forEach(c=>{ const s=document.createElement("span"); s.className="chip"; s.dataset.city=c;
    s.textContent=c==="Remote / Virtual"?"Virtual":c.split(",")[0]; cf.appendChild(s); });
  const inf=$("#interest-filters"); inf.innerHTML="";
  INTERESTS.forEach(i=>{ const s=document.createElement("span"); s.className="chip"; s.dataset.interest=i; s.textContent=i; inf.appendChild(s); });
  buildBuildingChips();
}
// Building chips are derived from the buildings people actually have (live data),
// not a fixed list — so it reflects who's really signed in. Rebuilt after load.
function buildBuildingChips(){
  const bf=$("#building-filters"); if(!bf) return;
  const set=new Set();
  PEOPLE.forEach(p=>{ if(p.building) set.add(p.building); });
  if(ME&&ME.building) set.add(ME.building);
  const list=[...set].sort();
  bf.innerHTML="";
  if(!list.length){ bf.innerHTML=`<span class="muted" style="font-size:12px">No buildings yet</span>`; return; }
  list.forEach(b=>{ const s=document.createElement("span"); s.className="chip"+(state.buildings.has(b)?" on":""); s.dataset.building=b; s.textContent=""+b; bf.appendChild(s); });
  if(typeof updateFilterCounts==="function") updateFilterCounts();
}
function wireFilters(){
  $("#q").addEventListener("input", e=>{ state.q=e.target.value; renderCards(); renderMap(); });
  $("#quick-filters").addEventListener("click", e=>{ const c=e.target.closest(".chip"); if(c) toggleSet(state.quick,c.dataset.f,c); });
  $("#track-filters").addEventListener("click", e=>{ const c=e.target.closest(".chip"); if(c) toggleSet(state.tracks,c.dataset.track,c); });
  $("#city-filters").addEventListener("click", e=>{ const c=e.target.closest(".chip"); if(c) toggleSet(state.cities,c.dataset.city,c); });
  $("#building-filters").addEventListener("click", e=>{ const c=e.target.closest(".chip"); if(c&&c.dataset.building) toggleSet(state.buildings,c.dataset.building,c); });
  $("#interest-filters").addEventListener("click", e=>{ const c=e.target.closest(".chip"); if(c) toggleSet(state.interests,c.dataset.interest,c); });
  $("#reset").addEventListener("click", ()=>{ state.quick.clear(); state.tracks.clear(); state.cities.clear(); state.buildings.clear(); state.interests.clear(); state.q=""; $("#q").value=""; $$(".chip").forEach(c=>c.classList.remove("on")); $$(".fg-search").forEach(s=>{s.value="";}); $$(".chip").forEach(c=>c.classList.remove("hidden")); updateFilterCounts(); renderCards(); renderMap(); });

  // Per-section search: filter the chips WITHIN a group by typed text.
  const wireSectionSearch = (inputId, containerId, attr) => {
    const inp=$("#"+inputId); if(!inp) return;
    inp.addEventListener("input", ()=>{
      const q=inp.value.trim().toLowerCase();
      const chips=$$("#"+containerId+" .chip");
      let shown=0;
      chips.forEach(c=>{ const v=(c.dataset[attr]||c.textContent||"").toLowerCase(); const hit=!q||v.includes(q); c.classList.toggle("hidden", !hit); if(hit) shown++; });
      // show a tiny "no match" note
      const box=$("#"+containerId); let note=box.querySelector(".fg-empty");
      if(!shown){ if(!note){ note=document.createElement("div"); note.className="fg-empty"; box.appendChild(note); } note.textContent="No matches"; }
      else if(note){ note.remove(); }
    });
    // Enter opens nothing / stays; clicking a chip is unaffected.
    inp.addEventListener("click", e=>e.stopPropagation());
  };
  wireSectionSearch("city-search","city-filters","city");
  wireSectionSearch("building-search","building-filters","building");
  wireSectionSearch("interest-search","interest-filters","interest");

  updateFilterCounts();
}
function toggleSet(set,key,el){ if(set.has(key)){ set.delete(key); el.classList.remove("on"); } else { set.add(key); el.classList.add("on"); } updateFilterCounts(); renderCards(); renderMap(); }

// Show how many filters are active per group, as a badge on the group header.
function updateFilterCounts(){
  const counts={ quick:state.quick.size, track:state.tracks.size, city:state.cities.size, building:state.buildings.size, interest:state.interests.size };
  $$(".fg-count").forEach(b=>{ const n=counts[b.dataset.countFor]||0; b.textContent=n; b.classList.toggle("on", n>0); });
}

/* ---------- Resizable sidebar (drag handle + persisted width) ---------- */
const SIDEBAR_W_KEY="orbit-sidebar-w";
function wireSidebarResize(){
  const sidebar=$("#sidebar"), handle=$("#sidebar-resizer"); if(!sidebar||!handle) return;
  // restore saved width
  const saved=parseInt(localStorage.getItem(SIDEBAR_W_KEY)||"",10);
  if(saved && saved>=220 && saved<=560) sidebar.style.setProperty("--sidebar-w", saved+"px");
  let startX=0, startW=0, dragging=false;
  const MIN=220, MAX=560;
  const onMove=(e)=>{
    if(!dragging) return;
    const x=(e.touches?e.touches[0].clientX:e.clientX);
    let w=Math.min(MAX, Math.max(MIN, startW + (x-startX)));
    sidebar.style.setProperty("--sidebar-w", w+"px");
    if(map) map.invalidateSize();
  };
  const onUp=()=>{
    if(!dragging) return;
    dragging=false; sidebar.classList.remove("resizing");
    document.removeEventListener("mousemove",onMove); document.removeEventListener("mouseup",onUp);
    document.removeEventListener("touchmove",onMove); document.removeEventListener("touchend",onUp);
    const cur=getComputedStyle(sidebar).getPropertyValue("--sidebar-w").trim();
    const px=parseInt(cur,10); if(px) localStorage.setItem(SIDEBAR_W_KEY, px);
  };
  const onDown=(e)=>{
    dragging=true; sidebar.classList.add("resizing");
    startX=(e.touches?e.touches[0].clientX:e.clientX);
    startW=parseInt(getComputedStyle(sidebar).getPropertyValue("--sidebar-w"),10) || sidebar.offsetWidth;
    document.addEventListener("mousemove",onMove); document.addEventListener("mouseup",onUp);
    document.addEventListener("touchmove",onMove,{passive:false}); document.addEventListener("touchend",onUp);
    e.preventDefault();
  };
  handle.addEventListener("mousedown", onDown);
  handle.addEventListener("touchstart", onDown, {passive:false});
  // double-click resets to default
  handle.addEventListener("dblclick", ()=>{ sidebar.style.removeProperty("--sidebar-w"); localStorage.removeItem(SIDEBAR_W_KEY); if(map) map.invalidateSize(); });
}

/* ============================================================================
   TABS
   ========================================================================== */
function wireTabs(){
  $("#tabs").addEventListener("click", e=>{
    const b=e.target.closest("button"); if(!b) return;
    state.view=b.dataset.view;
    $$("#tabs button").forEach(x=>x.classList.toggle("active", x===b));
    $$(".view").forEach(v=>v.classList.remove("active"));
    $("#view-"+state.view).classList.add("active");
    if(state.view==="map" && map) setTimeout(()=>map.invalidateSize(),60);
    if(state.view==="speed") renderSpeed();
    if(state.view==="messages") renderInbox();
  });
}

/* ============================================================================
   CARD / GROUP / SPEED actions
   ========================================================================== */
document.addEventListener("click", e=>{
  const a=e.target.closest("[data-act]");
  if(a){ const p=byId(a.dataset.id); if(!p) return;
    if(a.dataset.act==="message")  startDM(p.id);
    if(a.dataset.act==="linkedin") openLinkedIn(p.id);
  }
  const g=e.target.closest("[data-group]");
  if(g) joinGroup(g.dataset.group);
  const oc=e.target.closest("[data-openchat]");
  if(oc) openGroupChat(oc.dataset.openchat);
  const cad=e.target.closest("[data-cad]");
  if(cad){ state.cadence=cad.dataset.cad; renderSpeed(); }
});
async function joinGroup(gid){
  const g=GROUPS.find(x=>x.id===gid); if(!g||!ME) return;
  if(!g.members.includes(ME.id)){
    const { error } = await db.from('group_members').insert({ group_id: gid, user_id: ME.id });
    if(error){ console.error('joinGroup failed:', error); toast("Couldn't join — try again"); return; }
    g.members.push(ME.id);
    toast(`Joined "${g.title}" ✓`); renderGroups();
  }
  openGroupChat(gid);
}
async function openGroupChat(gid){
  const g=GROUPS.find(x=>x.id===gid); if(!g) return;
  if(ME && !g.members.includes(ME.id)){
    const { error } = await db.from('group_members').insert({ group_id: gid, user_id: ME.id });
    if(error){ console.error('openGroupChat join failed:', error); toast("Couldn't open chat — try again"); return; }
    g.members.push(ME.id);
  }
  ensureGroup(gid);
  const convoKey = "grp:" + gid;
  const c=CONVOS[grpKey(gid)];
  c.messages = await loadMessages(convoKey);
  openChat(grpKey(gid));
}

/* ---------- Start a 1:1 DM / open LinkedIn ---------- */
window.startDM=async function(peerId){
  const p=byId(peerId); if(!p) return;
  const c=ensureDM(peerId);
  const convoKey = dmConvoKey(ME.id, peerId);
  c.messages = await loadMessages(convoKey);
  openChat(c.key);
  if(!c.messages.length){
    // Don't force words into the composer — offer the suggested intro as an opt-in chip.
    const foot=document.querySelector(".chat-foot");
    if(foot && !document.querySelector("#intro-suggest")){
      const bar=document.createElement("div");
      bar.id="intro-suggest";
      bar.innerHTML=`<button class="suggest-chip">Use suggested intro</button>`;
      foot.parentNode.insertBefore(bar, foot);
      bar.querySelector("button").addEventListener("click", ()=>{
        const input=$("#chat-input");
        if(input){ input.value=coffeeMessage(p); input.dispatchEvent(new Event("input")); input.focus(); }
        bar.remove();
      });
    }
    const input=$("#chat-input"); if(input) input.focus();
  }
};
/* window.openLinkedIn — provided by linkedin.js */

/* ============================================================================
   MODALS
   ========================================================================== */
function showModal(html){ $("#modal").className="modal"; $("#modal").innerHTML=html; $("#modal-back").classList.add("open"); }
function closeModal(){ $("#modal-back").classList.remove("open"); OPEN_CHAT=null; }
$("#modal-back").addEventListener("click", e=>{ if(e.target.id==="modal-back") closeModal(); });

/* ---------- New brown bag ---------- */
$("#new-group").addEventListener("click", ()=>{
  showModal(`
    <div class="m-head"><h2>New brown bag</h2><button class="x" onclick="closeModal()">×</button></div>
    <div class="m-body">
      <div class="two-col">
        <label class="fld"><span class="lab">Emoji</span><input id="g-emoji" value="☕" maxlength="2"></label>
        <label class="fld"><span class="lab">City (optional)</span>
          <select id="g-city"><option value="">Anywhere / Virtual</option>${Object.keys(CITIES).map(c=>`<option>${c}</option>`).join("")}</select></label>
      </div>
      <label class="fld"><span class="lab">Title</span><input id="g-title" placeholder="e.g. Seattle AFEs lunch"></label>
      <label class="fld"><span class="lab">Description</span><textarea id="g-desc" placeholder="What's this group for?"></textarea></label>
      <div class="privacy-row"><div class="pl">Private group<small>Only invited members can see and join</small></div><button class="switch" id="g-private" data-priv="private"></button></div>
    </div>
    <div class="m-foot"><button class="btn" onclick="closeModal()">Cancel</button><button class="btn primary" onclick="createGroup()">Create & join</button></div>`);
});
document.addEventListener("click", e=>{ const sw=e.target.closest("#g-private"); if(sw) sw.classList.toggle("on"); });
window.createGroup=async function(){
  const title=$("#g-title").value.trim(); if(!title){ toast("Give it a title first"); return; }
  const isPrivate = $("#g-private")?.classList.contains("on") || false;
  const { data } = await db.from('groups').insert({
    emoji: $("#g-emoji").value||"☕", title, description: $("#g-desc").value||"", city: $("#g-city").value, created_by: ME.id, private: isPrivate
  }).select().single();
  if(data){
    await db.from('group_members').insert({ group_id: data.id, user_id: ME.id });
    const group = { id: data.id, emoji: data.emoji, title: data.title, desc: data.description, city: data.city, members: [ME.id], private: data.private };
    GROUPS.unshift(group); ensureGroup(group.id);
    closeModal(); renderGroups(); toast(`Created "${title}" ✓`);
    openGroupChat(group.id);
  }
};

/* ============================================================================
   PROFILE + PRIVACY (opt-in, safety layer) + photo upload
   ========================================================================== */
function updateMeChip(){ const chip=$("#me-chip"); chip.innerHTML=ME?`${avatarHTML(ME,"av")} <span>${esc(ME.name.split(" ")[0])}</span>`:""; }
$("#me-chip").addEventListener("click", ()=> ME && viewMyProfile());
// One-click view of your own card — exactly what other AFEs see.
window.viewMyProfile=function(){
  if(!ME) return;
  const afeTag = ME.afe_class ? `<span class="track-badge" style="background:var(--accent-tint);color:var(--accent)">AFE '${ME.afe_class.slice(-2)}</span>` : "";
  showModal(`
    <div class="m-head"><h2>Your profile</h2><button class="x" onclick="closeModal()">×</button></div>
    <div class="m-body">
      <div style="display:flex;flex-direction:column;align-items:center;gap:14px;padding:20px 0">
        <div style="position:relative">
          ${avatarHTML(ME,"av-xl")}
          <span style="position:absolute;bottom:-4px;right:-4px;width:16px;height:16px;border-radius:50%;background:var(--good);border:3px solid var(--panel)"></span>
        </div>
        <div style="text-align:center">
          <div style="font-family:var(--font-display);font-size:22px;font-weight:700;letter-spacing:-.3px">${esc(ME.name)}</div>
          <div style="display:flex;gap:6px;justify-content:center;margin-top:6px;flex-wrap:wrap">
            <span class="track-badge ${ME.track}">${trackLabel(ME.track)}</span>
            ${afeTag}
          </div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:8px 0 16px">
        <div style="background:var(--panel-2);border:1px solid var(--line);border-radius:var(--radius-sm);padding:12px;text-align:center">
          <div style="font-size:11px;color:var(--ink-faint);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">Location</div>
          <div style="font-weight:700;font-size:14px">${ME.city==="Remote / Virtual"?"Virtual":esc(ME.city)}</div>
          ${ME.building?`<div style="font-size:12px;color:var(--ink-dim);margin-top:2px">${esc(ME.building)}</div>`:""}
        </div>
        <div style="background:var(--panel-2);border:1px solid var(--line);border-radius:var(--radius-sm);padding:12px;text-align:center">
          <div style="font-size:11px;color:var(--ink-faint);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">School</div>
          <div style="font-weight:700;font-size:14px">${esc(ME.school||"—")}</div>
          ${ME.org?`<div style="font-size:12px;color:var(--ink-dim);margin-top:2px">${esc(ME.org)}</div>`:""}
        </div>
      </div>
      ${(ME.interests||[]).length?`<div style="margin-bottom:14px"><div style="font-size:11px;color:var(--ink-faint);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Interests</div><div class="chips" style="justify-content:center">${ME.interests.map(i=>`<span class="chip on">${esc(i)}</span>`).join("")}</div></div>`:""}
      <div style="text-align:center;padding:10px;border-radius:var(--radius-sm);background:var(--accent-tint);border:1px solid var(--accent);font-size:12px;color:var(--ink-dim)">This is how other AFEs see you</div>
    </div>
    <div class="m-foot" style="justify-content:space-between">
      <button class="btn danger sm" onclick="deleteMyAccount()">Delete account</button>
      <div style="display:flex;gap:8px">
        ${ME.linkedin?`<button class="btn sm linkedin" onclick="window.open(linkedinURL(ME),'_blank','noopener')"><span class="li-ic">in</span>LinkedIn</button>`:""}
        <button class="btn primary" onclick="openProfile()">Edit profile</button>
      </div>
    </div>`);
};
// Permanently delete your account: your messages, group memberships, and profile
// row are removed from Supabase, so your email can sign up fresh later (no dupes).
window.deleteMyAccount=async function(){
  if(!ME) return;
  if(!confirm(`Delete your Orbit account?\n\nThis removes your profile, messages, and group memberships permanently. You can always join again later with the same email.`)) return;
  try{
    // Remove everything I sent (DMs + groups) AND both sides of my DM convos
    // (convo_key contains my UUID for any DM I'm part of).
    await db.from('messages').delete().or(`from_id.eq.${ME.id},convo_key.like.%${ME.id}%`);
    await db.from('groups').update({created_by:null}).eq('created_by', ME.id); // detach groups we created
    const { error } = await db.from('users').delete().eq('id', ME.id);       // group_members cascades
    if(error){ console.error(error); toast("Couldn't delete your account — try again"); return; }
    await db.auth.signOut().catch(()=>{});                                   // end OAuth session so auto-login doesn't recreate the account
    ME=null; closeModal();
    $("#app").classList.add("hidden"); $("#login").classList.remove("hidden");
    const n=$("#lg-name"), em=$("#lg-email"); if(n) n.value=""; if(em) em.value="";
    toast("Account deleted — safe travels ");
  }catch(e){ console.error(e); toast("Couldn't delete your account — try again"); }
};
$("#btn-privacy").addEventListener("click", ()=> ME && openPrivacy());

let PHOTO_DRAFT=null; // holds a data URL while editing
function openProfile(){ PHOTO_DRAFT=ME?.photo||null; showModal(profileFormHTML("Edit your profile", ME, false)); }
function profileFormHTML(heading, m, isOnboarding){
  const iv=(m?.interests)||[];
  const photo=PHOTO_DRAFT || m?.photo || null;
  const avPrev = photo ? `background-image:url('${safePhotoUrl(photo)}')` : avatarStyle(m?.name||ME?.name||"You");
  const avTxt  = photo ? "" : initials(m?.name||ME?.name||"You");
  return `
    <div class="m-head"><span class="logo" style="width:26px;height:26px"></span><h2>${heading}</h2>${isOnboarding?'':'<button class="x" onclick="closeModal()">×</button>'}</div>
    <div class="m-body">
      ${isOnboarding?`<div class="consent-box" style="margin-bottom:18px"><div><b>You're in control.</b> Orbit only shows what you switch on, and never your exact location — just your city center. Change or hide anything anytime.</div></div>`:""}
      <div class="photo-row">
        <div class="av-xl" id="photo-prev" style="${avPrev}">${avTxt}</div>
        <div>
          <div class="lab" style="margin-bottom:2px">Profile picture</div>
          <div class="hint">Optional — stays on your device (demo).</div>
          <div class="btns">
            <button class="btn sm" onclick="document.getElementById('photo-input').click()">Upload</button>
            <button class="btn sm ghost" onclick="clearPhoto()">Remove</button>
          </div>
          <input type="file" id="photo-input" accept="image/*" style="display:none" onchange="onPhotoPick(event)">
        </div>
      </div>
      <div class="two-col">
        <label class="fld"><span class="lab">Name</span><input id="f-name" value="${esc(m?.name||'')}" placeholder="Your name"></label>
        <label class="fld"><span class="lab">Track</span><select id="f-track"><option value="SDE" ${m?.track==='SDE'?'selected':''}>SDE — Software Development Engineer</option><option value="HDE" ${m?.track==='HDE'?'selected':''}>HDE — Hardware Development Engineer</option></select></label>
      </div>
      <div class="two-col">
        <label class="fld"><span class="lab">AFE Class</span><select id="f-afe-class"><option value="">— Select year —</option>${[2019,2020,2021,2022,2023,2024,2025,2026].map(y=>`<option value="${y}" ${m?.afe_class===String(y)?'selected':''}>AFE ${y}</option>`).join("")}</select></label>
        <label class="fld"><span class="lab">City</span><select id="f-city" onchange="refreshBuildingOptions()">${Object.keys(CITIES).map(c=>`<option ${m?.city===c?'selected':''}>${c}</option>`).join("")}</select></label>
        <label class="fld"><span class="lab">Building</span>
          <input id="f-building" list="building-list" value="${esc(m?.building||'')}" placeholder="e.g. SEA40" autocomplete="off">
          <datalist id="building-list">${buildingsForCity(m?.city||Object.keys(CITIES)[0]).map(b=>`<option value="${esc(b)}">`).join("")}</datalist>
        </label>
      </div>
      <div class="two-col">
        <label class="fld"><span class="lab">School</span><input id="f-school" value="${esc(m?.school||'')}" placeholder="e.g. University of Washington"></label>
        <label class="fld"><span class="lab">Team / org</span><input id="f-org" value="${esc(m?.org||'')}" placeholder="e.g. Cloud · Compute"></label>
      </div>
      <div class="two-col">
        <label class="fld"><span class="lab">Email</span><input id="f-email" value="${esc(m?.email||'')}" placeholder="you@example.com"></label>
        <label class="fld"><span class="lab">LinkedIn (optional)</span><input id="f-linkedin" value="${esc(m?.linkedin||'')}" placeholder="profile URL or handle"></label>
      </div>
      <label class="fld"><span class="lab">Availability</span>
        <select id="f-avail">
          <option value="coffee" ${m?.avail==='coffee'?'selected':''}>Open to coffee chats</option>
          <option value="dm" ${m?.avail==='dm'?'selected':''}>Open to messages</option>
          <option value="lunch" ${m?.avail==='lunch'?'selected':''}>Looking for a lunch group</option>
          <option value="busy" ${m?.avail==='busy'?'selected':''}> Busy this week</option>
        </select></label>
      <label class="fld"><span class="lab">First-time intern?</span>
        <select id="f-new"><option value="yes" ${m?.newToo?'selected':''}>Yes — I'm also new to this </option><option value="no" ${m && !m.newToo?'selected':''}>No, I've interned before</option></select></label>
      <span class="lab">Interests (tap to toggle)</span>
      <div class="chips interest-cloud" id="f-interests" style="margin-top:6px">
        ${INTERESTS.map(i=>`<span class="chip ${iv.includes(i)?'on':''}" data-i="${i}">${i}</span>`).join("")}
      </div>
    </div>
    <div class="m-foot">
      ${isOnboarding?'':'<button class="btn" onclick="closeModal()">Cancel</button>'}
      <button class="btn primary" onclick="saveProfile(${isOnboarding})">${isOnboarding?'Join Orbit':'Save'}</button>
    </div>`;
}
window.onPhotoPick=function(ev){
  const file=ev.target.files&&ev.target.files[0]; if(!file) return;
  const reader=new FileReader();
  reader.onload=()=>{ PHOTO_DRAFT=reader.result; const prev=$("#photo-prev"); if(prev){ prev.style.backgroundImage=`url('${safePhotoUrl(PHOTO_DRAFT)}')`; prev.style.backgroundSize="cover"; prev.style.backgroundPosition="center"; prev.textContent=""; } };
  reader.readAsDataURL(file);
};
window.clearPhoto=function(){ PHOTO_DRAFT=null; const prev=$("#photo-prev"); if(prev){ const nm=$("#f-name")?.value||ME?.name||"You"; prev.style.backgroundImage="none"; prev.setAttribute("style", avatarStyle(nm)); prev.textContent=initials(nm); } };
document.addEventListener("click", e=>{ const chip=e.target.closest("#f-interests .chip"); if(chip) chip.classList.toggle("on"); });
// When the city changes in the profile form, refresh the building autocomplete list.
window.refreshBuildingOptions=function(){
  const city=$("#f-city")?.value, dl=$("#building-list"); if(!dl) return;
  dl.innerHTML=buildingsForCity(city).map(b=>`<option value="${esc(b)}">`).join("");
};

window.saveProfile=async function(isOnboarding){
  const name=$("#f-name").value.trim(); if(!name){ toast("Add your name to continue"); return; }
  const li=normalizeLinkedIn($("#f-linkedin").value);
  if(li===null){ toast("That LinkedIn doesn't look right — paste your profile URL or just your handle"); $("#f-linkedin").focus(); return; }
  ME={
    ...ME,
    name, track:$("#f-track").value, afe_class:$("#f-afe-class")?.value||'', city:$("#f-city").value, school:$("#f-school").value,
    org:$("#f-org").value, building:$("#f-building").value.trim(), email:$("#f-email").value.trim(), linkedin:li,
    avail:$("#f-avail").value, newToo:$("#f-new").value==="yes",
    interests:$$("#f-interests .chip.on").map(c=>c.dataset.i),
    photo:PHOTO_DRAFT || ME?.photo || null,
    privacy: ME?.privacy || {...DEFAULT_PRIVACY}
  };
  // Persist to Supabase
  const payload = {
    name: ME.name, track: ME.track, city: ME.city, school: ME.school, org: ME.org, building: ME.building,
    linkedin: ME.linkedin, avail: ME.avail, new_too: ME.newToo, interests: ME.interests,
    bio: ME.bio||'', photo: ME.photo, privacy: ME.privacy, email: ME.email
  };
  if(ME.afe_class) payload.afe_class = ME.afe_class;
  const { error: saveErr } = await db.from('users').update(payload).eq('id', ME.id);
  if(saveErr){ console.error('Profile save error:', saveErr); toast("Save failed — check console"); return; }
  closeModal(); renderAll();
  if(map){ const c=CITIES[ME.city]; if(c) map.setView([c.lat,c.lng],6); }
  toast(isOnboarding?`Welcome to Orbit, ${name.split(" ")[0]}! `:"Profile saved ✓");
};

function openPrivacy(){
  const P=ME.privacy;
  const rows=[
    ["onMap","Show me on the map","Pin at city center only — never exact"],
    ["city","Show my city",""],["office","Show my team / org",""],["school","Show my school",""],
    ["interests","Show my interests",""],["availability","Show my availability status",""],
    ["linkedin","Show my LinkedIn",""],["email","Allow direct messages","Let other AFEs start a 1:1 chat with you"],
  ];
  showModal(`
    <div class="m-head"><h2>Privacy & consent</h2><button class="x" onclick="closeModal()">×</button></div>
    <div class="m-body">
      <div class="consent-box" style="margin-bottom:16px">🛡️ <div><b>Safety layer:</b> No one sees you on the map or can contact you unless you opt in. Exact location is never shown — only your city. Turn anything off and it disappears for everyone instantly.</div></div>
      ${rows.map(([k,l,s])=>`<div class="privacy-row"><div class="pl">${l}${s?`<small>${s}</small>`:""}</div><button class="switch ${P[k]?'on':''}" data-priv="${k}"></button></div>`).join("")}
    </div>
    <div class="m-foot"><button class="btn primary" onclick="closeModal();renderAll()">Done</button></div>`);
}
document.addEventListener("click", e=>{ const sw=e.target.closest("[data-priv]"); if(sw&&ME){ const k=sw.dataset.priv; ME.privacy[k]=!ME.privacy[k]; sw.classList.toggle("on", ME.privacy[k]); } });

/* ============================================================================
   LIVE PRESENCE  — who's online right now via Supabase Realtime presence
   ========================================================================== */
const ONLINE_IDS = new Set();

function subscribePresence(){
  if(!ME) return;
  const ch = db.channel("orbit-presence", { config:{ presence:{ key: ME.id } } });
  ch.on("presence", { event:"sync" }, ()=>{
    ONLINE_IDS.clear();
    const state = ch.presenceState();
    for(const key of Object.keys(state)) ONLINE_IDS.add(key);
    renderMap();          // re-render map pins with/without pulse
    renderGlobe();        // update globe rings
    updateOnlineCount();
  }).subscribe(async status=>{
    if(status==="SUBSCRIBED") await ch.track({ id: ME.id });
  });
}

function updateOnlineCount(){
  const bar = document.getElementById("count-bar-map");
  if(!bar) return;
  const total = visiblePeople().length;
  const online = visiblePeople().filter(p => ONLINE_IDS.has(p.id)).length;
  const liveStr = online > 0
    ? ` · <span style="color:var(--good)">● ${online} online now</span>`
    : "";
  bar.innerHTML = `<b>${total}</b> ${total===1?"AFE":"AFEs"} on the map · pins are approximate${liveStr}`;
}

/* ============================================================================
   GLOBE MODE  — 3D spinning globe with city glows + connection arcs
   ========================================================================== */
let globeInstance = null;
let globeOn = false;
let pendingArc = null;   // { from, to } city coords set when user clicks a pin

function initGlobe(){
  const container = document.getElementById("globe-container");
  if(globeInstance || !container) return;

  const isDark = currentTheme() !== "light";
  globeInstance = Globe()(container)
    .globeImageUrl(isDark
      ? "https://unpkg.com/three-globe/example/img/earth-night.jpg"
      : "https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg")
    .backgroundImageUrl("https://unpkg.com/three-globe/example/img/night-sky.png")
    .width(container.clientWidth)
    .height(container.clientHeight)
    .pointOfView({ lat:39, lng:-95, altitude:1.8 }, 0)
    .atmosphereColor(isDark ? "#1e3a8a" : "#4fa3e0")
    .atmosphereAltitude(0.18);

  // Resize with container
  const ro = new ResizeObserver(()=>{
    if(globeInstance){
      globeInstance.width(container.clientWidth);
      globeInstance.height(container.clientHeight);
    }
  });
  ro.observe(container);

  renderGlobe();
}

function renderGlobe(){
  if(!globeInstance || !globeOn) return;
  const list = visiblePeople();

  // City aggregation: group people by city for ring altitude + label
  const cityMap = {};
  for(const p of list){
    const c = CITIES[p.city]; if(!c) continue;
    if(!cityMap[p.city]) cityMap[p.city] = { lat:c.lat, lng:c.lng, people:[], name:p.city };
    cityMap[p.city].people.push(p);
  }
  if(ME && ME.privacy?.onMap){
    const c = CITIES[ME.city];
    if(c && !cityMap[ME.city]) cityMap[ME.city] = { lat:c.lat, lng:c.lng, people:[], name:ME.city };
    if(cityMap[ME.city]) cityMap[ME.city].people.push(ME);
  }
  const cities = Object.values(cityMap);

  // Glow rings — altitude scales with count, color by online presence
  globeInstance.ringsData(cities)
    .ringLat(d => d.lat)
    .ringLng(d => d.lng)
    .ringColor(d => {
      const hasOnline = d.people.some(p => ONLINE_IDS.has(p.id));
      return hasOnline ? ["rgba(70,214,164,0.9)", "rgba(70,214,164,0)"] : ["rgba(255,138,76,0.8)", "rgba(255,138,76,0)"];
    })
    .ringMaxRadius(d => 3 + Math.sqrt(d.people.length) * 2)
    .ringPropagationSpeed(1.2)
    .ringRepeatPeriod(900);

  // City labels
  globeInstance.labelsData(cities)
    .labelLat(d => d.lat)
    .labelLng(d => d.lng)
    .labelText(d => `${d.name.split(",")[0]} · ${d.people.length}`)
    .labelSize(1.4)
    .labelDotRadius(0.5)
    .labelColor(() => "rgba(255,255,255,0.85)")
    .labelResolution(2);

  // Points (individual pins) — pulse green if online
  const points = list.map(p => {
    const c = CITIES[p.city]; if(!c) return null;
    const j = jitter(p.city, p.id); if(!j) return null;
    return { lat:j.lat, lng:j.lng, person:p, online: ONLINE_IDS.has(p.id) };
  }).filter(Boolean);
  if(ME && ME.privacy?.onMap){
    const j = jitter(ME.city, ME.id+"me");
    if(j) points.push({ lat:j.lat, lng:j.lng, person:ME, online:true, isMe:true });
  }
  globeInstance.pointsData(points)
    .pointLat(d => d.lat)
    .pointLng(d => d.lng)
    .pointColor(d => d.isMe ? "#46d6a4" : d.online ? "#46d6a4" : trackColor(d.person.track))
    .pointAltitude(d => d.online ? 0.015 : 0.005)
    .pointRadius(d => d.isMe ? 0.55 : 0.4)
    .onPointClick(d => {
      if(!d.person || d.isMe) return;
      // Draw a glowing arc from ME's city to the clicked person's city
      if(ME){
        const from = jitter(ME.city, ME.id+"me") || CITIES[ME.city];
        const to   = { lat:d.lat, lng:d.lng };
        if(from) showGlobeArc(from, to, d.person);
      }
    });

  // Arc — show or clear
  if(pendingArc){
    globeInstance.arcsData([pendingArc])
      .arcStartLat(a => a.fromLat).arcStartLng(a => a.fromLng)
      .arcEndLat(a => a.toLat).arcEndLng(a => a.toLng)
      .arcColor(() => ["rgba(255,138,76,0.9)", "rgba(99,164,255,0.9)"])
      .arcAltitude(0.28)
      .arcStroke(0.7)
      .arcDashLength(0.4)
      .arcDashGap(0.2)
      .arcDashAnimateTime(1200);
  } else {
    globeInstance.arcsData([]);
  }
}

function showGlobeArc(from, to, person){
  pendingArc = { fromLat:from.lat, fromLng:from.lng, toLat:to.lat, toLng:to.lng };
  renderGlobe();
  // Fly the globe to point toward the destination
  globeInstance.pointOfView({ lat:(from.lat+to.lat)/2, lng:(from.lng+to.lng)/2, altitude:1.4 }, 900);
  // Show a toast with the person's name
  toast(`✨ ${person.name} · ${person.city}`);
  setTimeout(()=>{ pendingArc=null; renderGlobe(); }, 5000);
}

function toggleGlobe(){
  globeOn = !globeOn;
  const container = document.getElementById("globe-container");
  const mapEl = document.getElementById("map");
  const btn = document.getElementById("btn-globe");
  container.classList.toggle("active", globeOn);
  // Leaflet tiles look bad peeking behind globe — just hide/show the map
  if(mapEl) mapEl.style.opacity = globeOn ? "0" : "1";
  if(btn){ btn.classList.toggle("on", globeOn); btn.setAttribute("aria-pressed", String(globeOn)); }
  if(globeOn){
    if(!globeInstance) initGlobe(); else renderGlobe();
  }
}

function updateGlobeTheme(){
  if(!globeInstance) return;
  const isDark = currentTheme() !== "light";
  globeInstance.globeImageUrl(isDark
    ? "https://unpkg.com/three-globe/example/img/earth-night.jpg"
    : "https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg");
}

/* ============================================================================
   LOGIN + BOOT
   ========================================================================== */
let tileLayer=null;
// CartoDB basemaps (no API key). Voyager = detailed with roads/labels/terrain for
// a livelier canvas in light mode; dark_matter (dark_all) for the dark theme so the
// warm heatmap glow pops. Both free, {s} subdomains a-d.
function tileUrlFor(theme){ const style = theme==="light" ? "rastertiles/voyager" : "dark_all"; return `https://{s}.basemaps.cartocdn.com/${style}/{z}/{x}/{y}{r}.png`; }
function setMapTiles(theme){
  if(!map) return;
  if(tileLayer) map.removeLayer(tileLayer);
  tileLayer=L.tileLayer(tileUrlFor(theme),{ maxZoom:19, subdomains:"abcd" }).addTo(map);
  tileLayer.bringToBack();
}
function initMap(){
  // worldCopyJump keeps pins + heatmap visible in every horizontal "copy" of the
  // world as you pan (like Google/Apple Maps) instead of scrolling into endless
  // empty repeats. minZoom:2 stops the map zooming out so far you see many copies
  // stacked side by side at once.
  map=L.map("map",{ zoomControl:true, attributionControl:false, worldCopyJump:true, minZoom:3, maxBoundsViscosity:1.0 }).setView([39,-98],4);
  map.zoomControl.setPosition("topright");
  setMapTiles(currentTheme());
  markerLayer=L.layerGroup().addTo(map);
  renderMap();
  wireMapTools();
}

/* ---------- Map tools: "Locate me" + city jump search ---------- */
let locateMarker=null, locateCircle=null;
function countInCity(city){ return PEOPLE.filter(p=>p.city===city).length; }

function flyToCity(city){
  const c=CITIES[city]; if(!c||!map) return;
  map.flyTo([c.lat,c.lng], city==="Remote / Virtual"?4:9, { duration:.9 });
  toast(`${city} · ${countInCity(city)} ${countInCity(city)===1?"AFE":"AFEs"} here`);
}

/* Your location is cached in the browser (localStorage) so "Locate me" jumps
   INSTANTLY — no geolocation prompt after the first time. It's stored only on
   this device and never written to your Orbit profile (exact location is
   never shared with others). Shift/Alt-click, or the tiny ⟳ affordance, forces
   a fresh GPS read to update the cached spot. */
const MYLOC_KEY="orbit-my-location";
function getCachedLocation(){ try{ const v=JSON.parse(localStorage.getItem(MYLOC_KEY)||"null"); return (v&&typeof v.lat==="number"&&typeof v.lng==="number")?v:null; }catch(e){ return null; } }
function saveCachedLocation(loc){ try{ localStorage.setItem(MYLOC_KEY, JSON.stringify(loc)); }catch(e){} }

function nearestHub(lat,lng){
  let best=null, bestD=Infinity;
  for(const [name,c] of Object.entries(CITIES)){ if(name==="Remote / Virtual") continue;
    const d=(c.lat-lat)**2+(c.lng-lng)**2; if(d<bestD){ bestD=d; best=name; } }
  return best;
}
// Drop the "you are here" marker + fly there (used by both cached and fresh paths).
function showLocation(lat,lng,accuracy,{announce=true}={}){
  if(!map) return;
  if(locateMarker) markerLayer.removeLayer(locateMarker);
  if(locateCircle) markerLayer.removeLayer(locateCircle);
  locateCircle=L.circle([lat,lng], { radius:Math.max(accuracy||500,300), color:"#46d6a4", weight:1, fillColor:"#46d6a4", fillOpacity:.12 }).addTo(markerLayer);
  locateMarker=L.marker([lat,lng], { icon:L.divIcon({ className:"", iconSize:[22,22], iconAnchor:[11,11],
    html:`<div style="width:16px;height:16px;border-radius:50%;background:#46d6a4;border:3px solid #fff;box-shadow:0 0 0 3px rgba(70,214,164,.4),0 2px 6px rgba(0,0,0,.4)"></div>` }) })
    .addTo(markerLayer).bindPopup("<b>You are here</b><br><span style='color:#777;font-size:12px'>Saved on this device only.</span>");
  map.flyTo([lat,lng], 11, { duration:.9 });
  locateMarker.openPopup();
  if(announce){ const hub=nearestHub(lat,lng); if(hub) toast(`Your location · nearest hub: ${hub} (${countInCity(hub)} AFEs)`); }
}

// Ask the browser for a fresh fix, cache it, then show. Only used first time or on refresh.
function fetchAndCacheLocation(){
  const btn=$("#btn-locate");
  if(!navigator.geolocation){ toast("Geolocation isn't supported in this browser"); return; }
  if(btn){ btn.classList.add("locating"); btn.textContent="Locating…"; }
  const done=()=>{ if(btn){ btn.classList.remove("locating"); btn.textContent="Locate me"; } };
  navigator.geolocation.getCurrentPosition(
    pos=>{ const { latitude:lat, longitude:lng, accuracy }=pos.coords;
      saveCachedLocation({ lat, lng, accuracy, ts:Date.now() });
      showLocation(lat,lng,accuracy);
      done();
    },
    err=>{ done(); toast(err.code===1 ? "Location permission denied" : "Couldn't get your location"); },
    { enableHighAccuracy:true, timeout:10000, maximumAge:60000 }
  );
}

// Primary click: if we have a cached position, jump instantly (like the city
// search). Force a fresh read with Shift/Alt-click, or when nothing is cached.
function locateMe(e){
  const forceFresh = e && (e.shiftKey || e.altKey);
  const cached = getCachedLocation();
  if(cached && !forceFresh){ showLocation(cached.lat, cached.lng, cached.accuracy); return; }
  fetchAndCacheLocation();
}

function wireMapTools(){
  const btn=$("#btn-locate"); if(btn && !btn._wired){ btn._wired=true; btn.addEventListener("click", locateMe); }
  const rbtn=$("#btn-locate-refresh"); if(rbtn && !rbtn._wired){ rbtn._wired=true; rbtn.addEventListener("click", ()=>{ rbtn.classList.add("spin"); const clear=()=>rbtn.classList.remove("spin"); setTimeout(clear,1200); fetchAndCacheLocation(); }); }
  const hbtn=$("#btn-heat"); if(hbtn && !hbtn._wired){ hbtn._wired=true;
    hbtn.classList.toggle("on", heatOn); hbtn.setAttribute("aria-pressed", String(heatOn));
    hbtn.addEventListener("click", ()=>{ heatOn=!heatOn; localStorage.setItem("orbit-heat", heatOn?"on":"off");
      hbtn.classList.toggle("on", heatOn); hbtn.setAttribute("aria-pressed", String(heatOn)); renderMap(); });
  }
  const gbtn=$("#btn-globe"); if(gbtn && !gbtn._wired){ gbtn._wired=true; gbtn.addEventListener("click", toggleGlobe); }
  const inp=$("#map-city-search"), box=$("#map-suggest");
  if(!inp || inp._wired) return; inp._wired=true;
  const cities=Object.keys(CITIES);
  let active=-1, matches=[];
  const render=()=>{
    const q=inp.value.trim().toLowerCase();
    matches=cities.filter(c=>c.toLowerCase().includes(q));
    if(!q || !matches.length){ box.innerHTML = q?`<div class="opt none">No matching city</div>`:""; box.classList.toggle("open", !!q); return; }
    box.innerHTML=matches.map((c,i)=>`<div class="opt${i===active?' active':''}" data-city="${esc(c)}"><span>${c==="Remote / Virtual"?"Remote / Virtual":esc(c)}</span><span class="cnt">${countInCity(c)}</span></div>`).join("");
    box.classList.add("open");
  };
  const choose=(city)=>{ inp.value=city==="Remote / Virtual"?"Remote / Virtual":city; box.classList.remove("open"); active=-1; flyToCity(city); };
  inp.addEventListener("input", ()=>{ active=-1; render(); });
  inp.addEventListener("focus", ()=>{ if(inp.value.trim()) render(); });
  inp.addEventListener("keydown", e=>{
    if(!box.classList.contains("open")) return;
    if(e.key==="ArrowDown"){ e.preventDefault(); active=Math.min(matches.length-1, active+1); render(); }
    else if(e.key==="ArrowUp"){ e.preventDefault(); active=Math.max(0, active-1); render(); }
    else if(e.key==="Enter"){ e.preventDefault(); if(matches[active]) choose(matches[active]); else if(matches.length) choose(matches[0]); }
    else if(e.key==="Escape"){ box.classList.remove("open"); }
  });
  box.addEventListener("click", e=>{ const o=e.target.closest(".opt[data-city]"); if(o) choose(o.dataset.city); });
  document.addEventListener("click", e=>{ if(!e.target.closest(".map-search")) box.classList.remove("open"); });
}
// --- Google OAuth login ---
async function signInWithGoogle(){
  const { error } = await db.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin + window.location.pathname }
  });
  if(error){ console.error('Google sign-in error:', error); $("#lg-err").textContent="Sign-in failed, try again."; }
}

// After Google redirects back, load or create the user profile
async function handleAuthSession(session){
  if(!session?.user) return;
  const authUser = session.user;
  const email = authUser.email;
  const name = authUser.user_metadata?.full_name || authUser.user_metadata?.name || email.split('@')[0];
  const photo = authUser.user_metadata?.avatar_url || null;

  // Check if user exists in our users table (handle duplicates)
  let { data: existingList } = await db.from('users').select('*').eq('email', email);

  if(existingList && existingList.length > 1){
    // Clean up duplicates — keep the oldest, delete the rest
    existingList.sort((a,b) => new Date(a.created_at) - new Date(b.created_at));
    const dupes = existingList.slice(1);
    for(const dupe of dupes){
      await db.from('users').delete().eq('id', dupe.id);
    }
    existingList = [existingList[0]];
  }

  const existing = existingList && existingList.length > 0 ? existingList[0] : null;

  if(existing){
    ME = { ...existing, newToo: existing.new_too, interests: existing.interests||[], topics: (existing.topics&&existing.topics.length)?existing.topics:undefined, privacy: existing.privacy||{...DEFAULT_PRIVACY} };
    // Update photo from Google if they don't have one
    if(!ME.photo && photo){
      ME.photo = photo;
      await db.from('users').update({ photo }).eq('id', ME.id);
    }
  } else {
    // Use upsert to prevent duplicates on email
    const { data: created, error: createErr } = await db.from('users').upsert({
      name, email, track: 'SDE', city: 'Seattle, WA', school: '', org: '', linkedin: '',
      avail: 'coffee', new_too: true, interests: [], bio: '', photo,
      privacy: { onMap:true, city:true, office:true, school:true, interests:true, linkedin:true, email:true, availability:true }
    }, { onConflict: 'email' }).select().single();
    if(createErr){ console.error('Create user error:', createErr); return; }
    ME = { ...created, newToo: created.new_too, interests: created.interests||[], privacy: created.privacy||{...DEFAULT_PRIVACY} };
  }

  await enterApp();
}

async function loadAllConversations(){
  if(!ME) return;
  _loadingHistory = true;
  const myGroupKeys = GROUPS.filter(g=>g.members.includes(ME.id)).map(g=>"grp:"+g.id);
  const orFilter = [`from_id.eq.${ME.id}`, `convo_key.like.%${ME.id}%`];
  if(myGroupKeys.length) orFilter.push(...myGroupKeys.map(k=>`convo_key.eq.${k}`));
  const { data, error } = await db.from('messages').select('*').or(orFilter.join(',')).order('ts',{ascending:true}).limit(5000);
  if(error){ console.error('loadAllConversations error:', error); _loadingHistory=false; return; }
  const grouped = {};
  for(const m of (data||[])){ if(!grouped[m.convo_key]) grouped[m.convo_key]=[]; grouped[m.convo_key].push(m); }
  for(const [convoKey, msgs] of Object.entries(grouped)){
    if(convoKey.startsWith('dm:')){
      const parts=convoKey.slice(3).split(':');
      if(!parts.includes(ME.id)) continue;
      const peerId=parts.find(id=>id!==ME.id); if(!peerId) continue;
      ensureDM(peerId);
      const c=CONVOS[dmKey(peerId)];
      for(const m of msgs.slice(-200)) pushMessage(c.key, m.from_id, m.text, m.ts);
    } else if(convoKey.startsWith('grp:')){
      const groupId=convoKey.slice(4);
      ensureGroup(groupId);
      const c=CONVOS[grpKey(groupId)];
      for(const m of msgs.slice(-200)) pushMessage(c.key, m.from_id, m.text, m.ts);
    }
  }
  _loadingHistory = false;
  refreshMessagingUI();
}

async function enterApp(){
  const onboarded = localStorage.getItem("orbit-onboarded-"+ME.id);
  const isFirstTime = !onboarded && !ME.school && !ME.org;

  // Load all users
  const { data: users } = await db.from('users').select('*');
  PEOPLE = (users||[]).filter(u => u.id !== ME.id).map(u => ({ ...u, newToo: u.new_too, interests: u.interests||[], topics: (u.topics&&u.topics.length)?u.topics:undefined }));

  // Load groups + members
  const { data: groups } = await db.from('groups').select('*, group_members(user_id)');
  GROUPS = (groups||[]).map(g => ({
    id: g.id, emoji: g.emoji, title: g.title, desc: g.description, city: g.city,
    private: g.private||false, members: (g.group_members||[]).map(m => m.user_id)
  }));

  $("#login").classList.add("hidden");
  $("#app").classList.remove("hidden");
  if(!map) initMap(); else setTimeout(()=>map.invalidateSize(),60);
  buildFilterChips();
  renderAll();
  PHOTO_DRAFT=null;

  // Load existing conversations so inbox is populated on refresh
  await loadAllConversations();

  // Subscribe to real-time messages
  subscribeToMessages();

  // Subscribe to presence (who's online right now)
  subscribePresence();

  // Subscribe to user changes
  db.channel('users-realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, (payload) => {
      if(!ME) return;
      if(payload.eventType === 'DELETE'){
        // A user deleted their account — remove them from everyone's view.
        const goneId = payload.old?.id; if(!goneId || goneId === ME.id) return;
        const gi = PEOPLE.findIndex(p => p.id === goneId);
        if(gi >= 0){ PEOPLE.splice(gi, 1); renderCards(); renderMap(); }
        return;
      }
      const user = { ...payload.new, newToo: payload.new.new_too, interests: payload.new.interests||[], topics: (payload.new.topics&&payload.new.topics.length)?payload.new.topics:undefined };
      if(user.id === ME.id){ ME = { ...user, privacy: user.privacy||ME.privacy||{...DEFAULT_PRIVACY} }; updateMeChip(); return; }
      const idx = PEOPLE.findIndex(p => p.id === user.id);
      if(idx >= 0) PEOPLE[idx] = user; else PEOPLE.push(user);
      renderCards(); renderMap();
    })
    .subscribe();

  if(isFirstTime){
    localStorage.setItem("orbit-onboarded-"+ME.id, "1");
    showModal(profileFormHTML("Welcome to Orbit", ME, true));
  }
}

$("#lg-google").addEventListener("click", signInWithGoogle);

/* ============================================================================
   THEME (dark / light) — follows the OS by default, remembers explicit choice.
   ========================================================================== */
const THEME_KEY = "orbit-theme";
// Effective theme: saved choice if the user picked one, else the OS preference.
function currentTheme(){
  const saved = localStorage.getItem(THEME_KEY);
  if(saved==="light"||saved==="dark") return saved;
  return (window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches) ? "light" : "dark";
}
function applyTheme(theme){
  document.documentElement.setAttribute("data-theme", theme);
  const btn=$("#btn-theme");
  if(btn){ btn.textContent = theme==="light" ? "☀️" : ""; btn.title = `Switch to ${theme==="light"?"dark":"light"} mode`; }
  setMapTiles(theme); // swap Leaflet basemap to match
  updateGlobeTheme();
}
function toggleTheme(){
  const next = currentTheme()==="light" ? "dark" : "light";
  localStorage.setItem(THEME_KEY, next); // explicit choice is remembered
  applyTheme(next);
}
// Apply immediately at load so the login screen already matches.
applyTheme(currentTheme());
$("#btn-theme").addEventListener("click", toggleTheme);
// If the user hasn't chosen explicitly, follow live OS changes.
if(window.matchMedia){
  window.matchMedia("(prefers-color-scheme: light)").addEventListener("change", ()=>{
    if(!localStorage.getItem(THEME_KEY)) applyTheme(currentTheme());
  });
}

async function boot(){
  buildFilterChips();
  wireFilters(); wireTabs(); wireSidebarResize(); wireMapTools();

  // Clean up URL hash left by Supabase auth redirect
  if(window.location.hash && window.location.hash.includes('access_token')){
    history.replaceState(null, '', window.location.pathname);
  }

  // Check if user is already logged in (session persists)
  const { data: { session } } = await db.auth.getSession();
  if(session){
    await handleAuthSession(session);
  }

  // Listen for auth state changes (handles redirect back from Google)
  db.auth.onAuthStateChange(async (event, session) => {
    if(event === 'SIGNED_IN' && session && !ME){
      await handleAuthSession(session);
    }
  });
}
// A11y: make clickable non-button elements (chips, conversation rows, me-chip)
// keyboard-operable — Enter/Space triggers a click. They also get tabindex/role
// applied lazily so they're reachable and announced.
function makeClickableAccessible(){
  $$(".chip, .conv, .me-chip, .theme-toggle").forEach(el=>{
    if(el.tagName==="BUTTON") return;
    if(!el.hasAttribute("tabindex")) el.setAttribute("tabindex","0");
    if(!el.hasAttribute("role")) el.setAttribute("role","button");
  });
}
document.addEventListener("keydown", e=>{
  const el=e.target.closest(".chip, .conv, .me-chip");
  if(el && (e.key==="Enter"||e.key===" ")){ e.preventDefault(); el.click(); }
});
// Re-apply after any render that injects chips/rows.
const _origRenderAll = renderAll;
renderAll = function(){ _origRenderAll(); makeClickableAccessible(); };

document.addEventListener("DOMContentLoaded", ()=>{ boot(); makeClickableAccessible(); });
