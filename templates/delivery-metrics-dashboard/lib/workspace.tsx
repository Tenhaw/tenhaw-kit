"use client";

import { useEffect, useState, type ReactNode } from "react";
import { buildUtmUrl } from "@tenhaw/core";

export function useWorkspace<T>(key: string, sample: T, validate: (value: unknown) => T) {
  const [data, setData] = useState<T>(sample);
  const [notice, setNotice] = useState("Synthetic examples. Import your own file to begin.");
  const [ready, setReady] = useState(false);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(key);
      if (saved) { setData(validate(JSON.parse(saved))); setNotice("Restored from this browser."); }
    } catch { setNotice("Saved data could not be read. Synthetic examples loaded."); }
    setReady(true);
  }, [key, validate]);
  useEffect(() => {
    if (!ready) return;
    try { localStorage.setItem(key, JSON.stringify(data)); }
    catch { setNotice("Browser storage is unavailable or full. Export a JSON copy to keep your work."); }
  }, [data, key, ready]);
  function reset() { setData(sample); setNotice("Synthetic examples restored."); }
  function clear() { localStorage.removeItem(key); setNotice("Saved copy removed. Export anything you need before closing this tab."); }
  return { data, setData, notice, setNotice, reset, clear };
}

export function download(name: string, data: unknown, type = "application/json") {
  const body = typeof data === "string" ? data : JSON.stringify(data, null, 2);
  const url = URL.createObjectURL(new Blob([body], { type }));
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = name; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function Workspace({ title, description, section, setSection, sections, children, actions, notice }: {
  title: string; description: string; section: string; setSection: (section: string) => void;
  sections: string[]; children: ReactNode; actions?: ReactNode; notice: string;
}) {
  return <div className="workspace"><a className="skip" href="#workspace-main">Skip to workspace</a><aside className="sidebar"><div className="brand"><span className="mark" aria-hidden="true">t.</span><span>tenhaw<span className="muted"> / kit</span></span></div><span className="eyebrow">INTERNAL WORKSPACE</span><nav aria-label="Workspace views">{sections.map(item => <button key={item} type="button" aria-current={item === section ? "page" : undefined} className={item === section ? "nav active" : "nav"} onClick={() => setSection(item)}>{item}</button>)}</nav><div className="sidebar-note"><span className="dot" /> Local workspace<p>Data stays in this browser.</p><small>No account, shared database or usage tracking.</small></div></aside><main id="workspace-main"><header><div><p className="eyebrow">TENHAW KIT / {section.toUpperCase()}</p><h1>{title}</h1><p className="lede">{description}</p></div></header><div className="toolbar">{actions}</div><p className="notice" role="status">{notice}</p>{children}<footer>{process.env.NEXT_PUBLIC_TENHAW_ATTRIBUTION !== "false" && <span>Built with Tenhaw Kit. <a href={buildUtmUrl({source:"template",medium:"footer",content:title.toLowerCase().replaceAll(" ","-")})}>Get help applying this</a></span>}<span>Imported records stay on this device. Export before clearing browser storage.</span></footer></main></div>;
}

export function FileActions<T>({data, name, onImport, onError, reset, csv}: {data:T;name:string;onImport:(text:string,extension:string)=>void;onError:(message:string)=>void;reset:()=>void;csv?:string}) {
 return <><label className="button primary">Import {csv !== undefined ? "CSV / JSON" : "JSON"}<input type="file" accept={csv !== undefined ? ".json,.csv" : ".json"} onChange={async event => { const file = event.target.files?.[0]; event.target.value=""; if (!file) return; if (file.size > 2_000_000) {onError("Choose a file under 2 MB."); return;} try {onImport(await file.text(), file.name.toLowerCase().endsWith(".csv") ? "csv" : "json");} catch(error) {onError(error instanceof Error ? error.message : "Could not import this file.");} }} /></label><button type="button" onClick={()=>download(name+".json",data)}>Export JSON</button>{csv !== undefined && <button type="button" onClick={()=>download(name+".csv",csv,"text/csv;charset=utf-8")}>Export CSV</button>}<button type="button" className="subtle" onClick={reset}>Reset to example</button></>;
}
export function Stats({items}:{items:{label:string;value:ReactNode;note?:string}[]}) { return <div className="stats">{items.map(item=><article key={item.label} className="stat"><span>{item.label}</span><strong>{item.value}</strong>{item.note && <small>{item.note}</small>}</article>)}</div>; }
export function Panel({title,children,aside}:{title:string;children:ReactNode;aside?:string}) { return <section className="panel"><div className="panel-heading"><h2>{title}</h2>{aside && <small>{aside}</small>}</div>{children}</section>; }
export function Bar({label,value,max=100,detail}:{label:string;value:number;max?:number;detail?:string}) {return <div className="bar-row"><div><span>{label}</span><strong>{detail ?? `${Math.round(value)}%`}</strong></div><div className="track"><span style={{width:`${Math.min(100,Math.max(0,max > 0 ? value/max*100 : 0))}%`}} /></div></div>;}
export function Table({headers,rows}:{headers:string[];rows:ReactNode[][]}) {return <div className="table-scroll"><table><thead><tr>{headers.map(header=><th key={header} scope="col">{header}</th>)}</tr></thead><tbody>{rows.map((row,i)=><tr key={i}>{row.map((cell,j)=><td key={j}>{cell}</td>)}</tr>)}</tbody></table>{rows.length===0&&<p className="empty">No records yet.</p>}</div>;}
export function JsonReport({value}:{value:unknown}) {return <details><summary>Inspect calculation output</summary><pre>{JSON.stringify(value,null,2)}</pre></details>;}
export const number = (value:number|null, digits=1) => value === null ? "Insufficient data" : value.toLocaleString("en-GB",{maximumFractionDigits:digits});
