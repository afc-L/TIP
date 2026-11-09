'use strict';
// =====================================================================================
// STORY — script helpers + every story script. Scripts are async functions that the
// overworld runs when you talk to an NPC, step on a trigger, or an NPC spots you.
// =====================================================================================
MB.CHAPTERS = [
  'Prologue: A New Partner', 'Chapter 1: The Sprout Badge', 'Chapter 2: Whispers in Moonveil', 'Chapter 3: The Iron Mountain', 'Chapter 4: The Great Becoming',
  'Chapter 5: Storm and Steel', 'Chapter 6: Ashes and Stars', 'Chapter 7: The Frozen North', 'Chapter 8: Eclipse over the Capital', 'Chapter 9: Dawn and Dusk',
  'Chapter 10: The Championship', 'Chapter 11: A New Horizon', 'Chapter 12: Neo Eclipse', 'Chapter 13: The Forgotten Expanse', 'Chapter 14: Origin',
];
MB.checkCond = function (cond) {
  if (!cond) return true;
  const S = MB.state;
  return cond.split('&').every((c) => {
    c = c.trim(); if (!c) return true;
    let neg = false;
    if (c.startsWith('!')) { neg = true; c = c.slice(1); }
    if (c.startsWith('(') && c.endsWith(')')) c = c.slice(1, -1);
    let v;
    if (c.startsWith('time=')) v = MB.World.timeOfDay() === c.slice(5) || (c.slice(5) === 'day' && MB.World.timeOfDay() !== 'night');
    else if (c.startsWith('badges>=')) v = S.badges.length >= +c.slice(8);
    else if (c.startsWith('q_done:')) v = !!(S.quests[c.slice(7)] && S.quests[c.slice(7)].done);
    else if (c.startsWith('caught_')) v = !!(S.dex[c.slice(7)] && S.dex[c.slice(7)].caught) || !!S.flags[c];
    else if (c.startsWith('day=')) v = MB.World.dayOfWeek() === +c.slice(4);
    else if (c.startsWith('season=')) v = MB.World.season() === c.slice(7);
    else if (c.startsWith('has:')) v = MB.Bag.count(c.slice(4)) > 0 || !!S.keyItems[c.slice(4)];
    else if (c.startsWith('v_badge')) v = S.vBadges.length >= +c.slice(7);
    else if (c === 'never') v = false;
    else v = !!S.flags[c];
    return neg ? !v : v;
  });
};

// ---------------- helpers used by scripts ----------------
MB.Sc = {
  flag: (f) => !!MB.state.flags[f],
  set(f, v = true) { MB.state.flags[f] = v; MB.Quests && MB.Quests.onFlag(f); MB.Over && MB.Over.refresh(); },
  async give(id, qty = 1, quiet) {
    const it = MB.ITEMS[id];
    if (it.cat === 'key') MB.state.keyItems[id] = true; else MB.Bag.add(id, qty);
    if (!quiet) { MB.audio.sfx('item'); await MB.say(`${MB.state.name} received ${qty > 1 ? qty + ' ' : ''}${it.name}${qty > 1 && !/s$/.test(it.name) ? 's' : ''}!`); }
    if (it.cat === 'mega') { MB.Achievements.unlock('first_stone'); MB.Achievements.check(); }
  },
  async giveMon(sp, lvl, opts = {}) {
    const m = MB.Mon.create(sp, lvl, Object.assign({ ot: MB.state.trainerId, met: MB.World.mapName() }, opts));
    MB.audio.sfx('catch');
    await MB.say(`${MB.state.name} received ${m.name}!`);
    if (await MB.yesno(`Give a nickname to ${m.name}?`)) { m.name = await MB.inputText(`Nickname for ${m.name}?`, m.name, 12); }
    await MB.Collection.addCaught(m, { gift: true });
    return m;
  },
  heal() { for (const m of MB.state.party) if (!m.egg) MB.Mon.heal(m); },
  async healJingle() { MB.Sc.heal(); MB.audio.sfx('heal'); await MB.Game.wait(1.0); },
  async battle(key, opts = {}) { return MB.Battles.boss(key, opts); },
  chapter(n) { if ((MB.state.chapter || 0) < n) { MB.state.chapter = n; MB.toast(MB.CHAPTERS[n], '#503080'); } },
  rivalName: () => MB.state.rivalName || 'Kael',
  starterLine: () => MB.state.starter,
  rivalStarter: () => ({ emberfox: 'aquaphin', aquaphin: 'leafling', leafling: 'emberfox' }[MB.state.starter] || 'aquaphin'),
};

MB.SCRIPTS = {};
const SC = MB.SCRIPTS;
const S_ = () => MB.state;
const sp = (who) => who;

// ===================== PROLOGUE =====================
SC.mom_talk = async () => {
  const S = S_();
  if (!S.flags.got_starter) return MB.sayAll(['Good morning, sweetie! Professor Hazel called — she wants to see you at the lab today.', 'I think today\'s the day you get your very first partner!'], 'Mom');
  if (!S.keyItems.running_shoes) {
    await MB.say(`Oh my, ${S.name}! Is that your new partner? It\'s adorable!`, { speaker: 'Mom' });
    await MB.say('Take these Trail Shoes. Hold Shift to run. And come home whenever you need a rest, okay?', { speaker: 'Mom' });
    await MB.Sc.give('running_shoes');
    return;
  }
  await MB.say('You look tired! Let me take care of your team.', { speaker: 'Mom' });
  await MB.Sc.healJingle();
  await MB.say(S.badges.length ? `${S.badges.length} badge${S.badges.length > 1 ? 's' : ''} already! I\'m so proud of you.` : 'Do your best out there!', { speaker: 'Mom' });
};
SC.wb_guard = async () => MB.sayAll(['Wait! You can\'t go into the tall grass without a creature of your own!', 'Professor Hazel\'s lab is right over there.']);
SC.lab_aide = async () => {
  const S = S_();
  if (S.flags.got_dex && !S.flags.aide_capsules) { await MB.say('The Professor asked me to give you these. Good luck on your journey!', { speaker: 'Lab Aide' }); await MB.Sc.give('basic_capsule', 5); MB.Sc.set('aide_capsules'); return; }
  await MB.say('The Aetherdex fills in automatically when you see or catch creatures. Try to complete it!', { speaker: 'Lab Aide' });
};
SC.prof_talk = async (ctx) => {
  const S = S_();
  const P = 'Prof. Hazel';
  if (!S.flags.got_starter) {
    MB.Sc.chapter(0);
    await MB.sayAll([`Ah, ${S.name}! Right on time. Welcome to my lab!`, 'I study how creatures and people form bonds — and how those bonds can make creatures change.', 'Aetheria is home to hundreds of species. Some are common. Some... are the stuff of legend.', `My grandson ${MB.Sc.rivalName()} already picked his partner — well, he will once you\'ve chosen yours. He insisted on going second so he\'d "have the advantage."`, 'Now then! On the table are three creatures. Choose the one that speaks to you.'], P);
    let chosen = null;
    while (!chosen) {
      const pick = await MB.Screens.starterSelect();
      const name = MB.SP[pick].name;
      const desc = { emberfox: 'the Flame-type fox. Quick and fierce, with a fire that burns brighter when it\'s in danger!', aquaphin: 'the Aqua-type dolphin. Playful and well-balanced, with a powerful tail!', leafling: 'the Nature-type fawn. Sturdy and patient, it grows mighty with time!' }[pick];
      if (await MB.yesno(`So you want ${name}, ${desc}`)) chosen = pick;
    }
    S.starter = chosen;
    const mon = MB.Mon.create(chosen, 5, { ot: S.trainerId, met: 'Willowbrook Village', ivs: { hp: 20, atk: 20, def: 20, spa: 20, spd: 20, spe: 20 }, ability: 0, friend: 90 });
    MB.audio.sfx('catch');
    await MB.say(`${S.name} received ${mon.name}!`);
    if (await MB.yesno(`Would you like to give ${mon.name} a nickname?`)) mon.name = await MB.inputText(`Nickname for ${mon.name}?`, mon.name, 12);
    await MB.Collection.addCaught(mon, { gift: true, silent: true });
    MB.Sc.set('got_starter');
    // rival enters
    const rs = MB.Sc.rivalStarter();
    await MB.say(`Gramps! I\'m here! ...Oh. ${S.name} already picked. Fine. Then I choose ${MB.SP[rs].name}!`, { speaker: MB.Sc.rivalName() });
    await MB.say('Heh, I picked the one that beats yours. That\'s called strategy.', { speaker: MB.Sc.rivalName() });
    await MB.say(`Kael, really? ...Well, a little friendly battle never hurt. Go on, you two!`, { speaker: P });
    const win = await MB.Battles.rival(0, { canLose: true });
    if (win) await MB.say('What?! I had the type advantage! ...Okay, okay. Beginner\'s luck.', { speaker: MB.Sc.rivalName() });
    else await MB.say('Ha! Told you. Strategy! ...Don\'t look so down, you did fine.', { speaker: MB.Sc.rivalName() });
    MB.Sc.heal();
    await MB.say(`I\'m heading to Verdant City to get my first badge. Catch me if you can, ${S.name}!`, { speaker: MB.Sc.rivalName() });
    await MB.sayAll(['That boy... Well! Now, take this. It\'s an Aetherdex — it records every creature you meet.', 'Help me fill it in, would you? Every page is a story waiting to be told.'], P);
    await MB.Sc.give('aetherdex');
    await MB.Sc.give('town_map');
    MB.Sc.set('got_dex');
    await MB.sayAll(['Gym Leaders across Aetheria test trainers with their badges. Collect all eight and you may challenge the Elite Championship.', 'My aide has some capsules for you. And do visit your mother before you leave!'], P);
    MB.Sc.chapter(1);
    MB.Achievements.unlock('journey_begins');
    return;
  }
  if (S.flags.champion && !S.keyItems.veloria_pass) {
    await MB.sayAll([`Champion ${S.name}! I knew it from the moment you chose ${MB.SP[S.starter].name}.`, 'I have news. Across the sea lies Veloria — a land of rifts and creatures we\'ve never documented.', 'Take this Veloria Pass. Show it at the Stormport docks. And this — a Prime Capsule. It never fails.'], P);
    await MB.Sc.give('veloria_pass'); await MB.Sc.give('master_capsule'); await MB.Sc.give('radiant_charm');
    MB.Sc.chapter(11);
    return;
  }
  const seen = MB.Dex.countSeen(), caught = MB.Dex.countCaught();
  await MB.say(`Let me see your Aetherdex... You\'ve seen ${seen} and caught ${caught} species!`, { speaker: P });
  const rate = caught < 10 ? 'Every great journey starts with a few steps. Keep going!' : caught < 40 ? 'You\'re really getting the hang of this!' : caught < 100 ? 'Impressive! Researchers would envy your data.' : caught < 200 ? 'Extraordinary! You may know more than I do now.' : 'Incredible... you\'re rewriting the textbooks!';
  await MB.say(rate, { speaker: P });
  await MB.Dex.milestoneRewards(P);
};
SC.r1_hint = async () => { if (!S_().flags.r1_hint_done) { MB.Sc.set('r1_hint_done'); await MB.say('Tip: Press Esc or X to open the menu. C opens your party, I your bag, M the map, Q your quest journal.'); } };
SC.trail_bike = async () => {
  const S = S_(), C = 'Cyclist Bea';
  if (S.keyItems.trail_bike) return MB.say('Use the Trail Bike from your Bag (Key Items) to ride twice as fast outdoors!', { speaker: C });
  if (!S.flags.badge_mira) return MB.say('I ride everywhere on my Trail Bike! Earn the Sprout Badge and maybe I\'ll lend you my spare.', { speaker: C });
  await MB.say('The Sprout Badge! You\'re going places. Get there faster with my spare Trail Bike!', { speaker: C });
  await MB.Sc.give('trail_bike');
  await MB.say('Open your Bag, go to Key Items and use it to hop on or off. It doesn\'t work indoors.', { speaker: C });
};
SC.power_gloves = async () => {
  const S = S_(), R = 'Strongman Rocco';
  if (S.keyItems.power_gloves) return MB.say('Push those boulders with pride! Strength is nothing without a good partner.', { speaker: R });
  if (!S.flags.badge_brutus) return MB.sayAll(['HNNGH! I lift boulders for fun. Brutus is my training buddy!', 'Beat him at the gym and come see me. I have something for strong trainers.'], R);
  await MB.sayAll(['You beat Brutus?! Ha! Then you\'ve earned these.', 'My old Power Gloves. With them you can push heavy boulders out of your way.'], R);
  await MB.Sc.give('power_gloves');
  await MB.say('Walk into a boulder to push it. Some hide treasure behind them!', { speaker: R });
};
SC.gate_badge = async (ctx) => MB.sayAll(ctx.npc.talk || ['You need more badges to pass.']);
SC.gate_flag = async (ctx) => MB.sayAll(ctx.npc.talk || ['You can\'t go this way yet.']);

// ===================== GYM LEADERS =====================
MB.LEADER_FLAG = { mira: 'badge_mira', voltan: 'badge_voltan', brutus: 'badge_brutus', marina: 'badge_marina', cinder: 'badge_cinder', selene: 'badge_selene', frost: 'badge_frost', darius: 'badge_darius', w_bram: 'vb_bram', w_orla: 'vb_orla', w_quill: 'vb_quill', w_tempest: 'vb_tempest', w_ysolde: 'vb_ysolde', w_ignatius: 'vb_ignatius' };
SC.leader = async (ctx, key) => {
  const S = S_();
  const L = MB.BOSSES[key];
  const fl = MB.LEADER_FLAG[key];
  const veloria = key.startsWith('w_');
  if (!S.flags[fl]) {
    const win = await MB.Battles.boss(key, { music: 'gymbattle', env: 'gym' });
    if (!win) return;
    MB.Sc.set(fl);
    if (veloria) S.vBadges.push(L.badge); else S.badges.push(L.badge);
    MB.audio.sfx('badge');
    await MB.say(`${S.name} received the ${L.badge}!`);
    MB.Achievements.unlock(veloria ? 'first_seal' : 'first_badge');
    if (L.reward) { await MB.say(L.rewardText, { speaker: L.name }); await MB.Sc.give(L.reward); }
    const ch = { mira: 2, voltan: 3, brutus: 4, marina: 5, cinder: 6, selene: 7, frost: 7, darius: 9 }[key];
    if (ch) MB.Sc.chapter(ch);
    if (key === 'darius') await MB.sayAll(['The way to Celestial Summit has opened. Valen fled there with the Heart fragments.', 'Go. End this.'], L.name);
    if (veloria && S.vBadges.length >= 6) await MB.say('You hold all six Warden Seals. The Veloria League in Zenith City awaits you.', { speaker: L.name });
    MB.Achievements.check();
    return;
  }
  // rematches after champion (once per day)
  if (S.flags.champion) {
    if (S.flags['rematch_' + key] === S.day) return MB.say('That was a battle to remember. Come back tomorrow for another!', { speaker: L.name });
    if (await MB.yesno(`${L.name}: You came back! Want a rematch at full strength?`)) {
      const win = await MB.Battles.boss(key, { music: 'gymbattle', env: 'gym', rematch: true });
      S.flags['rematch_' + key] = S.day;
      if (win) {
        S.stats.rematches = (S.stats.rematches || 0) + 1;
        const prize = { voltan: 'thundermane_stone', cinder: 'hearthound_stone', darius: 'umbrawolf_stone', frost: 'avalanchor_stone', selene: 'mentalord_stone', mira: 'aurorelle_stone' }[key];
        if (prize && !MB.Bag.count(prize) && !S.flags['got_' + prize]) { S.flags['got_' + prize] = true; await MB.say('You\'ve earned this. I kept it for a trainer worthy of it.', { speaker: L.name }); await MB.Sc.give(prize); }
        else await MB.Sc.give('rare_candy');
      }
    }
    return;
  }
  await MB.say(`${L.name}: You already have my badge. Keep pushing forward!`);
};

// ===================== RIVAL =====================
const RIVAL_TEXT = {
  2: { pre: ['Yo! Took you long enough. I already got through Moonveil while you were dawdling.', 'Those black-uniform creeps were in the forest too. Did you see them? Whatever. Battle me!'], win: 'Argh! How do you keep doing that?!', lose: 'Ha! Keep training, slowpoke.', after: 'My sister always says I rush things... Whatever. See you at the next gym!' },
  3: { pre: ['Hey. I heard you were in the Hollow when the Syndicate showed up.', 'I... I wanted to be the one who stopped them. Battle me. I need to know how far behind I am.'], win: 'Behind. Way behind. Okay. I\'ll fix that.', lose: 'Yes! See? I\'m catching up!', after: 'I\'m going to train in the waters off Stormport. Don\'t you dare fall behind me.' },
  4: { pre: ['Six badges. Same as me. Ha. My sister... she\'s the Champion, you know. Aurelia.', 'Everyone in Willowbrook expects me to be just like her. Let\'s see if I can at least beat YOU.'], win: 'Huh. You\'re really strong. ...Maybe that\'s okay.', lose: 'One step closer to Aurelia!', after: 'Hey. Be careful at the Observatory. The Syndicate\'s been heading north.' },
  5: { pre: ['The marsh is creepy, right? Stick together? ...Just kidding. Battle first!'], win: 'You\'re incredible. I mean it.', lose: 'Don\'t get cocky... oh wait, that\'s me.', after: 'Grunts are swarming toward the Capital. Something big is going down. I\'m going to help.' },
  6: { pre: ['This is it. Champion\'s Path. After this, the League. After that... my sister.', 'I\'m not doing this to prove anything to anyone anymore. I\'m doing it because I love battling. Because of you, actually.', 'So give me everything you\'ve got!'], win: 'Ha... haha. You know what? You\'re going to beat her. I can feel it. Go get \'em, partner.', lose: 'I did it! ...But don\'t you dare quit now. The League\'s waiting.', after: 'I\'ll be cheering for you. Loudly. Embarrassingly loudly.' },
};
async function rivalScript(stage, flag) {
  const R = MB.Sc.rivalName();
  const T = RIVAL_TEXT[stage];
  for (const l of T.pre) await MB.say(l, { speaker: R });
  const win = await MB.Battles.rival(stage - 1, { canLose: true, lose: T.win });
  await MB.say(win ? T.win : T.lose, { speaker: R });
  await MB.say(T.after, { speaker: R });
  MB.Sc.set(flag);
  if (stage === 5) MB.Sc.chapter(8);
}
SC.rival_2 = () => rivalScript(2, 'rival2_done');
SC.rival_3 = () => rivalScript(3, 'rival3_done');
SC.rival_4 = () => rivalScript(4, 'rival4_done');
SC.rival_5 = () => rivalScript(5, 'rival5_done');
SC.rival_6 = () => rivalScript(6, 'rival6_done');
SC.rival_v1 = async () => {
  const R = MB.Sc.rivalName();
  await MB.sayAll(['Surprise! You didn\'t think I\'d let you have Veloria all to yourself, did you?', 'Aurelia\'s been training me. And I\'ve caught creatures you\'ve never even seen. Let\'s go!'], R);
  const win = await MB.Battles.rival(7, { canLose: true });
  await MB.say(win ? 'Still unbeatable... but I\'m getting closer, right? Right?!' : 'YES! First win in a new region!', { speaker: R });
  await MB.say('The rifts here are wild. Neo Eclipse is after the Rift Core — I\'ll keep an eye on them.', { speaker: R });
  MB.Sc.set('rival_v1_done');
};
SC.rival_v2 = async () => {
  const R = MB.Sc.rivalName();
  await MB.sayAll(['Six seals. Same as me. The Veloria League is right behind me.', 'Before you go in... one more battle. For old times\' sake. No holding back!'], R);
  const win = await MB.Battles.rival(7, { canLose: true, boost: 6 });
  await MB.say(win ? 'Ha... you\'re the best rival anyone could ask for. Go win it all.' : 'I won! ...Okay, now YOU go win the League. I\'ll be cheering.', { speaker: R });
  MB.Sc.set('rival_v2_done');
};
SC.rival_rematch = async () => {
  const S = S_(), R = MB.Sc.rivalName();
  if (S.flags.rival_rm_day === S.day) return MB.say('Rematch tomorrow, champ. I need to rest my team. ...And my ego.', { speaker: R });
  if (await MB.yesno(`${R}: Hey, Champion! I\'ve been training non-stop. Rematch?`)) {
    const win = await MB.Battles.rival(7, { canLose: true });
    S.flags.rival_rm_day = S.day;
    await MB.say(win ? 'Still number one... I\'ll get you next time!' : 'I WON! Wait till Aurelia hears!', { speaker: R });
    if (win) await MB.Sc.give(MB.pick(['rare_candy', 'full_restore', 'ancient_capsule', 'power_tonic']));
  }
};

// ===================== CHAPTER 2: MOONVEIL =====================
SC.moonveil_event = async () => {
  const S = S_();
  if (S.flags.moonveil_done) return;
  const L = 'Dr. Lyra';
  await MB.say('Hand over that research journal, lady! The Syndicate wants every scrap about the "Great Becoming."', { speaker: 'Grunt' });
  await MB.say('Absolutely not! ...Oh! You there — a trainer? Please, help me!', { speaker: L });
  const w1 = await MB.Battles.grunt(['Venom', 'Shadow'], 3, 10, { intro: 'A kid? The Eclipse Syndicate doesn\'t lose to kids!' });
  if (!w1) return;
  await MB.say('Ugh! Whatever, we\'ll find the rest in the Hollow. Retreat!', { speaker: 'Grunt' });
  MB.Sc.set('moonveil_done');
  await MB.sayAll(['Thank you! I\'m Dr. Lyra Vance. I study an ancient phenomenon the old texts call the Great Becoming.', 'Today we call it Mega Evolution — a temporary transformation that unlocks a creature\'s hidden power.', 'It requires a special stone and a device to channel the bond between trainer and creature. Neither has been seen in a thousand years...', 'But those Syndicate people seem to think otherwise. I\'m heading to the Ancient Hollow ruins to investigate. Perhaps we\'ll meet again!'], L);
  await MB.Sc.give('fishing_rod');
  MB.Sc.chapter(2);
};
SC.grove_hint = async () => MB.sayAll(['The great spirit of this forest, Sylvarch, sleeps in the grove to the north.', 'It is said to wake only for one who carries the Mind Badge of Skyreach.']);

// ===================== CHAPTER 4: ANCIENT HOLLOW (Aether Gauntlet) =====================
SC.hollow_event = async () => {
  const S = S_();
  if (S.flags.hollow_done) return;
  const L = 'Dr. Lyra';
  await MB.say(`${S.name}! Thank goodness. Commander Vex of the Syndicate has broken into the temple vault!`, { speaker: L });
  await MB.say('Well, well. The little hero from the forest. The Director wants the Gauntlet and I want my bonus. Move!', { speaker: 'Vex' });
  const win = await MB.Battles.boss('vex');
  if (!win) return;
  await MB.say('Tch. Fine. Keep your shiny trinket. We already know where to look next: the Heart sleeps where the stars point.', { speaker: 'Vex' });
  MB.Sc.set('hollow_done');
  await MB.sayAll(['You did it! And look — the vault. The murals were right!', 'This is the Aether Gauntlet. The ancient Aetherians used it to channel their bond into a creature carrying an Aether Stone.', 'The stone resonates with one species only. And this one... it\'s reacting to your partner!'], L);
  await MB.Sc.give('aether_gauntlet');
  const final = MB.SP[{ emberfox: 'infernyx', aquaphin: 'leviaphin', leafling: 'arborix' }[S.starter]];
  await MB.Sc.give(final.mega.stone);
  await MB.sayAll([`When your partner fully evolves into ${final.name}, have it hold the ${MB.ITEMS[final.mega.stone].name}. Then in battle, choose MEGA EVOLVE before you attack!`, 'Only one Mega Evolution per battle — it drains the Gauntlet. The transformation lasts until the battle ends.', 'Other Aether Stones are scattered across Aetheria — hidden in caves, guarded by strong trainers, lost in ruins...', 'The fossil team at the research camp might want to talk to you, too. I\'ll study the murals. Be careful, ' + S.name + '.'], L);
  MB.Sc.chapter(4);
  MB.Achievements.unlock('gauntlet');
};
SC.hollow_mural = async () => {
  const S = S_();
  await MB.sayAll(['The mural shows a radiant heart split into three by robed figures.', 'One fragment rises as a golden dragon of dawn. One sinks as a black dragon of dusk.', 'The third is sealed far away, beyond time itself... An inscription reads:', '"Let no single hand hold the Heart. Let every bond be its own Becoming."']);
  if (S.flags.champion && !S.flags.mural_secret) { MB.Sc.set('mural_secret'); await MB.say('...Now that you look closely, there\'s a faint glow behind the mural. The way to the Forgotten Expanse lies through the Hollow Depths.'); }
};
SC.fossil_revive = async () => {
  const S = S_();
  const F = 'Fossil Expert';
  if (!S.flags.fossil_gift) {
    await MB.say('Lyra told me about you! We dig up fossils of ancient creatures here. Take one — we have too many!', { speaker: F });
    const c = await MB.ask('Which fossil will you take?', ['Fin Fossil', 'Amber Wing', 'Trilo Fossil']);
    const id = ['fin_fossil', 'amber_wing', 'shell_fossil'][Math.max(0, c)];
    await MB.Sc.give(id); MB.Sc.set('fossil_gift');
  }
  const fossils = ['fin_fossil', 'amber_wing', 'shell_fossil'].filter((f) => MB.Bag.count(f) > 0);
  if (!fossils.length) return MB.say('Bring me any fossils you find and I\'ll revive them with our Aether reactor!', { speaker: F });
  const c = await MB.ask('Revive which fossil?', fossils.map((f) => MB.ITEMS[f].name).concat(['Not now']));
  if (c < 0 || c >= fossils.length) return;
  MB.Bag.remove(fossils[c], 1);
  await MB.say('The reactor hums... and...!', { speaker: F });
  await MB.Sc.giveMon(MB.ITEMS[fossils[c]].fossil, 25);
  MB.Achievements.unlock('fossil');
};

// ===================== CHAPTER 5: EMBERFALL PLANT =====================
SC.plant_rook = async () => {
  if (S_().flags.plant_done) return;
  const R = 'Rook';
  const win = await MB.Battles.boss('rook');
  if (!win) return;
  MB.Sc.set('plant_done');
  await MB.sayAll(['Our drills were siphoning Aether from deep under Emberfall. Valuable data. Irrelevant now.', 'The Director has what he needs from this site. We go to the Caldera.'], R);
  await MB.say('You saved the plant! Leader Cinder is back at the gym. Here — the Syndicate left this behind.', { speaker: 'Engineer' });
  await MB.Sc.give('automax_stone');
};
SC.plant_engineer = async () => MB.say('The plant is running smoothly again. Thanks to you!', { speaker: 'Engineer' });

// ===================== CHAPTER 6: CALDERA + OBSERVATORY =====================
SC.caldera_lab = async () => {
  if (S_().flags.caldera_done) return;
  await MB.say('You\'ve been a thorn in our side since Moonveil. Let\'s see you handle real heat!', { speaker: 'Lt. Mara' });
  const team = [['magmolem', 40], ['emberwren', 40], ['cindercoil', 41], ['hissling', 41]];
  const win = await MB.Battles.custom({ name: 'Mara', title: 'Lieutenant', team, pay: 4000, ai: 3, music: 'evil', app: { skin: '#c08860', hair: '#e04040', hairStyle: 'long', top: '#402858', bottom: '#201828', emblem: true } });
  if (!win) return;
  MB.Sc.set('caldera_done');
  await MB.sayAll(['Fine! Take your little victory.', 'We already shipped the core samples. The Director just needs the star chart from Starfall to find the Summit\'s entrance.', '...Oops. Forget I said that.'], 'Lt. Mara');
  await MB.Sc.give('syndicate_badge');
  MB.Sc.chapter(6);
};
SC.obs_nyx = async () => {
  if (S_().flags.obs_done) return;
  await MB.say('The stars told me you\'d come. They also told me you\'d lose. Shall we test them?', { speaker: 'Nyx' });
  const win = await MB.Battles.boss('nyx');
  if (!win) return;
  MB.Sc.set('obs_done');
  await MB.sayAll(['...The constellations didn\'t mention you. How curious.', 'I have the chart already. But tell me, child — if the Director unites the Heart, would that truly be so terrible?', 'No more wars over stones. No more creatures used as weapons. Just... one hand. Guiding all of it.', 'Think on it.'], 'Nyx');
};
SC.obs_lyra = async () => {
  const S = S_();
  const L = 'Dr. Lyra';
  if (!S.flags.obs_done) return MB.say('Nyx is at the telescope! Please, stop her!', { speaker: L });
  if (!S.flags.lyra_truth) {
    MB.Sc.set('lyra_truth');
    await MB.sayAll(['Thank you. I\'ve finally pieced it together from the ruins and this observatory.', 'Thousands of years ago, the Aetherians found the Aether Heart — the source of all Mega Evolution.', 'They went to war over it. To end the war, they split the Heart into Dawn, Dusk and Core, and sealed each away.', 'Every Aether Stone in the world is a splinter of that Heart. Every Mega Evolution is a tiny echo of it.', 'If the Syndicate reunites the fragments at Celestial Summit, they could control — or end — every Mega Evolution in existence.', '...There\'s something else. The Syndicate\'s funding traces back to the Aether Foundation. To Director Valen. My old mentor.', 'I hope I\'m wrong. Go to Frostholm. Get stronger. I\'ll keep digging.'], L);
    MB.Sc.chapter(7);
    return;
  }
  await MB.say('The ancients believed every bond creates its own Becoming. I think they were right.', { speaker: L });
};

// ===================== CHAPTER 8: CAPITAL =====================
SC.capital_sable = async () => {
  if (S_().flags.capital_done) return;
  await MB.say('So you\'re the child Nyx won\'t stop talking about. I am Sable, the Director\'s blade.', { speaker: 'Sable' });
  const win = await MB.Battles.boss('sable');
  if (!win) return;
  MB.Sc.set('capital_done');
  await MB.sayAll(['Impossible...', 'It doesn\'t matter. The Director already left for Celestial Summit with the Dawn and Dusk keys.', 'You want to know who the Director is? You\'ve been standing in his tower. Valen Orrick. Head of the Aether Foundation. Patron of your precious Professor.', 'Go on, run to the Summit. You\'ll need Darius\'s badge to break the seal — and you\'ll be too late anyway.'], 'Sable');
  MB.Achievements.unlock('syndicate_buster');
};
SC.summit_valen = async () => {
  const S = S_();
  if (S.flags.summit_done) return;
  const V = 'Valen';
  MB.audio.play('evil');
  await MB.sayAll([`${S.name}. Hazel\'s little prodigy. I funded the research that gave you that Aetherdex, you know.`, 'Do you understand what the Aether Heart is? It is power without end. Split, it breeds war — Syndicates, thieves, conquerors.', 'United, under one careful hand, it would end all of that. No more stolen stones. No more creatures twisted into weapons.', 'The Dawn and Dusk fragments sleep in this altar. Once I awaken them, the Core will answer.', 'You cannot stop history. But you are welcome to try.'], V);
  const win = await MB.Battles.boss('valen');
  if (!win) return;
  await MB.sayAll(['...So. A child stands where I could not.', 'Perhaps the ancients were right. Perhaps every bond must find its own Becoming.', 'The fragments... they are waking on their own. Look!'], V);
  MB.Sc.set('summit_done');
  MB.Achievements.unlock('stopped_valen');
  await MB.say('A blinding light and a deep shadow rise from the altar!');
  const which = MB.World.isNight() ? 'noctyrr' : 'solarion';
  await MB.say(`The ${which === 'solarion' ? 'golden dragon of Dawn' : 'black dragon of Dusk'} descends from the sky! (The other twin will appear here at the opposite time of day.)`);
  await MB.Battles.legend(which, 60, { story: true });
  await MB.say(`${MB.Sc.rivalName()} arrives, panting. "The Syndicate grunts are all rounded up! Did you... whoa. You actually did it."`);
  await MB.say('Valen surrenders to the Capital Rangers. Before he is led away, he looks back at the altar one last time.');
  await MB.say('"The void beyond the Expanse is still out there," he mutters. "Someone has to watch it..."');
  MB.Sc.chapter(10);
  await MB.say('The way to Champion\'s Path is now open, east of the Capital.', { speaker: 'Ranger' });
};

// ===================== CHAPTER 10: LEAGUE =====================
SC.league_gate = async () => {
  const S = S_();
  if (S.badges.length < 8) return MB.say('Only trainers with all eight Gym Badges may enter the Championship.', { speaker: 'Guard' });
  if (!S.flags.summit_done) return MB.say('The Championship is postponed while Celestial Summit is in chaos.', { speaker: 'Guard' });
  if (!(await MB.yesno('Welcome, challenger. Once you enter, you cannot leave until you win or lose. Ready?'))) return;
  await MB.Battles.championship({ region: 'A' });
};
SC.v_league_gate = async () => {
  const S = S_();
  if (S.vBadges.length < 6) return MB.say('Only trainers with all six Warden Seals may challenge the Veloria League.', { speaker: 'Herald' });
  if (!(await MB.yesno('The Veloria League awaits. Once you begin, there is no turning back. Ready?'))) return;
  await MB.Battles.championship({ region: 'V' });
};

// ===================== POSTGAME: VELORIA =====================
SC.ship_veloria = async () => {
  const S = S_();
  if (!S.keyItems.veloria_pass) return MB.say('Ships to Veloria only take passengers with a Veloria Pass. Champions get one from their professor, I hear.', { speaker: 'Sailor' });
  if (!(await MB.yesno('All aboard for Halcyon Harbor, Veloria?'))) return;
  await MB.fadeOut(0.6);
  S.region = 'V';
  if (!S.flags.first_veloria) { MB.Sc.set('first_veloria'); MB.Achievements.unlock('new_horizon'); }
  await MB.Over.warpTo('halcyon', null, null, 'down', { door: 'hh_port' });
  await MB.fadeIn(0.6);
  await MB.say('Welcome to Veloria!');
};
SC.ship_aetheria = async () => {
  const S = S_();
  if (!(await MB.yesno('Set sail for Stormport, Aetheria?'))) return;
  await MB.fadeOut(0.6);
  S.region = 'A';
  await MB.Over.warpTo('stormport', null, null, 'down', { door: 'sp_port' });
  await MB.fadeIn(0.6);
};
SC.veloria_prof = async () => {
  const S = S_();
  const P = 'Dr. Ines';
  if (!S.flags.got_rift_lens) {
    await MB.sayAll([`You must be ${S.name}, the Aetherian Champion! Hazel told me all about you.`, 'I\'m Dr. Ines. I study the rifts — tears in reality where two phases of Veloria overlap: the Bright and the Gloam.', 'Crystal walls exist in one phase but not the other. With this Rift Lens you can shift between them. Press R to use it anywhere in Veloria.', 'Six Wardens guard Veloria\'s seals. Earn them all and challenge the Veloria League in Zenith City.', 'Oh — and be careful. There are rumors of people in black uniforms near the Rift Core.'], P);
    await MB.Sc.give('rift_lens');
    MB.Sc.set('got_rift_lens');
    return;
  }
  const shards = S.starShards ? S.starShards.length : 0;
  await MB.say(`You have ${shards} of 8 Star Shards. Legends say they form the original creature when brought to the Rift Core altar.`, { speaker: P });
};
SC.neo_sable = async () => {
  if (S_().flags.neo_done) return;
  await MB.sayAll(['You! The Syndicate is reborn as Neo Eclipse. Without Valen, I lead now.', 'The Heart denied us. The Rift Core will not! Its power tears between worlds — we\'ll pour it into every stone in both regions!'], 'Sable');
  const win = await MB.Battles.boss('neo_sable');
  if (!win) return;
  MB.Sc.set('neo_done');
  await MB.sayAll(['Again?! You haunt me across oceans...', 'Fine. Go into the Rift Core. See what waits there. I hope it swallows you.'], 'Sable');
  MB.Sc.chapter(12);
};

// ===================== LEGENDARIES =====================
SC.legend_generic = async (ctx) => {
  const n = ctx.npc;
  const L = MB.SP[n.legend];
  MB.audio.cry(L.key, true);
  await MB.say(`${L.name}: ...!`);
  await MB.say(L.desc);
  if (!(await MB.yesno(`Challenge the legendary ${L.name}?`))) return;
  await MB.Battles.legend(n.legend, n.lvl);
};
SC.legend_sylvarch = async (ctx) => {
  await MB.say('The trees bow. A great antlered spirit steps from the mist, its eyes like moonlit pools.');
  return SC.legend_generic(ctx);
};
SC.legend_lunelle = async (ctx) => {
  const ev = MB.World.events();
  if (!ev.some((e) => e.type === 'meteor')) return MB.say('A faint melody hangs in the air... It might grow louder during a meteor shower.');
  await MB.say('Beneath the falling stars, a ghostly singer turns toward you.');
  return SC.legend_generic(ctx);
};
SC.wispette_girl = async () => {
  const S = S_();
  const c = MB.Dex.countCaught();
  await MB.say('...You can see me? Most people can\'t.', { speaker: 'Pale Girl' });
  if (c < 150) return MB.say(`I\'m looking for someone who has befriended many, many creatures. At least 150 kinds. You have ${c}...`, { speaker: 'Pale Girl' });
  await MB.say('You have so many friends. I\'d like to be one too.', { speaker: 'Pale Girl' });
  await MB.say('The girl fades into a cluster of glowing wisps!');
  await MB.Battles.legend('wispette', 60);
};
SC.wish_shrine = async () => {
  const S = S_();
  await MB.say('This little shrine is older than the village. People leave wishes here for their creatures.', { speaker: 'Shrine Keeper' });
  if (S.flags.champion && !S.flags.shrine_gift) { MB.Sc.set('shrine_gift'); await MB.say('Oh! The shrine is glowing for you, Champion. It left something...', { speaker: 'Shrine Keeper' }); await MB.Sc.give('leviaphin_stone'); await MB.Sc.give('arborix_stone'); await MB.Sc.give('infernyx_stone'); }
};
// Star shards (secret legendary puzzle chain across both regions)
async function shard(id, text, check, fail) {
  const S = S_();
  if (S.flags['shard_' + id]) return MB.say('Only quiet remains here.');
  await MB.say(text);
  if (!check()) return MB.say(fail);
  S.starShards = S.starShards || [];
  S.starShards.push(id);
  MB.Sc.set('shard_' + id);
  MB.audio.sfx('item');
  await MB.say(`${S.name} found a Star Shard! (${S.starShards.length}/8)`);
  MB.Bag.add('star_shard', 1);
  MB.Achievements.check();
}
SC.star_shard_grove = () => shard('grove', 'The grove spirit smiles. "You showed kindness to Sylvarch. Take this light."', () => true, '');
SC.star_shard_throne = () => shard('throne', 'King Aldric\'s echo speaks: "The crown is yours. And with it, a star."', () => true, '');
SC.star_shard_summit = () => shard('summit', 'Dawn and Dusk shine together on the altar, and a shard of starlight falls between them.', () => true, '');
SC.star_shard_starfall = () => shard('starfall', '"A shard fell on the roof during the last meteor shower," says the stargazer. "Come back at night during a shower and I\'ll help you look."', () => MB.World.isNight() && MB.World.events().some((e) => e.type === 'meteor'), 'The stargazer shakes their head. "Not tonight. Wait for a meteor shower."');
SC.star_shard_gloam = () => shard('gloam', '"The shard drifts between phases," the hermit says. "Show me a creature born of the rifts."', () => MB.state.party.some((m) => /^rift|phase/.test(m.sp)), 'Bring a creature from the rifts (like Riftlet or Phasekit) in your party.');
SC.star_shard_dunes = () => shard('dunes', 'The seer points at a mirage. "Only at the peak of day does it become real."', () => MB.World.timeOfDay() === 'day', 'Come back during the day, when the mirage is strongest.');
SC.star_shard_tundra = () => shard('tundra', '"The aurora hides it," the watcher says. "Under the night sky, with an Ice creature leading your team..."', () => MB.World.isNight() && MB.state.party[0] && MB.SP[MB.state.party[0].sp].types.includes('Ice'), 'Return at night with an Ice-type creature at the front of your party.');
SC.star_shard_verdigris = () => shard('verdigris', 'The copper sentinel creaks. "PRESENT. THE GUARDIAN. OF. VERDIGRIS."', () => !!(MB.state.dex.verdigon && MB.state.dex.verdigon.caught), 'It seems to want to see Verdigon, the ruins\' guardian, registered as caught.');
SC.omnirift_altar = async () => {
  const S = S_();
  const n = (S.starShards || []).length;
  await MB.say(`An altar with eight star-shaped hollows. ${n} of them glow.`);
  if (n < 8) return MB.say('Four shards lie in Aetheria and four in Veloria. Each is guarded by a riddle of place, time or companion.');
  await MB.say('The eight shards rise and spin together... light pours from the rift!');
  MB.Sc.chapter(14);
  await MB.Battles.legend('omnirift', 85);
};
// Postgame bosses
SC.aldric = async () => {
  if (S_().flags.aldric_done) return;
  const win = await MB.Battles.boss('ancient_king', { env: 'legend' });
  if (win) { MB.Sc.set('aldric_done'); await MB.say('The spectral king bows his head and fades. The throne room grows calm.'); }
};
SC.final_boss = async () => {
  const S = S_();
  if (S.flags.final_boss_done) return;
  MB.Sc.chapter(13);
  await MB.sayAll(['Champion of two worlds... I knew you would come.', 'After the Summit I came here, to the place the ancients sealed the void left behind when the Heart was split.', 'It spoke to me. Nihilux — the emptiness that hungers to make the Heart whole by devouring it.', 'I thought I could control it. Now it controls me.', 'If you can... stop me. One last time.'], 'Eclipsed Valen');
  const win = await MB.Battles.boss('valen_final', { env: 'space', canLose: true });
  if (!win) return MB.say('The void laughs. Come back stronger.');
  MB.Sc.set('final_boss_done');
  MB.Achievements.unlock('true_ending');
  await MB.sayAll(['...It\'s quiet. For the first time in a long time.', 'Thank you. Truly. Tell Lyra... tell her she was right. Every bond, its own Becoming.', 'Nihilux remains, but its grip is broken. If you have the strength... it can be befriended. Or caught.'], 'Valen');
  await MB.say('Valen collapses, freed. The Rangers will find him safe. The void creature lingers nearby...');
};

// ===================== MISC SERVICES =====================
SC.daycare = async () => MB.Breeding.talk();
SC.move_tutor = async () => {
  const S = S_();
  await MB.say('I teach rare moves — for a Heart Scale.', { speaker: 'Move Tutor' });
  if (!MB.Bag.count('heart_scale')) return MB.say('Come back with a Heart Scale.', { speaker: 'Move Tutor' });
  const idx = await MB.Screens.pickPartyMon('Teach which creature?');
  if (idx < 0) return;
  const m = S.party[idx]; const spx = MB.SP[m.sp];
  const opts = spx.eggMoves.filter((id) => !m.moves.some((x) => x.id === id));
  if (!opts.length) return MB.say('I have nothing to teach that one.', { speaker: 'Move Tutor' });
  const c = await MB.ask('Teach which move?', opts.map((id) => MB.MOVES[id].name));
  if (c < 0) return;
  await MB.Screens.teachMove(m, opts[c]);
  MB.Bag.remove('heart_scale', 1);
};
SC.move_reminder = async () => {
  const S = S_();
  await MB.say('I can help a creature remember moves it has forgotten. Free of charge!', { speaker: 'Move Reminder' });
  const idx = await MB.Screens.pickPartyMon('Which creature?');
  if (idx < 0) return;
  const m = S.party[idx];
  const opts = MB.SP[m.sp].learn.filter(([l, id]) => l <= m.lvl && !m.moves.some((x) => x.id === id)).map(([, id]) => id);
  if (!opts.length) return MB.say('It remembers everything already!', { speaker: 'Move Reminder' });
  const c = await MB.ask('Remember which move?', opts.map((id) => MB.MOVES[id].name), { maxVis: 6 });
  if (c < 0) return;
  await MB.Screens.teachMove(m, opts[c]);
};
SC.name_rater = async () => {
  const idx = await MB.Screens.pickPartyMon('I rate names! Which creature should I rename?');
  if (idx < 0) return;
  const m = S_().party[idx];
  if (m.ot && m.ot !== S_().trainerId) return MB.say('That creature was traded to you... its name is precious to it.', { speaker: 'Name Rater' });
  m.name = await MB.inputText(`New name for ${m.name}?`, m.name, 12);
  await MB.say(`${m.name}! A splendid name!`, { speaker: 'Name Rater' });
};
SC.ability_swap = async () => {
  await MB.say('With a Comet Piece I can awaken a creature\'s other ability.', { speaker: 'Ability Scholar' });
  if (!MB.Bag.count('comet_piece')) return;
  const idx = await MB.Screens.pickPartyMon('Which creature?');
  if (idx < 0) return;
  const m = S_().party[idx];
  const sp2 = MB.SP[m.sp];
  const c = await MB.ask('Choose an ability', sp2.abilities.map((a, i) => MB.ABILITIES[a].name + (i === 2 ? ' (hidden)' : '')));
  if (c < 0) return;
  m.ability = c; MB.Bag.remove('comet_piece', 1);
  await MB.say(`${m.name}'s ability is now ${MB.ABILITIES[sp2.abilities[c]].name}!`, { speaker: 'Ability Scholar' });
};
void sp;

MB.GYM_TIPS = {
  hedge: 'The hedges form a maze. Look for gaps, and watch out for trainers in the grass!',
  switch: 'Step on the switches to open the electric gates.',
  boulder: 'Push the boulders out of the way to clear a path.',
  slide: 'The floor is slick! You\'ll slide until you hit something. Walk along the edges to stop.',
  lava: 'Don\'t touch the lava! Find the safe path.',
  teleport: 'The warp pads send you across the gym. Find the right sequence!',
  ice: 'The ice is slippery. Rocks will stop your slide.',
  dark: 'It\'s pitch black in here. Feel your way along the invisible walls.',
};
