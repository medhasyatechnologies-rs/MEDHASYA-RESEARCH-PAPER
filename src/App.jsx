import { useState, useEffect, useRef } from "react";
 
const C = {
  bg: "#f7f6f2", border: "#e2ddd6", ink: "#1a1814", inkMid: "#4a4540", inkLight: "#7a7570",
  accent: "#2d5a8e", accentLight: "#e8f0f9", accentDark: "#1a3d62",
  gold: "#b8860b", goldLight: "#fdf6e3", green: "#2e7d52", greenLight: "#edf7f1", red: "#c0392b",
};
 
const FORMATS = {
  IEEE:     { name:"IEEE",         full:"Institute of Electrical and Electronics Engineers",    sections:["Introduction","Related Work","Methodology","Results & Discussion","Conclusion"],                       citationStyle:"numeric",   columns:"double" },
  ACM:      { name:"ACM",          full:"Association for Computing Machinery",                   sections:["Introduction","Background & Related Work","Approach","Evaluation","Discussion","Conclusion"],        citationStyle:"numeric",   columns:"double" },
  Springer: { name:"Springer LNCS",full:"Springer Lecture Notes in Computer Science",           sections:["Introduction","Related Work","Proposed Method","Experiments","Conclusion"],                          citationStyle:"numeric",   columns:"single" },
  Elsevier: { name:"Elsevier",     full:"Elsevier Journal Format",                              sections:["Introduction","Literature Review","Materials & Methods","Results","Discussion","Conclusion"],        citationStyle:"name-year", columns:"single" },
};
 
const ROMAN = ["I","II","III","IV","V","VI","VII","VIII","IX","X","XI","XII","XIII","XIV","XV"];
 
function getSectionNum(fmt, idx) {
  return fmt === "IEEE" ? ROMAN[idx] + "." : (idx + 1) + ".";
}
function wordCount(t) {
  if (!t || !t.trim()) return 0;
  return t.trim().replace(/[^a-zA-Z0-9\s]/g," ").trim().split(/\s+/).filter(Boolean).length;
}
function sKey(name) { return "__s__" + name.toLowerCase().replace(/[^a-z0-9]/g,"_"); }
function isValidEmail(e) { if (!e||!e.trim()) return true; return /\S+@\S+\.\S+/.test(e.trim()); }
 
function formatCitation(ref, idx, style) {
  const { authors=[], year="", title="", journal="", volume="", issue="", pages="", doi="", booktitle="" } = ref;
  const aStr = authors.length===0 ? "Unknown Author" : authors.length>6 ? authors.slice(0,6).join(", ")+" et al." : authors.join(", ");
  const tStr = title.trim() ? title.trim() : null;
  const venue = journal || booktitle || "";
  if (style==="name-year") {
    const last = authors[0]?.split(" ").pop()||"Unknown";
    const tag = authors.length>2?`${last} et al.`:aStr;
    return { inText:`(${tag}, ${year||"n.d."})`, full:[aStr,`(${year||"n.d."}).`,tStr?`${tStr}.`:null,venue||null,volume?`, ${volume}`:null,issue?`(${issue})`:null,pages?`, ${pages}`:null,doi?`. https://doi.org/${doi}`:null].filter(Boolean).join(" ") };
  }
  return { inText:`[${idx+1}]`, full:[`[${idx+1}]`,`${aStr},`,tStr?`"${tStr},"`:null,venue?`${venue}`:null,volume?`, vol. ${volume}`:null,issue?`, no. ${issue}`:null,pages?`, pp. ${pages}`:null,year?`, ${year}`:null,doi?`, doi: ${doi}`:null].filter(Boolean).join(" ")+"." };
}
 
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
 
// ─── Section content: text + optional images + optional tables ──────────────
// sections[sKey(name)] = { text: "", figures: [{id, dataUrl, caption}], tables: [{id, caption, rows:[[...]]}] }
 
function getSectionData(paper, name) {
  const empty = { text:"", figures:[], tables:[] };
  return paper.sections?.[sKey(name)] || empty;
}
function setSectionData(setPaper, name, data) {
  setPaper(p => ({ ...p, sections: { ...p.sections, [sKey(name)]: data } }));
}
 
// ─── Figure renderer ─────────────────────────────────────────────────────────
function FigureBlock({ fig, idx }) {
  return (
    <div style={{ margin:"10px 0", textAlign:"center" }}>
      <img src={fig.dataUrl} alt={fig.caption||`Figure ${idx+1}`}
        style={{ maxWidth:"100%", maxHeight:180, objectFit:"contain", border:"1px solid #ccc" }} />
      <div style={{ fontSize:10, fontStyle:"italic", marginTop:3, color:"#333", lineHeight:1.4 }}>
        Fig. {idx+1}. {fig.caption||""}
      </div>
    </div>
  );
}
 
// ─── Table renderer ──────────────────────────────────────────────────────────
function TableBlock({ tbl, idx }) {
  if (!tbl.rows || tbl.rows.length===0) return null;
  return (
    <div style={{ margin:"10px 0" }}>
      <div style={{ fontSize:10, fontWeight:"bold", textAlign:"center", marginBottom:3, textTransform:"uppercase", letterSpacing:"0.04em" }}>
        Table {idx+1}
      </div>
      {tbl.caption && <div style={{ fontSize:10, fontStyle:"italic", textAlign:"center", marginBottom:4 }}>{tbl.caption}</div>}
      <table style={{ borderCollapse:"collapse", width:"100%", fontSize:10 }}>
        {tbl.rows.map((row, ri) => (
          <tr key={ri}>
            {row.map((cell, ci) => (
              <td key={ci} style={{ border:"1px solid #555", padding:"2px 5px", fontWeight: ri===0?"bold":"normal", textAlign:"center" }}>{cell}</td>
            ))}
          </tr>
        ))}
      </table>
    </div>
  );
}
 
// ─── PAPER PREVIEW ───────────────────────────────────────────────────────────
// Matches the reference IEEE paper image exactly:
// • Large serif title, centered
// • Authors side-by-side with italic affiliations, email, ORCID
// • Full-width bold+italic Abstract— (whole abstract bold), then italic Keywords—
// • Thin rule → two-column body with centered uppercase Roman numeral headings
// • Justified body text, 10pt-equivalent, tight leading
// • References flow continuously in two-column
 
function PaperPreview({ paper, fmt, allBodySections, refs }) {
  const fmtObj   = FORMATS[fmt];
  const isDouble = fmtObj.columns === "double";
 
  // ── render all body content (sections + refs) as a flat list of nodes
  // then pour them into two columns using CSS columns on a FIXED-WIDTH wrapper
  // Fixed width forces the browser to honour column layout even inside an iframe
 
  const secHeadStyle = (f) => ({
    fontWeight: "bold",
    fontSize:   f === "IEEE" ? 11 : 12,
    textAlign:  f === "IEEE" ? "center" : "left",
    margin:     "12px 0 4px",
    textTransform: f === "IEEE" ? "uppercase" : "none",
    letterSpacing: f === "IEEE" ? "0.06em" : "normal",
    fontFamily: "Times New Roman, serif",
  });
 
  const bodyText = {
    fontSize: 11,
    lineHeight: 1.55,
    textAlign: "justify",
    fontFamily: "Times New Roman, serif",
    whiteSpace: "pre-wrap",
    margin: "0 0 6px",
  };
 
  // Abstract style: IEEE uses bold text for whole abstract
  const abstractIEEE = {
    fontSize: 11,
    lineHeight: 1.55,
    textAlign: "justify",
    fontFamily: "Times New Roman, serif",
    fontWeight: "bold",
    margin: "0 0 6px",
  };
 
  const PAGE_W = 860; // fixed pixel width — forces CSS columns to work in iframe
 
  return (
    // Outer scroll wrapper
    <div style={{ overflowX: "auto", padding: "32px 16px" }}>
      {/* Fixed-width A4-ish page */}
      <div style={{
        width: PAGE_W,
        minWidth: PAGE_W,
        background: "#fff",
        margin: "0 auto",
        padding: isDouble ? "52px 54px 52px 54px" : "52px 72px",
        boxShadow: "0 2px 32px rgba(0,0,0,0.15)",
        fontFamily: "Times New Roman, serif",
        color: "#111",
        boxSizing: "border-box",
      }}>
 
        {/* ── TITLE ── */}
        <div style={{
          textAlign: "center",
          fontSize: isDouble ? 22 : 24,
          fontWeight: "bold",
          lineHeight: 1.2,
          marginBottom: 18,
          fontFamily: "Times New Roman, serif",
        }}>
          {paper.title || "Paper Title"}
        </div>
 
        {/* ── AUTHORS — side by side ── */}
        {paper.authors?.length > 0 && (
          <div style={{
            display: "flex",
            justifyContent: "center",
            flexWrap: "wrap",
            gap: "48px",
            marginBottom: 16,
            textAlign: "center",
          }}>
            {paper.authors.map((a, i) => (
              <div key={i} style={{ minWidth: 140 }}>
                <div style={{ fontSize: 12, fontWeight: "bold" }}>{a.name || "Author"}</div>
                {a.affiliation && (
                  <div style={{ fontSize: 10.5, fontStyle: "italic", color: "#222", lineHeight: 1.4, maxWidth: 220 }}>
                    {a.affiliation}
                  </div>
                )}
                {a.email && <div style={{ fontSize: 10.5, color: "#222" }}>{a.email}</div>}
              </div>
            ))}
          </div>
        )}
 
        {/* ── ABSTRACT full-width ── */}
        {paper.abstract && (
          <div style={{ marginBottom: 8 }}>
            {fmt === "IEEE" ? (
              // IEEE: bold italic "Abstract—" + bold abstract text (matches reference image)
              <div style={abstractIEEE}>
                <span style={{ fontStyle: "italic" }}>Abstract</span>
                <span style={{ fontStyle: "italic" }}>—</span>
                {paper.abstract}
              </div>
            ) : fmt === "ACM" ? (
              <div>
                <div style={{ fontWeight: "bold", fontSize: 11, marginBottom: 3 }}>ABSTRACT</div>
                <div style={{ ...bodyText, fontWeight: "normal" }}>{paper.abstract}</div>
              </div>
            ) : (
              <div>
                <div style={{ fontWeight: "bold", fontSize: 12, marginBottom: 3 }}>Abstract</div>
                <div style={{ ...bodyText, fontWeight: "normal" }}>{paper.abstract}</div>
              </div>
            )}
          </div>
        )}
 
        {/* ── KEYWORDS ── */}
        {paper.keywords && (
          <div style={{ fontSize: 11, fontStyle: "italic", marginBottom: 10, fontFamily: "Times New Roman, serif" }}>
            <em>
              <strong>Keywords</strong>—{paper.keywords}
            </em>
          </div>
        )}
 
        {/* ── DIVIDER before body ── */}
        <hr style={{ border: "none", borderTop: "1px solid #555", margin: "8px 0 10px" }} />
 
        {/* ── BODY: two-column or single ── */}
        {isDouble ? (
          // CSS columns on a fixed-width div — WORKS in iframes when width is explicit pixels
          <div style={{
            columnCount: 2,
            columnGap: "20px",
            columnRule: "1px solid #bbb",
            width: "100%",
          }}>
            {allBodySections.map((sec, idx) => {
              const data = getSectionData(paper, sec.name);
              const text = data.text || "";
              const figures = data.figures || [];
              const tables  = data.tables  || [];
              if (!text && !figures.length && !tables.length) return null;
              const label = `${ROMAN[idx]}. ${sec.name.toUpperCase()}`;
              return (
                <div key={sec.id} style={{ breakInside: "avoid", display: "inline-block", width: "100%" }}>
                  <div style={secHeadStyle(fmt)}>{label}</div>
                  {text && <div style={bodyText}>{text}</div>}
                  {figures.map((f, i) => <FigureBlock key={f.id} fig={f} idx={i} />)}
                  {tables.map((t, i)  => <TableBlock  key={t.id} tbl={t} idx={i} />)}
                </div>
              );
            })}
 
            {/* References */}
            {refs.length > 0 && (
              <div style={{ breakInside: "avoid", display: "inline-block", width: "100%" }}>
                <div style={secHeadStyle(fmt)}>References</div>
                <div style={{ fontSize: 10, lineHeight: 1.45, fontFamily: "Times New Roman, serif" }}>
                  {refs.map((ref, i) => (
                    <div key={i} style={{ marginBottom: 4 }}>
                      {formatCitation(ref, i, fmtObj.citationStyle).full}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          // Single column (Springer, Elsevier)
          <div>
            {allBodySections.map((sec, idx) => {
              const data = getSectionData(paper, sec.name);
              const text = data.text || "";
              const figures = data.figures || [];
              const tables  = data.tables  || [];
              if (!text && !figures.length && !tables.length) return null;
              const label = fmt === "Springer"
                ? `${idx+1}  ${sec.name}`
                : `${idx+1}. ${sec.name}`;
              return (
                <div key={sec.id} style={{ marginBottom: 14 }}>
                  <div style={secHeadStyle(fmt)}>{label}</div>
                  {text && <div style={{ ...bodyText, fontSize: 12, lineHeight: 1.65 }}>{text}</div>}
                  {figures.map((f, i) => <FigureBlock key={f.id} fig={f} idx={i} />)}
                  {tables.map((t, i)  => <TableBlock  key={t.id} tbl={t} idx={i} />)}
                </div>
              );
            })}
 
            {refs.length > 0 && (
              <div style={{ marginTop: 20 }}>
                <div style={{ fontWeight: "bold", fontSize: 13, marginBottom: 8, fontFamily: "Times New Roman, serif" }}>References</div>
                <div style={{ fontSize: 11.5, lineHeight: 1.6, fontFamily: "Times New Roman, serif" }}>
                  {refs.map((ref, i) => (
                    <div key={i} style={{ marginBottom: 5 }}>
                      {formatCitation(ref, i, fmtObj.citationStyle).full}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
 
// ─── Section Editor with Text + Figures + Tables ──────────────────────────────
function SectionEditor({ sec, paper, setPaper, fmt, onBack, onNext }) {
  const data = getSectionData(paper, sec.name);
  const figures = data.figures || [];
  const tables  = data.tables  || [];
  const text    = data.text    || "";
  const imgRef  = useRef();
  const [tab, setTab] = useState("text"); // text | figures | tables
  const [editingTable, setEditingTable] = useState(null); // {id, caption, rows} or null for new
  const [newTableRows, setNewTableRows] = useState(3);
  const [newTableCols, setNewTableCols] = useState(3);
 
  const update = (patch) => setSectionData(setPaper, sec.name, { ...data, ...patch });
 
  // ── Figures ──
  const addFigure = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const fig = { id:`fig_${Date.now()}`, dataUrl: ev.target.result, caption:"" };
      update({ figures: [...figures, fig] });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };
  const updateFigCaption = (id, caption) => update({ figures: figures.map(f => f.id===id?{...f,caption}:f) });
  const removeFigure = (id) => update({ figures: figures.filter(f => f.id!==id) });
 
  // ── Tables ──
  const startNewTable = () => {
    const rows = Array.from({length:newTableRows}, (_,ri) =>
      Array.from({length:newTableCols}, (_,ci) => ri===0?`Col ${ci+1}`:``));
    setEditingTable({ id:`tbl_${Date.now()}`, caption:"", rows });
  };
  const saveTable = () => {
    if (!editingTable) return;
    const existing = tables.find(t=>t.id===editingTable.id);
    if (existing) update({ tables: tables.map(t=>t.id===editingTable.id?editingTable:t) });
    else          update({ tables: [...tables, editingTable] });
    setEditingTable(null);
  };
  const removeTable = (id) => update({ tables: tables.filter(t=>t.id!==id) });
  const setCellVal = (ri,ci,val) => {
    const rows = editingTable.rows.map((row,r)=>row.map((cell,c)=>r===ri&&c===ci?val:cell));
    setEditingTable({...editingTable, rows});
  };
  const addTableRow = () => setEditingTable({...editingTable, rows:[...editingTable.rows, Array(editingTable.rows[0].length).fill("")]});
  const addTableCol = () => setEditingTable({...editingTable, rows: editingTable.rows.map(r=>[...r,""])});
  const removeTableRow = (ri) => setEditingTable({...editingTable, rows: editingTable.rows.filter((_,r)=>r!==ri)});
  const removeTableCol = (ci) => setEditingTable({...editingTable, rows: editingTable.rows.map(r=>r.filter((_,c)=>c!==ci))});
 
  const tabBtn = (id, label) => (
    <button onClick={()=>setTab(id)} style={{
      padding:"7px 18px", fontWeight:600, fontSize:13, cursor:"pointer", border:"none",
      borderBottom: tab===id ? `2px solid ${C.accent}` : "2px solid transparent",
      background:"transparent", color: tab===id ? C.accent : C.inkLight,
    }}>{label}</button>
  );
 
  return (
    <div>
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
        {sec.type==="custom" && <span style={{ fontSize:11, background:C.accentLight, color:C.accent, padding:"2px 8px", borderRadius:100, fontWeight:600 }}>CUSTOM</span>}
        <h2 style={{ fontSize:20, fontWeight:700, color:C.ink }}>{sec.name}</h2>
      </div>
 
      {GUIDELINES[sec.name] ? (
        <div style={{ background:C.goldLight, border:"1px solid #e0c85a", borderRadius:6, padding:"9px 13px", marginBottom:12, fontSize:12, color:"#6a5000" }}>
          <strong>{fmt} guideline:</strong> {GUIDELINES[sec.name]}
        </div>
      ) : (
        <div style={{ background:C.accentLight, border:`1px solid ${C.accent}30`, borderRadius:6, padding:"9px 13px", marginBottom:12, fontSize:12, color:C.accentDark }}>
          <strong>Custom section</strong> — paste your content below. Will appear with proper numbering in the paper.
        </div>
      )}
 
      {/* Tab bar */}
      <div style={{ borderBottom:`1px solid ${C.border}`, marginBottom:16, display:"flex" }}>
        {tabBtn("text",   `Text (${wordCount(text)} words)`)}
        {tabBtn("figures",`Figures (${figures.length})`)}
        {tabBtn("tables", `Tables (${tables.length})`)}
      </div>
 
      {/* TEXT TAB */}
      {tab==="text" && (
        <div>
          <textarea
            style={{ width:"100%", padding:"10px 12px", border:`1.5px solid ${C.border}`, borderRadius:6, fontSize:14, color:C.ink, background:"white", resize:"vertical", minHeight:300, fontFamily:"system-ui, sans-serif", lineHeight:1.6 }}
            placeholder={`Type your ${sec.name} content here…`}
            value={text}
            onChange={e => update({ text: e.target.value })}
          />
          <div style={{ fontSize:12, color:C.inkLight, marginTop:4 }}>{wordCount(text)} words</div>
        </div>
      )}
 
      {/* FIGURES TAB */}
      {tab==="figures" && (
        <div>
          <div style={{ marginBottom:16 }}>
            <input ref={imgRef} type="file" accept="image/*" style={{ display:"none" }} onChange={addFigure} />
            <button onClick={()=>imgRef.current?.click()} style={{ background:C.accent, color:"white", border:"none", padding:"9px 20px", borderRadius:6, fontSize:13, fontWeight:600, cursor:"pointer" }}>
              + Upload Image / Figure
            </button>
            <span style={{ fontSize:12, color:C.inkLight, marginLeft:12 }}>PNG, JPG, SVG — will appear in paper with "Fig. N. caption" label</span>
          </div>
 
          {figures.length===0 && (
            <div style={{ textAlign:"center", padding:"32px 0", color:C.inkLight, border:`2px dashed ${C.border}`, borderRadius:8, fontSize:14 }}>
              No figures yet. Upload one above.
            </div>
          )}
 
          {figures.map((fig, i) => (
            <div key={fig.id} style={{ border:`1px solid ${C.border}`, borderRadius:8, padding:14, marginBottom:12, background:"#fafaf9", display:"flex", gap:14, alignItems:"flex-start" }}>
              <img src={fig.dataUrl} alt="" style={{ width:140, height:100, objectFit:"contain", border:"1px solid #ddd", borderRadius:4, flexShrink:0, background:"#f0f0f0" }} />
              <div style={{ flex:1 }}>
                <div style={{ fontSize:12, fontWeight:700, color:C.inkMid, marginBottom:6 }}>Fig. {i+1}</div>
                <label style={{ display:"block", fontSize:11, fontWeight:600, color:C.inkLight, marginBottom:4, textTransform:"uppercase", letterSpacing:"0.06em" }}>Caption</label>
                <input
                  style={{ width:"100%", padding:"8px 10px", border:`1.5px solid ${C.border}`, borderRadius:5, fontSize:13, color:C.ink, background:"white" }}
                  placeholder="Block diagram of the proposed method"
                  value={fig.caption}
                  onChange={e=>updateFigCaption(fig.id, e.target.value)}
                />
                <button onClick={()=>removeFigure(fig.id)} style={{ marginTop:8, background:"transparent", color:C.red, border:`1px solid ${C.border}`, padding:"4px 12px", borderRadius:5, fontSize:12, cursor:"pointer" }}>Remove</button>
              </div>
            </div>
          ))}
        </div>
      )}
 
      {/* TABLES TAB */}
      {tab==="tables" && (
        <div>
          {!editingTable && (
            <div style={{ marginBottom:16 }}>
              <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
                <label style={{ fontSize:12, fontWeight:600, color:C.inkMid }}>Rows:</label>
                <input type="number" min={2} max={20} value={newTableRows} onChange={e=>setNewTableRows(+e.target.value)}
                  style={{ width:60, padding:"5px 8px", border:`1.5px solid ${C.border}`, borderRadius:5, fontSize:13 }} />
                <label style={{ fontSize:12, fontWeight:600, color:C.inkMid }}>Cols:</label>
                <input type="number" min={2} max={10} value={newTableCols} onChange={e=>setNewTableCols(+e.target.value)}
                  style={{ width:60, padding:"5px 8px", border:`1.5px solid ${C.border}`, borderRadius:5, fontSize:13 }} />
                <button onClick={startNewTable} style={{ background:C.accent, color:"white", border:"none", padding:"8px 18px", borderRadius:6, fontSize:13, fontWeight:600, cursor:"pointer" }}>
                  + Create Table
                </button>
              </div>
              <span style={{ fontSize:12, color:C.inkLight }}>Row 1 is treated as the header row.</span>
            </div>
          )}
 
          {/* Table editor */}
          {editingTable && (
            <div style={{ border:`1.5px solid ${C.accent}`, borderRadius:8, padding:16, marginBottom:16, background:C.accentLight }}>
              <div style={{ fontWeight:700, fontSize:14, color:C.accent, marginBottom:10 }}>Table Editor</div>
              <div style={{ marginBottom:10 }}>
                <label style={{ fontSize:12, fontWeight:600, color:C.inkMid, marginBottom:4, display:"block", textTransform:"uppercase", letterSpacing:"0.06em" }}>Caption</label>
                <input style={{ width:"100%", padding:"8px 10px", border:`1.5px solid ${C.border}`, borderRadius:5, fontSize:13, color:C.ink, background:"white" }}
                  placeholder="Comparison of classification metrics" value={editingTable.caption}
                  onChange={e=>setEditingTable({...editingTable, caption:e.target.value})} />
              </div>
              <div style={{ overflowX:"auto", marginBottom:10 }}>
                <table style={{ borderCollapse:"collapse", fontSize:12 }}>
                  {editingTable.rows.map((row,ri)=>(
                    <tr key={ri}>
                      {row.map((cell,ci)=>(
                        <td key={ci} style={{ border:"1px solid #aaa", padding:0 }}>
                          <input value={cell} onChange={e=>setCellVal(ri,ci,e.target.value)}
                            style={{ padding:"5px 7px", border:"none", outline:"none", width:90, fontSize:12, background: ri===0?"#d4e4f7":"white", fontWeight: ri===0?"bold":"normal" }} />
                        </td>
                      ))}
                      <td style={{ paddingLeft:6 }}>
                        <button onClick={()=>removeTableRow(ri)} style={{ border:"none", background:"none", color:C.red, cursor:"pointer", fontSize:14 }}>✕</button>
                      </td>
                    </tr>
                  ))}
                </table>
              </div>
              <div style={{ display:"flex", gap:8, marginBottom:12 }}>
                <button onClick={addTableRow} style={{ border:`1px solid ${C.border}`, background:"white", padding:"5px 12px", borderRadius:5, fontSize:12, cursor:"pointer" }}>+ Row</button>
                <button onClick={addTableCol} style={{ border:`1px solid ${C.border}`, background:"white", padding:"5px 12px", borderRadius:5, fontSize:12, cursor:"pointer" }}>+ Col</button>
              </div>
              <div style={{ display:"flex", gap:8 }}>
                <button onClick={saveTable} style={{ background:C.accent, color:"white", border:"none", padding:"8px 20px", borderRadius:6, fontSize:13, fontWeight:600, cursor:"pointer" }}>Save Table</button>
                <button onClick={()=>setEditingTable(null)} style={{ background:"transparent", border:`1px solid ${C.border}`, padding:"8px 16px", borderRadius:6, fontSize:13, cursor:"pointer", color:C.inkMid }}>Cancel</button>
              </div>
            </div>
          )}
 
          {tables.length===0 && !editingTable && (
            <div style={{ textAlign:"center", padding:"32px 0", color:C.inkLight, border:`2px dashed ${C.border}`, borderRadius:8, fontSize:14 }}>No tables yet. Create one above.</div>
          )}
 
          {tables.map((tbl,i)=>(
            <div key={tbl.id} style={{ border:`1px solid ${C.border}`, borderRadius:8, padding:14, marginBottom:10, background:"#fafaf9" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                <span style={{ fontWeight:700, fontSize:13, color:C.accent }}>Table {i+1}: {tbl.caption||"(no caption)"}</span>
                <div style={{ display:"flex", gap:6 }}>
                  <button onClick={()=>setEditingTable({...tbl})} style={{ border:`1px solid ${C.border}`, background:"white", padding:"4px 10px", borderRadius:5, fontSize:12, cursor:"pointer" }}>Edit</button>
                  <button onClick={()=>removeTable(tbl.id)} style={{ border:`1px solid ${C.border}`, background:"transparent", color:C.red, padding:"4px 10px", borderRadius:5, fontSize:12, cursor:"pointer" }}>Remove</button>
                </div>
              </div>
              <div style={{ overflowX:"auto" }}>
                <table style={{ borderCollapse:"collapse", fontSize:11, width:"100%" }}>
                  {tbl.rows.map((row,ri)=>(
                    <tr key={ri} style={{ background: ri===0?"#e0e8f4":"white" }}>
                      {row.map((cell,ci)=>(
                        <td key={ci} style={{ border:"1px solid #aaa", padding:"3px 8px", fontWeight: ri===0?"bold":"normal", textAlign:"center" }}>{cell}</td>
                      ))}
                    </tr>
                  ))}
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
 
      {/* Nav */}
      <div style={{ display:"flex", justifyContent:"flex-end", gap:10, marginTop:18 }}>
        <button onClick={onBack} style={{ background:"transparent", border:`1.5px solid ${C.border}`, padding:"9px 20px", borderRadius:6, fontSize:13, cursor:"pointer", color:C.inkMid }}>← Back</button>
        <button onClick={onNext} style={{ background:C.accent, color:"white", border:"none", padding:"9px 22px", borderRadius:6, fontSize:13, fontWeight:600, cursor:"pointer" }}>Next →</button>
      </div>
    </div>
  );
}
 
// ─── Validation banner ────────────────────────────────────────────────────────
function ValidationBanner({ errors }) {
  if (!errors.length) return null;
  return (
    <div style={{ background:"#fff3cd", border:"1.5px solid #f0c040", borderRadius:8, padding:"12px 16px", marginBottom:16 }}>
      <div style={{ fontSize:13, fontWeight:700, color:"#7a5000", marginBottom:5 }}>Please fix the following before previewing:</div>
      {errors.map((e,i)=><div key={i} style={{ fontSize:12, color:"#7a5000" }}>• {e}</div>)}
    </div>
  );
}
 
// ─── Dot indicator ────────────────────────────────────────────────────────────
function Dot({ done, active, label }) {
  return (
    <span style={{ width:16, height:16, borderRadius:"50%", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", fontSize:9, background: done?C.green:(active?C.accent:C.border), color: done||active?"white":C.inkLight }}>
      {done?"✓":label}
    </span>
  );
}
 
// ─── Add section widget ───────────────────────────────────────────────────────
function AddSecWidget({ triggerId, afterIdx, addingSectionAfter, setAddingSectionAfter, newSectionName, setNewSectionName, addCustomSection }) {
  if (addingSectionAfter===triggerId) {
    return (
      <div style={{ padding:"4px 4px", display:"flex", gap:4 }}>
        <input
          style={{ flex:1, padding:"5px 8px", border:`1.5px solid ${C.accent}`, borderRadius:5, fontSize:12, color:C.ink, background:"white", outline:"none" }}
          placeholder="Section name…" value={newSectionName} onChange={e=>setNewSectionName(e.target.value)}
          onKeyDown={e=>{ if(e.key==="Enter") addCustomSection(afterIdx); if(e.key==="Escape"){setAddingSectionAfter(null);setNewSectionName("");} }}
          autoFocus
        />
        <button style={{ background:C.accent, color:"white", border:"none", borderRadius:5, padding:"4px 10px", fontSize:12, cursor:"pointer" }} onClick={()=>addCustomSection(afterIdx)}>+</button>
        <button style={{ background:"transparent", border:`1px solid ${C.border}`, borderRadius:5, padding:"4px 7px", fontSize:12, cursor:"pointer", color:C.inkLight }} onClick={()=>{setAddingSectionAfter(null);setNewSectionName("");}}>✕</button>
      </div>
    );
  }
  return (
    <button onClick={()=>{setAddingSectionAfter(triggerId);setNewSectionName("");}}
      style={{ border:`1.5px dashed ${C.border}`, background:"transparent", color:C.inkLight, fontSize:11, padding:"3px 8px", borderRadius:5, cursor:"pointer", width:"100%", textAlign:"center", margin:"2px 0" }}
      onMouseEnter={e=>{e.currentTarget.style.borderColor=C.accent;e.currentTarget.style.color=C.accent;e.currentTarget.style.background=C.accentLight;}}
      onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.color=C.inkLight;e.currentTarget.style.background="transparent";}}>
      + add section here
    </button>
  );
}
 
// ─── MAIN APP ─────────────────────────────────────────────────────────────────
const LS_KEY = "medhasya_v3";
const defaultPaper = { title:"", authors:[{name:"",affiliation:"",email:""}], keywords:"", abstract:"", sections:{} };
 
export default function MedhasyaApp() {
  const [fmt, setFmt]           = useState("IEEE");
  const [phase, setPhase]       = useState("format");
  const [paper, setPaper]       = useState(defaultPaper);
  const [refs, setRefs]         = useState([]);
  const [activeSec, setActiveSec] = useState(0);
  const [copied, setCopied]     = useState(false);
  const [valErrors, setValErrors] = useState([]);
  const [customSecs, setCustomSecs] = useState([]);
  const [addingAfter, setAddingAfter] = useState(null);
  const [newSecName, setNewSecName]   = useState("");
  const [renamingId, setRenamingId]   = useState(null);
  const [renameVal, setRenameVal]     = useState("");
 
  // Auto-save
  useEffect(()=>{ try{ const s=localStorage.getItem(LS_KEY); if(s){const d=JSON.parse(s);if(d.paper)setPaper(d.paper);if(d.refs)setRefs(d.refs);if(d.fmt)setFmt(d.fmt);if(d.customSecs)setCustomSecs(d.customSecs);} }catch(_){} },[]);
  useEffect(()=>{ try{ localStorage.setItem(LS_KEY,JSON.stringify({paper,refs,fmt,customSecs})); }catch(_){} },[paper,refs,fmt,customSecs]);
 
  const clearSaved = () => { try{localStorage.removeItem(LS_KEY);}catch(_){} setPaper(defaultPaper);setRefs([]);setCustomSecs([]);setFmt("IEEE");setActiveSec(0);setPhase("format"); };
 
  const format      = FORMATS[fmt];
  const fixedSecs   = format.sections;
 
  const buildBodySections = () => {
    const slots = fixedSecs.map((s,i)=>({ items:[{id:`fixed_${i}`,name:s,type:"fixed"}] }));
    customSecs.forEach(cs=>{
      const ai = cs.insertAfterIdx ?? fixedSecs.length-1;
      const si = Math.max(0,Math.min(ai+1, slots.length-1));
      slots[si].items.push({id:cs.id,name:cs.name,type:"custom",insertAfterIdx:cs.insertAfterIdx});
    });
    return slots.flatMap(s=>s.items);
  };
  const allBodySecs = buildBodySections();
  const navItems    = ["meta","abstract",...allBodySecs.map(s=>s.id),"references"];
  const curId       = navItems[activeSec];
  const curSec      = allBodySecs.find(s=>s.id===curId);
 
  const totalWords  = wordCount(paper.abstract) + allBodySecs.reduce((a,s)=>a+wordCount(getSectionData(paper,s.name).text||""),0);
  const filledCount = (paper.abstract?1:0) + allBodySecs.filter(s=>(getSectionData(paper,s.name).text||"").trim()).length;
 
  // Custom section ops
  const addCustomSec = (insertAfterIdx) => {
    const name=newSecName.trim(); if(!name) return;
    setCustomSecs(cs=>[...cs,{id:`custom_${Date.now()}`,name,insertAfterIdx}]);
    setNewSecName(""); setAddingAfter(null);
  };
  const removeCustomSec = (id) => {
    const sec=customSecs.find(s=>s.id===id);
    if(sec){ const k=sKey(sec.name); setPaper(p=>{ const ns={...p.sections}; delete ns[k]; return{...p,sections:ns}; }); }
    setCustomSecs(cs=>cs.filter(s=>s.id!==id));
    if(curId===id) setActiveSec(0);
  };
  const renameCustomSec = (id) => {
    const name=renameVal.trim(); if(!name){setRenamingId(null);return;}
    const sec=customSecs.find(s=>s.id===id);
    if(sec){
      const oldD=getSectionData(paper,sec.name); const ok=sKey(sec.name); const nk=sKey(name);
      setPaper(p=>{ const ns={...p.sections}; delete ns[ok]; ns[nk]=oldD; return{...p,sections:ns}; });
      setCustomSecs(cs=>cs.map(s=>s.id===id?{...s,name}:s));
    }
    setRenamingId(null); setRenameVal("");
  };
  const moveCustomSec = (id, dir) => {
    const ci=allBodySecs.findIndex(s=>s.id===id); const ti=ci+dir;
    if(ti<0||ti>=allBodySecs.length) return;
    const nb=allBodySecs[ti];
    setCustomSecs(cs=>{
      const me=cs.find(s=>s.id===id); if(!me) return cs;
      if(nb.type==="custom"){
        const nb2=cs.find(s=>s.id===nb.id); const mi=me.insertAfterIdx; const ni=nb2.insertAfterIdx;
        return cs.map(s=>s.id===id?{...s,insertAfterIdx:ni}:s.id===nb.id?{...s,insertAfterIdx:mi}:s);
      } else {
        const fi=fixedSecs.indexOf(nb.name); const ni=dir===-1?fi-1:fi;
        return cs.map(s=>s.id===id?{...s,insertAfterIdx:Math.max(-1,ni)}:s);
      }
    });
  };
 
  // Author ops
  const addAuthor    = ()=>setPaper(p=>({...p,authors:[...p.authors,{name:"",affiliation:"",email:""}]}));
  const removeAuthor = (i)=>setPaper(p=>({...p,authors:p.authors.filter((_,x)=>x!==i)}));
  const updateAuthor = (i,f,v)=>setPaper(p=>({...p,authors:p.authors.map((a,x)=>x===i?{...a,[f]:v}:a)}));
 
  // Ref ops
  const addRef    = ()=>setRefs(r=>[...r,{authors:[],year:"",title:"",journal:"",volume:"",issue:"",pages:"",doi:"",booktitle:""}]);
  const removeRef = (i)=>setRefs(r=>r.filter((_,x)=>x!==i));
  const updateRef = (i,f,v)=>setRefs(r=>r.map((ref,x)=>x===i?{...ref,[f]:v}:ref));
 
  // Validation
  const validate = () => {
    const err=[];
    if(!paper.title.trim()) err.push("Paper title is required.");
    if(!paper.abstract.trim()) err.push("Abstract is required.");
    if(allBodySecs.filter(s=>(getSectionData(paper,s.name).text||"").trim()).length===0) err.push("At least one body section needs content.");
    paper.authors.forEach((a,i)=>{ if(a.email&&!isValidEmail(a.email)) err.push(`Author ${i+1} email is invalid.`); });
    return err;
  };
  const goPreview = ()=>{ const e=validate(); if(e.length){setValErrors(e);return;} setValErrors([]); setPhase("preview"); };
 
  // Exports
  const exportMd = ()=>{
    const lines=[`# ${paper.title}`,"",`**Format:** ${format.full}`];
    if(paper.keywords) lines.push(`**Keywords:** ${paper.keywords}`);
    lines.push("");
    if(paper.abstract) lines.push("## Abstract",paper.abstract,"");
    allBodySecs.forEach((s,i)=>{ const d=getSectionData(paper,s.name); const t=d.text||""; if(t) lines.push(`## ${getSectionNum(fmt,i)} ${s.name}`,t,""); });
    if(refs.length){ lines.push("## References"); refs.forEach((r,i)=>lines.push(formatCitation(r,i,format.citationStyle).full)); }
    const blob=new Blob([lines.join("\n")],{type:"text/markdown"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a"); a.href=url; a.download=`${paper.title.replace(/\s+/g,"_")||"paper"}.md`; a.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  const copyText = async ()=>{
    const lines=[paper.title,""];
    if(paper.abstract) lines.push("ABSTRACT",paper.abstract,"");
    allBodySecs.forEach((s,i)=>{ const t=getSectionData(paper,s.name).text||""; if(t) lines.push(`${getSectionNum(fmt,i)} ${s.name.toUpperCase()}`,t,""); });
    if(refs.length){ lines.push("REFERENCES"); refs.forEach((r,i)=>lines.push(formatCitation(r,i,format.citationStyle).full)); }
    const text=lines.join("\n");
    try{ await navigator.clipboard.writeText(text); }
    catch(_){ try{ const ta=document.createElement("textarea");ta.value=text;ta.style.position="fixed";ta.style.opacity="0";document.body.appendChild(ta);ta.focus();ta.select();document.execCommand("copy");document.body.removeChild(ta); }catch(__){ alert("Copy failed. Use Ctrl+A in preview to select all."); return; } }
    setCopied(true); setTimeout(()=>setCopied(false),2000);
  };
 
  // ── PHASE 1: Format Selection ────────────────────────────────────────────────
  if(phase==="format") return (
    <div style={{ minHeight:"100vh", background:C.bg, fontFamily:"system-ui, sans-serif" }}>
      <style>{`*{box-sizing:border-box;margin:0;padding:0;} .fc{border:2px solid ${C.border};border-radius:8px;padding:20px;cursor:pointer;transition:all .18s;background:white;} .fc:hover{border-color:${C.accent};box-shadow:0 0 0 3px ${C.accentLight};} .fc.sel{border-color:${C.accent};background:${C.accentLight};}`}</style>
      <header style={{ padding:"16px 28px", borderBottom:`1px solid ${C.border}`, background:"white", display:"flex", alignItems:"center", gap:12 }}>
        <div style={{ width:32,height:32,background:C.accent,borderRadius:6,display:"flex",alignItems:"center",justifyContent:"center" }}><span style={{ color:"white",fontSize:16,fontWeight:700 }}>M</span></div>
        <span style={{ fontWeight:700,fontSize:17,color:C.ink }}>Medhasya AI</span>
        <span style={{ fontSize:12,color:C.inkLight }}>· Research Paper Formatter</span>
        <div style={{ marginLeft:"auto",display:"flex",gap:10,alignItems:"center" }}>
          <span style={{ fontSize:12,background:C.greenLight,color:C.green,padding:"3px 10px",borderRadius:100,fontWeight:600 }}>Free</span>
          {paper.title && <button onClick={()=>setPhase("input")} style={{ background:C.accent,color:"white",border:"none",padding:"8px 16px",borderRadius:6,fontSize:13,fontWeight:600,cursor:"pointer" }}>Resume Draft →</button>}
        </div>
      </header>
      <div style={{ padding:"44px 24px", maxWidth:760, margin:"0 auto" }}>
        <div style={{ textAlign:"center", marginBottom:36 }}>
          <h1 style={{ fontSize:28,fontWeight:700,color:C.ink,marginBottom:10 }}>Choose your paper format</h1>
          <p style={{ fontSize:14,color:C.inkMid,lineHeight:1.6 }}>Pick your target journal or conference. Add text, images, and tables per section.</p>
        </div>
        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:24 }}>
          {Object.entries(FORMATS).map(([k,f])=>(
            <div key={k} className={`fc${fmt===k?" sel":""}`} onClick={()=>setFmt(k)}>
              <div style={{ display:"flex",justifyContent:"space-between",marginBottom:10 }}>
                <span style={{ fontSize:17,fontWeight:700,color:fmt===k?C.accent:C.ink }}>{f.name}</span>
                {fmt===k && <span style={{ fontSize:11,background:C.accent,color:"white",padding:"2px 8px",borderRadius:100 }}>SELECTED</span>}
              </div>
              <p style={{ fontSize:12,color:C.inkLight,marginBottom:8 }}>{f.full}</p>
              <div style={{ fontSize:12,color:C.inkMid,marginBottom:3 }}><strong>Layout:</strong> {f.columns==="double"?"Two-column (IEEE style)":"Single-column"}</div>
              <div style={{ fontSize:12,color:C.inkMid,marginBottom:3 }}><strong>Citations:</strong> {f.citationStyle==="numeric"?"Numeric [1]":"Author-Year"}</div>
              <div style={{ fontSize:12,color:C.inkMid }}><strong>Sections:</strong> {f.sections.join(" → ")}</div>
            </div>
          ))}
        </div>
        <div style={{ background:C.goldLight,border:"1px solid #e0c85a",borderRadius:8,padding:14,marginBottom:24,fontSize:13,color:"#7a6000" }}>
          <strong>What's supported:</strong> Text content per section · Upload images/figures with captions · Build data tables · Add custom sections anywhere · Auto-formatted references · Two-column layout for IEEE/ACM · Auto-save in browser
        </div>
        <div style={{ display:"flex",justifyContent:"center",gap:12 }}>
          <button onClick={()=>setPhase("input")} style={{ background:C.accent,color:"white",border:"none",padding:"13px 36px",borderRadius:6,fontSize:15,fontWeight:600,cursor:"pointer" }}>
            Start with {fmt} →
          </button>
          {paper.title && <button onClick={clearSaved} style={{ background:"transparent",border:`1px solid ${C.red}`,color:C.red,padding:"13px 20px",borderRadius:6,fontSize:13,cursor:"pointer" }}>Clear draft</button>}
        </div>
      </div>
    </div>
  );
 
  // ── PHASE 2: Input ───────────────────────────────────────────────────────────
  if(phase==="input") return (
    <div style={{ minHeight:"100vh",background:C.bg,fontFamily:"system-ui, sans-serif",display:"flex",flexDirection:"column" }}>
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
 
      <header style={{ padding:"12px 22px",borderBottom:`1px solid ${C.border}`,background:"white",display:"flex",alignItems:"center",gap:14,position:"sticky",top:0,zIndex:20 }}>
        <button onClick={()=>setPhase("format")} style={{ border:"none",background:"none",cursor:"pointer",color:C.accent,fontSize:13,fontWeight:600 }}>← Format</button>
        <div style={{ width:1,height:20,background:C.border }}/>
        <span style={{ fontWeight:700,fontSize:15,color:C.ink }}>Medhasya AI</span>
        <span style={{ fontSize:12,color:C.inkLight,background:C.border,padding:"2px 8px",borderRadius:100 }}>{fmt}</span>
        <span style={{ fontSize:11,color:C.green }}>● auto-saved</span>
        <div style={{ marginLeft:"auto",display:"flex",gap:10,alignItems:"center" }}>
          <span style={{ fontSize:12,color:C.inkLight }}>{totalWords.toLocaleString()} words · {filledCount}/{allBodySecs.length+1} sections</span>
          <button onClick={goPreview} style={{ background:C.accent,color:"white",border:"none",padding:"9px 20px",borderRadius:6,fontSize:14,fontWeight:600,cursor:"pointer" }}>Preview Paper →</button>
        </div>
      </header>
 
      <div style={{ display:"flex",flex:1,minHeight:0 }}>
        {/* Sidebar */}
        <aside style={{ width:215,background:"white",borderRight:`1px solid ${C.border}`,padding:"13px 10px",flexShrink:0,overflowY:"auto" }}>
          <div style={{ fontSize:10,fontWeight:700,color:C.inkLight,letterSpacing:".12em",padding:"0 4px",marginBottom:10 }}>SECTIONS</div>
 
          <button className={`nt${curId==="meta"?" act":""}`} onClick={()=>setActiveSec(0)}>
            <Dot done={!!paper.title} active={curId==="meta"} label="1"/>Title & Authors
          </button>
          <button className={`nt${curId==="abstract"?" act":""}`} onClick={()=>setActiveSec(1)}>
            <Dot done={!!paper.abstract?.trim()} active={curId==="abstract"} label="2"/>Abstract
          </button>
 
          <AddSecWidget triggerId="before_all" afterIdx={-1} addingSectionAfter={addingAfter} setAddingSectionAfter={setAddingAfter} newSectionName={newSecName} setNewSectionName={setNewSecName} addCustomSection={addCustomSec}/>
 
          {allBodySecs.map((sec,idx)=>{
            const ni=navItems.indexOf(sec.id);
            const isAct=curId===sec.id;
            const data=getSectionData(paper,sec.name);
            const isDone=!!(data.text||"").trim()||(data.figures||[]).length>0||(data.tables||[]).length>0;
            const isCust=sec.type==="custom";
            const insertAI=isCust?(customSecs.find(c=>c.id===sec.id)?.insertAfterIdx??-1):idx;
            return (
              <div key={sec.id}>
                <div style={{ display:"flex",alignItems:"center",gap:2 }}>
                  <button className={`nt${isAct?" act":""}`} onClick={()=>setActiveSec(ni)} style={{ flex:1,minWidth:0 }}>
                    <Dot done={isDone} active={isAct} label={idx+3}/>
                    <span style={{ flex:1,overflow:"hidden",textOverflow:"ellipsis",display:"flex",alignItems:"center",gap:4 }}>
                      {isCust && <span style={{ fontSize:9,color:C.accent,flexShrink:0 }}>✦</span>}
                      {renamingId===sec.id ? (
                        <input value={renameVal} onChange={e=>setRenameVal(e.target.value)}
                          onKeyDown={e=>{if(e.key==="Enter")renameCustomSec(sec.id);if(e.key==="Escape")setRenamingId(null);}}
                          onBlur={()=>renameCustomSec(sec.id)} autoFocus onClick={e=>e.stopPropagation()}
                          style={{ width:"100%",border:"none",background:"transparent",fontSize:12,color:C.ink,outline:"none",padding:0 }}/>
                      ):sec.name}
                    </span>
                  </button>
                  {isCust && (
                    <div style={{ display:"flex",gap:1,flexShrink:0 }}>
                      <button className="sa" title="Move up"   onClick={()=>moveCustomSec(sec.id,-1)}>↑</button>
                      <button className="sa" title="Move down" onClick={()=>moveCustomSec(sec.id,1)}>↓</button>
                      <button className="sa" title="Rename"    onClick={()=>{setRenamingId(sec.id);setRenameVal(sec.name);}}>✎</button>
                      <button className="sa" title="Delete"    style={{ color:C.red }} onClick={()=>removeCustomSec(sec.id)}>✕</button>
                    </div>
                  )}
                </div>
                <AddSecWidget triggerId={sec.id} afterIdx={insertAI} addingSectionAfter={addingAfter} setAddingSectionAfter={setAddingAfter} newSectionName={newSecName} setNewSectionName={setNewSecName} addCustomSection={addCustomSec}/>
              </div>
            );
          })}
 
          <button className={`nt${curId==="references"?" act":""}`} onClick={()=>setActiveSec(navItems.indexOf("references"))}>
            <Dot done={refs.length>0} active={curId==="references"} label="R"/>References
          </button>
 
          <div style={{ marginTop:14,padding:"8px 6px",borderTop:`1px solid ${C.border}`,fontSize:11,color:C.inkLight,lineHeight:1.7 }}>
            <div><span style={{ color:C.accent }}>✦</span> Custom · ↑↓ reorder · ✎ rename · ✕ delete</div>
          </div>
        </aside>
 
        {/* Main */}
        <main style={{ flex:1,overflowY:"auto",padding:"28px 36px",maxWidth:820 }}>
          {valErrors.length>0 && <ValidationBanner errors={valErrors}/>}
 
          {/* META */}
          {curId==="meta" && (
            <div>
              <h2 style={{ fontSize:20,fontWeight:700,color:C.ink,marginBottom:6 }}>Title & Authors</h2>
              <p style={{ fontSize:13,color:C.inkLight,marginBottom:22 }}>Enter the paper title, authors, and keywords.</p>
              <div style={{ marginBottom:16 }}>
                <label className="fl">Paper Title *</label>
                <input className={`fi${!paper.title.trim()&&valErrors.length?" err":""}`} placeholder="e.g., Deep Learning-Based Anomaly Detection in IoT Networks" value={paper.title} onChange={e=>setPaper(p=>({...p,title:e.target.value}))}/>
              </div>
              <div style={{ marginBottom:16 }}>
                <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10 }}>
                  <label className="fl" style={{ margin:0 }}>Authors</label>
                  <button onClick={addAuthor} style={{ border:`1px solid ${C.border}`,background:"transparent",padding:"5px 12px",borderRadius:5,fontSize:12,cursor:"pointer",color:C.inkMid }}>+ Add Author</button>
                </div>
                {paper.authors.map((a,i)=>(
                  <div key={i} style={{ border:`1px solid ${C.border}`,borderRadius:8,padding:13,marginBottom:10,background:"#fafaf9" }}>
                    <div style={{ display:"flex",justifyContent:"space-between",marginBottom:9 }}>
                      <span style={{ fontSize:12,fontWeight:600,color:C.inkLight }}>Author {i+1}</span>
                      {paper.authors.length>1 && <button onClick={()=>removeAuthor(i)} style={{ background:"transparent",color:C.red,border:`1px solid ${C.border}`,padding:"3px 10px",borderRadius:5,fontSize:12,cursor:"pointer" }}>Remove</button>}
                    </div>
                    <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:9,marginBottom:9 }}>
                      <div><label className="fl">Full Name</label><input className="fi" placeholder="Priya Sharma" value={a.name} onChange={e=>updateAuthor(i,"name",e.target.value)}/></div>
                      <div>
                        <label className="fl">Email</label>
                        <input className={`fi${a.email&&!isValidEmail(a.email)?" err":""}`} placeholder="priya@nit.edu" value={a.email} onChange={e=>updateAuthor(i,"email",e.target.value)}/>
                        {a.email&&!isValidEmail(a.email) && <div style={{ fontSize:11,color:C.red,marginTop:2 }}>Invalid email</div>}
                      </div>
                    </div>
                    <div><label className="fl">Affiliation</label><input className="fi" placeholder="Dept. of CSE, NIT Warangal, India" value={a.affiliation} onChange={e=>updateAuthor(i,"affiliation",e.target.value)}/></div>
                  </div>
                ))}
              </div>
              <div style={{ marginBottom:18 }}>
                <label className="fl">Keywords (comma-separated)</label>
                <input className="fi" placeholder="deep learning, anomaly detection, IoT, LSTM" value={paper.keywords} onChange={e=>setPaper(p=>({...p,keywords:e.target.value}))}/>
              </div>
              <button onClick={()=>setActiveSec(1)} style={{ background:C.accent,color:"white",border:"none",padding:"10px 22px",borderRadius:6,fontSize:14,fontWeight:600,cursor:"pointer" }}>Next: Abstract →</button>
            </div>
          )}
 
          {/* ABSTRACT */}
          {curId==="abstract" && (
            <div>
              <h2 style={{ fontSize:20,fontWeight:700,color:C.ink,marginBottom:6 }}>Abstract</h2>
              <div style={{ background:C.goldLight,border:"1px solid #e0c85a",borderRadius:6,padding:"9px 13px",marginBottom:14,fontSize:12,color:"#6a5000" }}>
                <strong>{fmt} guideline:</strong>{" "}
                {fmt==="IEEE"?"150–250 words. Single paragraph, no citations, no equations.":fmt==="ACM"?"150–250 words. Describes problem, approach, and results.":fmt==="Springer"?"Up to 250 words. Single paragraph.":"150–300 words. Background, Objective, Methods, Results, Conclusions."}
              </div>
              <textarea className={`fi${!paper.abstract.trim()&&valErrors.length?" err":""}`} rows={10} placeholder="This paper presents a novel approach for…" value={paper.abstract} onChange={e=>setPaper(p=>({...p,abstract:e.target.value}))}/>
              <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:7 }}>
                <span style={{ fontSize:12,color:C.inkLight }}>{wordCount(paper.abstract)} words</span>
                <div style={{ display:"flex",gap:10 }}>
                  <button onClick={()=>setActiveSec(0)} style={{ background:"transparent",border:`1.5px solid ${C.border}`,padding:"8px 18px",borderRadius:6,fontSize:13,cursor:"pointer",color:C.inkMid }}>← Back</button>
                  <button onClick={()=>setActiveSec(2)} style={{ background:C.accent,color:"white",border:"none",padding:"8px 20px",borderRadius:6,fontSize:13,fontWeight:600,cursor:"pointer" }}>Next →</button>
                </div>
              </div>
            </div>
          )}
 
          {/* BODY SECTION */}
          {curSec && (
            <SectionEditor
              sec={curSec} paper={paper} setPaper={setPaper} fmt={fmt}
              onBack={()=>setActiveSec(a=>Math.max(0,a-1))}
              onNext={()=>setActiveSec(a=>Math.min(navItems.length-1,a+1))}
            />
          )}
 
          {/* REFERENCES */}
          {curId==="references" && (
            <div>
              <h2 style={{ fontSize:20,fontWeight:700,color:C.ink,marginBottom:6 }}>References</h2>
              <p style={{ fontSize:13,color:C.inkLight,marginBottom:8 }}>Auto-formatted in <strong>{format.citationStyle==="numeric"?"numeric [1] style":"Author-Year style"}</strong> per {fmt} rules.</p>
              <div style={{ background:C.goldLight,border:"1px solid #e0c85a",borderRadius:6,padding:"9px 13px",marginBottom:16,fontSize:12,color:"#6a5000" }}>
                <strong>Tip:</strong> For journals use Journal Name. For conferences use Book Title. DOI recommended.
              </div>
              {refs.length===0 && <div style={{ textAlign:"center",padding:"28px 0",color:C.inkLight,fontSize:14 }}>No references yet.</div>}
              {refs.map((ref,i)=>(
                <div key={i} style={{ border:`1px solid ${C.border}`,borderRadius:8,padding:13,marginBottom:11,background:"#fafaf9" }}>
                  <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:9 }}>
                    <span style={{ fontSize:13,fontWeight:700,color:C.accent }}>{format.citationStyle==="numeric"?`[${i+1}]`:`Ref ${i+1}`}</span>
                    <button onClick={()=>removeRef(i)} style={{ background:"transparent",color:C.red,border:`1px solid ${C.border}`,padding:"3px 10px",borderRadius:5,fontSize:12,cursor:"pointer" }}>Remove</button>
                  </div>
                  <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:9 }}>
                    <div style={{ gridColumn:"1 / -1" }}><label className="fl">Authors (one per line)</label><textarea className="fi" rows={2} placeholder={"J. Smith\nA. Kumar"} value={ref.authors.join("\n")} onChange={e=>updateRef(i,"authors",e.target.value.split("\n").filter(Boolean))}/></div>
                    <div style={{ gridColumn:"1 / -1" }}><label className="fl">Title</label><input className="fi" placeholder="Paper / Article Title" value={ref.title} onChange={e=>updateRef(i,"title",e.target.value)}/></div>
                    <div><label className="fl">Journal</label><input className="fi" placeholder="IEEE Trans. Neural Networks" value={ref.journal} onChange={e=>updateRef(i,"journal",e.target.value)}/></div>
                    <div><label className="fl">Book Title (Conference)</label><input className="fi" placeholder="Proc. CVPR 2024" value={ref.booktitle} onChange={e=>updateRef(i,"booktitle",e.target.value)}/></div>
                    <div><label className="fl">Year</label><input className="fi" placeholder="2024" value={ref.year} onChange={e=>updateRef(i,"year",e.target.value)}/></div>
                    <div><label className="fl">Volume</label><input className="fi" placeholder="34" value={ref.volume} onChange={e=>updateRef(i,"volume",e.target.value)}/></div>
                    <div><label className="fl">Issue</label><input className="fi" placeholder="2" value={ref.issue} onChange={e=>updateRef(i,"issue",e.target.value)}/></div>
                    <div><label className="fl">Pages</label><input className="fi" placeholder="112-128" value={ref.pages} onChange={e=>updateRef(i,"pages",e.target.value)}/></div>
                    <div style={{ gridColumn:"1 / -1" }}><label className="fl">DOI</label><input className="fi" placeholder="10.1109/TNN.2023.001" value={ref.doi} onChange={e=>updateRef(i,"doi",e.target.value)}/></div>
                  </div>
                  {(ref.title||ref.authors.length>0) && (
                    <div style={{ background:C.accentLight,borderRadius:5,padding:"7px 11px",fontSize:12,color:C.accent,marginTop:9 }}>
                      <strong>Preview:</strong> {formatCitation(ref,i,format.citationStyle).full}
                    </div>
                  )}
                </div>
              ))}
              <button onClick={addRef} style={{ width:"100%",textAlign:"center",marginBottom:18,padding:"10px 0",border:`1.5px dashed ${C.border}`,borderRadius:6,background:"transparent",color:C.inkMid,fontSize:13,cursor:"pointer" }}>+ Add Reference</button>
              <div style={{ display:"flex",gap:10 }}>
                <button onClick={()=>setActiveSec(a=>a-1)} style={{ background:"transparent",border:`1.5px solid ${C.border}`,padding:"9px 20px",borderRadius:6,fontSize:13,cursor:"pointer",color:C.inkMid }}>← Back</button>
                <button onClick={goPreview} style={{ flex:1,background:C.accent,color:"white",border:"none",padding:"12px",borderRadius:6,fontSize:15,fontWeight:600,cursor:"pointer" }}>Preview Formatted Paper →</button>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
 
  // ── PHASE 3: Preview ─────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight:"100vh",background:"#ddd",fontFamily:"system-ui, sans-serif" }}>
      <style>{`*{box-sizing:border-box;margin:0;padding:0;} @media print{header,.np{display:none!important;}}`}</style>
      <header style={{ padding:"11px 22px",background:C.ink,display:"flex",alignItems:"center",gap:13,position:"sticky",top:0,zIndex:10 }}>
        <button onClick={()=>setPhase("input")} style={{ border:"none",background:"transparent",cursor:"pointer",color:"#aaa",fontSize:13 }}>← Edit</button>
        <div style={{ width:1,height:20,background:"#444" }}/>
        <span style={{ color:"white",fontWeight:700,fontSize:14,maxWidth:320,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{paper.title||"Untitled"}</span>
        <span style={{ fontSize:12,background:"#333",color:"#aaa",padding:"2px 8px",borderRadius:100 }}>{fmt}</span>
        <span style={{ fontSize:12,color:"#888" }}>{totalWords.toLocaleString()} words</span>
        <div style={{ marginLeft:"auto",display:"flex",gap:9 }}>
          <button onClick={copyText} style={{ background:"white",color:C.inkMid,border:`1.5px solid ${C.border}`,padding:"7px 15px",borderRadius:6,fontSize:13,cursor:"pointer" }}>{copied?"✓ Copied!":"Copy Text"}</button>
          <button onClick={exportMd} style={{ background:"white",color:C.inkMid,border:`1.5px solid ${C.border}`,padding:"7px 15px",borderRadius:6,fontSize:13,cursor:"pointer" }}>↓ Markdown</button>
          <button onClick={()=>window.print()} style={{ background:C.accent,color:"white",border:"none",padding:"7px 18px",borderRadius:6,fontSize:13,fontWeight:600,cursor:"pointer" }}>Print / PDF</button>
        </div>
      </header>
      <PaperPreview paper={paper} fmt={fmt} allBodySections={allBodySecs} refs={refs}/>
      <div className="np" style={{ textAlign:"center",padding:"14px 0 32px",fontSize:12,color:"#888" }}>
        Medhasya AI · {format.full} · Print → Save as PDF
      </div>
    </div>
  );
}
