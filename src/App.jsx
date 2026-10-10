import { useState, useEffect, useRef } from "react";

const C = {
  bg: "#f7f6f2", border: "#e2ddd6", ink: "#1a1814", inkMid: "#4a4540", inkLight: "#7a7570",
  accent: "#2d5a8e", accentLight: "#e8f0f9", accentDark: "#1a3d62",
  gold: "#b8860b", goldLight: "#fdf6e3", green: "#2e7d52", greenLight: "#edf7f1", red: "#c0392b",
};

const FORMATS = {
  IEEE:     { name:"IEEE",         full:"Institute of Electrical and Electronics Engineers", sections:["Introduction","Related Work","Methodology","Results & Discussion","Conclusion"],                  citationStyle:"numeric",   columns:"double" },
  ACM:      { name:"ACM",          full:"Association for Computing Machinery",                sections:["Introduction","Background & Related Work","Approach","Evaluation","Discussion","Conclusion"], citationStyle:"numeric",   columns:"double" },
  Springer: { name:"Springer LNCS",full:"Springer Lecture Notes in Computer Science",        sections:["Introduction","Related Work","Proposed Method","Experiments","Conclusion"],                   citationStyle:"numeric",   columns:"single" },
  Elsevier: { name:"Elsevier",     full:"Elsevier Journal Format",                           sections:["Introduction","Literature Review","Materials & Methods","Results","Discussion","Conclusion"], citationStyle:"name-year", columns:"single" },
};

const GUIDELINES = {
  "Introduction":"State the problem, motivation, and your contributions. End with paper structure overview.",
  "Related Work":"Review prior work grouped by theme. Compare approaches and identify the gap your work fills.",
  "Background & Related Work":"Review prior work grouped by theme. Compare approaches and identify the gap.",
  "Methodology":"Describe your proposed method step by step. Include algorithms, system design, equations.",
  "Approach":"Describe your proposed approach with system design, algorithms, and implementation details.",
  "Proposed Method":"Describe your method in sufficient detail for reproducibility.",
  "Results & Discussion":"Present quantitative results. Compare to baselines. Discuss why your method works.",
  "Evaluation":"Present experiments, datasets, metrics, baselines, and quantitative results.",
  "Experiments":"Describe experimental setup, datasets, evaluation metrics, and compare results.",
  "Results":"Present findings with statistics. Reference tables and figures.",
  "Discussion":"Interpret results. Address limitations, unexpected findings, and implications.",
  "Materials & Methods":"Describe datasets, experimental protocol, tools, and statistical methods.",
  "Literature Review":"Comprehensive review of existing work, organized by sub-topic or chronologically.",
  "Conclusion":"Summarize contributions, key results, and future directions. Typically 200–350 words.",
};

const SERIF = '"Times New Roman", Times, "Liberation Serif", serif';

// ─── Helpers ─────────────────────────────────────────────────────────────────
function roman(n) {
  const map = [[10,"X"],[9,"IX"],[5,"V"],[4,"IV"],[1,"I"]];
  let r = "";
  for (const [v, s] of map) while (n >= v) { r += s; n -= v; }
  return r;
}
function headingLabel(fmt, n, name) {
  if (fmt === "IEEE") return `${roman(n)}. ${name.toUpperCase()}`;
  if (fmt === "ACM") return `${n} ${name.toUpperCase()}`;
  if (fmt === "Springer") return `${n}  ${name}`;
  return `${n}. ${name}`;
}
function wordCount(t) {
  if (!t || !t.trim()) return 0;
  return t.trim().split(/\s+/).filter(w => /[A-Za-z0-9]/.test(w)).length;
}
function slug(name) { return name.toLowerCase().replace(/[^a-z0-9]/g, "_"); }
function isValidEmail(e) { if (!e || !e.trim()) return true; return /^\S+@\S+\.\S+$/.test(e.trim()); }

// Paragraph splitting: blank lines = paragraph breaks (pasted text with hard-wrapped lines is re-joined);
// if there are no blank lines, each line break is treated as a new paragraph.
function toParagraphs(text) {
  const t = (text || "").replace(/\r\n?/g, "\n").trim();
  if (!t) return [];
  if (/\n\s*\n/.test(t)) return t.split(/\n\s*\n/).map(p => p.replace(/\s*\n\s*/g, " ").trim()).filter(Boolean);
  return t.split("\n").map(p => p.trim()).filter(Boolean);
}

// Section data is keyed by section id (custom) or by fixed name, so duplicate names never collide.
function secKey(sec) { return sec.type === "custom" ? sec.id : "__f__" + slug(sec.name); }
function normalizeData(v) {
  if (typeof v === "string") return { text: v, figures: [], tables: [] };
  if (!v || typeof v !== "object") return { text: "", figures: [], tables: [] };
  return { text: v.text || "", figures: Array.isArray(v.figures) ? v.figures : [], tables: Array.isArray(v.tables) ? v.tables : [] };
}
function getSectionData(paper, sec) {
  const s = paper.sections || {};
  return normalizeData(s[secKey(sec)] ?? s["__s__" + slug(sec.name)]); // legacy key fallback
}
function hasContent(paper, sec) {
  const d = getSectionData(paper, sec);
  return !!d.text.trim() || d.figures.length > 0 || d.tables.length > 0;
}
// Ordered list of sections that appear in the document, with continuous section/figure/table numbering.
function buildDocItems(paper, secs) {
  let fc = 0, tc = 0, n = 0;
  const items = [];
  secs.forEach(sec => {
    if (!hasContent(paper, sec)) return;
    const d = getSectionData(paper, sec);
    const figures = d.figures.filter(f => f.dataUrl && f.dataUrl.startsWith("data:"));
    items.push({ sec, d: { ...d, figures }, num: ++n, fig0: fc, tbl0: tc });
    fc += figures.length; tc += d.tables.length;
  });
  return items;
}

function cleanTitle(t) { return t.trim().replace(/[.,]+$/, ""); }

function formatCitation(ref, idx, style) {
  const { authors = [], year = "", title = "", journal = "", volume = "", issue = "", pages = "", doi = "", booktitle = "" } = ref;
  const list = authors.map(a => a.trim()).filter(Boolean);
  let aStr;
  if (list.length === 0) aStr = "Unknown Author";
  else if (list.length > 6) aStr = list[0] + " et al.";
  else if (list.length === 1) aStr = list[0];
  else if (list.length === 2) aStr = list[0] + " and " + list[1];
  else aStr = list.slice(0, -1).join(", ") + ", and " + list[list.length - 1];

  const t = title.trim() ? cleanTitle(title) : "";
  const venue = (journal || booktitle || "").trim();
  const pg = pages.trim().replace(/\s*[-–—]+\s*/, "–");
  const d = doi.trim().replace(/^https?:\/\/(dx\.)?doi\.org\//i, "");
  const yr = year.trim();

  if (style === "name-year") {
    const last = list[0]?.split(" ").pop() || "Unknown";
    const tag = list.length > 2 ? `${last} et al.` : aStr;
    let pre = `${aStr} (${yr || "n.d."}). ${t ? t + ". " : ""}`;
    let core = `${volume ? `, ${volume}` : ""}${issue ? `(${issue})` : ""}${pg ? `, ${pg}` : ""}`;
    let post;
    if (venue) post = core + ".";
    else post = core ? core.replace(/^, /, "") + "." : "";
    if (!venue && !post) pre = pre.trimEnd();
    if (d) post += ` https://doi.org/${d}`;
    const c = { pre, venue, post };
    return { inText: `(${tag}, ${yr || "n.d."})`, ...c, full: c.pre + c.venue + c.post };
  }

  const tail = [volume && `vol. ${volume}`, issue && `no. ${issue}`, pg && `pp. ${pg}`, yr, d && `doi: ${d}`].filter(Boolean);
  let c;
  if (!venue && tail.length === 0) {
    c = { pre: t ? `[${idx + 1}] ${aStr}, “${t}.”` : `[${idx + 1}] ${aStr}.`, venue: "", post: "" };
  } else {
    const pre = `[${idx + 1}] ${aStr}, ${t ? `“${t},” ` : ""}`;
    if (venue) c = { pre, venue, post: (tail.length ? ", " + tail.join(", ") : "") + "." };
    else c = { pre, venue: "", post: tail.join(", ") + "." };
  }
  return { inText: `[${idx + 1}]`, ...c, full: c.pre + c.venue + c.post };
}
function citeMd(ref, i, style) { const c = formatCitation(ref, i, style); return c.pre + (c.venue ? `*${c.venue}*` : "") + c.post; }
function Cite({ c }) { return <>{c.pre}{c.venue ? <em>{c.venue}</em> : null}{c.post}</>; }

// ─── Figure / Table renderers (print-quality) ────────────────────────────────
function FigureBlock({ fig, n, fmt, dbl }) {
  const ieee = fmt === "IEEE";
  return (
    <div className="keep" style={{ margin: "8pt 0", textAlign: "center" }}>
      <img src={fig.dataUrl} alt={fig.caption || `Figure ${n}`}
        style={{ maxWidth: "100%", maxHeight: dbl ? "75mm" : "110mm", objectFit: "contain" }} />
      <div style={{ fontSize: ieee ? "8pt" : "9.5pt", marginTop: 3, lineHeight: 1.3, fontFamily: SERIF }}>
        {ieee ? `Fig. ${n}.` : <strong>Figure {n}.</strong>} {fig.caption || ""}
      </div>
    </div>
  );
}
function TableBlock({ tbl, n, fmt, dbl }) {
  if (!tbl.rows || tbl.rows.length === 0) return null;
  const ieee = fmt === "IEEE";
  const fs = ieee ? "8.5pt" : "9.5pt";
  return (
    <div className="keep" style={{ margin: "8pt 0", fontFamily: SERIF }}>
      {ieee ? (
        <div style={{ textAlign: "center", fontSize: "8pt", marginBottom: 3, lineHeight: 1.3 }}>
          <div>TABLE {roman(n)}</div>
          {tbl.caption && <div style={{ textTransform: "uppercase" }}>{tbl.caption}</div>}
        </div>
      ) : (
        <div style={{ fontSize: "9.5pt", marginBottom: 3, lineHeight: 1.3 }}>
          <strong>Table {n}.</strong> {tbl.caption || ""}
        </div>
      )}
      <table style={{ borderCollapse: "collapse", width: "100%", fontSize: fs }}>
        <tbody>
          {tbl.rows.map((row, ri) => (
            <tr key={ri}>
              {row.map((cell, ci) => (
                <td key={ci} style={{ border: "0.5pt solid #333", padding: "1.5pt 4pt", fontWeight: ri === 0 ? "bold" : "normal", textAlign: "center", wordBreak: "break-word" }}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── PAPER PREVIEW (A4, WYSIWYG with print) ──────────────────────────────────
function PaperPreview({ paper, fmt, items, refs }) {
  const fmtObj = FORMATS[fmt];
  const dbl = fmtObj.columns === "double";
  const ieee = fmt === "IEEE";

  const body = { fontFamily: SERIF, fontSize: dbl ? "10pt" : "11pt", lineHeight: dbl ? 1.3 : 1.5, textAlign: "justify", hyphens: "auto", WebkitHyphens: "auto", margin: 0 };
  const paraStyle = { ...body, textIndent: ieee ? "1.2em" : 0, marginBottom: ieee ? 0 : (dbl ? "4pt" : "6pt") };
  const head = {
    fontFamily: SERIF, fontWeight: "bold", margin: "10pt 0 4pt",
    fontSize: ieee ? "10pt" : (fmt === "ACM" ? "10pt" : "12pt"),
    textAlign: ieee ? "center" : "left", letterSpacing: ieee ? "0.04em" : "normal",
  };
  const abstractText = (paper.abstract || "").replace(/\s*\n\s*/g, " ").trim();
  const keywords = (paper.keywords || "").trim();

  const renderSection = (it) => (
    <div key={it.sec.id}>
      <div className="sec-head" style={head}>{headingLabel(fmt, it.num, it.sec.name)}</div>
      {toParagraphs(it.d.text).map((p, i) => <p className="para" key={i} style={paraStyle}>{p}</p>)}
      {it.d.figures.map((f, i) => <FigureBlock key={f.id} fig={f} n={it.fig0 + i + 1} fmt={fmt} dbl={dbl} />)}
      {it.d.tables.map((t, i) => <TableBlock key={t.id} tbl={t} n={it.tbl0 + i + 1} fmt={fmt} dbl={dbl} />)}
    </div>
  );

  const refsBlock = refs.length > 0 && (
    <div>
      <div className="sec-head" style={{ ...head, fontSize: ieee ? "10pt" : (dbl ? "10pt" : "12pt") }}>{ieee || fmt === "ACM" ? "REFERENCES" : "References"}</div>
      <div style={{ fontSize: dbl ? "8pt" : "10pt", lineHeight: 1.3, fontFamily: SERIF, textAlign: "left" }}>
        {refs.map((ref, i) => (
          <div key={i} className="keep" style={{ marginBottom: 3, paddingLeft: "1.8em", textIndent: "-1.8em" }}>
            <Cite c={formatCitation(ref, i, fmtObj.citationStyle)} />
          </div>
        ))}
      </div>
    </div>
  );

  const authors = (paper.authors || []).filter(a => a.name || a.affiliation || a.email);

  return (
    <div id="preview-scroll-wrapper" style={{ overflowX: "auto", padding: "32px 16px", background: "#bbb" }}>
      <div id="print-paper" lang="en" style={{
        width: "210mm", minWidth: "210mm", minHeight: "297mm", background: "#fff", margin: "0 auto",
        padding: "15mm 14mm", boxShadow: "0 2px 32px rgba(0,0,0,0.15)", fontFamily: SERIF, color: "#000", boxSizing: "border-box",
      }}>
        <div style={{ textAlign: "center", fontSize: dbl ? "24pt" : "20pt", fontWeight: "bold", lineHeight: 1.15, marginBottom: "14pt" }}>
          {paper.title || "Paper Title"}
        </div>

        {authors.length > 0 && (
          <div style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: "10pt 36pt", marginBottom: "12pt", textAlign: "center" }}>
            {authors.map((a, i) => (
              <div key={i} style={{ minWidth: 120, maxWidth: 230 }}>
                <div style={{ fontSize: "11pt", fontWeight: "bold" }}>{a.name || "Author"}</div>
                {a.affiliation && <div style={{ fontSize: "9pt", fontStyle: "italic", lineHeight: 1.3 }}>{a.affiliation}</div>}
                {a.email && <div style={{ fontSize: "9pt" }}>{a.email}</div>}
              </div>
            ))}
          </div>
        )}

        {abstractText && (
          <div style={{ marginBottom: "6pt" }}>
            {ieee ? (
              <div style={{ ...body, fontSize: "9pt", fontWeight: "bold" }}><em>Abstract—</em>{abstractText}</div>
            ) : (
              <div>
                <div style={{ fontWeight: "bold", fontSize: fmt === "ACM" ? "10pt" : "11pt", marginBottom: 2 }}>{fmt === "ACM" ? "ABSTRACT" : "Abstract"}</div>
                <div style={{ ...body, fontSize: dbl ? "9pt" : "10.5pt" }}>{abstractText}</div>
              </div>
            )}
          </div>
        )}

        {keywords && (
          <div style={{ fontSize: dbl ? "9pt" : "10.5pt", fontStyle: "italic", marginBottom: "8pt", textAlign: "justify" }}>
            {ieee ? <><strong><em>Keywords</em></strong>—{keywords}</> : <><strong style={{ fontStyle: "normal" }}>{fmt === "ACM" ? "KEYWORDS" : "Keywords:"}</strong> <span style={{ fontStyle: "normal" }}>{keywords}</span></>}
          </div>
        )}

        <hr style={{ border: "none", borderTop: "0.5pt solid #000", margin: "6pt 0 8pt" }} />

        {dbl ? (
          <div className="two-col-body" style={{ columnCount: 2, columnGap: "5mm", width: "100%" }}>
            {items.map(renderSection)}
            {refsBlock}
          </div>
        ) : (
          <div>
            {items.map(renderSection)}
            {refsBlock}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Section Editor ──────────────────────────────────────────────────────────
function SectionEditor({ sec, paper, setPaper, fmt, onBack, onNext }) {
  const data = getSectionData(paper, sec);
  const { figures, tables, text } = data;
  const imgRef = useRef();
  const [tab, setTab] = useState("text");
  const [editingTable, setEditingTable] = useState(null);
  const [rowsStr, setRowsStr] = useState("3");
  const [colsStr, setColsStr] = useState("3");
  const [figError, setFigError] = useState("");

  // Functional update: always merges into the latest stored data (no stale closures)
  const update = (fn) => setPaper(p => {
    const cur = getSectionData(p, sec);
    const patch = typeof fn === "function" ? fn(cur) : fn;
    return { ...p, sections: { ...p.sections, [secKey(sec)]: { ...cur, ...patch } } };
  });

  const addFigure = (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) { setFigError("Please choose an image file (PNG, JPG, SVG…)."); return; }
    setFigError("");
    const reader = new FileReader();
    reader.onload = (ev) => {
      const fig = { id: `fig_${Date.now()}`, dataUrl: ev.target.result, caption: "" };
      update(cur => ({ figures: [...cur.figures, fig] }));
    };
    reader.onerror = () => setFigError("Could not read that file. Try another image.");
    reader.readAsDataURL(file);
  };
  const updateFigCaption = (id, caption) => update(cur => ({ figures: cur.figures.map(f => f.id === id ? { ...f, caption } : f) }));
  const removeFigure = (id) => update(cur => ({ figures: cur.figures.filter(f => f.id !== id) }));
  const moveFigure = (id, dir) => update(cur => {
    const a = [...cur.figures]; const i = a.findIndex(f => f.id === id); const j = i + dir;
    if (j < 0 || j >= a.length) return {};
    [a[i], a[j]] = [a[j], a[i]]; return { figures: a };
  });

  const clamp = (s, lo, hi) => Math.max(lo, Math.min(hi, parseInt(s, 10) || lo));
  const startNewTable = () => {
    const r = clamp(rowsStr, 2, 20), c = clamp(colsStr, 2, 10);
    const rows = Array.from({ length: r }, (_, ri) => Array.from({ length: c }, (_, ci) => ri === 0 ? `Col ${ci + 1}` : ""));
    setEditingTable({ id: `tbl_${Date.now()}`, caption: "", rows });
  };
  const saveTable = () => {
    if (!editingTable) return;
    const t = editingTable;
    update(cur => cur.tables.some(x => x.id === t.id)
      ? { tables: cur.tables.map(x => x.id === t.id ? t : x) }
      : { tables: [...cur.tables, t] });
    setEditingTable(null);
  };
  const removeTable = (id) => update(cur => ({ tables: cur.tables.filter(t => t.id !== id) }));
  const setCellVal = (ri, ci, val) => setEditingTable(t => ({ ...t, rows: t.rows.map((row, r) => row.map((cell, c) => r === ri && c === ci ? val : cell)) }));
  const addTableRow = () => setEditingTable(t => ({ ...t, rows: [...t.rows, Array((t.rows[0] || [""]).length).fill("")] }));
  const addTableCol = () => setEditingTable(t => ({ ...t, rows: t.rows.map(r => [...r, ""]) }));
  const removeTableRow = (ri) => setEditingTable(t => t.rows.length <= 1 ? t : { ...t, rows: t.rows.filter((_, r) => r !== ri) });
  const removeTableCol = (ci) => setEditingTable(t => (t.rows[0] || []).length <= 1 ? t : { ...t, rows: t.rows.map(r => r.filter((_, c) => c !== ci)) });

  const tabBtn = (id, icon, label, count) => (
    <button onClick={() => setTab(id)} style={{
      padding: "9px 20px", fontWeight: 600, fontSize: 13, cursor: "pointer", border: "none",
      borderBottom: tab === id ? `3px solid ${C.accent}` : "3px solid transparent",
      background: tab === id ? C.accentLight : "transparent", color: tab === id ? C.accent : C.inkLight,
      display: "flex", alignItems: "center", gap: 6, borderRadius: "6px 6px 0 0", transition: "all 0.15s",
    }}>
      <span style={{ fontSize: 15 }}>{icon}</span>{label}
      {count > 0 && <span style={{ background: C.accent, color: "white", borderRadius: 100, fontSize: 10, padding: "1px 6px", fontWeight: 700 }}>{count}</span>}
    </button>
  );
  const inputSm = { width: 60, padding: "5px 8px", border: `1.5px solid ${C.border}`, borderRadius: 5, fontSize: 13 };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        {sec.type === "custom" && <span style={{ fontSize: 11, background: C.accentLight, color: C.accent, padding: "2px 8px", borderRadius: 100, fontWeight: 600 }}>CUSTOM</span>}
        <h2 style={{ fontSize: 20, fontWeight: 700, color: C.ink }}>{sec.name}</h2>
      </div>

      {sec.type !== "custom" && GUIDELINES[sec.name] ? (
        <div style={{ background: C.goldLight, border: "1px solid #e0c85a", borderRadius: 6, padding: "9px 13px", marginBottom: 12, fontSize: 12, color: "#6a5000" }}>
          <strong>{fmt} guideline:</strong> {GUIDELINES[sec.name]}
        </div>
      ) : (
        <div style={{ background: C.accentLight, border: `1px solid ${C.accent}30`, borderRadius: 6, padding: "9px 13px", marginBottom: 12, fontSize: 12, color: C.accentDark }}>
          <strong>Custom section</strong> — paste your content below. It appears with proper numbering in the paper.
        </div>
      )}

      <div style={{ borderBottom: `1px solid ${C.border}`, marginBottom: 16, display: "flex", gap: 4 }}>
        {tabBtn("text", "📝", "Text", 0)}
        {tabBtn("figures", "🖼️", "Figures", figures.length)}
        {tabBtn("tables", "📊", "Tables", tables.length)}
      </div>

      {tab === "text" && (
        <div>
          {figures.length === 0 && tables.length === 0 && (
            <div style={{ background: "#f0f7ff", border: `1px solid ${C.accent}40`, borderRadius: 8, padding: "10px 14px", marginBottom: 14, display: "flex", gap: 12, alignItems: "center" }}>
              <div style={{ fontSize: 20 }}>💡</div>
              <div style={{ fontSize: 12, color: C.accentDark, lineHeight: 1.5 }}>
                <strong>You can add figures and tables to this section.</strong><br />
                Use the <strong>🖼️ Figures</strong> and <strong>📊 Tables</strong> tabs. Numbering runs continuously across the whole paper.
              </div>
            </div>
          )}
          <textarea
            style={{ width: "100%", padding: "10px 12px", border: `1.5px solid ${C.border}`, borderRadius: 6, fontSize: 14, color: C.ink, background: "white", resize: "vertical", minHeight: 300, fontFamily: "system-ui, sans-serif", lineHeight: 1.6 }}
            placeholder={`Type your ${sec.name} content here…\n\nLeave a blank line between paragraphs.`}
            value={text}
            onChange={e => update({ text: e.target.value })}
          />
          <div style={{ fontSize: 12, color: C.inkLight, marginTop: 4 }}>{wordCount(text)} words</div>
        </div>
      )}

      {tab === "figures" && (
        <div>
          <div style={{ background: "#fff8e1", border: "1px solid #ffe082", borderRadius: 7, padding: "9px 13px", marginBottom: 14, fontSize: 12, color: "#5d4000" }}>
            ⚠️ <strong>Note:</strong> Images are auto-saved only while they fit in browser storage. Large images are kept in memory and lost on refresh, so add figures last and download soon after.
          </div>
          <div style={{ marginBottom: 16 }}>
            <input ref={imgRef} type="file" accept="image/*" style={{ display: "none" }} onChange={addFigure} />
            <button onClick={() => imgRef.current?.click()} style={{ background: C.accent, color: "white", border: "none", padding: "10px 22px", borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              🖼️ Upload Image / Figure
            </button>
            <span style={{ fontSize: 12, color: C.inkLight, marginLeft: 12 }}>PNG, JPG, SVG</span>
            {figError && <div style={{ fontSize: 12, color: C.red, marginTop: 6 }}>{figError}</div>}
          </div>
          {figures.length === 0 && (
            <div onClick={() => imgRef.current?.click()}
              style={{ textAlign: "center", padding: "40px 0", color: C.inkLight, border: `2px dashed ${C.border}`, borderRadius: 8, fontSize: 14, cursor: "pointer", background: "#fafaf9" }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>🖼️</div>
              Click here or use the button above to upload a figure
            </div>
          )}
          {figures.map((fig, i) => (
            <div key={fig.id} style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: 14, marginBottom: 12, background: "#fafaf9", display: "flex", gap: 14, alignItems: "flex-start" }}>
              {fig.dataUrl && fig.dataUrl.startsWith("data:")
                ? <img src={fig.dataUrl} alt="" style={{ width: 140, height: 100, objectFit: "contain", border: "1px solid #ddd", borderRadius: 4, flexShrink: 0, background: "#f0f0f0" }} />
                : <div style={{ width: 140, height: 100, flexShrink: 0, background: "#f0f0f0" }} />}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.inkMid, marginBottom: 6 }}>Figure (this section) {i + 1}</div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: C.inkLight, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>Caption</label>
                <input style={{ width: "100%", padding: "8px 10px", border: `1.5px solid ${C.border}`, borderRadius: 5, fontSize: 13, color: C.ink, background: "white" }}
                  placeholder="Block diagram of the proposed method" value={fig.caption}
                  onChange={e => updateFigCaption(fig.id, e.target.value)} />
                <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                  <button disabled={i === 0} onClick={() => moveFigure(fig.id, -1)} style={{ border: `1px solid ${C.border}`, background: "white", padding: "4px 10px", borderRadius: 5, fontSize: 12, cursor: "pointer" }}>↑</button>
                  <button disabled={i === figures.length - 1} onClick={() => moveFigure(fig.id, 1)} style={{ border: `1px solid ${C.border}`, background: "white", padding: "4px 10px", borderRadius: 5, fontSize: 12, cursor: "pointer" }}>↓</button>
                  <button onClick={() => removeFigure(fig.id)} style={{ background: "transparent", color: C.red, border: `1px solid ${C.border}`, padding: "4px 12px", borderRadius: 5, fontSize: 12, cursor: "pointer" }}>Remove</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "tables" && (
        <div>
          {!editingTable && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: C.inkMid }}>Rows (2–20):</label>
                <input type="number" min={2} max={20} value={rowsStr} onChange={e => setRowsStr(e.target.value)} style={inputSm} />
                <label style={{ fontSize: 12, fontWeight: 600, color: C.inkMid }}>Cols (2–10):</label>
                <input type="number" min={2} max={10} value={colsStr} onChange={e => setColsStr(e.target.value)} style={inputSm} />
                <button onClick={startNewTable} style={{ background: C.accent, color: "white", border: "none", padding: "8px 18px", borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>+ Create Table</button>
              </div>
              <span style={{ fontSize: 12, color: C.inkLight }}>Row 1 is the header row.</span>
            </div>
          )}

          {editingTable && (
            <div style={{ border: `1.5px solid ${C.accent}`, borderRadius: 8, padding: 16, marginBottom: 16, background: C.accentLight }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: C.accent, marginBottom: 10 }}>Table Editor</div>
              <div style={{ marginBottom: 10 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: C.inkMid, marginBottom: 4, display: "block", textTransform: "uppercase", letterSpacing: "0.06em" }}>Caption</label>
                <input style={{ width: "100%", padding: "8px 10px", border: `1.5px solid ${C.border}`, borderRadius: 5, fontSize: 13, color: C.ink, background: "white" }}
                  placeholder="Comparison of classification metrics" value={editingTable.caption}
                  onChange={e => setEditingTable(t => ({ ...t, caption: e.target.value }))} />
              </div>
              <div style={{ overflowX: "auto", marginBottom: 10 }}>
                <table style={{ borderCollapse: "collapse", fontSize: 12 }}>
                  <tbody>
                    <tr>
                      {(editingTable.rows[0] || []).map((_, ci) => (
                        <td key={ci} style={{ textAlign: "center" }}>
                          <button title="Delete column" onClick={() => removeTableCol(ci)} style={{ border: "none", background: "none", color: C.red, cursor: "pointer", fontSize: 12 }}>✕ col</button>
                        </td>
                      ))}
                      <td />
                    </tr>
                    {editingTable.rows.map((row, ri) => (
                      <tr key={ri}>
                        {row.map((cell, ci) => (
                          <td key={ci} style={{ border: "1px solid #aaa", padding: 0 }}>
                            <input value={cell} onChange={e => setCellVal(ri, ci, e.target.value)}
                              style={{ padding: "5px 7px", border: "none", outline: "none", width: 90, fontSize: 12, background: ri === 0 ? "#d4e4f7" : "white", fontWeight: ri === 0 ? "bold" : "normal" }} />
                          </td>
                        ))}
                        <td style={{ paddingLeft: 6 }}>
                          <button title="Delete row" onClick={() => removeTableRow(ri)} style={{ border: "none", background: "none", color: C.red, cursor: "pointer", fontSize: 14 }}>✕</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                <button onClick={addTableRow} style={{ border: `1px solid ${C.border}`, background: "white", padding: "5px 12px", borderRadius: 5, fontSize: 12, cursor: "pointer" }}>+ Row</button>
                <button onClick={addTableCol} style={{ border: `1px solid ${C.border}`, background: "white", padding: "5px 12px", borderRadius: 5, fontSize: 12, cursor: "pointer" }}>+ Col</button>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={saveTable} style={{ background: C.accent, color: "white", border: "none", padding: "8px 20px", borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Save Table</button>
                <button onClick={() => setEditingTable(null)} style={{ background: "transparent", border: `1px solid ${C.border}`, padding: "8px 16px", borderRadius: 6, fontSize: 13, cursor: "pointer", color: C.inkMid }}>Cancel</button>
              </div>
            </div>
          )}

          {tables.length === 0 && !editingTable && (
            <div style={{ textAlign: "center", padding: "40px 0", color: C.inkLight, border: `2px dashed ${C.border}`, borderRadius: 8, fontSize: 14, background: "#fafaf9" }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>📊</div>
              Set rows &amp; cols above and click <strong>+ Create Table</strong>
            </div>
          )}

          {tables.map((tbl, i) => (
            <div key={tbl.id} style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: 14, marginBottom: 10, background: "#fafaf9" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontWeight: 700, fontSize: 13, color: C.accent }}>Table (this section) {i + 1}: {tbl.caption || "(no caption)"}</span>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => setEditingTable({ ...tbl, rows: tbl.rows.map(r => [...r]) })} style={{ border: `1px solid ${C.border}`, background: "white", padding: "4px 10px", borderRadius: 5, fontSize: 12, cursor: "pointer" }}>Edit</button>
                  <button onClick={() => removeTable(tbl.id)} style={{ border: `1px solid ${C.border}`, background: "transparent", color: C.red, padding: "4px 10px", borderRadius: 5, fontSize: 12, cursor: "pointer" }}>Remove</button>
                </div>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ borderCollapse: "collapse", fontSize: 11, width: "100%" }}>
                  <tbody>
                    {tbl.rows.map((row, ri) => (
                      <tr key={ri} style={{ background: ri === 0 ? "#e0e8f4" : "white" }}>
                        {row.map((cell, ci) => (
                          <td key={ci} style={{ border: "1px solid #aaa", padding: "3px 8px", fontWeight: ri === 0 ? "bold" : "normal", textAlign: "center" }}>{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18 }}>
        <button onClick={onBack} style={{ background: "transparent", border: `1.5px solid ${C.border}`, padding: "9px 20px", borderRadius: 6, fontSize: 13, cursor: "pointer", color: C.inkMid }}>← Back</button>
        <button onClick={onNext} style={{ background: C.accent, color: "white", border: "none", padding: "9px 22px", borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Next →</button>
      </div>
    </div>
  );
}

function ValidationBanner({ errors }) {
  if (!errors.length) return null;
  return (
    <div style={{ background: "#fff3cd", border: "1.5px solid #f0c040", borderRadius: 8, padding: "12px 16px", marginBottom: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: "#7a5000", marginBottom: 5 }}>Please fix the following before previewing:</div>
      {errors.map((e, i) => <div key={i} style={{ fontSize: 12, color: "#7a5000" }}>• {e}</div>)}
    </div>
  );
}

function Dot({ done, active, label }) {
  return (
    <span style={{ width: 16, height: 16, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, background: done ? C.green : (active ? C.accent : C.border), color: done || active ? "white" : C.inkLight }}>
      {done ? "✓" : label}
    </span>
  );
}

function AddSecWidget({ triggerId, afterIdx, afterId, addingSectionAfter, setAddingSectionAfter, newSectionName, setNewSectionName, addCustomSection }) {
  if (addingSectionAfter === triggerId) {
    return (
      <div style={{ padding: "4px 4px", display: "flex", gap: 4 }}>
        <input
          style={{ flex: 1, minWidth: 0, padding: "5px 8px", border: `1.5px solid ${C.accent}`, borderRadius: 5, fontSize: 12, color: C.ink, background: "white", outline: "none" }}
          placeholder="Section name…" value={newSectionName} onChange={e => setNewSectionName(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") addCustomSection(afterIdx, afterId); if (e.key === "Escape") { setAddingSectionAfter(null); setNewSectionName(""); } }}
          autoFocus
        />
        <button style={{ background: C.accent, color: "white", border: "none", borderRadius: 5, padding: "4px 10px", fontSize: 12, cursor: "pointer" }} onClick={() => addCustomSection(afterIdx, afterId)}>+</button>
        <button style={{ background: "transparent", border: `1px solid ${C.border}`, borderRadius: 5, padding: "4px 7px", fontSize: 12, cursor: "pointer", color: C.inkLight }} onClick={() => { setAddingSectionAfter(null); setNewSectionName(""); }}>✕</button>
      </div>
    );
  }
  return (
    <button onClick={() => { setAddingSectionAfter(triggerId); setNewSectionName(""); }}
      style={{ border: `1.5px dashed ${C.border}`, background: "transparent", color: C.inkLight, fontSize: 11, padding: "3px 8px", borderRadius: 5, cursor: "pointer", width: "100%", textAlign: "center", margin: "2px 0" }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent; e.currentTarget.style.background = C.accentLight; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.inkLight; e.currentTarget.style.background = "transparent"; }}>
      + add section here
    </button>
  );
}

// ─── MAIN APP ────────────────────────────────────────────────────────────────
const LS_KEY = "medhasya_v3";
const defaultPaper = { title: "", authors: [{ name: "", affiliation: "", email: "" }], keywords: "", abstract: "", sections: {} };

export default function MedhasyaApp() {
  const [fmt, setFmt] = useState("IEEE");
  const [phase, setPhase] = useState("format");
  const [paper, setPaper] = useState(defaultPaper);
  const [refs, setRefs] = useState([]);
  const [activeId, setActiveId] = useState("meta");
  const [copied, setCopied] = useState(false);
  const [valErrors, setValErrors] = useState([]);
  const [customSecs, setCustomSecs] = useState([]);
  const [addingAfter, setAddingAfter] = useState(null);
  const [newSecName, setNewSecName] = useState("");
  const [renamingId, setRenamingId] = useState(null);
  const [renameVal, setRenameVal] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const cancelRename = useRef(false);
  const mainRef = useRef(null);

  // Load saved draft once
  useEffect(() => {
    try {
      const s = localStorage.getItem(LS_KEY);
      if (s) {
        const d = JSON.parse(s);
        if (d.paper) {
          const sections = Object.fromEntries(Object.entries(d.paper.sections || {}).map(([k, v]) => {
            const nv = normalizeData(v);
            return [k, { ...nv, figures: nv.figures.filter(f => f && typeof f.dataUrl === "string" && f.dataUrl.startsWith("data:")) }];
          }));
          setPaper({ ...defaultPaper, ...d.paper, authors: d.paper.authors?.length ? d.paper.authors : defaultPaper.authors, sections });
        }
        if (Array.isArray(d.refs)) setRefs(d.refs.map(r => ({ authors: [], year: "", title: "", journal: "", volume: "", issue: "", pages: "", doi: "", booktitle: "", ...r })));
        if (d.fmt && FORMATS[d.fmt]) setFmt(d.fmt);
        if (Array.isArray(d.customSecs)) setCustomSecs(d.customSecs);
      }
    } catch (_) {}
    setHydrated(true);
  }, []);

  // Auto-save. Try with images; if storage is full, retry without image data.
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({ paper, refs, fmt, customSecs }));
    } catch (_) {
      try {
        const stripped = {
          ...paper,
          sections: Object.fromEntries(Object.entries(paper.sections || {}).map(([k, v]) => [k, { ...normalizeData(v), figures: [] }])),
        };
        localStorage.setItem(LS_KEY, JSON.stringify({ paper: stripped, refs, fmt, customSecs }));
      } catch (__) {}
    }
  }, [paper, refs, fmt, customSecs, hydrated]);

  const clearSaved = () => {
    try { localStorage.removeItem(LS_KEY); } catch (_) {}
    setPaper(defaultPaper); setRefs([]); setCustomSecs([]); setFmt("IEEE"); setActiveId("meta"); setPhase("format");
  };

  const format = FORMATS[fmt];
  const fixedSecs = format.sections;
  const slotOf = (c) => Math.min(c.insertAfterIdx ?? fixedSecs.length - 1, fixedSecs.length - 1);

  // Flat ordered list: customs with slot -1 first, then each fixed section followed by its customs (in array order)
  const buildBodySections = () => {
    const out = [];
    customSecs.filter(c => slotOf(c) < 0).forEach(c => out.push({ id: c.id, name: c.name, type: "custom" }));
    fixedSecs.forEach((s, i) => {
      out.push({ id: `fixed_${i}`, name: s, type: "fixed" });
      customSecs.filter(c => slotOf(c) === i).forEach(c => out.push({ id: c.id, name: c.name, type: "custom" }));
    });
    return out;
  };
  const allBodySecs = buildBodySections();
  const navItems = ["meta", "abstract", ...allBodySecs.map(s => s.id), "references"];
  const curId = navItems.includes(activeId) ? activeId : "meta";
  const curSec = allBodySecs.find(s => s.id === curId);
  const goRel = (d) => { const i = navItems.indexOf(curId); setActiveId(navItems[Math.max(0, Math.min(navItems.length - 1, i + d))]); };

  const docItems = buildDocItems(paper, allBodySecs);
  const totalWords = wordCount(paper.abstract) + allBodySecs.reduce((a, s) => a + wordCount(getSectionData(paper, s).text), 0);
  const filledCount = (paper.abstract?.trim() ? 1 : 0) + allBodySecs.filter(s => hasContent(paper, s)).length;

  // Custom section ops
  const addCustomSec = (insertAfterIdx, afterId) => {
    const name = newSecName.trim(); if (!name) return;
    const sec = { id: `custom_${Date.now()}`, name, insertAfterIdx };
    setCustomSecs(cs => {
      if (afterId) {
        const i = cs.findIndex(c => c.id === afterId);
        if (i >= 0) { const n = [...cs]; n.splice(i + 1, 0, sec); return n; }
      }
      const i = cs.findIndex(c => slotOf(c) === insertAfterIdx);
      if (i >= 0) { const n = [...cs]; n.splice(i, 0, sec); return n; }
      return [...cs, sec];
    });
    setNewSecName(""); setAddingAfter(null); setActiveId(sec.id);
  };
  const removeCustomSec = (id) => {
    const sec = customSecs.find(s => s.id === id);
    if (sec) setPaper(p => { const ns = { ...p.sections }; delete ns[id]; delete ns["__s__" + slug(sec.name)]; return { ...p, sections: ns }; });
    if (curId === id) { const i = navItems.indexOf(id); setActiveId(navItems[Math.max(0, i - 1)]); }
    setCustomSecs(cs => cs.filter(s => s.id !== id));
  };
  const renameCustomSec = (id) => {
    if (cancelRename.current) { cancelRename.current = false; setRenamingId(null); return; }
    const name = renameVal.trim();
    if (name) setCustomSecs(cs => cs.map(s => s.id === id ? { ...s, name } : s));
    setRenamingId(null); setRenameVal("");
  };
  const moveCustomSec = (id, dir) => {
    const flat = allBodySecs.map(s => s.id);
    const i = flat.indexOf(id), j = i + dir;
    if (i < 0 || j < 0 || j >= flat.length) return;
    [flat[i], flat[j]] = [flat[j], flat[i]];
    let lastFixed = -1; const next = [];
    flat.forEach(fid => {
      const f = allBodySecs.find(s => s.id === fid);
      if (f.type === "fixed") lastFixed = fixedSecs.indexOf(f.name);
      else next.push({ ...customSecs.find(c => c.id === fid), insertAfterIdx: lastFixed });
    });
    setCustomSecs(next);
  };

  // Author / reference ops
  const addAuthor = () => setPaper(p => ({ ...p, authors: [...p.authors, { name: "", affiliation: "", email: "" }] }));
  const removeAuthor = (i) => setPaper(p => ({ ...p, authors: p.authors.filter((_, x) => x !== i) }));
  const updateAuthor = (i, f, v) => setPaper(p => ({ ...p, authors: p.authors.map((a, x) => x === i ? { ...a, [f]: v } : a) }));
  const addRef = () => setRefs(r => [...r, { authors: [], year: "", title: "", journal: "", volume: "", issue: "", pages: "", doi: "", booktitle: "" }]);
  const removeRef = (i) => setRefs(r => r.filter((_, x) => x !== i));
  const updateRef = (i, f, v) => setRefs(r => r.map((ref, x) => x === i ? { ...ref, [f]: v } : ref));

  const validate = () => {
    const err = [];
    if (!paper.title.trim()) err.push("Paper title is required.");
    if (!paper.authors.some(a => a.name.trim())) err.push("At least one author name is required.");
    if (!paper.abstract.trim()) err.push("Abstract is required.");
    if (!allBodySecs.some(s => hasContent(paper, s))) err.push("At least one body section needs content.");
    paper.authors.forEach((a, i) => { if (a.email && !isValidEmail(a.email)) err.push(`Author ${i + 1} email is invalid.`); });
    return err;
  };
  const goPreview = () => {
    const e = validate();
    if (e.length) { setValErrors(e); mainRef.current?.scrollTo?.({ top: 0 }); return; }
    setValErrors([]); setPhase("preview");
  };

  // ── Exports (same numbering and content as the preview) ──
  const fileBase = () => (paper.title || "paper").trim().replace(/[^\w\-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 80) || "paper";
  const authorLines = () => paper.authors.filter(a => a.name.trim()).map(a => [a.name, a.affiliation, a.email].filter(s => s && s.trim()).join(", "));
  const mdTable = (rows) => {
    const esc = (c) => String(c ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
    const head = rows[0] || [];
    return [`| ${head.map(esc).join(" | ")} |`, `| ${head.map(() => "---").join(" | ")} |`, ...rows.slice(1).map(r => `| ${r.map(esc).join(" | ")} |`)].join("\n");
  };
  const exportMd = () => {
    const lines = [`# ${paper.title}`, ""];
    authorLines().forEach(l => lines.push(`- ${l}`));
    if (authorLines().length) lines.push("");
    lines.push(`**Format:** ${format.full}`);
    if (paper.keywords.trim()) lines.push("", `**Keywords:** ${paper.keywords.trim()}`);
    lines.push("");
    if (paper.abstract.trim()) lines.push("## Abstract", "", paper.abstract.trim().replace(/\s*\n\s*/g, " "), "");
    docItems.forEach(it => {
      lines.push(`## ${headingLabel(fmt, it.num, it.sec.name)}`, "");
      toParagraphs(it.d.text).forEach(p => lines.push(p, ""));
      it.d.figures.forEach((f, i) => {
        const n = it.fig0 + i + 1;
        lines.push(`![Figure ${n}](${f.dataUrl})`, "", `*Figure ${n}. ${f.caption || ""}*`, "");
      });
      it.d.tables.forEach((t, i) => {
        const n = it.tbl0 + i + 1;
        lines.push(`**Table ${n}.** ${t.caption || ""}`, "", mdTable(t.rows), "");
      });
    });
    if (refs.length) { lines.push("## References", ""); refs.forEach((r, i) => lines.push(citeMd(r, i, format.citationStyle), "")); }
    const blob = new Blob([lines.join("\n")], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `${fileBase()}.md`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const copyText = async () => {
    const lines = [paper.title, ""];
    authorLines().forEach(l => lines.push(l));
    if (authorLines().length) lines.push("");
    if (paper.keywords.trim()) lines.push(`Keywords: ${paper.keywords.trim()}`, "");
    if (paper.abstract.trim()) lines.push("ABSTRACT", paper.abstract.trim().replace(/\s*\n\s*/g, " "), "");
    docItems.forEach(it => {
      lines.push(headingLabel(fmt, it.num, it.sec.name), "");
      toParagraphs(it.d.text).forEach(p => lines.push(p, ""));
      it.d.figures.forEach((f, i) => lines.push(`[${fmt === "IEEE" ? "Fig." : "Figure"} ${it.fig0 + i + 1}. ${f.caption || ""}]`, ""));
      it.d.tables.forEach((t, i) => { lines.push(`${fmt === "IEEE" ? `TABLE ${roman(it.tbl0 + i + 1)}` : `Table ${it.tbl0 + i + 1}.`} ${t.caption || ""}`); t.rows.forEach(r => lines.push(r.join("\t"))); lines.push(""); });
    });
    if (refs.length) { lines.push("REFERENCES"); refs.forEach((r, i) => lines.push(formatCitation(r, i, format.citationStyle).full)); }
    const text = lines.join("\n");
    try { await navigator.clipboard.writeText(text); }
    catch (_) {
      try { const ta = document.createElement("textarea"); ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0"; document.body.appendChild(ta); ta.focus(); ta.select(); document.execCommand("copy"); document.body.removeChild(ta); }
      catch (__) { alert("Copy failed. Use Ctrl+A in the preview to select all."); return; }
    }
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };
  const doPrint = () => {
    const old = document.title;
    document.title = fileBase(); // default PDF file name
    const restore = () => { document.title = old; window.removeEventListener("afterprint", restore); };
    window.addEventListener("afterprint", restore);
    window.print();
  };

  // ── PHASE 1: Format selection ──
  if (phase === "format") return (
    <div className="app-root" style={{ minHeight: "100vh", background: C.bg, fontFamily: "system-ui, sans-serif" }}>
      <style>{`*{box-sizing:border-box;margin:0;padding:0;} .fc{border:2px solid ${C.border};border-radius:8px;padding:20px;cursor:pointer;transition:all .18s;background:white;} .fc:hover{border-color:${C.accent};box-shadow:0 0 0 3px ${C.accentLight};} .fc.sel{border-color:${C.accent};background:${C.accentLight};}`}</style>
      <header style={{ padding: "16px 28px", borderBottom: `1px solid ${C.border}`, background: "white", display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 32, height: 32, background: C.accent, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ color: "white", fontSize: 16, fontWeight: 700 }}>M</span></div>
        <span style={{ fontWeight: 700, fontSize: 17, color: C.ink }}>Medhasya AI</span>
        <span style={{ fontSize: 12, color: C.inkLight }}>· Research Paper Formatter</span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" }}>
          <span style={{ fontSize: 12, background: C.greenLight, color: C.green, padding: "3px 10px", borderRadius: 100, fontWeight: 600 }}>Free</span>
          {paper.title && <button onClick={() => setPhase("input")} style={{ background: C.accent, color: "white", border: "none", padding: "8px 16px", borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Resume Draft →</button>}
        </div>
      </header>
      <div style={{ padding: "44px 24px", maxWidth: 760, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: C.ink, marginBottom: 10 }}>Choose your paper format</h1>
          <p style={{ fontSize: 14, color: C.inkMid, lineHeight: 1.6 }}>Pick your target journal or conference. Add text, images, and tables per section.</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 24 }}>
          {Object.entries(FORMATS).map(([k, f]) => (
            <div key={k} className={`fc${fmt === k ? " sel" : ""}`} onClick={() => setFmt(k)}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                <span style={{ fontSize: 17, fontWeight: 700, color: fmt === k ? C.accent : C.ink }}>{f.name}</span>
                {fmt === k && <span style={{ fontSize: 11, background: C.accent, color: "white", padding: "2px 8px", borderRadius: 100 }}>SELECTED</span>}
              </div>
              <p style={{ fontSize: 12, color: C.inkLight, marginBottom: 8 }}>{f.full}</p>
              <div style={{ fontSize: 12, color: C.inkMid, marginBottom: 3 }}><strong>Layout:</strong> {f.columns === "double" ? "Two-column" : "Single-column"}</div>
              <div style={{ fontSize: 12, color: C.inkMid, marginBottom: 3 }}><strong>Citations:</strong> {f.citationStyle === "numeric" ? "Numeric [1]" : "Author-Year"}</div>
              <div style={{ fontSize: 12, color: C.inkMid }}><strong>Sections:</strong> {f.sections.join(" → ")}</div>
            </div>
          ))}
        </div>
        <div style={{ background: C.goldLight, border: "1px solid #e0c85a", borderRadius: 8, padding: 14, marginBottom: 24, fontSize: 13, color: "#7a6000" }}>
          <strong>What's supported:</strong> Text per section · Figures with captions · Data tables · Custom sections anywhere · Auto-formatted references · Two-column layout for IEEE/ACM · A4 print-ready PDF · Auto-save in browser
        </div>
        <div style={{ display: "flex", justifyContent: "center", gap: 12 }}>
          <button onClick={() => setPhase("input")} style={{ background: C.accent, color: "white", border: "none", padding: "13px 36px", borderRadius: 6, fontSize: 15, fontWeight: 600, cursor: "pointer" }}>Start with {fmt} →</button>
          {paper.title && <button onClick={clearSaved} style={{ background: "transparent", border: `1px solid ${C.red}`, color: C.red, padding: "13px 20px", borderRadius: 6, fontSize: 13, cursor: "pointer" }}>Clear draft</button>}
        </div>
      </div>
    </div>
  );

  // ── PHASE 2: Input ──
  if (phase === "input") return (
    <div className="app-root" style={{ minHeight: "100vh", background: C.bg, fontFamily: "system-ui, sans-serif", display: "flex", flexDirection: "column" }}>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0;}
        textarea,input{font-family:system-ui,sans-serif;}
        .fi{width:100%;padding:9px 11px;border:1.5px solid ${C.border};border-radius:6px;font-size:14px;color:${C.ink};background:white;transition:border .15s;resize:vertical;}
        .fi:focus{border-color:${C.accent};outline:none;box-shadow:0 0 0 3px ${C.accentLight};}
        .fi.err{border-color:${C.red};}
        .fl{display:block;font-size:11px;font-weight:600;color:${C.inkMid};margin-bottom:5px;text-transform:uppercase;letter-spacing:.06em;}
        .nt{padding:8px 10px;font-size:12px;cursor:pointer;border-radius:6px;transition:all .15s;border:none;background:transparent;text-align:left;display:flex;align-items:center;gap:7px;width:100%;color:${C.inkLight};}
        .nt:hover{background:${C.accentLight};color:${C.accent};}
        .nt.act{background:${C.accentLight};color:${C.accent};font-weight:600;}
        .sa{border:none;background:none;cursor:pointer;padding:2px 5px;font-size:12px;color:${C.inkLight};border-radius:3px;}
        .sa:hover{background:${C.border};color:${C.ink};}
      `}</style>

      <header style={{ padding: "12px 22px", borderBottom: `1px solid ${C.border}`, background: "white", display: "flex", alignItems: "center", gap: 14, position: "sticky", top: 0, zIndex: 20 }}>
        <button onClick={() => setPhase("format")} style={{ border: "none", background: "none", cursor: "pointer", color: C.accent, fontSize: 13, fontWeight: 600 }}>← Format</button>
        <div style={{ width: 1, height: 20, background: C.border }} />
        <span style={{ fontWeight: 700, fontSize: 15, color: C.ink }}>Medhasya AI</span>
        <span style={{ fontSize: 12, color: C.inkLight, background: C.border, padding: "2px 8px", borderRadius: 100 }}>{fmt}</span>
        <span style={{ fontSize: 11, color: C.green }}>● auto-saved</span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" }}>
          <span style={{ fontSize: 12, color: C.inkLight }}>{totalWords.toLocaleString()} words · {filledCount}/{allBodySecs.length + 1} sections</span>
          <button onClick={goPreview} style={{ background: C.accent, color: "white", border: "none", padding: "9px 20px", borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Preview Paper →</button>
        </div>
      </header>

      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        <aside style={{ width: 230, background: "white", borderRight: `1px solid ${C.border}`, padding: "13px 10px", flexShrink: 0, overflowY: "auto" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.inkLight, letterSpacing: ".12em", padding: "0 4px", marginBottom: 10 }}>SECTIONS</div>

          <button className={`nt${curId === "meta" ? " act" : ""}`} onClick={() => setActiveId("meta")}>
            <Dot done={!!paper.title} active={curId === "meta"} label="1" />Title & Authors
          </button>
          <button className={`nt${curId === "abstract" ? " act" : ""}`} onClick={() => setActiveId("abstract")}>
            <Dot done={!!paper.abstract?.trim()} active={curId === "abstract"} label="2" />Abstract
          </button>

          <AddSecWidget triggerId="before_all" afterIdx={-1} afterId={null} addingSectionAfter={addingAfter} setAddingSectionAfter={setAddingAfter} newSectionName={newSecName} setNewSectionName={setNewSecName} addCustomSection={addCustomSec} />

          {allBodySecs.map((sec, idx) => {
            const isAct = curId === sec.id;
            const isDone = hasContent(paper, sec);
            const isCust = sec.type === "custom";
            const cs = isCust ? customSecs.find(c => c.id === sec.id) : null;
            const insertAI = isCust ? slotOf(cs) : fixedSecs.indexOf(sec.name);
            return (
              <div key={sec.id}>
                <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
                  {renamingId === sec.id ? (
                    <div className="nt act" style={{ flex: 1, minWidth: 0 }}>
                      <Dot done={isDone} active label={idx + 3} />
                      <input value={renameVal} onChange={e => setRenameVal(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") renameCustomSec(sec.id); if (e.key === "Escape") { cancelRename.current = true; setRenamingId(null); } }}
                        onBlur={() => renameCustomSec(sec.id)} autoFocus
                        style={{ width: "100%", border: "none", background: "transparent", fontSize: 12, color: C.ink, outline: "none", padding: 0 }} />
                    </div>
                  ) : (
                    <button className={`nt${isAct ? " act" : ""}`} onClick={() => setActiveId(sec.id)} style={{ flex: 1, minWidth: 0 }}>
                      <Dot done={isDone} active={isAct} label={idx + 3} />
                      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>
                        {isCust && <span style={{ fontSize: 9, color: C.accent, marginRight: 4 }}>✦</span>}{sec.name}
                      </span>
                    </button>
                  )}
                  {isCust && renamingId !== sec.id && (
                    <div style={{ display: "flex", gap: 1, flexShrink: 0 }}>
                      <button className="sa" title="Move up" onClick={() => moveCustomSec(sec.id, -1)}>↑</button>
                      <button className="sa" title="Move down" onClick={() => moveCustomSec(sec.id, 1)}>↓</button>
                      <button className="sa" title="Rename" onClick={() => { cancelRename.current = false; setRenamingId(sec.id); setRenameVal(sec.name); }}>✎</button>
                      <button className="sa" title="Delete" style={{ color: C.red }} onClick={() => removeCustomSec(sec.id)}>✕</button>
                    </div>
                  )}
                </div>
                <AddSecWidget triggerId={sec.id} afterIdx={insertAI} afterId={isCust ? sec.id : null} addingSectionAfter={addingAfter} setAddingSectionAfter={setAddingAfter} newSectionName={newSecName} setNewSectionName={setNewSecName} addCustomSection={addCustomSec} />
              </div>
            );
          })}

          <button className={`nt${curId === "references" ? " act" : ""}`} onClick={() => setActiveId("references")}>
            <Dot done={refs.length > 0} active={curId === "references"} label="R" />References
          </button>

          <div style={{ marginTop: 14, padding: "8px 6px", borderTop: `1px solid ${C.border}`, fontSize: 11, color: C.inkLight, lineHeight: 1.7 }}>
            <div><span style={{ color: C.accent }}>✦</span> Custom · ↑↓ reorder · ✎ rename · ✕ delete</div>
          </div>
        </aside>

        <main ref={mainRef} style={{ flex: 1, overflowY: "auto", padding: "28px 36px", maxWidth: 820 }}>
          {valErrors.length > 0 && <ValidationBanner errors={valErrors} />}

          {curId === "meta" && (
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: C.ink, marginBottom: 6 }}>Title & Authors</h2>
              <p style={{ fontSize: 13, color: C.inkLight, marginBottom: 22 }}>Enter the paper title, authors, and keywords.</p>
              <div style={{ marginBottom: 16 }}>
                <label className="fl">Paper Title *</label>
                <input className={`fi${!paper.title.trim() && valErrors.length ? " err" : ""}`} placeholder="e.g., Deep Learning-Based Anomaly Detection in IoT Networks" value={paper.title} onChange={e => setPaper(p => ({ ...p, title: e.target.value }))} />
              </div>
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <label className="fl" style={{ margin: 0 }}>Authors</label>
                  <button onClick={addAuthor} style={{ border: `1px solid ${C.border}`, background: "transparent", padding: "5px 12px", borderRadius: 5, fontSize: 12, cursor: "pointer", color: C.inkMid }}>+ Add Author</button>
                </div>
                {paper.authors.map((a, i) => (
                  <div key={i} style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: 13, marginBottom: 10, background: "#fafaf9" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 9 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: C.inkLight }}>Author {i + 1}</span>
                      {paper.authors.length > 1 && <button onClick={() => removeAuthor(i)} style={{ background: "transparent", color: C.red, border: `1px solid ${C.border}`, padding: "3px 10px", borderRadius: 5, fontSize: 12, cursor: "pointer" }}>Remove</button>}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9, marginBottom: 9 }}>
                      <div><label className="fl">Full Name</label><input className="fi" placeholder="Priya Sharma" value={a.name} onChange={e => updateAuthor(i, "name", e.target.value)} /></div>
                      <div>
                        <label className="fl">Email</label>
                        <input className={`fi${a.email && !isValidEmail(a.email) ? " err" : ""}`} placeholder="priya@nit.edu" value={a.email} onChange={e => updateAuthor(i, "email", e.target.value)} />
                        {a.email && !isValidEmail(a.email) && <div style={{ fontSize: 11, color: C.red, marginTop: 2 }}>Invalid email</div>}
                      </div>
                    </div>
                    <div><label className="fl">Affiliation</label><input className="fi" placeholder="Dept. of CSE, NIT Warangal, India" value={a.affiliation} onChange={e => updateAuthor(i, "affiliation", e.target.value)} /></div>
                  </div>
                ))}
              </div>
              <div style={{ marginBottom: 18 }}>
                <label className="fl">Keywords (comma-separated)</label>
                <input className="fi" placeholder="deep learning, anomaly detection, IoT, LSTM" value={paper.keywords} onChange={e => setPaper(p => ({ ...p, keywords: e.target.value }))} />
              </div>
              <button onClick={() => goRel(1)} style={{ background: C.accent, color: "white", border: "none", padding: "10px 22px", borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Next: Abstract →</button>
            </div>
          )}

          {curId === "abstract" && (
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: C.ink, marginBottom: 6 }}>Abstract</h2>
              <div style={{ background: C.goldLight, border: "1px solid #e0c85a", borderRadius: 6, padding: "9px 13px", marginBottom: 14, fontSize: 12, color: "#6a5000" }}>
                <strong>{fmt} guideline:</strong>{" "}
                {fmt === "IEEE" ? "150–250 words. Single paragraph, no citations, no equations." : fmt === "ACM" ? "150–250 words. Describes problem, approach, and results." : fmt === "Springer" ? "Up to 250 words. Single paragraph." : "150–300 words. Background, Objective, Methods, Results, Conclusions."}
              </div>
              <textarea className={`fi${!paper.abstract.trim() && valErrors.length ? " err" : ""}`} rows={10} placeholder="This paper presents a novel approach for…" value={paper.abstract} onChange={e => setPaper(p => ({ ...p, abstract: e.target.value }))} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 7 }}>
                <span style={{ fontSize: 12, color: C.inkLight }}>{wordCount(paper.abstract)} words</span>
                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={() => goRel(-1)} style={{ background: "transparent", border: `1.5px solid ${C.border}`, padding: "8px 18px", borderRadius: 6, fontSize: 13, cursor: "pointer", color: C.inkMid }}>← Back</button>
                  <button onClick={() => goRel(1)} style={{ background: C.accent, color: "white", border: "none", padding: "8px 20px", borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Next →</button>
                </div>
              </div>
            </div>
          )}

          {curSec && (
            <SectionEditor
              key={curSec.id}
              sec={curSec} paper={paper} setPaper={setPaper} fmt={fmt}
              onBack={() => goRel(-1)} onNext={() => goRel(1)}
            />
          )}

          {curId === "references" && (
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: C.ink, marginBottom: 6 }}>References</h2>
              <p style={{ fontSize: 13, color: C.inkLight, marginBottom: 8 }}>Auto-formatted in <strong>{format.citationStyle === "numeric" ? "numeric [1] style" : "Author-Year style"}</strong> per {fmt} rules.</p>
              <div style={{ background: C.goldLight, border: "1px solid #e0c85a", borderRadius: 6, padding: "9px 13px", marginBottom: 16, fontSize: 12, color: "#6a5000" }}>
                <strong>Tip:</strong> For journals fill Journal. For conferences fill Book Title. Authors: write names exactly as they should print (e.g. "J. Smith"). DOI recommended.
              </div>
              {refs.length === 0 && <div style={{ textAlign: "center", padding: "28px 0", color: C.inkLight, fontSize: 14 }}>No references yet.</div>}
              {refs.map((ref, i) => (
                <div key={i} style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: 13, marginBottom: 11, background: "#fafaf9" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 9 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: C.accent }}>{format.citationStyle === "numeric" ? `[${i + 1}]` : `Ref ${i + 1}`}</span>
                    <button onClick={() => removeRef(i)} style={{ background: "transparent", color: C.red, border: `1px solid ${C.border}`, padding: "3px 10px", borderRadius: 5, fontSize: 12, cursor: "pointer" }}>Remove</button>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }}>
                    <div style={{ gridColumn: "1 / -1" }}><label className="fl">Authors (one per line)</label><textarea className="fi" rows={2} placeholder={"J. Smith\nA. Kumar"} value={ref.authors.join("\n")} onChange={e => updateRef(i, "authors", e.target.value.split("\n"))} /></div>
                    <div style={{ gridColumn: "1 / -1" }}><label className="fl">Title</label><input className="fi" placeholder="Paper / Article Title" value={ref.title} onChange={e => updateRef(i, "title", e.target.value)} /></div>
                    <div><label className="fl">Journal</label><input className="fi" placeholder="IEEE Trans. Neural Networks" value={ref.journal} onChange={e => updateRef(i, "journal", e.target.value)} /></div>
                    <div><label className="fl">Book Title (Conference)</label><input className="fi" placeholder="Proc. CVPR 2024" value={ref.booktitle} onChange={e => updateRef(i, "booktitle", e.target.value)} /></div>
                    <div><label className="fl">Year</label><input className="fi" placeholder="2024" value={ref.year} onChange={e => updateRef(i, "year", e.target.value)} /></div>
                    <div><label className="fl">Volume</label><input className="fi" placeholder="34" value={ref.volume} onChange={e => updateRef(i, "volume", e.target.value)} /></div>
                    <div><label className="fl">Issue</label><input className="fi" placeholder="2" value={ref.issue} onChange={e => updateRef(i, "issue", e.target.value)} /></div>
                    <div><label className="fl">Pages</label><input className="fi" placeholder="112-128" value={ref.pages} onChange={e => updateRef(i, "pages", e.target.value)} /></div>
                    <div style={{ gridColumn: "1 / -1" }}><label className="fl">DOI</label><input className="fi" placeholder="10.1109/TNN.2023.001" value={ref.doi} onChange={e => updateRef(i, "doi", e.target.value)} /></div>
                  </div>
                  {(ref.title || ref.authors.length > 0) && (
                    <div style={{ background: C.accentLight, borderRadius: 5, padding: "7px 11px", fontSize: 12, color: C.accent, marginTop: 9 }}>
                      <strong>Preview:</strong> <Cite c={formatCitation(ref, i, format.citationStyle)} />
                    </div>
                  )}
                </div>
              ))}
              <button onClick={addRef} style={{ width: "100%", textAlign: "center", marginBottom: 18, padding: "10px 0", border: `1.5px dashed ${C.border}`, borderRadius: 6, background: "transparent", color: C.inkMid, fontSize: 13, cursor: "pointer" }}>+ Add Reference</button>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => goRel(-1)} style={{ background: "transparent", border: `1.5px solid ${C.border}`, padding: "9px 20px", borderRadius: 6, fontSize: 13, cursor: "pointer", color: C.inkMid }}>← Back</button>
                <button onClick={goPreview} style={{ flex: 1, background: C.accent, color: "white", border: "none", padding: "12px", borderRadius: 6, fontSize: 15, fontWeight: 600, cursor: "pointer" }}>Preview Formatted Paper →</button>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );

  // ── PHASE 3: Preview / Print ──
  return (
    <div className="app-root" style={{ minHeight: "100vh", background: "#c8c8c8", fontFamily: "system-ui, sans-serif" }}>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .para { orphans: 2; widows: 2; }
        @page { size: A4 portrait; margin: 15mm 14mm; }
        @media print {
          html, body, #root { background: #fff !important; margin: 0 !important; padding: 0 !important; height: auto !important; overflow: visible !important; }
          .app-root { background: #fff !important; min-height: 0 !important; }
          .no-print { display: none !important; }
          #preview-scroll-wrapper { overflow: visible !important; padding: 0 !important; background: #fff !important; }
          #print-paper { width: 100% !important; min-width: 0 !important; min-height: 0 !important; margin: 0 !important; padding: 0 !important; box-shadow: none !important; }
          .sec-head { break-after: avoid; page-break-after: avoid; }
          .keep { break-inside: avoid; page-break-inside: avoid; }
          img { max-width: 100% !important; }
          * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>

      <header className="no-print" style={{ padding: "11px 22px", background: C.ink, display: "flex", alignItems: "center", gap: 13, position: "sticky", top: 0, zIndex: 10 }}>
        <button onClick={() => setPhase("input")} style={{ border: "none", background: "transparent", cursor: "pointer", color: "#aaa", fontSize: 13 }}>← Edit</button>
        <div style={{ width: 1, height: 20, background: "#444" }} />
        <span style={{ color: "white", fontWeight: 700, fontSize: 14, maxWidth: 320, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{paper.title || "Untitled"}</span>
        <span style={{ fontSize: 12, background: "#333", color: "#aaa", padding: "2px 8px", borderRadius: 100 }}>{fmt}</span>
        <span style={{ fontSize: 12, color: "#888" }}>{totalWords.toLocaleString()} words</span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 9, alignItems: "center" }}>
          <button onClick={copyText} style={{ background: "white", color: C.inkMid, border: `1.5px solid ${C.border}`, padding: "7px 15px", borderRadius: 6, fontSize: 13, cursor: "pointer" }}>{copied ? "✓ Copied!" : "Copy Text"}</button>
          <button onClick={exportMd} style={{ background: "white", color: C.inkMid, border: `1.5px solid ${C.border}`, padding: "7px 15px", borderRadius: 6, fontSize: 13, cursor: "pointer" }}>↓ Markdown</button>
          <button onClick={doPrint} style={{ background: C.accent, color: "white", border: "none", padding: "7px 18px", borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>🖨 Print / Save PDF</button>
        </div>
      </header>

      <PaperPreview paper={paper} fmt={fmt} items={docItems} refs={refs} />

      <div className="no-print" style={{ textAlign: "center", padding: "14px 16px 28px", fontSize: 12, color: "#555", lineHeight: 1.6 }}>
        Medhasya AI · {format.full}<br />
        For a perfect PDF: Print → Destination “Save as PDF” · Paper A4 · Margins “Default” · Scale 100% · turn off “Headers and footers” · turn on “Background graphics”.
      </div>
    </div>
  );
}
