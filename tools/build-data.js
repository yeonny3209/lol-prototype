// ===== 라이엇 Data Dragon → 게임 데이터 파일 생성기 =====
// 사용법:
//   node tools/build-data.js                 최신 패치를 내려받아 생성
//   node tools/build-data.js <폴더> <버전>     이미 받아 둔 ko_KR JSON(item/runesReforged/summoner/champion)으로 생성
// 결과: js/data/lol_data.js  (아이템 이름·가격·조합·스탯, 룬 트리, 소환사 주문 기본 정보)
// 설명 문장은 옮기지 않고, 효과는 js/data/item_effects.js 등에서 직접 구현합니다.
const fs = require('fs');
const path = require('path');
const https = require('https');

const get = url => new Promise((resolve, reject) => {
  https.get(url, res => {
    let body = '';
    res.setEncoding('utf8');
    res.on('data', c => body += c);
    res.on('end', () => resolve(body));
  }).on('error', reject);
});

async function main() {
  const [localDir, localVer] = process.argv.slice(2);
  const version = localVer || JSON.parse(await get('https://ddragon.leagueoflegends.com/api/versions.json'))[0];
  const load = async name => localDir
    ? JSON.parse(fs.readFileSync(path.join(localDir, name + '.json'), 'utf8'))
    : JSON.parse(await get(`https://ddragon.leagueoflegends.com/cdn/${version}/data/ko_KR/${name}.json`));

  const [itemJson, runeJson, spellJson, champJson] = await Promise.all(['item', 'runesReforged', 'summoner', 'champion'].map(load));

  // ---------- 아이템 ----------
  const STAT = {
    '공격력': 'ad', '주문력': 'ap', '체력': 'hp', '마나': 'mana', '방어력': 'armor', '마법 저항력': 'mr',
    '공격 속도': 'asPct', '치명타 확률': 'crit', '치명타 피해량': 'critDmg', '생명력 흡수': 'lifesteal',
    '모든 피해 흡혈': 'omnivamp', '스킬 가속': 'ah', '물리 관통력': 'lethality', '방어구 관통력': 'armorPenPct',
    '마법 관통력': ['mpen', 'mpenPct'], '이동 속도': ['ms', 'msPct'], '기본 체력 재생': 'baseHpRegenPct',
    '기본 마나 재생': 'baseManaRegenPct', '강인함': 'tenacity', '체력 회복 및 보호막': 'hsp', '10초당 골드': 'goldPer10',
  };
  const PCT_ONLY = new Set(['asPct', 'crit', 'critDmg', 'lifesteal', 'omnivamp', 'armorPenPct', 'baseHpRegenPct', 'baseManaRegenPct', 'tenacity', 'hsp']);
  const parseStats = desc => {
    const out = {};
    const m = desc.match(/<stats>([\s\S]*?)<\/stats>/);
    if (!m) return out;
    for (const part of m[1].split(/<br\s*\/?>/)) {
      const mm = part.match(/^\s*(.*?)\s*<attention>\s*([\d.]+)(%?)\s*<\/attention>/);
      if (!mm) continue;
      const name = mm[1].replace(/<[^>]+>/g, '').trim();
      const val = parseFloat(mm[2]), pct = mm[3] === '%';
      let key = STAT[name];
      if (!key) { console.warn('알 수 없는 스탯:', name); continue; }
      if (Array.isArray(key)) key = pct ? key[1] : key[0];
      if (val === 0) continue;
      out[key] = (out[key] || 0) + (pct || PCT_ONLY.has(key) ? +(val / 100).toFixed(4) : val);
    }
    return out;
  };

  // 설명문에 스탯 블록이 없는 아이템(예: 세계 지도집)은 Data Dragon의 기본 스탯 필드를 사용
  const DD_STAT = { FlatHPPoolMod: 'hp', FlatMPPoolMod: 'mana', FlatPhysicalDamageMod: 'ad', FlatMagicDamageMod: 'ap', FlatArmorMod: 'armor', FlatSpellBlockMod: 'mr', FlatMovementSpeedMod: 'ms', PercentMovementSpeedMod: 'msPct', PercentAttackSpeedMod: 'asPct', FlatCritChanceMod: 'crit', PercentLifeStealMod: 'lifesteal' };
  const withFallback = (parsed, raw) => {
    if (Object.keys(parsed).length || !raw) return parsed;
    const out = {};
    for (const k in raw) if (DD_STAT[k] && raw[k]) out[DD_STAT[k]] = raw[k];
    return out;
  };

  const d = itemJson.data;
  const DUPLICATES = new Set(['1105', '1106', '1107']);                   // 같은 정글 동료의 다른 모드용 사본
  const EXTRA = new Set(['3040', '3042', '3121', '2421', '3866', '3867']);  // 변신·퀘스트로만 얻는 아이템
  for (const [id, it] of Object.entries(d)) if (+id < 10000 && /^악곡의 왕관$/.test(it.name)) EXTRA.add(id);
  const shopItem = (id, it) => +id < 10000 && it.maps && it.maps['11'] && it.gold.purchasable && it.inStore !== false && !it.requiredChampion && !it.requiredAlly;
  const ids = Object.keys(d).filter(id => !DUPLICATES.has(id) && (shopItem(id, d[id]) || EXTRA.has(id)));
  const idSet = new Set(ids);
  const items = {};
  for (const id of ids) {
    const it = d[id];
    items[id] = {
      id, name: it.name,
      cost: it.gold.total, base: it.gold.base, sell: it.gold.sell,
      from: (it.from || []).filter(x => idSet.has(x)),
      into: (it.into || []).filter(x => idSet.has(x)),
      depth: it.depth || 1,
      tags: it.tags || [],
      stats: withFallback(parseStats(it.description), it.stats),
      shop: shopItem(id, it),
    };
  }

  // ---------- 룬 ----------
  const runes = runeJson.map(t => ({
    id: t.id, key: t.key, name: t.name, icon: t.icon,
    slots: t.slots.map(s => s.runes.map(r => ({ id: r.id, key: r.key, name: r.name, icon: r.icon }))),
  }));

  // ---------- 소환사 주문 (소환사의 협곡) ----------
  const spells = Object.values(spellJson.data)
    .filter(s => s.modes.includes('CLASSIC'))
    .map(s => ({ key: s.id, name: s.name, cd: +s.cooldownBurn, range: +s.rangeBurn, icon: s.image.full }));

  // ---------- 챔피언 초상화 ----------
  const champions = {};
  for (const [key, c] of Object.entries(champJson.data)) champions[key] = { name: c.name, icon: c.image.full };

  const lines = [];
  lines.push('// 자동 생성 파일 — 직접 수정하지 마세요. (node tools/build-data.js)');
  lines.push('// 출처: Riot Games Data Dragon ' + version + ' (ko_KR)');
  lines.push('const LOL_DATA = {');
  lines.push('  version: ' + JSON.stringify(version) + ',');
  lines.push('  items: {');
  for (const id of ids) lines.push('    ' + JSON.stringify(id) + ': ' + JSON.stringify(items[id]) + ',');
  lines.push('  },');
  lines.push('  runes: ' + JSON.stringify(runes) + ',');
  lines.push('  spells: ' + JSON.stringify(spells) + ',');
  lines.push('  champions: ' + JSON.stringify({ Orianna: champions.Orianna, LeeSin: champions.LeeSin, Ashe: champions.Ashe }) + ',');
  lines.push('};');
  const out = path.join(__dirname, '..', 'js', 'data', 'lol_data.js');
  fs.writeFileSync(out, lines.join('\n') + '\n');
  console.log(`생성 완료: ${out}  (패치 ${version}, 아이템 ${ids.length}개, 룬 트리 ${runes.length}개, 주문 ${spells.length}개)`);
}

main().catch(e => { console.error(e); process.exit(1); });
