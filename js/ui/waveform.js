import { hex } from "../core/bytes.js";

const fmtUs = us => us >= 1000 ? `${(us / 1000).toFixed(3)} ms` : `${us.toFixed(2)} µs`;
const fmtPct = n => `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;

export function clearWaveformPreview(container) {
    container.replaceChildren();
    container.classList.add("empty-preview");
    container.textContent = "Change protocol values to preview the generated RF waveform.";
}

export function renderWaveformPreview(container, encoded) {
    container.replaceChildren();
    container.classList.remove("empty-preview");
    if (!encoded?.waveform) return clearWaveformPreview(container);

    const a = encoded.analysis ?? null;
    const stats = document.createElement("div");
    stats.className = "waveform-stats";
    const items = a ? [
        ["RF symbols", String(a.symbols)],
        ["Symbol rate", `${a.actualSymbolRate.toFixed(2)} /s`],
        ["Symbol period", fmtUs(a.symbolPeriodUs)],
        ["Duration", fmtUs(a.durationUs)],
        ["TX bytes", String(encoded.bytes?.length ?? 0)],
        ["Padding", `${encoded.padding ?? 0} bit(s)`],
    ] : [
        ["RF symbols", String(encoded.waveform.length)],
        ["Symbol rate", "Current radio"],
        ["Symbol period", "—"],
        ["Duration", "—"],
        ["TX bytes", String(encoded.bytes?.length ?? 0)],
        ["Padding", `${encoded.padding ?? 0} bit(s)`],
    ];
    for (const [k,v] of items) {
        const x=document.createElement("div");
        x.innerHTML=`<span>${k}</span><strong>${v}</strong>`;
        stats.appendChild(x);
    }
    container.appendChild(stats);

    if (encoded.modulation) addLine(container, "Modulation", encoded.modulation);
    if (encoded.packetBytes instanceof Uint8Array) addLine(container, "Packet", hex(encoded.packetBytes));
    if (encoded.bits) addLine(container, "Logical bits", encoded.bits);

    const canvas=document.createElement("canvas");
    canvas.className="waveform-canvas";
    canvas.width=1200;
    canvas.height=180;
    container.appendChild(canvas);
    drawWaveform(canvas, encoded.waveform, encoded.modulation);

    const caption=document.createElement("div");
    caption.className="waveform-caption";
    const base=`Showing first ${Math.min(encoded.waveform.length, 160)} of ${encoded.waveform.length} RF symbols`;
    caption.textContent=a
        ? `${base} · requested ${a.requestedSymbolRate.toFixed(2)}/s · rate error ${fmtPct(a.rateErrorPercent)}`
        : `${base} · timing follows the current radio configuration`;
    container.appendChild(caption);

    if (a?.timings?.length) {
        const table=document.createElement("table");
        table.className="timing-table";
        table.innerHTML="<thead><tr><th>Element</th><th>Symbols</th><th>Desired</th><th>Actual</th><th>Error</th></tr></thead>";
        const body=document.createElement("tbody");
        for (const t of a.timings) {
            const tr=document.createElement("tr");
            tr.innerHTML=`<td>${t.name}</td><td>${t.symbols}</td><td>${t.requestedUs == null ? "—" : fmtUs(t.requestedUs)}</td><td>${fmtUs(t.actualUs)}</td><td>${t.errorPercent == null ? "—" : fmtPct(t.errorPercent)}</td>`;
            body.appendChild(tr);
        }
        table.appendChild(body);
        container.appendChild(table);
    }
}

function addLine(container, label, value) {
    const p=document.createElement("div");
    p.className="waveform-line";
    const span=document.createElement("span");
    span.textContent=label;
    const code=document.createElement("code");
    code.textContent=value;
    p.append(span, code);
    container.appendChild(p);
}

function drawWaveform(canvas, waveform, modulation = "") {
    const ctx=canvas.getContext("2d"), dpr=window.devicePixelRatio || 1;
    const cssW=canvas.clientWidth || 900, cssH=180;
    canvas.width=Math.round(cssW*dpr);
    canvas.height=Math.round(cssH*dpr);
    ctx.scale(dpr,dpr);
    ctx.clearRect(0,0,cssW,cssH);
    const left=18,right=12,top=25,bottom=28, hi=top+18,lo=cssH-bottom-18;
    const count=Math.min(waveform.length,160), step=(cssW-left-right)/Math.max(count,1);
    ctx.strokeStyle="#263244";
    ctx.lineWidth=1;
    ctx.beginPath();
    ctx.moveTo(left,hi); ctx.lineTo(cssW-right,hi);
    ctx.moveTo(left,lo); ctx.lineTo(cssW-right,lo);
    ctx.stroke();
    ctx.strokeStyle="#59a6ff";
    ctx.lineWidth=2;
    ctx.beginPath();
    let prev=null;
    for(let i=0;i<count;i++){
        const y=waveform[i]==="1"?hi:lo, x=left+i*step;
        if(i===0) ctx.moveTo(x,y);
        else { if(y!==prev) ctx.lineTo(x,prev); ctx.lineTo(x,y); }
        prev=y;
    }
    if (prev !== null) ctx.lineTo(left+count*step,prev);
    ctx.stroke();
    ctx.fillStyle="#8190a3";
    ctx.font="11px system-ui";
    const fsk=String(modulation).includes("FSK");
    ctx.fillText(fsk ? "+DEV" : "HIGH",left,12);
    ctx.fillText(fsk ? "-DEV" : "LOW",left,cssH-7);
}
