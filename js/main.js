/* The Cormoran — dossier chart engine (vanilla JS + SVG) */
(function () {
  "use strict";
  const D = window.DOSSIER;
  const SVGNS = "http://www.w3.org/2000/svg";

  const CITY_COLOR = {
    paris: "#0087A0", rome: "#C4452F", barcelona: "#4763D6",
    lisbon: "#8A6A00", berlin: "#B0448E", london: "#5C5344"
  };
  const SEQ = ["#D9E8E4", "#A6C9C4", "#68A0A2", "#337681", "#0B4F5C", "#06333B"];
  const INK2 = "#6B5F49", INK3 = "#93866C", LINE = "#DACDB2";

  /* Europe map mark style — flip this one line to switch. The first two share
     the same chrome: one petrol hue, the basemap tokens of the city dot maps,
     and all 23 cities named. No rate is printed on the map in any style — the
     desk keeps the figures in the table beneath it.
     "hollow" a pinpoint at the city with an outline ring around it. Area
              carries the rate and the map stays airy, so the names can sit
              over the circles. The desk's pick.
     "ink"    small filled discs on the dot maps' opacity ramp — half the size
              of the original, which is what frees the room for the names.
     "legacy" the original five-band petrol ramp, colour and area both encoding
              the rate, nine cities named. */
  const EUROPE_MAP_STYLE = "hollow";

  const fmtN = n => n.toLocaleString("en-GB");
  const svgEl = (tag, attrs) => {
    const e = document.createElementNS(SVGNS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  };
  const txt = (parent, x, y, str, attrs) => {
    const t = svgEl("text", Object.assign({ x, y, fill: INK2, "font-size": 12 }, attrs || {}));
    t.textContent = str;
    parent.appendChild(t);
    return t;
  };

  /* ---------- tooltip ---------- */
  function makeTip(container) {
    const tip = document.createElement("div");
    tip.className = "tip";
    container.appendChild(tip);
    let pinned = false;
    function place(html, px, py) {
      tip.innerHTML = html;
      tip.style.opacity = 1;
      const cw = container.clientWidth;
      const tw = tip.offsetWidth, th = tip.offsetHeight;
      let x = px + 14, y = py - th - 10;
      if (x + tw > cw - 4) x = px - tw - 14;
      if (x < 4) x = 4;
      if (y < 4) y = py + 16;
      tip.style.left = x + "px";
      tip.style.top = y + "px";
    }
    return {
      show(html, px, py) { if (!pinned) place(html, px, py); },
      hide() { if (!pinned) tip.style.opacity = 0; },
      pin(html, px, py) {
        pinned = true;
        tip.classList.add("pinned");
        place(html, px, py);
      },
      unpin() {
        pinned = false;
        tip.classList.remove("pinned");
        tip.style.opacity = 0;
      },
      isPinned() { return pinned; }
    };
  }


  /* ============================================================
     INTRO RAIL — small multiples: a decade of rents, shared scale
     ============================================================ */
  (function introRail() {
    const host = document.getElementById("rail-grid");
    if (!host) return;
    const years = D.rentIndex.years;
    // one shared domain for all six panels, so slopes are comparable
    const MINV = 95, MAXV = 205;
    const W = 300, H = 46, P = 4;
    const X = i => P + (W - P * 2) * (i / (years.length - 1));
    const Y = v => H - P - (H - P * 2) * ((v - MINV) / (MAXV - MINV));

    const keys = Object.keys(D.rentIndex.series)
      .sort((a, b) => last(b) - last(a));
    function last(k) {
      const v = D.rentIndex.series[k].vals;
      return v[v.length - 1];
    }

    for (const key of keys) {
      const vals = D.rentIndex.series[key].vals;
      const c = D.cities[key];
      const color = CITY_COLOR[key];
      const delta = last(key) - 100;

      const card = document.createElement("a");
      card.className = "sm";
      card.href = "#" + key;
      card.style.setProperty("--city", color);
      card.innerHTML =
        `<span class="sm-head"><span class="sm-name">${c.label}</span>` +
        `<span class="sm-delta">+${delta}%</span></span>` +
        `<span class="sm-spark"></span>` +
        `<span class="sm-foot">${fmtN(c.total)} listings · ${c.stockPct.toFixed(1)}% of homes</span>`;

      const svg = svgEl("svg", { viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: "none",
        role: "img", "aria-label": `${c.label} rents rose ${delta} per cent between 2015 and 2025` });
      // 2015 baseline
      svg.appendChild(svgEl("line", {
        x1: P, x2: W - P, y1: Y(100), y2: Y(100),
        stroke: INK3, "stroke-width": 1, "stroke-dasharray": "2 4"
      }));
      const d = vals.map((v, i) => (i ? "L" : "M") + X(i).toFixed(1) + " " + Y(v).toFixed(1)).join("");
      svg.appendChild(svgEl("path", {
        d, fill: "none", stroke: color, "stroke-width": 2,
        "stroke-linejoin": "round", "stroke-linecap": "round",
        "vector-effect": "non-scaling-stroke"
      }));
      svg.appendChild(svgEl("circle", {
        cx: X(vals.length - 1), cy: Y(vals[vals.length - 1]), r: 2.8,
        fill: color, stroke: "#F7F1E3", "stroke-width": 1.4
      }));
      card.querySelector(".sm-spark").appendChild(svg);
      host.appendChild(card);
    }
  })();

  /* ============================================================
     EUROPE MAP — 23 cities, Inside Airbnb June 2026
     ============================================================ */
  (function europeMap() {
    const host = document.getElementById("europe-map");
    if (!host) return;
    const LON0 = -12.5, LON1 = 34, LAT0 = 34, LAT1 = 62.5;
    const KX = Math.cos(48 * Math.PI / 180);
    const S = 22;
    const W = (LON1 - LON0) * KX * S, H = (LAT1 - LAT0) * S * 0.92;
    const px = lon => (lon - LON0) * KX * S;
    const py = lat => (LAT1 - lat) * S * 0.92;

    const HOLLOW = EUROPE_MAP_STYLE === "hollow";
    const INKY = EUROPE_MAP_STYLE !== "legacy";   // the two styles that share the chrome

    const svg = svgEl("svg", { viewBox: `0 0 ${W.toFixed(0)} ${H.toFixed(0)}`, role: "img",
      "aria-label": "Map of Europe showing Airbnb listings per thousand residents in 23 cities" });

    // countries
    const gLand = svgEl("g", INKY
      ? { fill: "#EBE1C9", stroke: "#D5C7A9", "stroke-width": 0.9, "stroke-linejoin": "round" }
      : { fill: "#EDE3CC", stroke: "#D8CBAE", "stroke-width": 1 });
    for (const f of D.europe) {
      for (const poly of f.p) {
        let d = "";
        for (const ring of poly) {
          d += "M" + ring.map(pt => px(pt[0]).toFixed(1) + " " + py(pt[1]).toFixed(1)).join("L") + "Z";
        }
        gLand.appendChild(svgEl("path", { d }));
      }
    }
    svg.appendChild(gLand);

    // scales
    const maxP = Math.max(...D.mapCities.map(c => c.per1000));
    const rOf = HOLLOW ? v => 3 + 20 * Math.sqrt(v / maxP)
              : INKY ? v => 2.4 + 11.5 * Math.sqrt(v / maxP)
              : v => 4 + 24 * Math.sqrt(v / maxP);
    // the ramp the city dot maps use, so both maps darken at the same rate
    const inkOf = v => (0.42 + 0.5 * Math.pow(v / maxP, 0.45)).toFixed(2);
    const colOf = v => v >= 36 ? SEQ[5] : v >= 24 ? SEQ[4] : v >= 15 ? SEQ[3] : v >= 8 ? SEQ[2] : SEQ[1];

    const tip = makeTip(host);
    const cities = [...D.mapCities].sort((a, b) => b.per1000 - a.per1000);

    const gDots = svgEl("g", {});
    // the ink circles are small, so hovering rides on a wider invisible disc
    const gHit = svgEl("g", { fill: "transparent" });
    for (const c of cities) {
      const x = px(c.lon), y = py(c.lat), r = rOf(c.per1000);
      const dot = svgEl("circle", HOLLOW
        ? { cx: x, cy: y, r, fill: SEQ[4], "fill-opacity": 0.09,
            stroke: SEQ[4], "stroke-width": 1.4, "stroke-opacity": 0.85 }
        : INKY
        ? { cx: x, cy: y, r, fill: SEQ[4], opacity: inkOf(c.per1000),
            stroke: "#F7F1E3", "stroke-width": 1 }
        : { cx: x, cy: y, r, fill: colOf(c.per1000), "fill-opacity": 0.82,
            stroke: "#F7F1E3", "stroke-width": 2 });
      const ttl = document.createElementNS(SVGNS, "title");
      ttl.textContent = `${c.name} — ${c.per1000} listings per 1,000 residents`;
      dot.appendChild(ttl);

      const rows =
        `<div class="trow"><span>listings</span><span class="v">${fmtN(c.listings)}</span></div>` +
        `<div class="trow"><span>per 1,000 residents</span><span class="v">${c.per1000}</span></div>` +
        `<div class="trow"><span>entire homes</span><span class="v">${c.entirePct}%</span></div>`;
      const target = INKY ? svgEl("circle", { cx: x, cy: y, r: r + 5 }) : dot;
      target.addEventListener("mousemove", ev => {
        const bb = host.getBoundingClientRect();
        tip.show(`<b>${c.name}</b>${rows}`, ev.clientX - bb.left, ev.clientY - bb.top);
      });
      target.addEventListener("mouseleave", () => tip.hide());
      gDots.appendChild(dot);
      // a ring alone leaves the city's actual position vague: pin the centre
      if (HOLLOW) gDots.appendChild(svgEl("circle", { cx: x, cy: y, r: 1.5, fill: SEQ[4] }));
      if (target !== dot) gHit.appendChild(target);
    }
    svg.appendChild(gDots);

    /* every city named, with its rate. Eight candidate slots per city, in
       order of preference; the first that clears the already-placed labels,
       every mark and the frame wins. Cities are served by rate descending,
       so the ones the reader came for get first pick of the good slots. */
    if (INKY) {
      const CW = 0.545;                    // mean glyph width / font-size, IBM Plex Sans
      const marks = cities.map(c => {
        const r = Math.max(rOf(c.per1000), 2.2);
        return { x: px(c.lon) - r, y: py(c.lat) - r, w: 2 * r, h: 2 * r };
      });
      const hits = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
      const overlap = (a, b) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) *
                                Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
      const gAll = svgEl("g", {});
      svg.appendChild(gAll);
      svg.appendChild(gHit);               // hit discs last, so they stay on top

      /* Type is measured in svg units, so on a phone it would shrink to five
         pixels. Grow it back to a readable size instead, and let the names that
         no longer fit fall away — the table underneath still lists all 23.
         The six cities with a chapter are served first, so they never drop. */
      const layout = () => {
      const scale = (host.clientWidth || W) / W;
      const tight = scale < 1;
      const floor = 11.5 / scale;
      // never droppable: the six with a chapter, plus the three highest rates
      const pinned = new Set(cities.filter(c => c.focus).map(c => c.key));
      for (const c of cities.slice(0, 3)) pinned.add(c.key);
      const queue = tight
        ? [...cities].sort((a, b) =>
            (pinned.has(b.key) ? 1 : 0) - (pinned.has(a.key) ? 1 : 0) || b.per1000 - a.per1000)
        : cities;
      while (gAll.firstChild) gAll.removeChild(gAll.firstChild);
      const taken = [];
      for (const c of queue) {
        const fs = Math.max(c.focus ? 12.5 : 11.2, floor);
        const w = c.name.length * CW * fs, h = fs * 1.05;
        const r = Math.max(rOf(c.per1000), 2.2), gap = r + 3.5;
        const ring = k => [[gap * k, fs * 0.36, "start"], [-gap * k, fs * 0.36, "end"],
                          [0, -(r + 4) * k, "middle"], [0, (r + 2) * k + fs, "middle"],
                          [gap * 0.75 * k, -(r + 3) * k, "start"], [-gap * 0.75 * k, -(r + 3) * k, "end"],
                          [gap * 0.75 * k, (r + 1) * k + fs, "start"], [-gap * 0.75 * k, (r + 1) * k + fs, "end"]];
        const slots = ring(1).concat(ring(1.9));   // a second, wider ring before giving up
        let put = null;
        for (const [dx, dy, anchor] of slots) {
          const x = px(c.lon) + dx, y = py(c.lat) + dy;
          const left = anchor === "start" ? x : anchor === "end" ? x - w : x - w / 2;
          const box = { x: left - 1.5, y: y - h + 1, w: w + 3, h: h + 2 };
          if (box.x < 2 || box.x + box.w > W - 2 || box.y < 2 || box.y + box.h > H - 2) continue;
          if (taken.some(t => hits(box, t)) || marks.some(m => hits(box, m))) continue;
          put = { x, y, anchor, box };
          break;
        }
        if (!put) {
          if (tight && !pinned.has(c.key)) continue;   // narrow screen: let it go
          // nothing is clear, so take the slot that treads on the least
          for (const [dx, dy, anchor] of slots) {
            const x = px(c.lon) + dx, y = py(c.lat) + dy;
            const left = anchor === "start" ? x : anchor === "end" ? x - w : x - w / 2;
            const box = { x: left - 1.5, y: y - h + 1, w: w + 3, h: h + 2 };
            if (box.x < 2 || box.x + box.w > W - 2 || box.y < 2 || box.y + box.h > H - 2) continue;
            let cost = 0;
            for (const t of taken) cost += overlap(box, t);
            for (const m of marks) cost += overlap(box, m) * 2;
            if (!put || cost < put.cost) put = { x, y, anchor, box, cost };
          }
          if (!put) {
            const x = px(c.lon) + gap, y = py(c.lat) + fs * 0.36;
            put = { x, y, anchor: "start", box: { x: x - 1.5, y: y - h + 1, w: w + 3, h: h + 2 } };
          }
        }
        taken.push(put.box);
        const t = svgEl("text", { x: put.x.toFixed(1), y: put.y.toFixed(1), "text-anchor": put.anchor,
          "font-size": fs, "font-weight": c.focus ? 600 : 500, fill: c.focus ? "#201B12" : INK2,
          "paint-order": "stroke", stroke: "#F7F1E3", "stroke-width": 3, "stroke-linejoin": "round" });
        t.textContent = c.name;
        gAll.appendChild(t);
      }
      };
      layout();
      let pending;
      window.addEventListener("resize", () => {
        clearTimeout(pending);
        pending = setTimeout(layout, 180);
      });
    }

    // legacy: labels for focus cities + the extremes
    const labelled = new Set(["rome", "barcelona", "paris", "berlin", "lisbon", "london", "porto", "florence", "copenhagen"]);
    const gLab = svgEl("g", { "font-size": 13.5, "font-weight": 600, fill: "#201B12" });
    const offsets = { rome: [8, 16], barcelona: [8, -8], paris: [10, -8], berlin: [10, -6], lisbon: [10, 22], london: [-10, -12], porto: [8, -14], florence: [12, 14], copenhagen: [10, -4] };
    for (const c of INKY ? [] : cities) {
      if (!labelled.has(c.key)) continue;
      const [dx, dy] = offsets[c.key] || [10, -6];
      const anchor = dx < 0 ? "end" : "start";
      const t = txt(gLab, px(c.lon) + dx + (dx < 0 ? -rOf(c.per1000) : rOf(c.per1000)) * 0.4, py(c.lat) + dy, c.name,
        { "text-anchor": anchor, fill: "#201B12", "font-size": 13.5, "paint-order": "stroke", stroke: "#F7F1E3", "stroke-width": 3 });
      if (!c.focus) { t.setAttribute("font-weight", 400); t.setAttribute("fill", INK2); }
    }
    svg.appendChild(gLab);

    host.appendChild(svg);

    // legend
    const leg = document.getElementById("europe-legend");
    if (INKY) {
      leg.innerHTML =
        `<span class="li"><span class="swatch ${HOLLOW ? "ring" : "dot"}" ` +
        `style="${HOLLOW ? "border-color" : "background"}:${SEQ[4]}"></span>` +
        `one mark per city — its area is the rate: listings per 1,000 residents</span>` +
        `<span class="li" style="color:${INK3}">circle area ∝ rate` +
        `${HOLLOW ? " — see the note below" : " · darker means denser, as on the city maps"}` +
        ` · exact figures in the table</span>`;
    } else {
      const bands = [["< 8", SEQ[1]], ["8–15", SEQ[2]], ["15–24", SEQ[3]], ["24–36", SEQ[4]], ["≥ 36", SEQ[5]]];
      leg.innerHTML = bands.map(b =>
        `<span class="li"><span class="swatch dot" style="background:${b[1]}"></span>${b[0]}</span>`
      ).join("") + `<span class="li" style="color:${INK3}">listings per 1,000 residents · circle area ∝ rate — see the note below</span>`;
    }

    // data table
    const tbody = document.querySelector("#europe-table tbody");
    tbody.innerHTML = cities.map(c =>
      `<tr><td>${c.name}</td><td>${fmtN(c.listings)}</td><td>${c.per1000}</td><td>${c.entirePct}%</td></tr>`).join("");
  })();

  /* ============================================================
     CITY DENSITY MAPS
     ============================================================ */
  function densityMap(key) {
    const host = document.getElementById("map-" + key);
    if (!host) return;
    const g = D.cities[key].grid;
    const color = CITY_COLOR[key];
    const svg = svgEl("svg", { viewBox: `0 0 ${g.w} ${g.h}`, role: "img",
      "aria-label": `Density map of ${D.cities[key].label} Airbnb listings` });
    // basemap: official boundaries, one hoverable shape per neighbourhood
    const nb = D.cities[key].nb || [];
    const gBase = svgEl("g", { class: "basemap" });
    const areas = nb.map(([name, count, share, d]) => {
      const p = svgEl("path", { d, class: "area" });
      const ttl = document.createElementNS(SVGNS, "title");
      ttl.textContent = count == null
        ? `${name} — listings not broken out in this snapshot`
        : `${name} — ${fmtN(count)} listings (${share}% of the city)`;
      p.appendChild(ttl);
      p._info = { name, count, share };
      gBase.appendChild(p);
      return p;
    });
    svg.appendChild(gBase);
    // listings as dots: area carries the count, so the map stays crisp.
    // pointer-events off, so the hover always reaches the boundary beneath.
    const gDots = svgEl("g", { class: "dots" });
    const frag = document.createDocumentFragment();
    for (const [x, y, c] of g.cells) {
      const t = Math.pow(c / g.max, 0.45);
      frag.appendChild(svgEl("circle", {
        cx: (x + 0.5).toFixed(1), cy: (y + 0.5).toFixed(1),
        r: (0.19 + 0.37 * t).toFixed(2), fill: color,
        opacity: (0.45 + 0.5 * t).toFixed(2)
      }));
    }
    gDots.appendChild(frag);
    svg.appendChild(gDots);
    host.appendChild(svg);

    /* names on hover */
    const tip = makeTip(host);
    let current = null;
    function clear() {
      if (current) current.classList.remove("on");
      current = null;
      tip.hide();
    }
    for (const p of areas) {
      p.addEventListener("mousemove", ev => {
        if (current !== p) { if (current) current.classList.remove("on"); p.classList.add("on"); current = p; }
        const bb = host.getBoundingClientRect();
        const i = p._info;
        tip.show(
          `<b>${i.name}</b>` + (i.count == null
            ? `<div class="trow"><span>listings</span><span class="v">not broken out</span></div>`
            : `<div class="trow"><span>listings</span><span class="v">${fmtN(i.count)}</span></div>` +
              `<div class="trow"><span>of the city's total</span><span class="v">${i.share}%</span></div>`),
          ev.clientX - bb.left, ev.clientY - bb.top);
      });
    }
    host.addEventListener("mouseleave", clear);
    // a tap leaves no "leave" event behind — dismiss when the next one lands elsewhere
    document.addEventListener("pointerdown", ev => { if (!host.contains(ev.target)) clear(); });

    /* text alternative: the same names, for keyboard, screen readers and touch */
    const det = document.createElement("details");
    det.className = "data-table";
    det.innerHTML =
      `<summary>View as table</summary><table><thead><tr>` +
      `<th>${key === "berlin" ? "Bezirk" : "Neighbourhood"}</th><th>Listings</th><th>Share of city</th>` +
      `</tr></thead><tbody>` +
      nb.map(([name, count, share]) =>
        `<tr><td>${name}</td><td>${count == null ? "–" : fmtN(count)}</td>` +
        `<td>${share == null ? "–" : share + "%"}</td></tr>`).join("") +
      `</tbody></table>`;
    host.insertAdjacentElement("afterend", det);
  }

  /* ============================================================
     RENT INDEX LINE CHART (per city, single series)
     ============================================================ */
  function rentChart(key) {
    const host = document.getElementById("rent-" + key);
    if (!host) return;
    const years = D.rentIndex.years;
    const vals = D.rentIndex.series[key].vals;
    const color = CITY_COLOR[key];
    const W = 520, H = 300, M = { t: 18, r: 52, b: 28, l: 40 };
    const maxV = Math.max(...vals) * 1.06, minV = 92;
    const X = i => M.l + (W - M.l - M.r) * (i / (years.length - 1));
    const Y = v => M.t + (H - M.t - M.b) * (1 - (v - minV) / (maxV - minV));

    const svg = svgEl("svg", { viewBox: `0 0 ${W} ${H}`, role: "img",
      "aria-label": `Rent index for ${D.cities[key].label}, 2015 to 2025` });

    // grid + axes
    const gG = svgEl("g", {});
    const steps = [100, 125, 150, 175, 200].filter(v => v < maxV);
    for (const v of steps) {
      gG.appendChild(svgEl("line", { x1: M.l, x2: W - M.r, y1: Y(v), y2: Y(v), stroke: LINE, "stroke-width": v === 100 ? 0 : 1 }));
      txt(gG, M.l - 6, Y(v) + 4, String(v), { "text-anchor": "end", fill: INK3, "font-size": 11 });
    }
    // baseline 100 dashed
    gG.appendChild(svgEl("line", { x1: M.l, x2: W - M.r, y1: Y(100), y2: Y(100), stroke: INK3, "stroke-width": 1, "stroke-dasharray": "3 4" }));
    for (const yr of [2015, 2020, 2025]) {
      const i = years.indexOf(yr);
      txt(gG, X(i), H - 8, String(yr), { "text-anchor": i === 0 ? "start" : i === years.length - 1 ? "end" : "middle", fill: INK3, "font-size": 11 });
    }
    svg.appendChild(gG);

    // line
    const d = vals.map((v, i) => (i ? "L" : "M") + X(i).toFixed(1) + " " + Y(v).toFixed(1)).join("");
    svg.appendChild(svgEl("path", { d, fill: "none", stroke: color, "stroke-width": 2.4, "stroke-linejoin": "round", "stroke-linecap": "round" }));
    const last = vals[vals.length - 1];
    svg.appendChild(svgEl("circle", { cx: X(vals.length - 1), cy: Y(last), r: 4, fill: color, stroke: "#F7F1E3", "stroke-width": 2 }));
    txt(svg, W - M.r + 8, Y(last) + 4, String(last), { fill: color, "font-weight": 700, "font-size": 14 });

    // hover
    const hoverDot = svgEl("circle", { r: 4.5, fill: color, stroke: "#F7F1E3", "stroke-width": 2, opacity: 0 });
    const hoverLine = svgEl("line", { y1: M.t, y2: H - M.b, stroke: INK3, "stroke-width": 1, opacity: 0 });
    svg.appendChild(hoverLine); svg.appendChild(hoverDot);
    const tip = makeTip(host);
    const overlay = svgEl("rect", { x: M.l, y: M.t, width: W - M.l - M.r, height: H - M.t - M.b, fill: "transparent" });
    overlay.addEventListener("mousemove", ev => {
      const bb = host.querySelector("svg").getBoundingClientRect();
      const sx = (ev.clientX - bb.left) / bb.width * W;
      const i = Math.max(0, Math.min(years.length - 1, Math.round((sx - M.l) / (W - M.l - M.r) * (years.length - 1))));
      hoverLine.setAttribute("x1", X(i)); hoverLine.setAttribute("x2", X(i)); hoverLine.setAttribute("opacity", 0.5);
      hoverDot.setAttribute("cx", X(i)); hoverDot.setAttribute("cy", Y(vals[i])); hoverDot.setAttribute("opacity", 1);
      tip.show(`<b>${years[i]}</b><div class="trow"><span>index</span><span class="v">${vals[i]}</span></div>` +
        `<div class="trow"><span>vs 2015</span><span class="v">${vals[i] >= 100 ? "+" : ""}${vals[i] - 100}%</span></div>`,
        X(i) / W * bb.width, Y(vals[i]) / H * bb.height);
    });
    overlay.addEventListener("mouseleave", () => { tip.hide(); hoverDot.setAttribute("opacity", 0); hoverLine.setAttribute("opacity", 0); });
    svg.appendChild(overlay);
    host.appendChild(svg);
  }

  for (const key of ["rome", "barcelona", "paris", "berlin", "lisbon", "london"]) {
    densityMap(key);
    rentChart(key);
  }

  /* ============================================================
     MEGA DIDA — fill stat numbers
     ============================================================ */
  for (const key in D.cities) {
    const c = D.cities[key];
    const put = (id, val) => { const e = document.getElementById(id + "-" + key); if (e) e.innerHTML = val; };
    put("st-listings", fmtN(c.total));
    put("st-entire", c.entirePct + "<small>%</small>");
    put("st-per1000", c.per1000);
    put("st-stock", c.stockPct.toFixed(1) + "<small>%</small>");
    put("st-multi", c.multiHostPct + "<small>%</small>");
  }

  /* ============================================================
     RESTRICTIONS — Eurostat indexed multi-line, 2019 = 100
     ============================================================ */
  (function restrictions() {
    const host = document.getElementById("eurostat-chart");
    if (!host) return;
    const years = D.eurostat.years;
    const keys = ["paris", "rome", "barcelona", "lisbon", "berlin"];
    const series = keys.map(k => {
      const s = D.eurostat.series[k];
      const base = s.vals[years.indexOf(2019)];
      return { key: k, label: s.label, color: CITY_COLOR[k], raw: s.vals,
        idx: s.vals.map(v => v == null ? null : Math.round(v / base * 100)) };
    });

    const W = 960, H = 470, M = { t: 24, r: 190, b: 34, l: 46 };
    const maxV = 215, minV = 20;
    const X = i => M.l + (W - M.l - M.r) * (i / (years.length - 1));
    const Y = v => M.t + (H - M.t - M.b) * (1 - (v - minV) / (maxV - minV));

    const svg = svgEl("svg", { viewBox: `0 0 ${W} ${H}`, role: "img",
      "aria-label": "Guest nights booked via platforms, indexed to 2019, five city regions" });

    for (const v of [50, 100, 150, 200]) {
      svg.appendChild(svgEl("line", { x1: M.l, x2: W - M.r, y1: Y(v), y2: Y(v), stroke: v === 100 ? INK3 : LINE, "stroke-width": 1, "stroke-dasharray": v === 100 ? "3 4" : "none" }));
      txt(svg, M.l - 8, Y(v) + 4, String(v), { "text-anchor": "end", fill: INK3, "font-size": 12 });
    }
    txt(svg, M.l, M.t - 8, "2019 = 100", { fill: INK3, "font-size": 12 });
    for (const yr of years) {
      txt(svg, X(years.indexOf(yr)), H - 10, String(yr), { "text-anchor": "middle", fill: INK3, "font-size": 12 });
    }

    for (const s of series) {
      let d = "", started = false;
      s.idx.forEach((v, i) => {
        if (v == null) return;
        d += (started ? "L" : "M") + X(i).toFixed(1) + " " + Y(v).toFixed(1);
        started = true;
      });
      svg.appendChild(svgEl("path", { d, fill: "none", stroke: s.color, "stroke-width": 2.4, "stroke-linejoin": "round", "stroke-linecap": "round" }));
      // end label
      let li = s.idx.length - 1;
      while (s.idx[li] == null) li--;
      const endY = Y(s.idx[li]);
      svg.appendChild(svgEl("circle", { cx: X(li), cy: endY, r: 4, fill: s.color, stroke: "#F7F1E3", "stroke-width": 2 }));
      txt(svg, X(li) + 10, endY + 4, `${s.idx[li]} · ${s.label}`, { fill: s.color, "font-weight": 600, "font-size": 13 });
    }

    /* policy event markers */
    const events = [
      { key: "lisbon", year: 2023, n: 1 },
      { key: "barcelona", year: 2024, n: 2 },
      { key: "paris", year: 2025, n: 3 },
      { key: "rome", year: 2025, n: 4 }
    ];
    for (const e of events) {
      const s = series.find(x => x.key === e.key);
      const i = years.indexOf(e.year);
      if (s.idx[i] == null) continue;
      const x = X(i), y = Y(s.idx[i]);
      svg.appendChild(svgEl("circle", { cx: x, cy: y, r: 9, fill: "#201B12" }));
      txt(svg, x, y + 4, String(e.n), { "text-anchor": "middle", fill: "#F7F1E3", "font-size": 11, "font-weight": 700 });
    }

    /* hover crosshair */
    const hoverLine = svgEl("line", { y1: M.t, y2: H - M.b, stroke: INK3, "stroke-width": 1, opacity: 0 });
    svg.appendChild(hoverLine);
    const tip = makeTip(host);
    const overlay = svgEl("rect", { x: M.l, y: M.t, width: W - M.l - M.r, height: H - M.t - M.b, fill: "transparent" });
    overlay.addEventListener("mousemove", ev => {
      const bb = host.querySelector("svg").getBoundingClientRect();
      const sx = (ev.clientX - bb.left) / bb.width * W;
      const i = Math.max(0, Math.min(years.length - 1, Math.round((sx - M.l) / (W - M.l - M.r) * (years.length - 1))));
      hoverLine.setAttribute("x1", X(i)); hoverLine.setAttribute("x2", X(i)); hoverLine.setAttribute("opacity", 0.5);
      const rows = series.map(s => s.idx[i] == null ? "" :
        `<div class="trow"><span class="sw" style="background:${s.color}"></span><span>${s.label.split(" (")[0]}</span><span class="v">${s.idx[i]} · ${(s.raw[i] / 1e6).toFixed(1)}M</span></div>`).join("");
      tip.show(`<b>${years[i]}</b>${rows}`, (X(i) / W) * bb.width, 40);
    });
    overlay.addEventListener("mouseleave", () => { tip.hide(); hoverLine.setAttribute("opacity", 0); });
    svg.appendChild(overlay);
    host.appendChild(svg);

    // legend
    const leg = document.getElementById("eurostat-legend");
    leg.innerHTML = series.map(s =>
      `<span class="li"><span class="swatch" style="background:${s.color}"></span>${s.label}</span>`).join("");

    // table
    const tbody = document.querySelector("#eurostat-table tbody");
    tbody.innerHTML = series.map(s =>
      `<tr><td>${s.label}</td>${s.raw.map(v => `<td>${v == null ? "–" : (v / 1e6).toFixed(1)}</td>`).join("")}</tr>`).join("");
  })();

  /* ============================================================
     CITY NAV active state
     ============================================================ */
  (function nav() {
    const links = document.querySelectorAll(".city-nav a");
    if (!links.length || !("IntersectionObserver" in window)) return;
    const map = {};
    links.forEach(a => { map[a.getAttribute("href").slice(1)] = a; });
    const io = new IntersectionObserver(entries => {
      entries.forEach(en => {
        if (en.isIntersecting) {
          links.forEach(a => a.classList.remove("active"));
          const a = map[en.target.id];
          if (a) a.classList.add("active");
        }
      });
    }, { rootMargin: "-30% 0px -60% 0px" });
    document.querySelectorAll("section.city").forEach(s => io.observe(s));
  })();
})();

/* ---------- Sources & methodology: collapsed by default, opens on demand ---------- */
(function () {
  const btn = document.getElementById("src-toggle");
  const body = document.getElementById("src-body");
  if (!btn || !body) return;
  document.documentElement.classList.add("js-src");
  const label = btn.querySelector(".lbl");
  function set(open) {
    body.hidden = !open;
    btn.setAttribute("aria-expanded", String(open));
    label.textContent = open ? "Show less" : "Read more";
  }
  set(false);
  btn.addEventListener("click", () => {
    const open = body.hidden;
    set(open);
    if (!open) document.getElementById("sources").scrollIntoView({ block: "start" });
  });
  // any link to the sources section opens it
  document.querySelectorAll('a[href="#sources"]').forEach(a => a.addEventListener("click", () => set(true)));
  if (location.hash === "#sources") set(true);
  window.addEventListener("hashchange", () => { if (location.hash === "#sources") set(true); });
})();
