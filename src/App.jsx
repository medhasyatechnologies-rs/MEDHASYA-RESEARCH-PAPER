import { useState, useEffect } from "react";
 
// ── MEDHASYA AI · Research Paper Formatter ──────────────────────
// Bugs fixed: section numbering, export numbering, position collisions,
// single-key storage, validation, clipboard safety, citation titles,
// email validation, URL revocation, localStorage auto-save.
 
const C = {
  bg: "#f7f6f2",
  border: "#e2ddd6",
  ink: "#1a1814",
  inkMid: "#4a4540",
  inkLight: "#7a7570",
  accent: "#2d5a8e",
  accentLight: "#e8f0f9",
  accentDark: "#1a3d62",
  gold: "#b8860b",
  goldLight: "#fdf6e3",
  green: "#2e7d52",
  greenLight: "#edf7f1",
  red: "#c0392b",
};
 
const FORMATS = {
  IEEE: {
    name: "IEEE",
    full: "Institute of Electrical and Electronics Engineers",
    sections: ["Introduction", "Related Work", "Methodology", "Results & Discussion", "Conclusion"],
    citationStyle: "numeric",
    columns: "double",
  },
  ACM: {
    name: "ACM",
    full: "Association for Computing Machinery",
    sections: ["Introduction", "Background & Related Work", "Approach", "Evaluation", "Discussion", "Conclusion"],
    citationStyle: "numeric",
    columns: "double",
  },
  Springer: {
    name: "Springer LNCS",
    full: "Springer Lecture Notes in Computer Science",
    sections: ["Introduction", "Related Work", "Proposed Method", "Experiments", "Conclusion"],
    citationStyle: "numeric",
    columns: "single",
  },
  Elsevier: {
    name: "Elsevier",
    full: "Elsevier Journal Format",
    sections: ["Introduction", "Literature Review", "Materials & Methods", "Results", "Discussion", "Conclusion"],
    citationStyle: "name-year",
    columns: "single",
  },
};
 
const ROMAN = ["I","II","III","IV","V","VI","VII","VIII","IX","X","XI","XII","XIII","XIV","XV"];
 
// FIX 1+2: getSectionNum takes 0-based idx, ROMAN[idx] gives correct I, II, III…
// Callers must pass i (not i+1)
function getSectionNum(fmt, idx) {
  return fmt === "IEEE" ? ROMAN[idx] + "." : (idx + 1) + ".";
}
 
// FIX 9: better word count — strip common non-word tokens before splitting
function wordCount(t) {
  if (!t || !t.trim()) return 0;
  return t.trim().replace(/[^a-zA-Z0-9\s]/g, " ").trim().split(/\s+/).filter(Boolean).length;
}
 
// FIX 4: single canonical key — only one key stored per section
function sectionKey(name) {
  return "__sec__" + name.toLowerCase().replace(/[^a-z0-9]/g, "_");
}
 
// FIX 7: safe citation — skip empty title gracefully
function formatCitation(ref, idx, style) {
  const { authors, year, title, journal, volume, issue, pages, doi, booktitle } = ref;
 
  const authorStr =
    !authors || authors.length === 0
      ? "Unknown Author"
      : authors.length > 6
        ? authors.slice(0, 6).join(", ") + " et al."
        : authors.join(", ");
 
  const safeTitle = title && title.trim() ? title.trim() : null;
  const venue = journal || booktitle || "";
 
  if (style === "name-year") {
    const last = authors?.[0]?.split(" ").pop() || "Unknown";
    const tag = (authors?.length || 0) > 2 ? `${last} et al.` : authorStr;
    const parts = [
      authorStr,
      `(${year || "n.d."}).`,
      safeTitle ? `${safeTitle}.` : null,
      venue || null,
      volume ? `, ${volume}` : null,
      issue ? `(${issue})` : null,
      pages ? `, ${pages}` : null,
      doi ? `. https://doi.org/${doi}` : null,
    ].filter(Boolean);
    return {
      inText: `(${tag}, ${year || "n.d."})`,
      full: parts.join(" "),
    };
  }
 
  const parts = [
    `[${idx + 1}]`,
    `${authorStr},`,
    safeTitle ? `"${safeTitle},"` : null,
    venue ? `${venue}` : null,
    volume ? `, vol. ${volume}` : null,
    issue ? `, no. ${issue}` : null,
    pages ? `, pp. ${pages}` : null,
    year ? `, ${year}` : null,
    doi ? `, doi: ${doi}` : null,
  ].filter(Boolean);
 
  return {
    inText: `[${idx + 1}]`,
    full: parts.join(" ") + ".",
  };
}
 
// FIX 8: email validation
function isValidEmail(email) {
  if (!email || !email.trim()) return true; // optional field
  return /\S+@\S+\.\S+/.test(email.trim());
}
 
const GUIDELINES = {
  "Introduction": "State the problem, motivation, and your contributions. End with paper structure overview.",
  "Related Work": "Review prior work grouped by theme. Compare approaches and identify the gap your work fills.",
  "Background & Related Work": "Review prior work grouped by theme. Compare approaches and identify the gap.",
  "Methodology": "Describe your proposed method step by step. Include algorithms, system design, equations. Make it reproducible.",
  "Approach": "Describe your proposed approach with system design, algorithms, and implementation details.",
  "Proposed Method": "Describe your method with sufficient detail for reproducibility. Equations and diagrams are common.",
  "Results & Discussion": "Present quantitative results. Compare to baselines. Discuss why your method works.",
  "Evaluation": "Present experiments, datasets, metrics, baselines, and quantitative results.",
  "Experiments": "Describe experimental setup, datasets, evaluation metrics, and compare results.",
  "Results": "Present findings with statistics. Reference tables and figures (e.g., Table 1, Fig. 2).",
  "Discussion": "Interpret results. Address limitations, unexpected findings, and implications.",
  "Materials & Methods": "Describe datasets, experimental protocol, tools, and statistical methods.",
  "Literature Review": "Comprehensive review of existing work, organized by sub-topic or chronologically.",
  "Conclusion": "Summarize contributions, key results, and future directions. Typically 200–350 words.",
};
 
// ── Paper Preview ─────────────────────────────────────────────
function PaperPreview({ paper, fmt, allBodySections, refs }) {
  const fmtObj = FORMATS[fmt];
 
  // FIX 1: pass idx (0-based) directly — ROMAN[0] = "I", correct
  const sLabel = (name, idx) =>
    fmt === "IEEE"
      ? `${ROMAN[idx]}. ${name.toUpperCase()}`
      : `${idx + 1}. ${name}`;
 
  return (
    <div style={{
      fontFamily: "Times New Roman, serif",
      fontSize: 14,
      lineHeight: 1.65,
      color: "#111",
      background: "#fff",
      padding: "48px 56px",
      maxWidth: 900,
      margin: "0 auto",
      boxShadow: "0 2px 24px rgba(0,0,0,0.08)",
      borderRadius: 4,
    }}>
      {/* Title */}
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <div style={{ fontSize: 20, fontWeight: "bold", lineHeight: 1.3, marginBottom: 20 }}>
          {paper.title || "Paper Title"}
        </div>
        {paper.authors?.length > 0 && (
          <div style={{ marginBottom: 10 }}>
            {paper.authors.map((a, i) => (
              <span key={i}>
                <span style={{ fontStyle: "italic" }}>{a.name}</span>
                {i < paper.authors.length - 1 && ", "}
              </span>
            ))}
          </div>
        )}
        {paper.authors?.some(a => a.affiliation) && (
          <div style={{ fontSize: 12, color: "#333", marginBottom: 8 }}>
            {paper.authors.filter(a => a.affiliation).map((a, i) => (
              <div key={i}>
                {a.name}{a.affiliation ? ` — ${a.affiliation}` : ""}
                {a.email ? ` — ${a.email}` : ""}
              </div>
            ))}
          </div>
        )}
        {paper.keywords && (
          <div style={{ fontSize: 12, marginTop: 8 }}>
            <strong>Keywords:</strong> <em>{paper.keywords}</em>
          </div>
        )}
      </div>
 
      <hr style={{ border: "none", borderTop: "1px solid #888", margin: "0 0 20px" }} />
 
      {/* Abstract */}
      {paper.abstract && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontWeight: "bold", fontSize: 13, textAlign: fmt === "IEEE" ? "center" : "left", marginBottom: 8 }}>
            {fmt === "IEEE" ? "Abstract—" : "Abstract"}
          </div>
          <div style={{ fontSize: 13, lineHeight: 1.6 }}>{paper.abstract}</div>
        </div>
      )}
 
      <hr style={{ border: "none", borderTop: "1px solid #ccc", margin: "0 0 24px" }} />
 
      {/* Body sections — FIX 1: pass idx directly (0-based) */}
      {allBodySections.map((sec, idx) => {
        const content = paper.sections?.[sectionKey(sec.name)] || "";
        if (!content) return null;
        return (
          <div key={sec.id} style={{ marginBottom: 24 }}>
            <div style={{
              fontWeight: "bold",
              fontSize: fmt === "IEEE" ? 13 : 14,
              textAlign: fmt === "IEEE" ? "center" : "left",
              marginBottom: 8,
              textTransform: fmt === "IEEE" ? "uppercase" : "none",
              letterSpacing: fmt === "IEEE" ? "0.05em" : "normal",
            }}>
              {sLabel(sec.name, idx)}
            </div>
            <div style={{ fontSize: 13.5, lineHeight: 1.7, whiteSpace: "pre-wrap", textAlign: "justify" }}>
              {content}
            </div>
          </div>
        );
      })}
 
      {/* References */}
      {refs.length > 0 && (
        <div style={{ marginTop: 28 }}>
          <div style={{
            fontWeight: "bold", fontSize: 13,
            textAlign: fmt === "IEEE" ? "center" : "left",
            marginBottom: 12,
            textTransform: fmt === "IEEE" ? "uppercase" : "none",
          }}>
            References
          </div>
          <div style={{ fontSize: 12.5, lineHeight: 1.6 }}>
            {refs.map((ref, i) => (
              <div key={i} style={{ marginBottom: 6 }}>
                {formatCitation(ref, i, fmtObj.citationStyle).full}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
 
// ── Validation banner ─────────────────────────────────────────
function ValidationBanner({ errors }) {
  if (!errors.length) return null;
  return (
    <div style={{ background: "#fff3cd", border: "1.5px solid #f0c040", borderRadius: 8, padding: "12px 16px", marginBottom: 20 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: "#7a5000", marginBottom: 6 }}>Please fix the following before previewing:</div>
      {errors.map((e, i) => (
        <div key={i} style={{ fontSize: 12, color: "#7a5000" }}>• {e}</div>
      ))}
    </div>
  );
}
 
// ── MAIN APP ──────────────────────────────────────────────────
const LS_KEY = "medhasya_v2";
 
const defaultPaper = {
  title: "",
  authors: [{ name: "", affiliation: "", email: "" }],
  keywords: "",
  abstract: "",
  sections: {},
};
 
export default function MedhasyaApp() {
  const [fmt, setFmt] = useState("IEEE");
  const [phase, setPhase] = useState("format");
  const [paper, setPaper] = useState(defaultPaper);
  const [refs, setRefs] = useState([]);
  const [activeSection, setActiveSection] = useState(0);
  const [copied, setCopied] = useState(false);
  const [validationErrors, setValidationErrors] = useState([]);
 
  const [customSections, setCustomSections] = useState([]);
  const [addingSectionAfter, setAddingSectionAfter] = useState(null);
  const [newSectionName, setNewSectionName] = useState("");
  const [renamingId, setRenamingId] = useState(null);
  const [renameVal, setRenameVal] = useState("");
 
  // FIX A: auto-save to localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LS_KEY);
      if (saved) {
        const data = JSON.parse(saved);
        if (data.paper) setPaper(data.paper);
        if (data.refs) setRefs(data.refs);
        if (data.fmt) setFmt(data.fmt);
        if (data.customSections) setCustomSections(data.customSections);
      }
    } catch (_) {}
  }, []);
 
  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({ paper, refs, fmt, customSections }));
    } catch (_) {}
  }, [paper, refs, fmt, customSections]);
 
  const clearSaved = () => {
    try { localStorage.removeItem(LS_KEY); } catch (_) {}
    setPaper(defaultPaper);
    setRefs([]);
    setCustomSections([]);
    setFmt("IEEE");
    setActiveSection(0);
    setPhase("format");
  };
 
  const format = FORMATS[fmt];
  const fixedSections = format.sections;
 
  // FIX 3: use insertion-order array instead of float positions
  // allBodySections is an ordered array — custom sections sit at a splice index
  // Each custom section stores { id, name, insertAfterIdx } where insertAfterIdx is index in fixedSections (-1 = before all)
  // We build the merged array deterministically
  const buildAllBodySections = () => {
    // Start with fixed sections as slots
    const slots = fixedSections.map((s, i) => ({
      items: [{ id: `fixed_${i}`, name: s, type: "fixed" }],
    }));
    // For each custom section, insert into the right slot
    // insertAfterIdx: -1 = before slot 0, 0 = after fixed[0], etc.
    customSections.forEach(cs => {
      const afterIdx = cs.insertAfterIdx ?? fixedSections.length - 1;
      const slotIdx = Math.max(0, Math.min(afterIdx + 1, slots.length - 1));
      slots[slotIdx].items.push({ id: cs.id, name: cs.name, type: "custom", insertAfterIdx: cs.insertAfterIdx });
    });
    return slots.flatMap(slot => slot.items);
  };
 
  const allBodySections = buildAllBodySections();
  const navItems = ["meta", "abstract", ...allBodySections.map(s => s.id), "references"];
  const currentNavId = navItems[activeSection];
 
  // FIX 4: single-key storage — only use sectionKey(name)
  const setSection = (name, val) => {
    const key = sectionKey(name);
    setPaper(p => ({ ...p, sections: { ...p.sections, [key]: val } }));
  };
  const getSection = (name) => paper.sections?.[sectionKey(name)] || "";
 
  // Author helpers
  const addAuthor = () => setPaper(p => ({ ...p, authors: [...p.authors, { name: "", affiliation: "", email: "" }] }));
  const removeAuthor = (i) => setPaper(p => ({ ...p, authors: p.authors.filter((_, idx) => idx !== i) }));
  const updateAuthor = (i, field, val) =>
    setPaper(p => ({ ...p, authors: p.authors.map((a, idx) => idx === i ? { ...a, [field]: val } : a) }));
 
  // Ref helpers
  const addRef = () => setRefs(r => [...r, { authors: [], year: "", title: "", journal: "", volume: "", issue: "", pages: "", doi: "", booktitle: "" }]);
  const removeRef = (i) => setRefs(r => r.filter((_, idx) => idx !== i));
  const updateRef = (i, field, val) => setRefs(r => r.map((ref, idx) => idx === i ? { ...ref, [field]: val } : ref));
 
  // FIX 3: custom section uses insertAfterIdx (integer slot), no float positions
  const addCustomSection = (insertAfterIdx) => {
    const name = newSectionName.trim();
    if (!name) return;
    const id = `custom_${Date.now()}`;
    setCustomSections(cs => [...cs, { id, name, insertAfterIdx }]);
    setNewSectionName("");
    setAddingSectionAfter(null);
  };
 
  const removeCustomSection = (id) => {
    const sec = customSections.find(s => s.id === id);
    if (sec) {
      const key = sectionKey(sec.name);
      setPaper(p => {
        const newSecs = { ...p.sections };
        delete newSecs[key];
        return { ...p, sections: newSecs };
      });
    }
    setCustomSections(cs => cs.filter(s => s.id !== id));
    if (currentNavId === id) setActiveSection(0);
  };
 
  const renameCustomSection = (id) => {
    const name = renameVal.trim();
    if (!name) { setRenamingId(null); return; }
    const sec = customSections.find(s => s.id === id);
    if (sec) {
      const oldContent = getSection(sec.name);
      const oldKey = sectionKey(sec.name);
      const newKey = sectionKey(name);
      setPaper(p => {
        const newSecs = { ...p.sections };
        delete newSecs[oldKey];
        newSecs[newKey] = oldContent;
        return { ...p, sections: newSecs };
      });
      setCustomSections(cs => cs.map(s => s.id === id ? { ...s, name } : s));
    }
    setRenamingId(null);
    setRenameVal("");
  };
 
  // Move by swapping insertAfterIdx with neighbour in allBodySections
  const moveCustomSection = (id, dir) => {
    const currentIdx = allBodySections.findIndex(s => s.id === id);
    const targetIdx = currentIdx + dir;
    if (targetIdx < 0 || targetIdx >= allBodySections.length) return;
    const neighbour = allBodySections[targetIdx];
    // Swap insertAfterIdx with neighbour if neighbour is also custom; else shift around fixed
    setCustomSections(cs => {
      const meSec = cs.find(s => s.id === id);
      if (!meSec) return cs;
      if (neighbour.type === "custom") {
        const neighbourSec = cs.find(s => s.id === neighbour.id);
        const myIdx = meSec.insertAfterIdx;
        const theirIdx = neighbourSec.insertAfterIdx;
        return cs.map(s =>
          s.id === id ? { ...s, insertAfterIdx: theirIdx } :
          s.id === neighbour.id ? { ...s, insertAfterIdx: myIdx } : s
        );
      } else {
        // neighbour is fixed — move custom to be just before/after that fixed
        const fixedIdx = fixedSections.indexOf(neighbour.name);
        const newInsert = dir === -1 ? fixedIdx - 1 : fixedIdx;
        return cs.map(s => s.id === id ? { ...s, insertAfterIdx: Math.max(-1, newInsert) } : s);
      }
    });
  };
 
  // Word count total
  const totalWords = wordCount(paper.abstract) +
    allBodySections.reduce((acc, s) => acc + wordCount(getSection(s.name)), 0);
 
  const filledCount = (paper.abstract ? 1 : 0) +
    allBodySections.filter(s => getSection(s.name).trim()).length;
 
  // FIX 5: validation before preview
  const validate = () => {
    const errors = [];
    if (!paper.title.trim()) errors.push("Paper title is required.");
    if (!paper.abstract.trim()) errors.push("Abstract is required.");
    const filledBody = allBodySections.filter(s => getSection(s.name).trim()).length;
    if (filledBody === 0) errors.push("At least one body section must have content.");
    // FIX 8: email validation
    paper.authors.forEach((a, i) => {
      if (a.email && !isValidEmail(a.email)) {
        errors.push(`Author ${i + 1} email "${a.email}" looks invalid.`);
      }
    });
    return errors;
  };
 
  const goToPreview = () => {
    const errors = validate();
    if (errors.length) {
      setValidationErrors(errors);
      return;
    }
    setValidationErrors([]);
    setPhase("preview");
  };
 
  // FIX 2+10: export with correct numbering (i, not i+1) and URL revocation
  const exportMd = () => {
    const lines = [`# ${paper.title}`, "", `**Format:** ${format.full}`];
    if (paper.keywords) lines.push(`**Keywords:** ${paper.keywords}`);
    lines.push("");
    if (paper.abstract) lines.push("## Abstract", paper.abstract, "");
    allBodySections.forEach((s, i) => {
      const content = getSection(s.name);
      if (content) lines.push(`## ${getSectionNum(fmt, i)} ${s.name}`, content, ""); // FIX 2: i not i+1
    });
    if (refs.length) {
      lines.push("## References");
      refs.forEach((r, i) => lines.push(formatCitation(r, i, format.citationStyle).full));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${paper.title.replace(/\s+/g, "_") || "paper"}.md`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000); // FIX 10
  };
 
  // FIX 2: copyText with correct numbering; FIX 6: safe clipboard
  const copyText = async () => {
    const lines = [paper.title, ""];
    if (paper.abstract) lines.push("ABSTRACT", paper.abstract, "");
    allBodySections.forEach((s, i) => {
      const c = getSection(s.name);
      if (c) lines.push(`${getSectionNum(fmt, i)} ${s.name.toUpperCase()}`, c, ""); // FIX 2
    });
    if (refs.length) {
      lines.push("REFERENCES");
      refs.forEach((r, i) => lines.push(formatCitation(r, i, format.citationStyle).full));
    }
    const text = lines.join("\n");
    // FIX 6: safe clipboard with fallback
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      // Fallback: create a temporary textarea
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (_) {
        alert("Copy failed. Please use Ctrl+A / Cmd+A in the preview to select all text.");
      }
    }
  };
 
  // ── PHASE 1: Format Selection ─────────────────────────────────
  if (phase === "format") return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "system-ui, sans-serif" }}>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .fmt-card { border: 2px solid ${C.border}; border-radius: 8px; padding: 20px; cursor: pointer; transition: all 0.18s; background: white; }
        .fmt-card:hover { border-color: ${C.accent}; box-shadow: 0 0 0 3px ${C.accentLight}; }
        .fmt-card.sel { border-color: ${C.accent}; background: ${C.accentLight}; }
        .btn-p { background: ${C.accent}; color: white; border: none; padding: 12px 28px; border-radius: 6px; font-size: 15px; font-weight: 600; cursor: pointer; }
        .btn-p:hover { background: ${C.accentDark}; }
        .btn-g { background: transparent; color: ${C.inkMid}; border: 1.5px solid ${C.border}; padding: 8px 18px; border-radius: 6px; font-size: 13px; cursor: pointer; }
        .btn-g:hover { border-color: ${C.inkMid}; }
      `}</style>
      <header style={{ padding: "18px 32px", borderBottom: `1px solid ${C.border}`, background: "white", display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 32, height: 32, background: C.accent, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ color: "white", fontSize: 16, fontWeight: 700 }}>M</span>
        </div>
        <span style={{ fontWeight: 700, fontSize: 17, color: C.ink }}>Medhasya AI</span>
        <span style={{ fontSize: 12, color: C.inkLight }}>· Research Paper Formatter</span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" }}>
          <span style={{ fontSize: 12, background: C.greenLight, color: C.green, padding: "3px 10px", borderRadius: 100, fontWeight: 600 }}>Free</span>
          {paper.title && (
            <button className="btn-g" style={{ fontSize: 12 }} onClick={() => setPhase("input")}>Resume Draft →</button>
          )}
        </div>
      </header>
 
      <div style={{ padding: "48px 24px", maxWidth: 760, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <h1 style={{ fontSize: 30, fontWeight: 700, color: C.ink, marginBottom: 10 }}>Choose your paper format</h1>
          <p style={{ fontSize: 15, color: C.inkMid, lineHeight: 1.6 }}>
            Pick your target journal or conference. Fixed sections are pre-loaded — add custom sections anywhere you need.
          </p>
        </div>
 
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 28 }}>
          {Object.entries(FORMATS).map(([key, f]) => (
            <div key={key} className={`fmt-card${fmt === key ? " sel" : ""}`} onClick={() => setFmt(key)}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                <span style={{ fontSize: 18, fontWeight: 700, color: fmt === key ? C.accent : C.ink }}>{f.name}</span>
                {fmt === key && <span style={{ fontSize: 11, background: C.accent, color: "white", padding: "2px 8px", borderRadius: 100 }}>SELECTED</span>}
              </div>
              <p style={{ fontSize: 12, color: C.inkLight, marginBottom: 10 }}>{f.full}</p>
              <div style={{ fontSize: 12, color: C.inkMid, marginBottom: 4 }}>
                <strong>Sections:</strong> {f.sections.join(" → ")}
              </div>
              <div style={{ fontSize: 12, color: C.inkMid, marginBottom: 4 }}>
                <strong>Citations:</strong> {f.citationStyle === "numeric" ? "Numeric [1]" : "Author-Year (Smith, 2024)"}
              </div>
              <div style={{ fontSize: 12, color: C.inkMid }}>
                <strong>Layout:</strong> {f.columns === "double" ? "Two-column" : "Single-column"}
              </div>
            </div>
          ))}
        </div>
 
        <div style={{ background: C.goldLight, border: "1px solid #e0c85a", borderRadius: 8, padding: 14, marginBottom: 28, fontSize: 13, color: "#7a6000" }}>
          <strong>How it works:</strong> Paste your content into each section. Add custom sections (e.g. "System Architecture", "Limitations") anywhere. Your draft auto-saves in your browser.
        </div>
 
        <div style={{ display: "flex", justifyContent: "center", gap: 12 }}>
          <button className="btn-p" onClick={() => setPhase("input")} style={{ fontSize: 16, padding: "14px 40px" }}>
            Start with {fmt} →
          </button>
          {paper.title && (
            <button className="btn-g" style={{ color: C.red, borderColor: C.red, fontSize: 13 }} onClick={clearSaved}>
              Clear saved draft
            </button>
          )}
        </div>
      </div>
    </div>
  );
 
  // ── PHASE 2: Content Input ────────────────────────────────────
  if (phase === "input") {
    const currentSec = allBodySections.find(s => s.id === currentNavId);
 
    return (
      <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "system-ui, sans-serif", display: "flex", flexDirection: "column" }}>
        <style>{`
          * { box-sizing: border-box; margin: 0; padding: 0; }
          textarea, input { font-family: system-ui, sans-serif; }
          .fi { width: 100%; padding: 10px 12px; border: 1.5px solid ${C.border}; border-radius: 6px; font-size: 14px; color: ${C.ink}; background: white; transition: border 0.15s; resize: vertical; }
          .fi:focus { border-color: ${C.accent}; outline: none; box-shadow: 0 0 0 3px ${C.accentLight}; }
          .fi.err { border-color: ${C.red}; }
          .fl { display: block; font-size: 12px; font-weight: 600; color: ${C.inkMid}; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.06em; }
          .btn-p { background: ${C.accent}; color: white; border: none; padding: 10px 22px; border-radius: 6px; font-size: 14px; font-weight: 600; cursor: pointer; }
          .btn-p:hover { background: ${C.accentDark}; }
          .btn-g { background: transparent; color: ${C.inkMid}; border: 1.5px solid ${C.border}; padding: 8px 18px; border-radius: 6px; font-size: 13px; cursor: pointer; }
          .btn-g:hover { border-color: ${C.inkMid}; }
          .btn-d { background: transparent; color: ${C.red}; border: 1.5px solid ${C.border}; padding: 5px 12px; border-radius: 5px; font-size: 12px; cursor: pointer; }
          .btn-d:hover { border-color: ${C.red}; }
          .nav-tab { padding: 8px 10px; font-size: 12px; cursor: pointer; border-radius: 6px; transition: all 0.15s; white-space: nowrap; border: none; background: transparent; text-align: left; display: flex; align-items: center; gap: 7px; width: 100%; color: ${C.inkLight}; }
          .nav-tab:hover { background: ${C.accentLight}; color: ${C.accent}; }
          .nav-tab.act { background: ${C.accentLight}; color: ${C.accent}; font-weight: 600; }
          .add-sec-btn { border: 1.5px dashed ${C.border}; background: transparent; color: ${C.inkLight}; font-size: 11px; padding: 3px 8px; border-radius: 5px; cursor: pointer; width: 100%; text-align: center; margin: 2px 0; }
          .add-sec-btn:hover { border-color: ${C.accent}; color: ${C.accent}; background: ${C.accentLight}; }
          .sec-action { border: none; background: none; cursor: pointer; padding: 2px 5px; font-size: 12px; color: ${C.inkLight}; border-radius: 3px; }
          .sec-action:hover { background: ${C.border}; color: ${C.ink}; }
        `}</style>
 
        {/* Header */}
        <header style={{ padding: "13px 24px", borderBottom: `1px solid ${C.border}`, background: "white", display: "flex", alignItems: "center", gap: 14, position: "sticky", top: 0, zIndex: 20 }}>
          <button onClick={() => setPhase("format")} style={{ border: "none", background: "none", cursor: "pointer", color: C.accent, fontSize: 13, fontWeight: 600 }}>← Format</button>
          <div style={{ width: 1, height: 20, background: C.border }} />
          <span style={{ fontWeight: 700, fontSize: 15, color: C.ink }}>Medhasya AI</span>
          <span style={{ fontSize: 12, color: C.inkLight, background: C.border, padding: "2px 8px", borderRadius: 100 }}>{fmt}</span>
          <span style={{ fontSize: 11, color: C.green }}>● auto-saved</span>
          <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" }}>
            <span style={{ fontSize: 12, color: C.inkLight }}>{totalWords.toLocaleString()} words · {filledCount}/{allBodySections.length + 1} sections</span>
            <button className="btn-p" onClick={goToPreview}>Preview Paper →</button>
          </div>
        </header>
 
        <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
 
          {/* Sidebar */}
          <aside style={{ width: 215, background: "white", borderRight: `1px solid ${C.border}`, padding: "14px 10px", flexShrink: 0, overflowY: "auto" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.inkLight, letterSpacing: "0.12em", padding: "0 4px", marginBottom: 10 }}>SECTIONS</div>
 
            {/* Meta */}
            <button className={`nav-tab${currentNavId === "meta" ? " act" : ""}`} onClick={() => setActiveSection(0)}>
              <Dot done={!!paper.title} active={currentNavId === "meta"} label="1" />
              Title & Authors
            </button>
 
            {/* Abstract */}
            <button className={`nav-tab${currentNavId === "abstract" ? " act" : ""}`} onClick={() => setActiveSection(1)}>
              <Dot done={!!paper.abstract?.trim()} active={currentNavId === "abstract"} label="2" />
              Abstract
            </button>
 
            {/* Add before first body section */}
            {AddSectionWidget({ triggerId: "before_all", afterIdx: -1, addingSectionAfter, setAddingSectionAfter, newSectionName, setNewSectionName, addCustomSection })}
 
            {/* Body sections */}
            {allBodySections.map((sec, idx) => {
              const navIdx = navItems.indexOf(sec.id);
              const isActive = currentNavId === sec.id;
              const isDone = !!getSection(sec.name).trim();
              const isCustom = sec.type === "custom";
              // The fixed section index this custom comes after
              const insertAfterIdx = isCustom ? (customSections.find(c => c.id === sec.id)?.insertAfterIdx ?? -1) : idx;
 
              return (
                <div key={sec.id}>
                  <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
                    <button className={`nav-tab${isActive ? " act" : ""}`} onClick={() => setActiveSection(navIdx)} style={{ flex: 1, minWidth: 0 }}>
                      <Dot done={isDone} active={isActive} label={idx + 3} />
                      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", display: "flex", alignItems: "center", gap: 4 }}>
                        {isCustom && <span style={{ fontSize: 9, color: C.accent, flexShrink: 0 }}>✦</span>}
                        {renamingId === sec.id ? (
                          <input
                            value={renameVal}
                            onChange={e => setRenameVal(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === "Enter") renameCustomSection(sec.id);
                              if (e.key === "Escape") setRenamingId(null);
                            }}
                            onBlur={() => renameCustomSection(sec.id)}
                            autoFocus
                            onClick={e => e.stopPropagation()}
                            style={{ width: "100%", border: "none", background: "transparent", fontSize: 12, color: C.ink, outline: "none", padding: 0 }}
                          />
                        ) : sec.name}
                      </span>
                    </button>
                    {isCustom && (
                      <div style={{ display: "flex", gap: 1, flexShrink: 0 }}>
                        <button className="sec-action" title="Move up" onClick={() => moveCustomSection(sec.id, -1)}>↑</button>
                        <button className="sec-action" title="Move down" onClick={() => moveCustomSection(sec.id, 1)}>↓</button>
                        <button className="sec-action" title="Rename" onClick={() => { setRenamingId(sec.id); setRenameVal(sec.name); }}>✎</button>
                        <button className="sec-action" title="Delete" style={{ color: C.red }} onClick={() => removeCustomSection(sec.id)}>✕</button>
                      </div>
                    )}
                  </div>
 
                  {/* Add after this section */}
                  {AddSectionWidget({
                    triggerId: sec.id,
                    afterIdx: isCustom ? insertAfterIdx : idx,
                    addingSectionAfter,
                    setAddingSectionAfter,
                    newSectionName,
                    setNewSectionName,
                    addCustomSection,
                  })}
                </div>
              );
            })}
 
            {/* References */}
            <button className={`nav-tab${currentNavId === "references" ? " act" : ""}`} onClick={() => setActiveSection(navItems.indexOf("references"))}>
              <Dot done={refs.length > 0} active={currentNavId === "references"} label="R" />
              References
            </button>
 
            <div style={{ marginTop: 16, padding: "10px 6px", borderTop: `1px solid ${C.border}`, fontSize: 11, color: C.inkLight, lineHeight: 1.7 }}>
              <div><span style={{ color: C.accent }}>✦</span> Custom section</div>
              <div>↑↓ reorder · ✎ rename · ✕ delete</div>
            </div>
          </aside>
 
          {/* Main */}
          <main style={{ flex: 1, overflowY: "auto", padding: "32px 40px", maxWidth: 800 }}>
 
            {validationErrors.length > 0 && <ValidationBanner errors={validationErrors} />}
 
            {/* META */}
            {currentNavId === "meta" && (
              <div>
                <h2 style={{ fontSize: 20, fontWeight: 700, color: C.ink, marginBottom: 6 }}>Title & Authors</h2>
                <p style={{ fontSize: 13, color: C.inkLight, marginBottom: 24 }}>Enter the paper title, authors, and keywords.</p>
 
                <div style={{ marginBottom: 18 }}>
                  <label className="fl">Paper Title *</label>
                  <input className={`fi${!paper.title.trim() && validationErrors.length ? " err" : ""}`}
                    placeholder="e.g., Deep Learning-Based Anomaly Detection in IoT Networks"
                    value={paper.title}
                    onChange={e => setPaper(p => ({ ...p, title: e.target.value }))} />
                </div>
 
                <div style={{ marginBottom: 18 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <label className="fl" style={{ margin: 0 }}>Authors</label>
                    <button className="btn-g" onClick={addAuthor} style={{ fontSize: 12, padding: "5px 12px" }}>+ Add Author</button>
                  </div>
                  {paper.authors.map((author, i) => (
                    <div key={i} style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: 14, marginBottom: 10, background: "#fafaf9" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: C.inkLight }}>Author {i + 1}</span>
                        {paper.authors.length > 1 && <button className="btn-d" onClick={() => removeAuthor(i)}>Remove</button>}
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                        <div>
                          <label className="fl">Full Name</label>
                          <input className="fi" placeholder="Priya Sharma" value={author.name} onChange={e => updateAuthor(i, "name", e.target.value)} />
                        </div>
                        <div>
                          <label className="fl">Email</label>
                          {/* FIX 8: show error if invalid email */}
                          <input
                            className={`fi${author.email && !isValidEmail(author.email) ? " err" : ""}`}
                            placeholder="priya@nit.edu"
                            value={author.email}
                            onChange={e => updateAuthor(i, "email", e.target.value)}
                          />
                          {author.email && !isValidEmail(author.email) && (
                            <div style={{ fontSize: 11, color: C.red, marginTop: 3 }}>Enter a valid email address</div>
                          )}
                        </div>
                      </div>
                      <div>
                        <label className="fl">Affiliation</label>
                        <input className="fi" placeholder="Dept. of CSE, NIT Warangal, India" value={author.affiliation} onChange={e => updateAuthor(i, "affiliation", e.target.value)} />
                      </div>
                    </div>
                  ))}
                </div>
 
                <div style={{ marginBottom: 20 }}>
                  <label className="fl">Keywords (comma-separated)</label>
                  <input className="fi" placeholder="deep learning, anomaly detection, IoT, LSTM" value={paper.keywords} onChange={e => setPaper(p => ({ ...p, keywords: e.target.value }))} />
                </div>
 
                <button className="btn-p" onClick={() => setActiveSection(1)}>Next: Abstract →</button>
              </div>
            )}
 
            {/* ABSTRACT */}
            {currentNavId === "abstract" && (
              <div>
                <h2 style={{ fontSize: 20, fontWeight: 700, color: C.ink, marginBottom: 6 }}>Abstract</h2>
                <p style={{ fontSize: 13, color: C.inkLight, marginBottom: 8 }}>Paste your abstract. Don't include the word "Abstract" at the start.</p>
                <div style={{ background: C.goldLight, border: "1px solid #e0c85a", borderRadius: 6, padding: "10px 14px", marginBottom: 16, fontSize: 12, color: "#6a5000" }}>
                  <strong>{fmt} guideline:</strong>{" "}
                  {fmt === "IEEE" ? "150–250 words. Single paragraph, no citations, no equations." :
                   fmt === "ACM" ? "150–250 words. Describes problem, approach, and results." :
                   fmt === "Springer" ? "Up to 250 words. Single paragraph." :
                   "150–300 words. Background, Objective, Methods, Results, Conclusions."}
                </div>
                <textarea
                  className={`fi${!paper.abstract.trim() && validationErrors.length ? " err" : ""}`}
                  rows={10}
                  placeholder="This paper presents a novel approach for…"
                  value={paper.abstract}
                  onChange={e => setPaper(p => ({ ...p, abstract: e.target.value }))}
                />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                  <span style={{ fontSize: 12, color: C.inkLight }}>{wordCount(paper.abstract)} words</span>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button className="btn-g" onClick={() => setActiveSection(0)}>← Back</button>
                    <button className="btn-p" onClick={() => setActiveSection(2)}>Next →</button>
                  </div>
                </div>
              </div>
            )}
 
            {/* BODY SECTION */}
            {currentSec && (
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                  {currentSec.type === "custom" && (
                    <span style={{ fontSize: 11, background: C.accentLight, color: C.accent, padding: "2px 8px", borderRadius: 100, fontWeight: 600 }}>CUSTOM</span>
                  )}
                  <h2 style={{ fontSize: 20, fontWeight: 700, color: C.ink }}>{currentSec.name}</h2>
                </div>
 
                {currentSec.type === "custom" && renamingId !== currentSec.id && (
                  <button style={{ border: "none", background: "none", cursor: "pointer", color: C.accent, fontSize: 12, marginBottom: 8, padding: 0 }}
                    onClick={() => { setRenamingId(currentSec.id); setRenameVal(currentSec.name); }}>
                    ✎ Rename this section
                  </button>
                )}
                {currentSec.type === "custom" && renamingId === currentSec.id && (
                  <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                    <input className="fi" value={renameVal} onChange={e => setRenameVal(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") renameCustomSection(currentSec.id); if (e.key === "Escape") setRenamingId(null); }}
                      autoFocus style={{ maxWidth: 300 }} />
                    <button className="btn-p" style={{ padding: "8px 16px" }} onClick={() => renameCustomSection(currentSec.id)}>Save</button>
                    <button className="btn-g" onClick={() => setRenamingId(null)}>Cancel</button>
                  </div>
                )}
 
                {GUIDELINES[currentSec.name] ? (
                  <div style={{ background: C.goldLight, border: "1px solid #e0c85a", borderRadius: 6, padding: "10px 14px", marginBottom: 14, fontSize: 12, color: "#6a5000" }}>
                    <strong>{fmt} guideline:</strong> {GUIDELINES[currentSec.name]}
                  </div>
                ) : (
                  <div style={{ background: C.accentLight, border: `1px solid ${C.accent}30`, borderRadius: 6, padding: "10px 14px", marginBottom: 14, fontSize: 12, color: C.accentDark }}>
                    <strong>Custom section</strong> — paste or type your content. It will appear in the paper with proper numbering.
                  </div>
                )}
 
                <textarea
                  className="fi"
                  rows={14}
                  placeholder={`Type your ${currentSec.name} content here…`}
                  value={getSection(currentSec.name)}
                  onChange={e => setSection(currentSec.name, e.target.value)}
                />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                  <span style={{ fontSize: 12, color: C.inkLight }}>{wordCount(getSection(currentSec.name))} words</span>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button className="btn-g" onClick={() => setActiveSection(a => Math.max(0, a - 1))}>← Back</button>
                    <button className="btn-p" onClick={() => setActiveSection(a => Math.min(navItems.length - 1, a + 1))}>Next →</button>
                  </div>
                </div>
              </div>
            )}
 
            {/* REFERENCES */}
            {currentNavId === "references" && (
              <div>
                <h2 style={{ fontSize: 20, fontWeight: 700, color: C.ink, marginBottom: 6 }}>References</h2>
                <p style={{ fontSize: 13, color: C.inkLight, marginBottom: 8 }}>
                  Auto-formatted in <strong>{format.citationStyle === "numeric" ? "numeric [1] style" : "Author-Year style"}</strong> per {fmt} rules.
                </p>
                <div style={{ background: C.goldLight, border: "1px solid #e0c85a", borderRadius: 6, padding: "10px 14px", marginBottom: 18, fontSize: 12, color: "#6a5000" }}>
                  <strong>Tip:</strong> For journals use Journal Name. For conferences use Book Title (Booktitle). DOI recommended.
                </div>
 
                {refs.length === 0 && (
                  <div style={{ textAlign: "center", padding: "28px 0", color: C.inkLight, fontSize: 14 }}>No references yet. Add one below.</div>
                )}
 
                {refs.map((ref, i) => (
                  <div key={i} style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: 14, marginBottom: 12, background: "#fafaf9" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: C.accent }}>
                        {format.citationStyle === "numeric" ? `[${i + 1}]` : `Ref ${i + 1}`}
                      </span>
                      <button className="btn-d" onClick={() => removeRef(i)}>Remove</button>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <div style={{ gridColumn: "1 / -1" }}>
                        <label className="fl">Authors (one per line)</label>
                        <textarea className="fi" rows={2} placeholder={"J. Smith\nA. Kumar"} value={ref.authors.join("\n")} onChange={e => updateRef(i, "authors", e.target.value.split("\n").filter(Boolean))} />
                      </div>
                      <div style={{ gridColumn: "1 / -1" }}>
                        <label className="fl">Title</label>
                        <input className="fi" placeholder="Paper / Article Title" value={ref.title} onChange={e => updateRef(i, "title", e.target.value)} />
                      </div>
                      <div>
                        <label className="fl">Journal</label>
                        <input className="fi" placeholder="IEEE Trans. Neural Networks" value={ref.journal} onChange={e => updateRef(i, "journal", e.target.value)} />
                      </div>
                      <div>
                        <label className="fl">Book Title (Conference)</label>
                        <input className="fi" placeholder="Proc. CVPR 2024" value={ref.booktitle} onChange={e => updateRef(i, "booktitle", e.target.value)} />
                      </div>
                      <div><label className="fl">Year</label><input className="fi" placeholder="2024" value={ref.year} onChange={e => updateRef(i, "year", e.target.value)} /></div>
                      <div><label className="fl">Volume</label><input className="fi" placeholder="34" value={ref.volume} onChange={e => updateRef(i, "volume", e.target.value)} /></div>
                      <div><label className="fl">Issue</label><input className="fi" placeholder="2" value={ref.issue} onChange={e => updateRef(i, "issue", e.target.value)} /></div>
                      <div><label className="fl">Pages</label><input className="fi" placeholder="112-128" value={ref.pages} onChange={e => updateRef(i, "pages", e.target.value)} /></div>
                      <div style={{ gridColumn: "1 / -1" }}>
                        <label className="fl">DOI</label>
                        <input className="fi" placeholder="10.1109/TNN.2023.001" value={ref.doi} onChange={e => updateRef(i, "doi", e.target.value)} />
                      </div>
                    </div>
                    {(ref.title || ref.authors.length > 0) && (
                      <div style={{ background: C.accentLight, borderRadius: 5, padding: "8px 12px", fontSize: 12, color: C.accent, marginTop: 10 }}>
                        <strong>Preview:</strong> {formatCitation(ref, i, format.citationStyle).full}
                      </div>
                    )}
                  </div>
                ))}
 
                <button className="btn-g" onClick={addRef} style={{ width: "100%", textAlign: "center", marginBottom: 20, padding: "10px 0", borderStyle: "dashed" }}>
                  + Add Reference
                </button>
 
                <div style={{ display: "flex", gap: 12 }}>
                  <button className="btn-g" onClick={() => setActiveSection(a => a - 1)}>← Back</button>
                  <button className="btn-p" onClick={goToPreview} style={{ flex: 1, fontSize: 15, padding: "12px" }}>
                    Preview Formatted Paper →
                  </button>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    );
  }
 
  // ── PHASE 3: Preview ──────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: "#e8e6e0", fontFamily: "system-ui, sans-serif" }}>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .btn-p { background: ${C.accent}; color: white; border: none; padding: 10px 20px; border-radius: 6px; font-size: 14px; font-weight: 600; cursor: pointer; }
        .btn-p:hover { background: ${C.accentDark}; }
        .btn-g { background: white; color: ${C.inkMid}; border: 1.5px solid ${C.border}; padding: 8px 16px; border-radius: 6px; font-size: 13px; cursor: pointer; }
        .btn-g:hover { border-color: ${C.inkMid}; }
        @media print { header, .no-print { display: none !important; } }
      `}</style>
 
      <header style={{ padding: "12px 24px", background: C.ink, display: "flex", alignItems: "center", gap: 14, position: "sticky", top: 0, zIndex: 10 }}>
        <button onClick={() => setPhase("input")} style={{ border: "none", background: "transparent", cursor: "pointer", color: "#aaa", fontSize: 13 }}>← Edit</button>
        <div style={{ width: 1, height: 20, background: "#444" }} />
        <span style={{ color: "white", fontWeight: 700, fontSize: 14, maxWidth: 320, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {paper.title || "Untitled Paper"}
        </span>
        <span style={{ fontSize: 12, background: "#333", color: "#aaa", padding: "2px 8px", borderRadius: 100 }}>{fmt}</span>
        <span style={{ fontSize: 12, color: "#888" }}>{totalWords.toLocaleString()} words</span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 10 }}>
          <button className="btn-g" onClick={copyText}>{copied ? "✓ Copied!" : "Copy Text"}</button>
          <button className="btn-g" onClick={exportMd}>↓ Markdown</button>
          <button className="btn-p" onClick={() => window.print()}>Print / PDF</button>
        </div>
      </header>
 
      <div style={{ padding: "40px 24px" }}>
        <PaperPreview paper={paper} fmt={fmt} allBodySections={allBodySections} refs={refs} />
      </div>
 
      <div className="no-print" style={{ textAlign: "center", padding: "16px 0 36px", fontSize: 12, color: "#888" }}>
        Formatted by Medhasya AI · {format.full} · Use Print → Save as PDF for final output
      </div>
    </div>
  );
}
 
// ── Small helper components ────────────────────────────────────
function Dot({ done, active, label }) {
  return (
    <span style={{
      width: 16, height: 16, borderRadius: "50%", flexShrink: 0,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 9,
      background: done ? C.green : (active ? C.accent : C.border),
      color: done || active ? "white" : C.inkLight,
    }}>
      {done ? "✓" : label}
    </span>
  );
}
 
function AddSectionWidget({ triggerId, afterIdx, addingSectionAfter, setAddingSectionAfter, newSectionName, setNewSectionName, addCustomSection }) {
  if (addingSectionAfter === triggerId) {
    return (
      <div style={{ padding: "5px 4px", display: "flex", gap: 4 }}>
        <input
          style={{ flex: 1, padding: "5px 8px", border: `1.5px solid ${C.accent}`, borderRadius: 5, fontSize: 12, color: C.ink, background: "white", outline: "none" }}
          placeholder="Section name…"
          value={newSectionName}
          onChange={e => setNewSectionName(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter") addCustomSection(afterIdx);
            if (e.key === "Escape") { setAddingSectionAfter(null); setNewSectionName(""); }
          }}
          autoFocus
        />
        <button
          style={{ background: C.accent, color: "white", border: "none", borderRadius: 5, padding: "4px 10px", fontSize: 12, cursor: "pointer", flexShrink: 0 }}
          onClick={() => addCustomSection(afterIdx)}
        >+</button>
        <button
          style={{ background: "transparent", border: `1px solid ${C.border}`, borderRadius: 5, padding: "4px 8px", fontSize: 12, cursor: "pointer", flexShrink: 0, color: C.inkLight }}
          onClick={() => { setAddingSectionAfter(null); setNewSectionName(""); }}
        >✕</button>
      </div>
    );
  }
  return (
    <button className="add-sec-btn" onClick={() => { setAddingSectionAfter(triggerId); setNewSectionName(""); }}>
      + add section here
    </button>
  );
}