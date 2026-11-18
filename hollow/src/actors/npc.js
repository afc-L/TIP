// NPCs: people living in the maps. Each has a personality that shapes perception and
// reactions, a daily routine (walking, chatting, using buildings), and a full reaction
// ladder: uneasy -> investigate -> recognise -> flee / hide / call for help / confront.
import * as THREE from 'three';
import { buildHumanoid } from './humanoid.js';
import { clamp, damp, dampAngle, angleDiff, rand, pick, chance, lerp, smooth } from '../core/util.js';
import { silhouetteTexture } from '../core/textures.js';

export const PERSONALITIES = {
  calm: { sight: 1, hear: 0.8, gain: 0.7, panicAt: 0.85, investigate: 0.45, confront: 0.05, hide: 0.35, erratic: 0.05, speed: 1, label: 'Calm' },
  nervous: { sight: 1, hear: 1.4, gain: 1.5, panicAt: 0.45, investigate: 0.12, confront: 0, hide: 0.6, erratic: 0.25, speed: 1.05, label: 'Nervous' },
  observant: { sight: 1.5, hear: 1.25, gain: 1.15, panicAt: 0.7, investigate: 0.55, confront: 0.05, hide: 0.5, erratic: 0.05, speed: 1, label: 'Observant' },
  brave: { sight: 1.1, hear: 1, gain: 0.9, panicAt: 0.95, investigate: 0.9, confront: 0.35, hide: 0.2, erratic: 0.05, speed: 1.05, label: 'Brave' },
  aggressive: { sight: 1.1, hear: 1, gain: 1, panicAt: 1.2, investigate: 0.8, confront: 0.85, hide: 0.05, erratic: 0.1, speed: 1.05, label: 'Aggressive' },
  panicked: { sight: 1, hear: 1.25, gain: 1.35, panicAt: 0.5, investigate: 0.2, confront: 0.08, hide: 0.4, erratic: 0.65, speed: 1.1, label: 'Panicked' },
};
const PKEYS = Object.keys(PERSONALITIES);

export const LINES = {
  uneasy: ['Did you hear that?', '...Hello?', 'What was that?', 'Is someone there?', "That's not funny.", 'Who’s there?', 'Huh.'],
  investigate: ['Hello? Anyone out here?', "If this is a joke, I'm calling the police.", 'Come out where I can see you.', 'Probably just an animal...', "I know someone's there."],
  recognize: ['Oh my God...', 'What the hell is that?!', 'No, no, no, no...', 'RUN!', 'Get away from me!', 'What... what are you?'],
  flee: ['HELP! SOMEBODY HELP!', 'Run! RUN!', "It's coming!", 'Get inside! GET INSIDE!', "Don't look back!"],
  hide: ['please, please, please...', 'shh... shh...', "it can't see me... it can't see me...", "don't breathe...", 'go away... go away...'],
  call: ["Hello? There's something here, please send someone!", "I don't know what it is! Please hurry!", "It's still out there... please...", "I'm hiding. Please, just come."],
  confront: ['Back off! I’m warning you!', 'Come on then! COME ON!', 'Stay back!', 'Get out of here!'],
  armed: ['Contact! Contact!', 'There! Light it up!', 'Hold your ground!', 'Movement! Over there!', 'Keep your lights on it!'],
  downed: ['...please...', 'someone... help...', 'no...'],
  calmDown: ['...I think it’s gone.', 'Was it... was it real?', 'I need to get out of here.'],
  phone: ['...no, I\'m almost home.', 'Can you hear me? The signal\'s bad out here.', 'I\'ll call you back.', '...yeah. Yeah. Okay.', 'Did you see the news?'],
  chat: ['...and then she just left. No note, nothing.', 'Did you lock the car?', 'It\'s too quiet tonight.', 'You hear about the Hendersons?', 'I don\'t like being out after dark anymore.', 'They never found that kid, you know.', 'Something\'s been getting into the bins.', 'I keep having the same dream.', 'Did the power go out at yours too?', 'Don\'t look now, but... never mind.'],
  sawNothing: ['...nothing.', 'I could have sworn...', 'Just the wind.', 'Getting jumpy.'],
};

let NPC_ID = 0;
const sensesTex = () => silhouetteTexture('rgba(255,255,255,1)', 4);

export class NPC {
  constructor(game, def) {
    this.game = game; this.id = NPC_ID++;
    this.def = def;
    this.role = def.role || 'civilian';
    this.pkey = def.personality || pick(PKEYS);
    this.P = PERSONALITIES[this.pkey];
    this.body = buildHumanoid(def.seed ?? Math.floor(Math.random() * 1e6), def.outfit || 'casual', { child: def.child, lost: def.lost });
    this.group = this.body.group;
    this.B = this.body.bones;
    this.H = this.body.H;
    this.pos = def.pos.clone(); this.yaw = def.yaw ?? rand(0, Math.PI * 2);
    this.vel = new THREE.Vector3(); this.speed = 0;
    this.state = 'idle'; this.stateT = 0; this.activity = def.activity || pick(['stand', 'look', 'phone', 'stand']);
    this.activityT = rand(4, 14);
    this.path = null; this.pathI = 0; this.goal = null;
    this.suspicion = 0; this.fear = 0; this.alerted = false; this.recognized = false;
    this.lastKnown = new THREE.Vector3(); this.stimulus = new THREE.Vector3(); this.lastSeenT = 999; this.seesMonster = false;
    this.health = def.health || (this.role === 'searcher' || this.role === 'guard' ? 140 : 100);
    this.stamina = rand(12, 25);
    this.percT = Math.random() * 0.2;
    this.voiceT = rand(2, 10);
    this.flashlight = !!def.flashlight;
    this.flashOn = this.flashlight && (def.flashOn ?? true);
    this.static = !!def.static; this.home = def.home || null;
    this.ph = Math.random(); this.cur = {}; this.t = Math.random() * 10;
    this.attackCD = rand(1, 3); this.stuckT = 0; this.lastProgress = this.pos.clone();
    this.downedT = 0; this.removed = false; this.dissolveT = 0; this.hitT = 0; this.flinchT = 0;
    this.talkPartner = null; this.lookTarget = null; this.headYaw = 0;
    this.lostAnchor = def.lost || false;
    this.nervousBonus = 0;
    this.group.position.copy(this.pos);
    // Enhanced Senses marker (seen through walls)
    const sm = new THREE.SpriteMaterial({ map: sensesTex(), color: 0xffffff, transparent: true, opacity: 0, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending });
    this.senseSprite = new THREE.Sprite(sm); this.senseSprite.scale.set(0.9 * this.H, 1.8 * this.H, 1); this.senseSprite.renderOrder = 10;
    this.senseSprite.position.set(0, 0.9 * this.H, 0); this.senseSprite.visible = false;
    this.group.add(this.senseSprite);
    // flashlight beam (fake volumetric cone)
    if (this.flashlight) {
      const cone = new THREE.ConeGeometry(1.6, 9, 16, 1, true); cone.translate(0, -4.5, 0);
      const bm = new THREE.ShaderMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false,
        vertexShader: 'varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
        fragmentShader: 'varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ float along = pow(vUv.y, 2.2); float edge = pow(abs(dot(normalize(vN), normalize(vV))), 1.5); gl_FragColor = vec4(vec3(1.0, 0.95, 0.82) * along * edge * 0.07, 1.0); }' });
      this.beam = new THREE.Mesh(cone, bm); this.beam.position.set(0, -0.1 * this.H, 0.05);
      this.B.handR.add(this.beam);
      const torch = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, 0.18, 8), new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.6, roughness: 0.4, emissive: 0x000000 }));
      torch.position.set(0, -0.09 * this.H, 0.02); this.B.handR.add(torch);
      this.beamDir = new THREE.Vector3();
    }
    this.heat = 0;
  }

  get alive() { return !['downed', 'fed', 'dissolve', 'crawl', 'corpse'].includes(this.state) && !this.removed; }
  get vulnerable() { return ['downed', 'crawl'].includes(this.state); }
  eye(out = new THREE.Vector3()) { return out.set(this.pos.x, this.pos.y + 1.6 * this.H, this.pos.z); }
  center(out = new THREE.Vector3()) { return out.set(this.pos.x, this.pos.y + 1.0 * this.H, this.pos.z); }

  setState(s, t = 0) {
    if (this.state === s) return;
    this.prevState = this.state; this.state = s; this.stateT = 0; this.stateDur = t;
    if (s !== 'talk' && this.talkPartner) { const p = this.talkPartner; this.talkPartner = null; if (p.talkPartner === this) { p.talkPartner = null; if (p.state === 'talk') p.setState('idle'); } }
    const fearful = ['flee', 'hide', 'cower', 'call', 'scream', 'downed', 'crawl', 'fed', 'confront'].includes(s);
    this.body.setExpression(fearful || this.suspicion > 0.6 ? 'fear' : 'neutral');
  }

  say(cat, force = false) {
    const lines = (this.game.map.lines && this.game.map.lines[cat]) || LINES[cat];
    if (!lines) return;
    if (!force && this.sayCD > 0) return;
    this.sayCD = 2.5;
    const text = pick(lines);
    const vp = this.voicePitch();
    const loud = ['flee', 'recognize', 'confront', 'armed'].includes(cat);
    const quiet = cat === 'hide' || cat === 'downed';
    const dur = clamp(text.length * 0.06, 0.8, 3.2);
    if (!quiet || this.game.monster.pos.distanceTo(this.pos) < 12) {
      this.game.audio.play('babble', this.eye(), { pitch: vp * (loud ? 1.25 : quiet ? 0.9 : 1), dur, vol: loud ? 0.9 : quiet ? 0.18 : 0.45, rate: loud ? 7 : 5.5 });
    }
    this.game.ui.subtitle(this, text, quiet);
  }
  voicePitch() { return this.body.child ? 300 : this.body.female ? 205 + (this.id % 5) * 8 : 115 + (this.id % 5) * 7; }

  // ------------------------------------------------------------------ stimuli
  hear(pos, radius, type) {
    if (!this.alive || this.state === 'fed') return;
    const d = pos.distanceTo(this.pos);
    const R = radius * this.P.hear * (this.role === 'searcher' ? 1.3 : 1);
    if (d > R) return;
    const k = 1 - d / R;
    if (type === 'scream' || type === 'roar') {
      this.fear += k * (type === 'roar' ? 1.2 : 0.55) / (this.role !== 'civilian' ? 2 : 1);
      this.suspicion += k * 0.8;
      this.lastKnown.copy(pos); this.stimulus.copy(pos);
      if (type === 'roar' && d < 25) this.flinchT = 1.2;
      if (this.fear > this.P.panicAt && !this.recognized) this.recognize(true);
      else if (this.state !== 'flee' && this.state !== 'hide') this.becomeUneasy(pos);
      return;
    }
    const w = type === 'step' ? 0.35 : type === 'door' ? 0.5 : type === 'feed' ? 0.6 : 0.55;
    this.suspicion += k * w * this.P.gain * (1 + this.nervousBonus);
    this.stimulus.copy(pos).add(new THREE.Vector3(rand(-2, 2), 0, rand(-2, 2)));
    if (!this.recognized && this.suspicion > 0.22) this.becomeUneasy(this.stimulus);
  }

  becomeUneasy(pos) {
    if (['uneasy', 'investigate', 'flee', 'hide', 'cower', 'confront', 'call', 'scream'].includes(this.state) || !this.alive) return;
    this.stimulus.copy(pos);
    this.setState('uneasy'); this.stateDur = rand(2.5, 5);
    if (chance(0.6)) this.say('uneasy');
    if (this.talkPartner) this.talkPartner.becomeUneasy(pos);
  }

  recognize(fromSound = false) {
    if (this.recognized && ['flee', 'hide', 'cower', 'confront', 'call'].includes(this.state)) return;
    this.recognized = true; this.alerted = true; this.fear = Math.max(this.fear, 0.8);
    this.game.stats && this.game.stats.onSeen(this);
    const m = this.game.monster; const d = m.pos.distanceTo(this.pos);
    const armed = this.role === 'searcher' || this.role === 'guard';
    if (this.role === 'lost') { this.setState('flee'); this.planEscape(); return; }
    if (armed && this.health > 40) { this.setState('confront'); this.say('armed', true); this.game.npcs.alertArmed(this, m.pos); return; }
    if (!fromSound && chance(0.75)) {
      this.game.audio.play(chance(0.7) ? 'scream' : 'gasp', this.eye(), { pitch: this.body.child ? 1.5 : this.body.female ? 1.15 : 0.8, vol: 1 });
      this.game.emitNoise(this.pos, 35, 'scream', this);
    }
    this.say('recognize', true);
    if (this.pkey === 'aggressive' && chance(this.P.confront)) { this.setState('confront'); return; }
    if (this.pkey === 'brave' && d > 10 && chance(this.P.confront)) { this.setState('confront'); return; }
    if (d < 3.5 && (this.pkey === 'panicked' || this.pkey === 'nervous') && chance(0.4)) { this.setState('cower'); this.stateDur = rand(2, 5); return; }
    if (chance(this.P.hide) && this.game.nav.hide.length) { this.setState('hide'); this.planHide(); return; }
    this.setState('flee'); this.planEscape();
  }

  // ------------------------------------------------------------------ perception
  perceive(dt) {
    const g = this.game, m = g.monster;
    if (m.dead) { this.seesMonster = false; return; }
    const eye = this.eye(_v1), mc = m.chestPos(_v2);
    const d = eye.distanceTo(mc);
    this.seesMonster = false;
    // Terrifying Presence: an aura that makes people feel watched
    const aura = g.abilities ? g.abilities.presenceAura(this.pos) : 0;
    if (aura > 0) { this.fear += aura * dt * 0.5; this.suspicion += aura * dt * 0.6; if (!this.recognized && this.suspicion > 0.3) this.becomeUneasy(m.pos); if (this.fear > this.P.panicAt && !this.recognized) { this.lastKnown.copy(m.pos); this.recognize(true); } }
    if (d < 70) {
      const light = g.lightLevelAt(m.pos, this);
      let range = (7 + 36 * light) * this.P.sight * m.visibility * (this.alerted ? 1.35 : 1) * (this.role === 'searcher' ? 1.3 : 1);
      if (m.speed > 5) range *= 1.25; if (m.speed < 0.3 && m.crouchW > 0.5) range *= 0.55;
      const fwdYaw = this.yaw + this.headYaw;
      const dirYaw = Math.atan2(mc.x - eye.x, mc.z - eye.z);
      const off = Math.abs(angleDiff(fwdYaw, dirYaw));
      const fov = this.alerted ? 1.25 : this.state === 'investigate' ? 1.1 : 0.95;
      if ((d < range && off < fov) || d < 2.2) {
        if (g.world.lineOfSight(eye, mc) || g.world.lineOfSight(eye, m.headPos(_v3))) {
          this.seesMonster = true;
          const gain = this.P.gain * (1.6 - d / Math.max(range, 1)) * (this.alerted ? 2.5 : 1) * (1 + this.nervousBonus) * (off < 0.4 ? 1.4 : 0.8);
          this.suspicion += gain * dt * 1.4;
          this.lastKnown.copy(m.pos); this.lastSeenT = 0;
          if (d < 5.5) this.suspicion = Math.max(this.suspicion, 1.1);
          if (this.suspicion >= 1) {
            if (!this.recognized || ['uneasy', 'investigate', 'idle', 'walk', 'talk'].includes(this.state)) this.recognize();
          } else if (this.suspicion > 0.25) this.becomeUneasy(m.pos);
        }
      }
    }
    // social contagion: seeing others panic
    if (!this.recognized) {
      for (const o of g.npcs.list) {
        if (o === this || !o.alive) continue;
        if (!['flee', 'scream', 'confront', 'corpse', 'fed'].includes(o.state) && !o.vulnerable) continue;
        const dd = o.pos.distanceTo(this.pos); if (dd > (o.state === 'corpse' ? 15 : 20)) continue;
        if (!g.world.lineOfSight(eye, o.eye(_v3))) continue;
        this.fear += dt * (o.vulnerable || o.state === 'corpse' || o.state === 'fed' ? 1.8 : 0.9) * (1 + this.nervousBonus);
        if (o.state === 'corpse' && !this.sawCorpse) { this.sawCorpse = true; this.game.audio.play(Math.random() < 0.6 ? 'scream' : 'gasp', this.eye(), { pitch: this.body.female ? 1.2 : 0.85 }); this.say('recognize', true); }
        this.lastKnown.copy(o.recognized ? o.lastKnown : o.pos);
        if (this.fear > this.P.panicAt) { this.recognize(true); break; }
        else this.becomeUneasy(o.pos);
      }
    }
  }

  // ------------------------------------------------------------------ planning
  goTo(node, after) {
    const nav = this.game.nav;
    const start = nav.nearest(this.pos, 30, null, this.game.world) || nav.nearest(this.pos, 60);
    if (!start || !node) { this.path = null; return false; }
    const danger = this.recognized ? this.lastKnown : null;
    const p = nav.path(start, node, danger, 14);
    if (!p) { this.path = null; return false; }
    this.path = p.map((n) => n); this.pathI = 0; this.goal = node; this.onArrive = after || null;
    // skip first node if it's behind us
    if (this.path.length > 1) {
      const a = this.path[0].pos, b = this.path[1].pos;
      const ab = Math.hypot(b.x - a.x, b.z - a.z), pb = Math.hypot(b.x - this.pos.x, b.z - this.pos.z);
      if (pb < ab) this.pathI = 1;
    }
    this.stuckT = 0; this.lastProgress.copy(this.pos);
    return true;
  }
  planEscape() {
    const nav = this.game.nav;
    const exitPref = this.game.map.npcsCanLeave && chance(0.35) ? 'exit' : chance(0.4) ? 'indoor' : null;
    let target = nav.escapeTarget(this.pos, this.lastKnown, { preferTag: exitPref, minDist: 30 });
    if (!target) target = nav.escapeTarget(this.pos, this.lastKnown, {});
    this.goTo(target);
    this.repathT = rand(1.5, 2.5);
  }
  planHide() {
    const nav = this.game.nav;
    const t = nav.escapeTarget(this.pos, this.lastKnown, { preferTag: 'hide', minDist: 12, sample: 12 });
    if (t) { if (this.hideNode) this.hideNode.claimed = false; this.hideNode = t; t.claimed = true; this.goTo(t); }
    else { this.setState('flee'); this.planEscape(); }
  }

  // ------------------------------------------------------------------ damage
  takeHit(dmg, dir, heavy) {
    if (!this.alive && this.state !== 'crawl') return false;
    if (this.firstHitRecognized === undefined) this.firstHitRecognized = this.recognized;
    this.health -= dmg; this.hitT = 0.5; this.recognized = true; this.fear = 1.5;
    this.lastKnown.copy(this.game.monster.pos);
    this.vel.addScaledVector(dir, heavy ? 6 : 3.5);
    this.game.audio.play('gasp', this.eye(), { pitch: this.body.female ? 1.2 : 0.85, vol: 1 });
    this.game.emitNoise(this.pos, 25, 'scream', this);
    if (this.health <= 0 || this.state === 'crawl') { this.goDown(); return true; }
    if (this.state === 'confront' && this.role !== 'civilian') return false;
    this.setState('flee'); this.planEscape(); this.stamina += 8;
    return false;
  }
  goDown() {
    this.health = Math.max(this.health, 0);
    this.setState('downed'); this.downedT = 0; this.path = null;
    this.downedDur = rand(14, 22);
    this.game.audio.play('thud', this.pos, { vol: 0.8 });
    if (this.hideNode) { this.hideNode.claimed = false; this.hideNode = null; }
    this.game.stats && this.game.stats.onDowned(this);
  }

  // ------------------------------------------------------------------ update
  update(dt, lod) {
    this.t += dt; this.stateT += dt; this.sayCD = (this.sayCD || 0) - dt; this.lastSeenT += dt;
    this.hitT = Math.max(0, this.hitT - dt); this.flinchT = Math.max(0, this.flinchT - dt);
    const g = this.game, m = g.monster;
    // perception (staggered)
    this.percT -= dt;
    if (this.percT <= 0 && this.alive) { const step = lod > 1 ? 0.5 : 0.18; this.perceive(step); this.percT = step; }
    this.suspicion = Math.max(0, this.suspicion - dt * (this.seesMonster ? 0 : 0.035));
    this.fear = Math.max(0, this.fear - dt * (this.seesMonster ? 0 : 0.025));
    this.nervousBonus = Math.max(0, this.nervousBonus - dt * 0.003);

    let speed = 0; let face = null;
    const S = this.state;
    const run = (5.0 + (this.P.speed - 1) * 4) * (this.stamina > 0 ? 1 : 0.68) * (this.body.child ? 0.85 : 1);
    switch (S) {
      case 'idle': {
        if (this.static) { if (this.def.faceYaw !== undefined) face = this.def.faceYaw; }
        this.activityT -= dt;
        if (this.activityT <= 0 && !this.static) this.chooseNext();
        this.voiceT -= dt;
        if (this.voiceT <= 0) { this.voiceT = rand(10, 30); if (this.activity === 'phone') this.say('phone'); }
        break;
      }
      case 'walk': {
        speed = this.def.walkSpeed || (1.35 + (this.id % 3) * 0.1);
        if (this.nervousBonus > 0.3) speed *= 1.25;
        if (this.followPath(dt, speed)) { this.setState('idle'); this.activityT = rand(6, 20); this.activity = this.goal && this.goal.activity ? this.goal.activity : pick(['stand', 'look', 'phone', 'stand', 'smoke']); if (this.goal && this.goal.faceYaw !== undefined) this.def.faceYaw = this.goal.faceYaw; this.tryStartTalk(); }
        speed = this.curSpeed;
        break;
      }
      case 'talk': {
        if (this.talkPartner) face = Math.atan2(this.talkPartner.pos.x - this.pos.x, this.talkPartner.pos.z - this.pos.z);
        this.voiceT -= dt;
        if (this.voiceT <= 0 && this.talkLead) {
          // alternate speakers
          const speaker = this.talkTurn ? this.talkPartner : this; this.talkTurn = !this.talkTurn;
          if (speaker) speaker.say('chat'); this.voiceT = rand(2.5, 5);
        }
        if (this.stateT > this.stateDur || !this.talkPartner) { this.setState('idle'); this.activityT = 0.1; }
        break;
      }
      case 'uneasy': {
        face = Math.atan2(this.stimulus.x - this.pos.x, this.stimulus.z - this.pos.z);
        if (this.stateT > this.stateDur) {
          if (this.suspicion > 0.45 && chance(this.P.investigate)) { this.setState('investigate'); this.say('investigate'); this.invPhase = 0; const n = g.nav.nearest(this.stimulus, 20); if (n) this.goTo(n); }
          else if (this.suspicion > 0.7 && chance(0.5)) { this.nervousBonus = 0.6; this.setState('walk'); const n = g.nav.escapeTarget(this.pos, this.stimulus, { preferTag: 'indoor', minDist: 15 }); this.goTo(n); }
          else { if (chance(0.4)) this.say('sawNothing'); this.nervousBonus = Math.min(1, this.nervousBonus + 0.25); this.setState('idle'); this.activity = 'look'; this.activityT = rand(3, 8); }
        }
        break;
      }
      case 'investigate': {
        if (this.path) { if (this.followPath(dt, 1.1)) { this.path = null; this.stateT = 0; } speed = this.curSpeed; }
        else {
          this.activity = 'look';
          if (this.stateT > rand(4, 7)) { this.say('sawNothing'); this.suspicion *= 0.4; this.nervousBonus = Math.min(1, this.nervousBonus + 0.3); this.setState('idle'); this.activityT = rand(2, 5); }
        }
        break;
      }
      case 'flee': {
        this.stamina -= dt;
        if (this.path) {
          this.repathT -= dt;
          if (this.repathT <= 0) {
            this.repathT = rand(1.2, 2.2);
            // if the threat is between us and where we're going, re-plan
            const tgt = this.path[Math.min(this.pathI, this.path.length - 1)].pos;
            const toT = Math.atan2(tgt.x - this.pos.x, tgt.z - this.pos.z), toM = Math.atan2(this.lastKnown.x - this.pos.x, this.lastKnown.z - this.pos.z);
            if (Math.abs(angleDiff(toT, toM)) < 0.6 && this.lastKnown.distanceTo(this.pos) < 15) this.planEscape();
          }
          const erratic = this.P.erratic > 0 && chance(this.P.erratic * dt * 0.5);
          if (erratic) { this.planEscape(); if (chance(0.3)) { this.setState('cower'); this.stateDur = rand(1.5, 3); } }
          if (this.followPath(dt, run)) {
            this.path = null;
            if (this.goal && this.goal.tags.has('exit') && this.lastSeenT > 3) { this.escape(); return; }
          }
          speed = this.curSpeed;
          if (this.voiceT <= 0) { this.voiceT = rand(3, 6); if (chance(0.5)) { this.say('flee'); g.audio.play('help', this.eye(), { pitch: this.body.female ? 1.3 : 0.9 }); g.emitNoise(this.pos, 30, 'scream', this); } else g.audio.play('breathNPC', this.eye(), { vol: 0.4 }); }
          this.voiceT -= dt;
        } else {
          if (this.lastSeenT > 6) {
            if (chance(0.5) && g.nav.hide.length) { this.setState('hide'); this.planHide(); }
            else if (g.map.allowCalls && chance(0.6)) { this.setState('call'); this.stateDur = rand(6, 10); }
            else { this.setState('hide'); this.hideNode = null; }
          } else this.planEscape();
        }
        break;
      }
      case 'hide': {
        if (this.path) { if (this.followPath(dt, run * 0.9)) this.path = null; speed = this.curSpeed; this.closeDoorsBehind(); }
        else {
          this.activity = 'cower';
          if (this.hideNode && this.hideNode.faceYaw !== undefined) face = this.hideNode.faceYaw;
          this.voiceT -= dt;
          if (this.voiceT <= 0) { this.voiceT = rand(6, 14); if (chance(0.5)) this.say('hide'); else g.audio.play('cry', this.eye(), { vol: 0.2 }); }
          if (this.seesMonster && m.pos.distanceTo(this.pos) < 7) { this.setState('flee'); this.planEscape(); if (this.hideNode) this.hideNode.claimed = false; }
          if (this.stateT > 45 && this.lastSeenT > 30) this.calmDown();
          if (g.map.allowCalls && !this.called && this.stateT > 8 && this.lastSeenT > 8) { this.called = true; this.setState('call'); this.stateDur = rand(6, 9); }
        }
        break;
      }
      case 'call': {
        this.activity = 'call';
        if (this.stateT < 0.1) this.say('call', true);
        if (this.stateT > this.stateDur) { g.callForHelp && g.callForHelp(this.pos); this.called = true; this.setState('hide'); this.path = null; }
        if (this.seesMonster && m.pos.distanceTo(this.pos) < 10) { this.setState('flee'); this.planEscape(); }
        break;
      }
      case 'cower': {
        this.activity = 'cower';
        if (this.stateT > (this.stateDur || 3)) { this.setState('flee'); this.planEscape(); }
        break;
      }
      case 'confront': this.updateConfront(dt); speed = this.curSpeed || 0; face = this.confrontFace; break;
      case 'corpse': break;
      case 'downed': {
        this.downedT += dt;
        if (this.bleeding) { if (Math.random() < dt * 6) g.fx.bloodDrip(this.center(), 1); if (Math.random() < dt * 0.8) g.map.addBlood(this.pos, 0.7); if (this.downedT > this.downedDur) { this.becomeCorpse(); g.npcs.onRemoved(this, 'killed'); break; } }
        this.voiceT -= dt; if (this.voiceT <= 0) { this.voiceT = rand(4, 9); if (chance(0.5)) this.say('downed'); else g.audio.play('cry', this.eye(), { vol: 0.25 }); }
        if (this.downedT > this.downedDur) { this.setState('crawl'); this.crawlDir = Math.atan2(this.pos.x - m.pos.x, this.pos.z - m.pos.z); }
        break;
      }
      case 'crawl': {
        speed = 0.45; face = this.crawlDir;
        if (this.stateT > 12) { this.health = 30; this.setState('flee'); this.planEscape(); this.stamina = 5; }
        const dir = _v1.set(Math.sin(this.crawlDir), 0, Math.cos(this.crawlDir));
        this.moveDir(dt, dir, speed);
        break;
      }
      case 'fed': break;
      case 'dissolve': {
        this.dissolveT += dt;
        const k = clamp(this.dissolveT / 2.4, 0, 1);
        this.body.material.color.setRGB(1 - k * 0.97, 1 - k * 0.97, 1 - k * 0.97);
        this.body.faceMat.color.setRGB(1 - k, 1 - k, 1 - k);
        this.group.scale.setScalar(1 - smooth(clamp((this.dissolveT - 1.2) / 1.4, 0, 1)) * 0.999);
        if (this.dissolveT > 2.7) this.remove();
        break;
      }
    }
    if (this.hitT > 0 && this.alive) speed *= 0.3;
    // momentum from hits / pushes
    if (this.vel.lengthSq() > 0.01 && S !== 'fed') {
      this.pos.addScaledVector(this.vel, dt); this.vel.multiplyScalar(Math.exp(-dt * 5));
      this.collide();
    }
    // facing
    if (face !== null) this.yaw = dampAngle(this.yaw, face, 5, dt);
    // separation from the monster's body (it can shove people)
    if (this.alive || S === 'crawl') {
      const dx = this.pos.x - m.pos.x, dz = this.pos.z - m.pos.z, dd = Math.hypot(dx, dz);
      if (dd < 0.85 && dd > 0.01 && Math.abs(this.pos.y - m.pos.y) < 1.5) { this.pos.x += dx / dd * (0.85 - dd); this.pos.z += dz / dd * (0.85 - dd); }
    }
    this.animate(dt, lod);
    this.group.position.copy(this.pos); this.group.rotation.y = this.yaw;
    this.updateFlashlight();
  }

  closeDoorsBehind() {
    if (!this.passedDoor) return;
    const d = this.passedDoor;
    if (d.open && d.pos.distanceTo(this.pos) > 1.6 && d.pos.distanceTo(this.pos) < 4 && this.game.monster.pos.distanceTo(d.pos) > 1.5) { d.toggle(this.pos, this.game); this.passedDoor = null; }
  }

  becomeCorpse() {
    this.held = false; this.bleeding = false; this.flashOn = false;
    if (this.hideNode) { this.hideNode.claimed = false; this.hideNode = null; }
    this.setState('corpse'); this.body.setExpression('fear');
    this.corpseT = this.game.time;
    if (this.beam) this.beam.visible = false;
  }

  calmDown() {
    this.recognized = false; this.alerted = false; this.suspicion = 0.2; this.fear = 0.2; this.nervousBonus = 1;
    if (this.hideNode) { this.hideNode.claimed = false; this.hideNode = null; }
    this.say('calmDown');
    this.setState('idle'); this.activity = 'look'; this.activityT = rand(4, 8);
  }
  escape() {
    // reached the edge of the map and got away
    this.game.npcs.onEscaped(this);
    this.remove();
  }

  updateConfront(dt) {
    const g = this.game, m = g.monster; const d = this.pos.distanceTo(m.pos);
    const armed = this.role === 'searcher' || this.role === 'guard';
    const target = this.seesMonster ? m.pos : this.lastKnown;
    this.confrontFace = Math.atan2(target.x - this.pos.x, target.z - this.pos.z);
    this.attackCD -= dt; this.curSpeed = 0;
    this.activity = armed ? 'aim' : 'confront';
    // lose nerve
    if (!armed && (this.health < 50 || this.fear > 2.2 || (d < 2.5 && chance(dt * 0.8)))) { this.setState('flee'); this.planEscape(); return; }
    if (armed && this.health < 35) { this.setState('flee'); this.planEscape(); return; }
    if (!this.seesMonster && this.lastSeenT > 10) {
      if (armed) { this.setState('investigate'); const n = g.nav.nearest(this.lastKnown, 20); if (n) this.goTo(n); } else this.calmDown();
      return;
    }
    const want = armed ? 11 : 6;
    if (!this.seesMonster || d > want + 4) {
      // approach last known position
      if (!this.path || this.repathT <= 0) { const n = g.nav.nearest(target, 25); if (n) this.goTo(n); this.repathT = 1.5; }
      this.repathT -= dt;
      if (this.path) { this.followPath(dt, armed ? 3.2 : 2.6); }
    } else if (d < want - 3 && armed) {
      const away = _v1.set(this.pos.x - m.pos.x, 0, this.pos.z - m.pos.z).normalize();
      this.moveDir(dt, away, 2.2); this.walkBack = true;
    }
    if (this.seesMonster && this.attackCD <= 0) {
      if (armed && d < 30) {
        this.attackCD = rand(1.8, 3); this.say('armed'); g.combat.npcShoot(this, m);
      } else if (!armed && d < 14 && d > 3) {
        this.attackCD = rand(2.5, 4); this.throwT = 0.6; g.combat.npcThrow(this, m); this.say('confront');
      } else if (!armed && d <= 2.2) {
        this.attackCD = rand(1.5, 2.5); this.swingT = 0.5; g.combat.npcMelee(this, m);
      }
    }
    if (this.voiceT <= 0) { this.voiceT = rand(3, 6); if (!armed) this.say('confront'); }
    this.voiceT -= dt;
  }

  chooseNext() {
    const g = this.game;
    // routine: go somewhere, maybe enter a building, maybe join someone
    if (this.def.patrol && this.def.patrol.length) {
      this.patrolI = ((this.patrolI ?? -1) + 1) % this.def.patrol.length;
      this.setState('walk'); this.goTo(this.def.patrol[this.patrolI]); return;
    }
    const r = Math.random();
    let n = null;
    if (r < 0.65) n = g.nav.randomNear(this.home || this.pos, this.def.roam || 45, 'activity');
    if (!n) n = g.nav.randomNear(this.pos, 40);
    if (n && !n.claimed) { this.setState('walk'); if (!this.goTo(n)) { this.setState('idle'); this.activityT = rand(4, 10); } }
    else { this.activityT = rand(4, 10); this.activity = pick(['stand', 'look', 'phone']); }
  }

  tryStartTalk() {
    if (this.role !== 'civilian' && this.role !== 'explorer') return;
    for (const o of this.game.npcs.list) {
      if (o === this || o.state !== 'idle' || o.talkPartner || !o.alive || o.static) continue;
      if (o.pos.distanceTo(this.pos) < 4.5 && chance(0.75)) {
        this.setState('talk'); o.setState('talk');
        this.talkPartner = o; o.talkPartner = this; this.talkLead = true; o.talkLead = false;
        this.stateDur = o.stateDur = rand(15, 40); this.voiceT = 0.5;
        return;
      }
    }
  }

  // ------------------------------------------------------------------ movement
  followPath(dt, speed) {
    if (!this.path || this.pathI >= this.path.length) { this.curSpeed = 0; return true; }
    const node = this.path[this.pathI];
    const tp = node.pos;
    const dx = tp.x - this.pos.x, dz = tp.z - this.pos.z; const d = Math.hypot(dx, dz);
    const last = this.pathI === this.path.length - 1;
    // doors on the way
    for (let k = this.pathI; k < Math.min(this.path.length, this.pathI + 2); k++) {
      const dn = this.path[k].door;
      if (dn && !dn.open && !dn.locked && dn.pos.distanceTo(this.pos) < 2.2) { dn.toggle(this.pos, this.game); this.passedDoor = dn; }
    }
    if (d < (last ? 0.45 : speed > 3 ? 1.2 : 0.7)) {
      this.pathI++;
      if (this.pathI >= this.path.length) { this.curSpeed = 0; const cb = this.onArrive; this.onArrive = null; cb && cb(); return true; }
    }
    const dir = _v1.set(dx / (d || 1), 0, dz / (d || 1));
    this.moveDir(dt, dir, last && d < 1.5 ? Math.min(speed, 1.2) : speed);
    // stuck detection
    this.stuckT += dt;
    if (this.stuckT > 2) {
      if (this.pos.distanceTo(this.lastProgress) < 0.5) { this.pathI++; if (this.pathI >= this.path.length) { this.curSpeed = 0; return true; } }
      this.stuckT = 0; this.lastProgress.copy(this.pos);
    }
    return false;
  }
  moveDir(dt, dir, speed) {
    this.curSpeed = damp(this.curSpeed || 0, speed, 6, dt);
    // separation from nearby npcs
    for (const o of this.game.npcs.near(this.pos, 1.2)) {
      if (o === this || !o.alive) continue;
      const ox = this.pos.x - o.pos.x, oz = this.pos.z - o.pos.z, od = Math.hypot(ox, oz);
      if (od < 0.7 && od > 0.01) { dir.x += ox / od * 0.6; dir.z += oz / od * 0.6; }
    }
    const l = Math.hypot(dir.x, dir.z) || 1;
    this.pos.x += dir.x / l * this.curSpeed * dt; this.pos.z += dir.z / l * this.curSpeed * dt;
    if (!this.walkBack) this.yaw = dampAngle(this.yaw, Math.atan2(dir.x, dir.z), this.curSpeed > 3 ? 9 : 6, dt);
    this.walkBack = false;
    this.collide();
  }
  collide() {
    const w = this.game.world;
    w.resolve(this.pos, 0.28, 1.7 * this.H, 0.55);
    const gr = w.groundAt(this.pos.x, this.pos.z, this.pos.y, 0.2, 0.6);
    if (Math.abs(gr.y - this.pos.y) < 0.7) this.pos.y = damp(this.pos.y, gr.y, 18, 1 / 60);
    else if (gr.y < this.pos.y) this.pos.y = Math.max(gr.y, this.pos.y - 0.15);
    this.game.map.clampBounds && this.game.map.clampBounds(this.pos);
  }

  // ------------------------------------------------------------------ animation
  animate(dt, lod) {
    if (lod > 2 && (this.t * 60 | 0) % 3) return; // far: update pose every third frame
    if (this.state === 'corpse' && this.corpseSettled) return;
    if (this.state === 'corpse' && this.game.time - this.corpseT > 2) this.corpseSettled = true;
    const B = this.B, H = this.H, t = this.t;
    const sp = this.curSpeed || 0;
    const runW = clamp((sp - 1.8) / 2.5, 0, 1), walkW = clamp(sp / 1.3, 0, 1);
    const stride = lerp(1.35, 2.6, runW) * H;
    this.ph = (this.ph + sp * dt / stride) % 1;
    const ph = this.ph * Math.PI * 2;
    const T = {}; const set = (k, x = 0, y = 0, z = 0) => { T[k] = [x, y, z]; };
    const breath = Math.sin(t * 1.6 + this.id);
    let hipY = this.body.hipY - Math.abs(Math.cos(ph)) * 0.03 * walkW - runW * 0.05;
    let hipsRot = [runW * 0.12, Math.sin(ph) * 0.1 * walkW, 0];
    set('spine', runW * 0.12 + breath * 0.01, -Math.sin(ph) * 0.08 * walkW, 0);
    set('chest', runW * 0.08 - breath * 0.015, -Math.sin(ph) * 0.06 * walkW, 0);
    set('neck', 0, 0, 0);
    let headX = -runW * 0.15, headY = 0;
    // legs
    for (const [sd, o] of [['L', 0], ['R', Math.PI]]) {
      const p = ph + o; const amp = lerp(0.42, 0.85, runW) * walkW;
      const th = -Math.sin(p) * amp;
      const knee = (0.08 + Math.max(0, Math.cos(p)) * lerp(0.55, 1.5, runW)) * walkW + 0.05;
      set('thigh' + sd, th - runW * 0.15, 0, 0); set('shin' + sd, knee, 0, 0); set('foot' + sd, -th * 0.4 - knee * 0.35, 0, 0);
    }
    // arms
    for (const [sd, s, o] of [['L', 1, Math.PI], ['R', -1, 0]]) {
      const sw = Math.sin(ph + o);
      set('upperArm' + sd, sw * lerp(0.35, 0.9, runW) * walkW + 0.05, 0, s * (0.09 + runW * 0.1));
      set('foreArm' + sd, -lerp(0.2, 1.5, runW) - (1 - walkW) * 0.1, 0, 0);
      set('hand' + sd, 0, 0, 0);
    }
    // activity / state poses
    const A = this.state === 'idle' || this.state === 'investigate' || this.state === 'hide' || this.state === 'call' || this.state === 'cower' || this.state === 'confront' ? this.activity : null;
    const still = sp < 0.3;
    if (this.state === 'talk') {
      const g = Math.sin(t * 2.3 + this.id) * 0.5 + 0.5;
      set('upperArmR', -0.3 - g * 0.3, 0, -0.25); set('foreArmR', -1.1 - g * 0.4, 0.3, 0);
      if (this.id % 2) { set('upperArmL', -0.2, 0, 0.2); set('foreArmL', -1.2, -0.3, 0); }
      headY = Math.sin(t * 0.7) * 0.1;
    }
    if (still && A === 'phone') { set('upperArmR', -0.25, 0, -0.55); set('foreArmR', -2.35, 0.5, 0); headX = 0.25; }
    if (still && A === 'call') { set('upperArmR', -0.3, 0, -0.6); set('foreArmR', -2.4, 0.5, 0); }
    if (still && A === 'smoke') { const k = Math.max(0, Math.sin(t * 0.4 + this.id)); set('upperArmR', -0.35 * k, 0, -0.2); set('foreArmR', -0.5 - k * 1.8, 0.4 * k, 0); }
    if (A === 'look' || this.state === 'uneasy' || this.state === 'investigate') { headY = Math.sin(t * 0.6 + this.id) * 0.8; headX = Math.sin(t * 0.37) * 0.1; }
    if (this.state === 'uneasy') { headY *= 0.3; set('upperArmL', 0.1, 0, 0.15); set('upperArmR', 0.1, 0, -0.15); }
    if (A === 'sit') { hipY = 0.5 * H; set('thighL', -1.5, 0, 0.05); set('thighR', -1.5, 0, -0.05); set('shinL', 1.45, 0, 0); set('shinR', 1.45, 0, 0); set('footL', 0, 0, 0); set('footR', 0, 0, 0); set('spine', -0.1, 0, 0); }
    if (A === 'lean') { set('spine', -0.15, 0, 0); hipsRot[2] = 0.05; set('thighL', 0.15, 0, 0); set('shinL', 0.25, 0, 0); }
    if (A === 'work') { set('spine', 0.5 + Math.sin(t * 2) * 0.05, 0, 0); set('upperArmL', -0.9, 0, 0.1); set('upperArmR', -0.9 + Math.sin(t * 3) * 0.2, 0, -0.1); set('foreArmL', -0.6, 0, 0); set('foreArmR', -0.6, 0, 0); headX = 0.5; }
    if (A === 'cower') {
      const trem = Math.sin(t * 25) * 0.02;
      hipY = 0.42 * H; hipsRot = [0.75, 0, 0];
      set('thighL', -2.1, 0, 0.25); set('thighR', -2.1, 0, -0.25); set('shinL', 2.3, 0, 0); set('shinR', 2.3, 0, 0); set('footL', -0.2, 0, 0); set('footR', -0.2, 0, 0);
      set('spine', 0.35 + trem, 0, 0); set('chest', 0.25, 0, 0);
      set('upperArmL', -2.5 + trem, 0, 0.5); set('upperArmR', -2.5 - trem, 0, -0.5); set('foreArmL', -1.9, 0, 0); set('foreArmR', -1.9, 0, 0);
      headX = 0.7; headY = 0;
      if (this.state === 'hide' && Math.sin(t * 0.3 + this.id) > 0.85) { headX = -0.1; headY = Math.sin(t * 2) * 0.4; } // peeking
    }
    if (this.flashlight && this.flashOn && (A === 'look' || this.state === 'investigate' || this.state === 'walk' || A === 'aim' || this.state === 'uneasy')) {
      const sw = Math.sin(t * 0.8 + this.id) * 0.35;
      set('upperArmR', -1.25 + Math.sin(t * 0.5) * 0.08, sw * 0.5, -0.05); set('foreArmR', -0.15, 0, 0); set('handR', 0.1, 0, 0);
      if (A === 'aim') { set('upperArmL', -1.3, 0, -0.25); set('foreArmL', -0.4, 0, 0); }
    }
    if (A === 'confront') {
      const k = this.throwT > 0 ? 1 : 0; this.throwT = Math.max(0, (this.throwT || 0) - dt);
      if (k) { const u = 1 - this.throwT / 0.6; set('upperArmR', u < 0.5 ? -2.8 : -1.0, 0, -0.3); set('foreArmR', u < 0.5 ? -1.5 : -0.2, 0, 0); }
      else { set('upperArmR', -0.6, 0, -0.35); set('foreArmR', -1.6, 0, 0); set('upperArmL', -0.7, 0, 0.35); set('foreArmL', -1.6, 0, 0); set('spine', 0.15, 0, 0); }
      if (this.swingT > 0) { this.swingT -= dt; const u = 1 - this.swingT / 0.5; set('upperArmR', u < 0.4 ? -2.6 : -0.8, 0, -0.5); set('foreArmR', -0.3, 0, 0); }
    }
    if (this.state === 'flee' && runW > 0.3 && this.P.erratic > 0.3) headY = Math.sin(t * 3) * 0.6; // panicked look-backs
    if (this.flinchT > 0 && this.alive) { const k = this.flinchT / 1.2; set('upperArmL', -2.4 * k, 0, 0.6 * k); set('upperArmR', -2.4 * k, 0, -0.6 * k); set('foreArmL', -1.8 * k, 0, 0); set('foreArmR', -1.8 * k, 0, 0); headX = 0.5 * k; }
    if (this.hitT > 0 && this.alive) { set('spine', -0.4, 0, 0.2); set('chest', -0.3, 0, 0); headX = -0.4; }
    // lying states
    if (this.state === 'fed' && this.held) {
      // dangling in the monster's grip, struggling less as it loses limbs
      const k = this.struggle || 0; const fl = Math.sin(t * 13) * k, fl2 = Math.sin(t * 11 + 1) * k;
      hipY = this.body.hipY; hipsRot = [0.25 + fl * 0.1, 0, fl2 * 0.08];
      set('spine', -0.2 + fl * 0.2, 0, 0); set('chest', -0.2, 0, fl2 * 0.1);
      set('thighL', 0.1 - fl * 0.7, 0, 0.12); set('thighR', 0.1 + fl * 0.7, 0, -0.12); set('shinL', 0.3 + Math.max(0, fl) * 0.8, 0, 0); set('shinR', 0.3 + Math.max(0, -fl) * 0.8, 0, 0);
      set('footL', 0.5, 0, 0); set('footR', 0.5, 0, 0);
      set('upperArmL', -1.6 + fl2 * 1.2, 0, 0.5); set('upperArmR', -1.6 - fl2 * 1.2, 0, -0.5); set('foreArmL', -1.2, 0, 0); set('foreArmR', -1.2, 0, 0);
      headX = k > 0.2 ? -0.5 + fl * 0.3 : 0.9; headY = Math.sin(t * 7) * 0.4 * k;
    } else if (['downed', 'fed', 'dissolve', 'corpse'].includes(this.state)) {
      const tw = this.state === 'corpse' ? 0 : this.state === 'fed' ? Math.sin(t * 9) * 0.03 : Math.sin(t * 1.5) * 0.05;
      hipY = 0.13 * H; hipsRot = [-Math.PI / 2 + 0.05, 0, 0.1];
      set('spine', 0.05, 0, tw); set('chest', 0.05, 0, 0); set('thighL', 0.1, 0, 0.15); set('thighR', -0.2, 0, -0.1); set('shinL', 0.3, 0, 0); set('shinR', 0.6, 0, 0);
      set('upperArmL', -0.2 + tw, 0, 0.6); set('upperArmR', -0.5, 0, -0.4 - tw); set('foreArmL', -0.4, 0, 0); set('foreArmR', -1.0, 0, 0);
      set('footL', 0.6, 0, 0); set('footR', 0.6, 0, 0);
      headX = -0.2; headY = this.state === 'downed' ? Math.sin(t * 0.8) * 0.4 * (this.bleeding ? 0.3 : 1) : 0.6;
    }
    if (this.state === 'crawl') {
      const c = Math.sin(t * 4);
      hipY = 0.16 * H; hipsRot = [Math.PI / 2 - 0.05, 0, 0];
      set('spine', -0.1, 0, c * 0.08); set('chest', -0.15, 0, 0);
      set('upperArmL', -Math.PI + 0.3 + c * 0.5, 0, 0.3); set('upperArmR', -Math.PI + 0.3 - c * 0.5, 0, -0.3); set('foreArmL', -0.6, 0, 0); set('foreArmR', -0.6, 0, 0);
      set('thighL', c * 0.3, 0, 0.1); set('thighR', -c * 0.3, 0, -0.1); set('shinL', 0.4, 0, 0); set('shinR', 0.4, 0, 0);
      headX = -0.9;
    }
    // head look toward stimulus when alerted
    if (this.recognized && this.alive && this.state !== 'hide') {
      const toM = Math.atan2(this.lastKnown.x - this.pos.x, this.lastKnown.z - this.pos.z);
      headY = clamp(angleDiff(this.yaw, toM), -1.2, 1.2) * (this.state === 'flee' ? 0.5 : 0.8);
    }
    if (this.stareT > 0) { this.stareT -= dt; const c = this.game.camera.position; headY = clamp(angleDiff(this.yaw, Math.atan2(c.x - this.pos.x, c.z - this.pos.z)), -1.5, 1.5); headX = -0.05; }
    set('head', headX, headY * 0.6, 0); T.neck[1] = headY * 0.4;
    this.headYaw = headY;
    // apply
    const rate = 10;
    B.hips.position.y = damp(B.hips.position.y, hipY, rate, dt);
    const ch = this.cur.hips || (this.cur.hips = [0, 0, 0]);
    for (let i = 0; i < 3; i++) ch[i] = damp(ch[i], hipsRot[i], ['downed', 'fed', 'crawl', 'corpse'].includes(this.state) && !this.held ? 5 : rate, dt);
    B.hips.rotation.set(ch[0], ch[1], ch[2]);
    for (const k in T) {
      const c = this.cur[k] || (this.cur[k] = [0, 0, 0]);
      c[0] = damp(c[0], T[k][0], rate, dt); c[1] = damp(c[1], T[k][1], rate, dt); c[2] = damp(c[2], T[k][2], rate, dt);
      B[k].rotation.set(c[0], c[1], c[2]);
    }
  }

  updateFlashlight() {
    if (!this.beam) return;
    const on = this.flashOn && !['downed', 'fed', 'dissolve', 'crawl', 'corpse'].includes(this.state);
    this.beam.visible = on;
    if (on) { this.B.handR.getWorldDirection(_v1); this.beamDir.set(0, -1, 0).applyQuaternion(this.B.handR.getWorldQuaternion(_q)); }
  }

  remove() {
    if (this.removed) return;
    this.removed = true;
    if (this.hideNode) this.hideNode.claimed = false;
    this.group.parent && this.group.parent.remove(this.group);
    this.body.mesh.geometry.dispose();
  }
}
const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _q = new THREE.Quaternion();
