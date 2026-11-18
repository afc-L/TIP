// Story: notes, recordings, symbols, chapter objectives, challenges.
// The story is told sideways — through things people left behind — and never explains
// what the monster or The Presence actually is.
import * as THREE from 'three';
import { rand } from '../core/util.js';

export const NOTES = {
  // ---- Chapter 1: Ashgrove Lane
  sub_poster: { title: 'MISSING', text: 'HAVE YOU SEEN NOAH?\n\nNoah Hale, age 9. Brown hair, red raincoat.\nLast seen near the Ashgrove Lane playground, October 3rd, around dusk.\n\nNoah told his mother a "tall man" had been waiting by the swings.\nIf you have ANY information please call. Please.' },
  sub_watch: { title: 'Neighborhood Watch — Notice', text: 'Several residents have reported a VERY TALL FIGURE standing in the middle of Ashgrove Lane between 2 and 4 AM.\n\nIt does not respond. It does not move. It is never there when the police arrive.\n\nKeep porch lights ON. Do NOT approach. Do NOT go to number 13.' },
  sub_drawing: { title: 'A child\'s drawing', text: '(Crayon. A house with the number 13 on the door. A very tall black shape stands at the end of a long hallway drawn inside the house.\nNext to it, something smaller — grey, bent over, with long arms.)\n\nWritten underneath, in careful letters:\n"THE TALL MAN IS NOT THE BAD ONE. HE IS WAITING FOR THE OTHER ONE TO WAKE UP."' },
  sub_letter: { title: 'Letter, unopened', text: 'St. Aldric\'s Hospital — Department of Records\n\nDear Mrs. Hale,\n\nWe have searched our archives as requested. St. Aldric\'s closed in 1994 and we hold no record of a patient by the name you provided.\n\nWe did, however, find a file under patient number 0413 that lists this address — 13 Ashgrove Lane — as the next of kin.\n\nThe file is dated 1991. We cannot explain the photograph.' },
  sub_tape: { title: 'Tape: "Session 41"', kind: 'recording', lines: [
    [0, 'DR. MARROW: Session forty-one. Subject is calm. Subject, can you tell me what you see?'],
    [5, 'SUBJECT: ...the tall man. At the end of the hall. He\'s always at the end of the hall now.'],
    [11, 'DR. MARROW: And is he closer than yesterday?'],
    [15, 'SUBJECT: No. He never comes closer. He says he\'s not here for me.'],
    [20, 'DR. MARROW: Who is he here for?'],
    [24, 'SUBJECT: ...the thing that\'s going to come out of me.'],
    [29, '(Tape hiss. Something heavy moves in the background. The recording stops.)'],
  ] },
  sym_1: { title: 'A symbol', text: 'An eye inside a broken spiral, painted in something dark.\nYou have seen it before. You do not remember where.' },
  // ---- Chapter 2: Blackpine Forest
  for_journal: { title: 'Camping journal', text: 'Day 3. Ben says the deer are gone. All of them. The woods are dead quiet after dark.\n\nDay 4. Someone walked around our tents last night. In circles. For hours. Heavy steps, then light ones, then heavy again.\n\nDay 5. Ben went to get water at the lake. His flashlight is still down there, switched on, pointing at the trees.\n\nI\'m leaving at first light. If anyone finds this — don\'t follow the stone rings.' },
  for_ranger: { title: 'Tape: Ranger radio log', kind: 'recording', lines: [
    [0, 'RANGER COLE: Blackpine station, this is Cole. Found another ring of stones by the north trail.'],
    [6, 'RANGER COLE: Same symbol carved in the oak. Fresh. Someone\'s keeping it fresh.'],
    [12, 'DISPATCH: (static) ...copy, Cole. Any sign of the Harrow City group?'],
    [17, 'RANGER COLE: Their camp\'s empty. Stuff\'s still there. There\'s a hospital wristband in the cabin. St. Aldric\'s. Patient zero-four-one-three.'],
    [25, 'RANGER COLE: That place has been shut thirty years.'],
    [30, 'RANGER COLE: ...there\'s someone standing on the lake. Not in it. On it.'],
  ] },
  for_band: { title: 'Hospital wristband', text: 'ST. ALDRIC\'S HOSPITAL\nPATIENT 0413\nWARD: THRESHOLD (B)\nADMITTED: 03/10/1991\n\nThe plastic is new. It still smells like the hospital.' },
  for_photo: { title: 'Trail camera printout', text: 'Twelve frames, 03:12 to 03:14.\n\nFrames 1–5: an empty trail.\nFrame 6: something grey, bent, crossing on long arms.\nFrame 7–11: empty.\nFrame 12: a very tall black figure, standing exactly where the grey thing was. Facing the camera.' },
  sym_2: { title: 'A symbol', text: 'Carved deep into the trunk. The bark has grown around it, as if it has been here far longer than the trail.' },
  // ---- Chapter 3: Harrow City
  city_paper: { title: 'Harrow Gazette', text: 'ASHGROVE DISAPPEARANCES: SIXTH RESIDENT MISSING\n\nPolice have refused to comment on CCTV footage said to show "a figure over seven feet tall" on Ashgrove Lane.\n\nInside: St. Aldric\'s demolition delayed again. Former director Dr. Elias Marrow, 71, could not be reached at his Harrow City apartment.' },
  city_eviction: { title: 'Notice to vacate — Apt 4C', text: 'To: E. Marrow, Apartment 4C\n\nNeighbours report constant scratching from inside the walls of your unit, and "a tall man" seen standing in your window at all hours.\n\nYou have repeatedly told the superintendent that you "live alone, but not by choice."' },
  city_tape: { title: 'Tape: "I opened it"', kind: 'recording', lines: [
    [0, 'DR. MARROW: If someone is listening to this, it found you, or you are it.'],
    [6, 'DR. MARROW: We called it the Threshold. A door you open by not sleeping. 0413 held it open for nineteen days.'],
    [14, 'DR. MARROW: Something came through. Not a man. It wore the boy like a coat for a while, then it didn\'t need to.'],
    [22, 'DR. MARROW: And the tall one followed it. It has followed it ever since. It does not hunt. It watches. It waits.'],
    [30, 'DR. MARROW: I think it is waiting for the hunger to finish.'],
    [35, 'DR. MARROW: I closed the hospital. I never closed the door.'],
  ] },
  city_cctv: { title: 'Police report (excerpt)', text: 'CCTV, Parking Structure B2, 02:47.\n\nCamera 3 shows an unidentified figure, est. height 2.4–2.6 m, standing motionless for 41 minutes.\nCamera 4, facing the same spot, shows nothing.\nTechnicians found no fault with either camera.' },
  sym_3: { title: 'A symbol', text: 'Sprayed on the rooftop water tank. From up here you can see the whole city. Every light. Every window.' },
  // ---- Chapter 4: St. Aldric's
  hos_file: { title: 'Patient file 0413', text: 'NAME: [REDACTED]\nAGE: 9\nREFERRED BY: Dr. E. Marrow\n\nPresenting: reports a "tall man" at the end of every corridor. Does not sleep. Asks staff whether they "can hear it breathing yet."\n\nTreatment: THRESHOLD protocol (sleep withdrawal). Day 19: subject unresponsive. Day 20: subject no longer in room. Door locked from outside.\n\n(The paperclipped photograph shows a boy in a red raincoat.)' },
  hos_memo: { title: 'Staff memo', text: 'ALL STAFF\n\nDo NOT enter Basement Theatre B after 23:00.\nDo NOT respond to the PA system if it calls your name. The PA system has been disconnected since March.\nIf you see a tall man at the end of a corridor, do not walk toward him. Walk away. He will not follow.\n\nHe never follows.' },
  hos_tape: { title: 'Tape: "Day 19"', kind: 'recording', lines: [
    [0, 'NURSE: Day nineteen. He keeps asking if we can see it yet.'],
    [5, 'SUBJECT: It\'s in the room. It\'s sitting on my bed. It has really long arms.'],
    [11, 'NURSE: There\'s no one here, sweetheart.'],
    [15, 'SUBJECT: Not that one. The tall one\'s at the door. He\'s sad. He says he\'s sorry.'],
    [21, 'SUBJECT: He says he\'ll wait until it\'s full. Then he\'ll take it home.'],
    [27, '(A long silence. Then, very close to the microphone, something breathes.)'],
  ] },
  hos_chart: { title: 'Wall chart: THRESHOLD', text: 'A hand-drawn diagram: five circles connected by lines.\nThey are labelled ASHGROVE — BLACKPINE — HARROW — ST. ALDRIC\'S — and the fifth is just the symbol.\n\nUnderneath: "Every place it feeds, the door gets thinner."' },
  sym_4: { title: 'A symbol', text: 'Scratched into the operating table. Not painted. Scratched — by something with very long fingers.' },
  // ---- Chapter 5: The Other Side
  oth_echo1: { title: 'Echo', text: 'A red raincoat, folded neatly, dry, floating at chest height.\n\n"Mum said not to go near the swings after dark."' },
  oth_echo2: { title: 'Echo', text: 'A tent, perfectly pitched on nothing.\n\n"It walked around us all night. Heavy, then light, then heavy again. Like two of them taking turns."' },
  oth_echo3: { title: 'Echo', text: 'An apartment door, 4C, standing on its own.\n\n"I never closed the door."' },
  oth_echo4: { title: 'Echo', text: 'A hospital bed. The sheets are still warm.\n\n"He says he\'ll wait until it\'s full."' },
  sym_5: { title: 'A symbol', text: 'Here it is everywhere and nowhere. When you look straight at it, it is just a hole.' },
};

// Chapter definitions. check(g) returns true when an objective is complete.
export const CHAPTERS = {
  1: { map: 'suburb', title: 'I. Ashgrove Lane', intro: 'You wake in long wet grass. You are very tall. You are very hungry.', objectives: [
    { id: 'wake', text: 'Find out where you are', hint: 'WASD move · Mouse look · Shift sprint · C crouch · Space jump/climb', check: (g) => g.stats.mapDist > 25 || g.stats.mapTime > 25 },
    { id: 'feed', text: 'Feed', count: 2, hint: 'LMB strike · RMB heavy strike · when someone is down, hold F', check: (g) => g.stats.fedInMap >= 2 },
    { id: 'house', text: 'Something is calling from number 13, at the end of Willow Rd', target: 'ahDoor', check: (g) => g.map.refs && inBox(g.monster.pos, -47, 81, -33, 95) },
    { id: 'tape', text: 'Go down', check: (g) => g.story.taken('sub_tape') },
    { id: 'rift', text: 'Follow it', target: 'rift', reveal: 'rift_1', check: () => false },
  ] },
  2: { map: 'forest', title: 'II. Blackpine', intro: 'Pines, and fog, and somewhere a lake. The air tastes of people.', objectives: [
    { id: 'camp', text: 'Find the abandoned campsite', target: 'camp', check: (g) => g.map.refs && g.monster.pos.distanceTo(g.map.refs.camp) < 14 },
    { id: 'journal', text: 'Find out what happened to the campers', check: (g) => g.story.taken('for_journal') },
    { id: 'feed', text: 'Feed', count: 3, check: (g) => g.stats.fedInMap >= 3 },
    { id: 'cabin', text: 'Find the ranger station', target: 'cabin', check: (g) => g.story.taken('for_ranger') },
    { id: 'rift', text: 'Walk out onto the lake', target: 'rift', reveal: 'rift_2', check: () => false },
  ] },
  3: { map: 'city', title: 'III. Harrow City', intro: 'Rain. Light. So many of them.', objectives: [
    { id: 'feed', text: 'Feed', count: 3, check: (g) => g.stats.fedInMap >= 3 },
    { id: 'paper', text: 'Find out who Dr. Marrow was', check: (g) => g.story.taken('city_paper') },
    { id: 'apt', text: 'Find apartment 4C (the fire escape on Grand St.)', target: 'apt', check: (g) => g.story.taken('city_tape') },
    { id: 'garage', text: 'Go down to level B2 of the parking structure', target: 'garage', check: (g) => g.story.taken('city_cctv') },
    { id: 'rift', text: 'Climb. Look at all the lights.', target: 'rift', reveal: 'rift_3', check: () => false },
  ] },
  4: { map: 'hospital', title: 'IV. St. Aldric\'s', intro: 'You know these corridors. You do not know how.', objectives: [
    { id: 'enter', text: 'Get inside St. Aldric\'s', target: 'entrance', check: (g) => g.map.refs && g.map.isInside(g.monster.pos) },
    { id: 'power', text: 'Restore power (maintenance room)', target: 'power', check: (g) => g.map.refs && g.map.refs.powered },
    { id: 'file', text: 'Find patient file 0413 (records)', target: 'records', check: (g) => g.story.taken('hos_file') },
    { id: 'feed', text: 'Feed', count: 2, check: (g) => g.stats.fedInMap >= 2 },
    { id: 'theatre', text: 'Basement Theatre B', target: 'theatre', check: (g) => g.story.taken('hos_tape') },
    { id: 'rift', text: 'Open the door', target: 'rift', reveal: 'rift_4', check: () => false },
  ] },
  5: { map: 'other', title: 'V. The Other Side', intro: '...', objectives: [
    { id: 'echoes', text: 'Gather the echoes', count: 4, check: (g) => ['oth_echo1', 'oth_echo2', 'oth_echo3', 'oth_echo4'].filter((k) => g.story.taken(k)).length >= 4 },
    { id: 'house', text: 'Go home', target: 'house', check: (g) => g.map.refs && g.monster.pos.distanceTo(g.map.refs.house) < 9 },
    { id: 'presence', text: 'It is waiting for you', target: 'presence', check: () => false },
  ] },
};
function inBox(p, x0, z0, x1, z1) { return p.x > x0 && p.x < x1 && p.z > z0 && p.z < z1; }

export const CHALLENGES = {
  suburb: [
    { id: 'sub_unseen', text: 'Feed 3 times without anyone recognising you first', reward: 80, check: (s) => s.unseenFeeds >= 3 },
    { id: 'sub_notes', text: 'Find every note on Ashgrove Lane', reward: 60, check: (s, g) => ['sub_poster', 'sub_watch', 'sub_drawing', 'sub_letter'].every((k) => g.progress.d.notes.includes(k)) },
    { id: 'sub_cower', text: 'Make 5 people cower with your roar', reward: 70, check: (s) => s.cowered >= 5 },
  ],
  forest: [
    { id: 'for_ghost', text: 'Feed 4 times in the forest', reward: 70, check: (s) => s.fedInMap >= 4 },
    { id: 'for_noescape', text: 'Feed 3 times without anyone escaping', reward: 80, check: (s) => s.fedInMap >= 3 && s.escaped === 0 },
  ],
  city: [
    { id: 'city_frenzy', text: 'Feed 6 times in Harrow City', reward: 90, check: (s) => s.fedInMap >= 6 },
    { id: 'city_roof', text: 'Stand on the tallest rooftop', reward: 50, check: (s, g) => g.monster.pos.y > 40 },
  ],
  hospital: [
    { id: 'hos_guard', text: 'Feed on an armed searcher or guard', reward: 80, check: (s) => s.armedFed >= 1 },
    { id: 'hos_dark', text: 'Feed twice before restoring power', reward: 70, check: (s, g) => s.fedInMap >= 2 && !(g.map.refs && g.map.refs.powered) },
  ],
  other: [
    { id: 'oth_stare', text: 'Look The Presence in the face', reward: 100, check: (s) => s.presenceStares >= 1 },
  ],
};

export class Story {
  constructor(game) { this.game = game; this.chapter = null; this.objI = 0; this.takenSet = new Set(); this.playing = null; }
  reset(chapterNum) {
    this.takenSet = new Set(); this.objI = 0; this.chapter = chapterNum ? CHAPTERS[chapterNum] : null; this.chapterNum = chapterNum; this.done = false;
    if (this.chapter) { this.game.ui.chapterTitle(this.chapter.title, this.chapter.intro); this.announce(); }
  }
  taken(id) { return this.takenSet.has(id); }
  get current() { return this.chapter ? this.chapter.objectives[this.objI] : null; }
  announce() {
    const o = this.current; if (!o) return;
    if (o.reveal) { const it = this.game.map.interactables.find((x) => x.id === o.reveal); if (it) { it.hidden = false; it.mesh.visible = true; this.game.audio.play('stinger', it.pos, { vol: 0.5, dur: 2 }); } }
    if (o.hint) this.game.ui.hint(o.hint, 9);
  }
  targetPos() {
    const o = this.current; if (!o || !o.target) return null;
    if (o.target === 'rift') { const it = this.game.map.interactables.find((x) => x.id === o.reveal); return it ? it.pos : null; }
    const r = this.game.map.refs && this.game.map.refs[o.target];
    return r ? (r.pos || r) : null;
  }
  objectiveText() {
    const o = this.current; if (!o) return '';
    let t = o.text;
    if (o.count) { const g = this.game; const n = o.id === 'echoes' ? ['oth_echo1', 'oth_echo2', 'oth_echo3', 'oth_echo4'].filter((k) => this.taken(k)).length : g.stats.fedInMap; t += ` (${Math.min(n, o.count)}/${o.count})`; }
    return t;
  }
  update(dt) {
    const g = this.game;
    if (this.playing) {
      this.playing.t += dt;
      const L = this.playing.lines;
      while (this.playing.i < L.length && this.playing.t >= L[this.playing.i][0]) {
        const line = L[this.playing.i][1]; this.playing.i++;
        g.ui.subtitleRaw(line, 5.5);
        if (!line.startsWith('(')) g.audio.play('babble', null, { pitch: line.startsWith('DR.') || line.startsWith('RANGER') ? 105 : line.startsWith('SUBJECT') ? 290 : 190, dur: 3.5, vol: 0.4, rate: 4.5, radio: true });
        else g.audio.play('static', null, { vol: 0.15, dur: 1.5 });
      }
      if (this.playing.i >= L.length && this.playing.t > L[L.length - 1][0] + 5) { this.playing = null; g.audio.loop('static', 0); }
    }
    if (!this.chapter || this.done) return;
    const o = this.current; if (!o) return;
    if (o.check(g)) this.complete();
  }
  complete() {
    const g = this.game; this.objI++;
    g.audio.play('tone', null, { f: 220, vol: 0.2, dur: 2.5 });
    g.progress.addEssence(40);
    g.ui.toast('Objective complete  +40 essence', 2.5, 'essence');
    this.announce();
  }
  event(name, data) {
    const g = this.game;
    if (name === 'fed' && data && (data.role === 'searcher' || data.role === 'guard')) g.stats.armedFed++;
  }
  onInteract(it) {
    const g = this.game;
    if (it.kind === 'rift') {
      if (it.hidden) return false;
      if (g.mode !== 'story' && g.mode !== 'nightmare') { g.ui.hint('The rift is closed to you here. (Story / Nightmare)', 2.5); return true; }
      g.enterRift(it);
      return true;
    }
    const N = NOTES[it.id];
    if (!N) return false;
    if (it.kind === 'symbol') {
      if (g.progress.addSymbol(it.id)) { g.progress.addEssence(50); g.ui.toast(`Symbol found (${g.progress.d.symbols.length}/5)  +50 essence`, 3, 'essence'); if (g.progress.d.symbols.length >= 5) g.ui.toast('Something about you has changed. (New appearance unlocked)', 5); }
      g.audio.play('subSwell', it.pos, { vol: 0.6 });
      g.hallucinations.bump(0.04);
      g.ui.showNote(N.title, N.text);
      this.takenSet.add(it.id); it.taken = true;
      return true;
    }
    if (it.kind === 'recording' || N.kind === 'recording') {
      g.audio.play('tape', null, { vol: 0.6 }); g.audio.loop('static', 0.05);
      this.playing = { lines: N.lines, t: 0, i: 0 };
      if (g.progress.addNote(it.id)) { g.progress.addEssence(25); g.ui.toast('Recording found  +25 essence', 2.5, 'essence'); }
      this.takenSet.add(it.id); it.taken = true;
      g.ui.showNote(N.title, N.lines.map((l) => l[1]).join('\n\n'), true);
      return true;
    }
    g.audio.play('paper', null, { vol: 0.6 });
    if (g.progress.addNote(it.id)) { g.progress.addEssence(15); g.ui.toast('Note found  +15 essence', 2.5, 'essence'); }
    this.takenSet.add(it.id); it.taken = true;
    g.ui.showNote(N.title, N.text);
    // reading things in the dark is not always safe
    if (Math.random() < 0.35) setTimeout(() => g.hallucinations.trigger(Math.random() < 0.5 ? 'whisperBehind' : 'presenceBehind'), 2500);
    return true;
  }
}
