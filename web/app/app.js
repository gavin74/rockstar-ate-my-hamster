// Browser shell for the playable slice. Uses the built modules in dist/.
import { Session, STUDIOS, VIDEOS } from "./session.js";

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
  const over = session.over;
  for (const id of ["day", "week", "year", "record", "single", "release", "promo"]) $(id).disabled = over;
  const log = $("log");
  log.innerHTML = "";
  session.log.slice(-200).reverse().forEach((line) => {
    const d = document.createElement("div");
    d.textContent = line;
    log.appendChild(d);
  });
}

async function start() {
  const res = await fetch("remake-gamedata.json");
  const data = await res.json();
  session = new Session(data, { seed: BigInt(Date.now()) });
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
  render();
}

start().catch((e) => { $("msg").textContent = `Could not start: ${e.message}`; });
