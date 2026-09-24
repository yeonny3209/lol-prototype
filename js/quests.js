// ===== 역할군 퀘스트 (2026 시즌) · 정글 동료 =====
// 진행 조건과 보상은 2026 시즌 역할군 퀘스트 공개 자료 기준. 일부(간식 획득량 등)는 추정입니다.
const QUEST_INFO = {
  top: {
    need: 1200, lane: 'top', minion: [1, 2],
    goal: '미니언 처치(탑 라인 2점), 포탑 파괴(탑 50점), 에픽 몬스터(30점), 라인에 머물기로 점수를 모읍니다.',
    reward: '최대 레벨 20, 경험치 +600, 이후 경험치 획득량 +12.5%. 순간이동이 있으면 도착 시 최대 체력 35% 보호막, 없으면 강력 순간이동(재사용 420초)을 퀘스트 칸에 얻습니다.',
  },
  mid: {
    need: 1350, lane: 'mid', minion: [1, 2],
    goal: '미니언 처치(미드 라인 2점), 포탑 파괴(미드 50점), 에픽 몬스터(30점), 라인에 머물기로 점수를 모읍니다.',
    reward: '신발이 3단계로 업그레이드되고, 강화된 귀환(4초, 재사용 대기시간 300초)을 얻습니다.',
  },
  bot: {
    need: 1350, lane: 'bot', minion: [1.5, 3],
    goal: '미니언 처치(봇 라인 3점), 포탑 파괴(봇 50점), 에픽 몬스터(30점), 라인에 머물기로 점수를 모읍니다.',
    reward: '300골드, 이후 미니언 처치 +2골드·챔피언 처치 관여 +50골드. 신발이 퀘스트 칸으로 옮겨져 아이템 칸이 하나 늘어납니다.',
  },
  jungle: {
    need: 35,
    goal: '정글 동료 아이템을 들고 대형 몬스터를 사냥해 간식을 모읍니다 (대형 몬스터 1, 버프 몬스터 2, 에픽 몬스터 4, 1분마다 1 — 추정). 15개: 강화된 강타, 35개: 원시의 강타.',
    reward: '원시의 강타와 동료 강화 효과, 정글·강에서 이동 속도 +4%(전투 밖 8%), 대형 몬스터 처치 시 +10골드·+10경험치.',
  },
  support: {
    goal: '세계 지도집을 사서 골드를 모아 룬 나침반(400) → 세계의 결실(800)로 키웁니다.',
    reward: '서포터 아이템을 무료로 최종 업그레이드할 수 있고, 제어 와드 가격이 40골드가 되며 퀘스트 칸에 최대 2개까지 보관합니다.',
  },
};

const PET_NAMES = { scorchclaw: '화염발톱', gustwalker: '바람돌이', mosstomper: '이끼쿵쿵이' };

const QUEST_TRACKER = {
  add(h, e, pts) {
    const q = h.quest;
    if (q.done || q.role === 'jungle' || q.role === 'support') return;
    q.pts = Math.min(q.need, q.pts + pts);
    if (q.pts >= q.need) Quests.complete(h);
  },
  tick(h, e, dt) {
    const q = h.quest, g = h.game;
    if (q.done) return;
    if (q.role === 'support') {
      if (h.items.some(s => s && (s.id === '3867' || SUPPORT_UPGRADES.includes(s.id)))) Quests.complete(h);
      return;
    }
    if (q.role === 'jungle') {
      const hasPet = h.items.some(s => s && ITEM_GROUPS.jungle.includes(s.id));
      if (hasPet && g.time >= 90) {
        e.st.acc = (e.st.acc || 0) + dt;
        if (e.st.acc >= 60) { e.st.acc = 0; Quests.addTreats(h, 1); }
      }
      return;
    }
    if (g.time < 65) return;
    e.st.a = (e.st.a || 0) + dt;
    e.st.b = (e.st.b || 0) + dt;
    if (e.st.a >= 3) { e.st.a -= 3; QUEST_TRACKER.add(h, e,1); }
    if (e.st.b >= 5) { e.st.b -= 5; if (h.alive && MapData.laneAt(h.x, h.y) === q.info.lane) QUEST_TRACKER.add(h, e,8); }
  },
  kill(h, e, t) {
    const q = h.quest;
    if (q.role === 'jungle') {
      if (t.kind === 'monster' && (t.large || t.epic) && h.items.some(s => s && ITEM_GROUPS.jungle.includes(s.id))) Quests.addTreats(h, t.epic ? 4 : t.stats.buff ? 2 : 1);
      return;
    }
    if (t.kind === 'minion' && q.info.minion) QUEST_TRACKER.add(h, e,MapData.laneAt(t.x, t.y) === q.info.lane ? q.info.minion[1] : q.info.minion[0]);
    if (t.kind === 'monster' && t.epic) QUEST_TRACKER.add(h, e,30);
  },
  takedown(h, e, t, isKiller) {
    if (t.kind === 'hero') QUEST_TRACKER.add(h, e,15);
    if (!isKiller && t.epic) QUEST_TRACKER.add(h, e,30);
  },
  turretTakedown(h, e, t) { QUEST_TRACKER.add(h, e,t.lane === h.quest.info.lane ? 50 : 25); },
};

// 퀘스트 보상 효과
const QUEST_REWARD_FX = {
  bot: {
    kill(h, e, t) { if (t.kind === 'minion') h.addGold(2); },
    takedown(h, e, t) { if (t.kind === 'hero') h.addGold(50); },
  },
  jungle: {
    tick(h) {
      const z = MapData.zoneAt(h.x, h.y);
      if (z === 'jungle' || z === 'river') h.dynMsPct += h.inCombat() ? 0.04 : 0.08;
    },
    kill(h, e, t) { if (t.kind === 'monster' && (t.large || t.epic)) { h.addGold(10); h.gainXp(10); } },
  },
};

// 정글 동료 최종 성장 효과
const PET_FX = {
  scorchclaw: {
    desc: '주기적으로(10초) 챔피언 대상 다음 기본 공격·스킬이 적을 불태워 3초 동안 60(+레벨당 5)의 마법 피해를 주고 20% 둔화시킵니다. 대형 몬스터 처치 시 즉시 준비됩니다.',
    damageDealt(h, e, t, dmg, opts) {
      if (opts.proc || !champLike(t) || t.kind === 'monster' || h.game.time < (e.st.cd || 0)) return;
      e.st.cd = h.game.time + 10;
      h.game.addDot(h, t, 'scorchclaw', { total: 60 + 5 * h.level, dur: 3, tick: 1, type: 'magic' });
      h.game.applySlow(h, t, 'scorchclaw', 0.2, 2);
    },
    kill(h, e, t) { if (t.large || t.epic) e.st.cd = 0; },
  },
  gustwalker: {
    desc: '대형 몬스터를 처치하면 2초 동안 이동 속도가 45% 증가했다가 점차 감소합니다. (맵에 수풀이 없어 수풀 효과는 없음)',
    kill(h, e, t) { if (t.large || t.epic) h.addHaste('gustwalker', 0.45, 2, true); },
  },
  mosstomper: {
    desc: '전투에서 10초 벗어나 있거나 대형 몬스터를 처치하면 100(+레벨당 10)의 보호막을 얻습니다.',
    tick(h, e) {
      if (h.inCombat(10) || (h.shields && h.shields.mosstomper)) return;
      h.addShield('mosstomper', 100 + 10 * h.level, 1e9);
    },
    kill(h, e, t) { if (t.large || t.epic) h.addShield('mosstomper', 100 + 10 * h.level, 1e9); },
  },
};

// 공허 유충 처치 보상 '공허의 손길': 구조물에 주는 피해에 중첩(최대 3)당 고정 피해 추가.
// 실제 롤에는 '공허 유충 소환' 등 더 복잡한 효과가 있지만, 이 프로토타입에서는 단순화했습니다.
const VOID_TOUCH_FX = {
  damageDealt(h, e, t, dealt, opts) {
    if (opts.proc || !t.isStructure || !(h.voidStacks > 0)) return;
    h.game.dealDamage(h, t, 15 * h.voidStacks, { type: 'true', proc: true, silent: true });
  },
};

const Quests = {
  init(game, h) {
    const role = QUEST_INFO[h.role] ? h.role : 'mid';
    h.quest = { role, info: QUEST_INFO[role], pts: 0, need: QUEST_INFO[role].need || 1, treats: 0, done: false };
    h.questRewards = {};
    h.smiteTier = 0;
    h.voidStacks = 0;
    h.addExtraFx('questTracker', QUEST_TRACKER, {});
    h.addExtraFx('voidTouch', VOID_TOUCH_FX, {});
  },

  addTreats(h, n) {
    const q = h.quest;
    if (q.done) return;
    const before = q.treats;
    q.treats = Math.min(35, q.treats + n);
    if (before < 15 && q.treats >= 15) {
      h.smiteTier = 1;
      if (h === h.game.player) UI.announce('동료가 성장했습니다! 강화된 강타 획득', 'good');
    }
    if (q.treats >= 35) this.complete(h);
  },

  complete(h) {
    const q = h.quest;
    if (q.done) return;
    q.done = true;
    const g = h.game, me = h === g.player;
    switch (q.role) {
      case 'top': {
        h.levelCap = 20;
        h.gainXp(600);
        h.xpBonus += 0.125;
        const tp = h.spells.find(s => s.key === 'SummonerTeleport');
        if (tp) h.questRewards.topTp = true;
        else h.spells.push({ key: 'SummonerTeleport', cd: 0, charges: null, recharge: 0, quest: true });
        break;
      }
      case 'mid':
        h.questRewards.mid = true;
        h.empoweredRecall = { cd: 0 };
        Items.upgradeBoots(h);
        break;
      case 'bot': {
        h.questRewards.bot = true;
        h.addGold(300, h.x, h.y);
        const bi = h.items.findIndex(s => s && isBoots(ITEM_DB[s.id]));
        if (bi >= 0 && !h.questSlot) { h.questSlot = h.items[bi]; h.items[bi] = null; }
        h.addExtraFx('questBot', QUEST_REWARD_FX.bot, {});
        break;
      }
      case 'jungle': {
        h.smiteTier = 2;
        const pi = h.items.findIndex(s => s && ITEM_GROUPS.jungle.includes(s.id));
        const pet = pi >= 0 ? ITEM_EFFECTS[h.items[pi].id][0][1].pet : 'gustwalker';
        if (pi >= 0) h.items[pi] = null;
        h.petBuff = pet;
        h.addExtraFx('pet', PET_FX[pet], {});
        h.addExtraFx('questJungle', QUEST_REWARD_FX.jungle, {});
        break;
      }
      case 'support':
        h.questRewards.support = true;
        break;
    }
    h.recalcStats();
    g.addEffect({ type: 'levelup', x: h.x, y: h.y, dur: 1.2, follow: h });
    if (me) UI.announce(ROLES[q.role].name + ' 퀘스트 완료! ' + (q.role === 'jungle' ? PET_NAMES[h.petBuff] + ' 완전 성장' : ''), 'good');
  },

  progress(h) {
    const q = h.quest;
    if (!q) return { pct: 0, text: '' };
    if (q.role === 'jungle') return { pct: q.treats / 35, text: q.done ? '완료' : '간식 ' + q.treats + ' / 35' };
    if (q.role === 'support') {
      const s = h.items.find(x => x && ITEM_GROUPS.support.includes(x.id));
      if (q.done) return { pct: 1, text: '완료' };
      if (!s) return { pct: 0, text: '세계 지도집 필요' };
      const need = s.id === '3865' ? 400 : 800;
      return { pct: ((s.id === '3866' ? 0.33 : 0) + clamp((s.st.earned || 0) / need, 0, 1) * (s.id === '3865' ? 0.33 : 0.67)), text: ITEM_DB[s.id].name + ' ' + Math.floor(s.st.earned || 0) + ' / ' + need };
    }
    return { pct: q.pts / q.need, text: q.done ? '완료' : Math.floor(q.pts) + ' / ' + q.need };
  },
};
