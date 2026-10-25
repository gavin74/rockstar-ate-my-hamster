// Browser shell for the playable slice. Uses the built modules in dist/.
import { Session, STUDIOS, VIDEOS, LABEL_NAMES_UI } from "./session.js";

const $ = (id) => document.getElementById(id);
let session;

function fill(select, options) {
  select.innerHTML = "";
  options.forEach(([value, label]) => {
    const o = document.createElement("option");
    o.value = value;
    o.textContent = label;
    select.appendChild(o);
  });
}

function show(result) {
  $("msg").textContent = result.message;
  render();
}

function render() {
  const s = session.state;
  const pos = (p) => (p === 0 ? "-" : p <= 10 ? `#${p}` : `out (${p})`);
  $("date").textContent = `${["MON","TUE","WED","THU","FRI","SAT","SUN"][s.dayOfWeek]} ${String(s.dayOfMonth).padStart(2, "0")} ${["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"][s.month]}`;
  $("cash").textContent = `£${s.cash.toLocaleString("en-GB")}`;
  $("wages").textContent = `£${session.weeklyWages().toLocaleString("en-GB")}`;
  $("hype").textContent = s.hype;
  $("skill").textContent = s.skill;
  $("fame").textContent = s.fame;
  $("single").textContent = s.singleReleased ? pos(s.singlePos) : "-";
  $("album").textContent = s.albumReleased ? pos(s.albumPos) : s.albumInCan ? "in can" : "-";
  const offer = session.pendingOffer;
  $("offerRow").hidden = offer === null;
  if (offer !== null) $("offerText").textContent = "Record offer: tier " + offer + " (" + LABEL_NAMES_UI[offer] + ").";
  const over = session.over;
  for (const id of ["day", "week", "year", "record", "single", "release", "promo", "gearBuy", "signBtn", "declineBtn"]) $(id).disabled = over;
  const log = $("log");
  log.innerHTML = "";
  session.log.slice(-200).reverse().forEach((line) => {
    const d = document.createElement("div");
    d.textContent = line;
    log.appendChild(d);
  });
}

let data;

function showHire() {
  const roster = $("roster");
  roster.innerHTML = "";
  const picked = new Set();
  const update = () => {
    $("startBand").disabled = picked.size < 1 || picked.size > 4;
    $("hireCount").textContent = picked.size + " of 4 chosen";
  };
  data.roster.forEach((star, i) => {
    const row = document.createElement("label");
    row.className = "star";
    const box = document.createElement("input");
    box.type = "checkbox";
    box.onchange = () => {
      if (box.checked && picked.size >= 4) { box.checked = false; return; }
      box.checked ? picked.add(i) : picked.delete(i);
      update();
    };
    const wage = 10 * (1000 * star.stats[5] + 100 * star.stats[6] + 10 * star.stats[7] + star.stats[8]);
    const label = document.createElement("span");
    label.textContent = star.name;
    const info = document.createElement("span");
    info.textContent = "skill " + star.stats[2] + " · wage £" + wage + "/wk";
    row.append(box, label, info);
    roster.appendChild(row);
  });
  update();
  $("startBand").onclick = () => {
    const band = [...picked].map((i) => data.roster[i]);
    session = new Session(data, { seed: BigInt(Date.now()), band });
    $("hire").hidden = true;
    $("game").hidden = false;
    wireGame();
    render();
  };
}

function wireGame() {
  fill($("studio"), STUDIOS.map((label, i) => [i, label]));
  fill($("video"), Object.entries(VIDEOS).map(([k, v]) => [k, v.label]));
  fill($("track"), Array.from({ length: 10 }, (_, i) => [i, `Track ${i + 1}`]));
  $("day").onclick = () => { session.advanceDay(); $("msg").textContent = ""; render(); };
  $("week").onclick = () => { session.advanceDays(7); $("msg").textContent = ""; render(); };
  $("year").onclick = () => { session.advanceDays(30); $("msg").textContent = ""; render(); };
  $("record").onclick = () => show(session.recordAlbum(Number($("studio").value), $("albumName").value || "Untitled"));
  $("single").onclick = () => show(session.releaseSingle(Number($("track").value), $("video").value));
  $("release").onclick = () => show(session.releaseAlbum());
  $("promo").onclick = () => show(session.promote());
  fill($("gear"), [[0, "New"], [1, "Second hand"], [2, "Dodgy"]]);
  $("gearBuy").onclick = () => show(session.buyGear(Number($("gear").value)));
  $("signBtn").onclick = () => show(session.answerOffer(true));
  $("declineBtn").onclick = () => show(session.answerOffer(false));
}

async function start() {
  const res = await fetch("remake-gamedata.json");
  data = await res.json();
  showHire();
}

start().catch((e) => { $("msg").textContent = `Could not start: ${e.message}`; });
