// Browser shell for the remake. Uses the built modules in dist/.
import { Session, STUDIOS, VIDEOS, LABEL_NAMES_UI, VENUE_NAMES_UI, TICKET_PRICES_UI, SPONSOR_NAMES_UI } from "./session.js";

const $ = (id) => document.getElementById(id);
const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
let session;
let data;

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

function quiet(fn) {
  $("msg").textContent = "";
  fn();
  render();
}

/** The one open question, if any: a sponsor, a charity, a bootleg, or a star's demand. */
function prompt() {
  if (session.pendingMood) {
    const m = session.pendingMood;
    const name = session.state.starNames[m.slot];
    return {
      text: `${name} ${m.kind === "demand" ? "wants changes" : "gives an ultimatum"}: £${m.cost}.`,
      buttons: [
        ["Pay", () => show(session.answerMood(true)), true],
        ["Refuse", () => show(session.answerMood(false)), false],
      ],
    };
  }
  if (session.pendingSponsor !== null) {
    return {
      text: `Sponsor offer: ${SPONSOR_NAMES_UI[session.pendingSponsor]}.`,
      buttons: [
        ["Accept (£100k)", () => show(session.answerSponsorOffer(true)), true],
        ["Decline", () => show(session.answerSponsorOffer(false)), false],
      ],
    };
  }
  if (session.pendingCharity) {
    return {
      text: "A charity asks the band to play for free.",
      buttons: [
        ["Accept", () => show(session.answerCharityOffer(true)), true],
        ["Decline", () => show(session.answerCharityOffer(false)), false],
      ],
    };
  }
  if (session.pendingBootleg) {
    return {
      text: "Bootleggers are copying the album.",
      buttons: [
        ["Sue", () => show(session.answerBootleg(1)), true],
        ["Raid", () => show(session.answerBootleg(2)), false],
        ["Pay them off", () => show(session.answerBootleg(3)), false],
        ["Ignore", () => show(session.answerBootleg(0)), false],
      ],
    };
  }
  return null;
}

function render() {
  const s = session.state;
  const pos = (p) => (p === 0 ? "-" : p <= 10 ? `#${p}` : `out (${p})`);
  $("date").textContent = `${DAYS[s.dayOfWeek]} ${String(s.dayOfMonth).padStart(2, "0")} ${MONTHS[s.month]}`;
  $("cash").textContent = `£${s.cash.toLocaleString("en-GB")}`;
  $("wages").textContent = `£${session.weeklyWages().toLocaleString("en-GB")}`;
  $("hype").textContent = s.hype;
  $("skill").textContent = s.skill;
  $("fame").textContent = s.fame;
  $("single").textContent = s.singleReleased ? pos(s.singlePos) : "-";
  $("album").textContent = s.albumReleased ? pos(s.albumPos) : s.albumInCan ? "in can" : "-";

  const offer = session.pendingOffer;
  $("offerRow").hidden = offer === null;
  if (offer !== null) $("offerText").textContent = `Record offer: tier ${offer} (${LABEL_NAMES_UI[offer]}).`;

  const p = prompt();
  $("promptPanel").hidden = p === null;
  if (p) {
    $("promptText").textContent = p.text;
    const row = $("promptButtons");
    row.innerHTML = "";
    p.buttons.forEach(([label, onClick, primary]) => {
      const b = document.createElement("button");
      b.textContent = label;
      if (primary) b.className = "primary";
      b.onclick = onClick;
      row.appendChild(b);
    });
  }

  const over = session.over;
  const blocked = p !== null;
  for (const id of ["day", "week", "year", "record", "single", "release", "promo", "publicity", "gearBuy", "tour", "practice", "signBtn", "declineBtn"]) {
    $(id).disabled = over || blocked;
  }
  $("nextNight").disabled = over || blocked || !session.touring;

  const log = $("log");
  log.innerHTML = "";
  session.log.slice(-200).reverse().forEach((line) => {
    const d = document.createElement("div");
    d.textContent = line;
    log.appendChild(d);
  });
}

function showHire() {
  const roster = $("roster");
  roster.innerHTML = "";
  const picked = new Set();
  const update = () => {
    $("startBand").disabled = picked.size < 1 || picked.size > 4;
    $("hireCount").textContent = `${picked.size} of 4 chosen`;
  };
  data.roster.forEach((star, i) => {
    const row = document.createElement("label");
    row.className = "star";
    const box = document.createElement("input");
    box.type = "checkbox";
    box.onchange = () => {
      if (box.checked && picked.size >= 4) {
        box.checked = false;
        return;
      }
      if (box.checked) picked.add(i);
      else picked.delete(i);
      update();
    };
    const wage = 10 * (1000 * star.stats[5] + 100 * star.stats[6] + 10 * star.stats[7] + star.stats[8]);
    const name = document.createElement("span");
    name.textContent = star.name;
    const info = document.createElement("span");
    info.textContent = `skill ${star.stats[2]} · wage £${wage}/wk`;
    row.append(box, name, info);
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
  fill($("gear"), [[0, "New"], [1, "Second hand"], [2, "Dodgy"]]);
  fill($("venue"), VENUE_NAMES_UI.map((label, i) => [i, label]));
  fill($("price"), TICKET_PRICES_UI.map((p, i) => [i, `£${p}`]));

  $("day").onclick = () => quiet(() => session.advanceDay());
  $("week").onclick = () => quiet(() => session.advanceDays(7));
  $("year").onclick = () => quiet(() => session.advanceDays(30));
  $("record").onclick = () => show(session.recordAlbum(Number($("studio").value), $("albumName").value || "Untitled"));
  $("single").onclick = () => show(session.releaseSingle(Number($("track").value), $("video").value));
  $("release").onclick = () => show(session.releaseAlbum());
  $("promo").onclick = () => show(session.promote());
  $("publicity").onclick = () => show(session.publicity());
  $("gearBuy").onclick = () => show(session.buyGear(Number($("gear").value)));
  $("signBtn").onclick = () => show(session.answerOffer(true));
  $("declineBtn").onclick = () => show(session.answerOffer(false));
  $("tour").onclick = () => show(session.beginTour(Number($("venue").value), Number($("price").value), 5));
  $("nextNight").onclick = () => show(session.playNight());
  $("practice").onclick = () => show(session.practice(3));
}

async function start() {
  const res = await fetch("remake-gamedata.json");
  data = await res.json();
  showHire();
}

start().catch((e) => {
  $("msg").textContent = `Could not start: ${e.message}`;
});
