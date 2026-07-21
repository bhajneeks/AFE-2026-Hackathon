/* ============================================================================
   ORBIT — LINKEDIN MODULE (linkedin.js)
   ============================================================================
   All LinkedIn-specific logic lives here, separate from the main app so it can
   be owned/edited independently.

   Depends on globals defined in index.html at CALL time (not load time):
     ME, byId, connectionReasons, showModal, esc, toast, copyText
   Exposes globals used by index.html:
     normalizeLinkedIn(raw)  — clean any pasted URL/handle; null if invalid
     linkedinURL(person)     — canonical profile URL for a person
     linkedinNote(person)    — personalized 300-char-safe connect note
     window.openLinkedIn(id) — the "in Connect" modal
   ========================================================================== */

// Opens the person's real LinkedIn profile so the user can Connect / message there.
function linkedinURL(person){ return `https://www.linkedin.com/in/${encodeURIComponent(person.linkedin)}`; }

// Accepts anything a user might paste — full URL, bare domain path, "in/handle",
// "@handle", or just the handle — and returns the clean handle, or null if invalid.
function normalizeLinkedIn(raw){
  if(!raw) return "";                                  // optional field — empty is fine
  let s=raw.trim();
  s=s.replace(/^https?:\/\//i,"").replace(/^www\./i,"");   // strip scheme + www
  s=s.replace(/^[a-z]{2,3}\.linkedin\.com\//i,"").replace(/^linkedin\.com\//i,""); // strip domain (incl. country subdomains)
  s=s.replace(/^in\//i,"");                            // strip the /in/ path prefix
  s=s.replace(/^@/,"");                                // strip a leading @
  s=s.split(/[?#]/)[0];                                // drop query string / fragment
  s=s.replace(/\/+$/,"");                              // drop trailing slashes
  // LinkedIn public handles: letters (any language), numbers, hyphens (+ percent-encoding)
  if(!/^[\p{L}\p{N}\-_%]{3,100}$/u.test(s)) return null; // null = looks invalid
  return s;
}

// A short note the user can copy into LinkedIn's connect/message box (300-char safe).
function linkedinNote(person){
  const reasons=connectionReasons(person);
  const meName=ME?.name?.split(" ")[0] || "a fellow AFE";
  const hook=reasons.find(r=>r.key!=="alum")?.me || "we're both AFE interns";
  let note=`Hi ${person.name.split(" ")[0]}, I'm ${meName} — ${hook}. Would love to connect here on LinkedIn and maybe grab a quick coffee chat!`;
  return note.length>300 ? note.slice(0,297)+"…" : note;
}

// The "in Connect" modal: personalized note + open the profile in a new tab.
window.openLinkedIn=function(peerId){
  const p=byId(peerId); if(!p||!p.linkedin) return;
  const note=linkedinNote(p);
  showModal(`
    <div class="m-head"><div class="btn linkedin" style="pointer-events:none;font-size:16px">in</div><h2>Connect on LinkedIn</h2><button class="x" onclick="closeModal()">×</button></div>
    <div class="m-body">
      <p class="muted">Opening <b>${esc(p.name)}</b>'s LinkedIn profile in a new tab. Hit <b>Connect</b> (or <b>Message</b>) there and paste this note:</p>
      <div class="copyfield"><textarea id="li-note" style="min-height:110px">${esc(note)}</textarea></div>
      <p class="muted" style="font-size:12px;margin-top:10px">🔗 <code>linkedin.com/in/${esc(p.linkedin)}</code> &nbsp;·&nbsp; <span style="color:var(--ink-faint)">Demo profiles use sample handles, so the page may not resolve to a real person.</span></p>
    </div>
    <div class="m-foot">
      <button class="btn" onclick="copyText(document.getElementById('li-note').value)">📋 Copy note</button>
      <button class="btn primary" onclick="window.open('${linkedinURL(p)}','_blank','noopener'); toast('Opening LinkedIn…')">Open LinkedIn ↗</button>
    </div>`);
};
