import { CROP_LIST, CropType, CROPS } from '../data/crops';
import { AXE_PRICE, PICKAXE_PRICE, SEED_UNLOCK_COST, SILO_TIERS, TRUCK_TIERS } from '../data/upgrades';
import { AnimalProduct, CHICKEN_PRICE, COOP_BASE_COST, COOP_TIERS, COW_PRICE, PASTURE_TILE_PRICE, PRODUCTS, SHEEP_PRICE } from '../data/animals';
import { BARN_WOOD_COST, DOCK_PRICE, DOCK_TIERS, ZONE_SILO_COST } from '../data/fishing';
import { BIOMES } from '../data/biomes';
import { DAY_MS } from '../game/DayNight';
import { Game } from '../game/Game';
import { QUEST_DAY_MS } from '../game/QuestSystem';
import { currentPrice } from '../game/PriceSystem';

const dayNightIcon = (now: number) => ((now % DAY_MS) / DAY_MS < 0.5 ? '☀️' : '🌙');
const fmtClock = (now: number) => { const t = (now % DAY_MS) / DAY_MS, h = Math.floor(t * 24), m = Math.floor((t * 24 * 60) % 60); return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`; };

const $ = (id: string) => document.getElementById(id)!;
const toolKey = (t: { kind: string; crop?: CropType } | null) => t ? `${t.kind}${t.crop ?? ''}` : '';

type MarketTab = 'sementes' | 'silo' | 'caminhao' | 'cercas' | 'ferramentas' | 'terreno' | 'animais' | 'pesca';
const TABS: { id: MarketTab; label: string }[] = [
  { id: 'sementes', label: '🌱 Sementes' },
  { id: 'silo', label: '🏚️ Silo' },
  { id: 'caminhao', label: '🚚 Caminhão' },
  { id: 'cercas', label: '🌲 Cercas' },
  { id: 'ferramentas', label: '🪓 Ferramentas' },
  { id: 'terreno', label: '🗺️ Terreno' },
  { id: 'animais', label: '🐔 Animais' },
  { id: 'pesca', label: '🎣 Pesca' },
];

export class HUD {
  private el: HTMLElement;
  private toastTimer = 0;
  private panel: 'market' | 'none' = 'none'; // o inventário agora é sempre visível, separado deste painel
  private marketTab: MarketTab = 'sementes';
  private invKey = '';
  private marketKey = '';
  private seedBarKey = '';
  private letterKey = '';

  constructor(private game: Game) {
    this.el = $('hud');
    this.el.innerHTML = `
      <div class="coins" id="coins"></div>
      <div class="truckpill" id="truckpill" hidden></div>
      <div class="toast" id="toast"></div>
      <div class="inv fixed" id="inv"></div>
      <div class="inv market" id="market" hidden></div>
      <div class="letter" id="letter" hidden></div>
      <div class="clock" id="clock"></div>
      <div class="pasturebar" id="pasturebar" hidden></div>
      <div class="bar" id="bar"></div>`;
    this.el.addEventListener('click', e => {
      const b = (e.target as HTMLElement).closest('button'); if (!b) return;
      const tool = b.dataset.tool, tab = b.dataset.mtab, zone = b.dataset.zone;
      if (tab) { this.marketTab = tab as MarketTab; this.marketKey = ''; if (b.dataset.mtabOpen) this.panel = 'market'; this.refresh(); return; }
      if (zone !== undefined) { game.switchZone(+zone); return; }
      if (tool === 'hoe') game.selectTool({ kind: 'hoe' });
      else if (tool === 'dock') game.selectTool({ kind: 'dock' });
      else if (tool === 'axe') game.selectTool({ kind: 'axe' });
      else if (tool === 'pickaxe') game.selectTool({ kind: 'pickaxe' });
      else if (tool === 'fence') game.selectTool({ kind: 'fence' });
      else if (tool === 'demolish') game.selectTool({ kind: 'demolish' });
      else if (tool?.startsWith('seed')) game.selectTool({ kind: 'seed', crop: tool.slice(4) as CropType });
      else if (b.id === 'harvestAll') game.harvestAll();
      else if (b.id === 'sellAll') game.sellAll();
      else if (b.id === 'buyFence') game.buyFence();
      else if (b.id === 'buyLicense') game.buySeedLicense();
      else if (b.id === 'upgradeSilo') game.upgradeSilo();
      else if (b.id === 'upgradeTruck') game.upgradeTruck();
      else if (b.id === 'buyAxe') game.buyAxe();
      else if (b.id === 'buyPickaxe') game.buyPickaxe();
      else if (b.id === 'deliverQuest') game.deliverQuest();
      else if (b.id === 'closeLetter') game.openMailbox();
      else if (b.id === 'buyCoop') game.buyCoop();
      else if (b.id === 'upgradeCoop') game.upgradeCoop();
      else if (b.id === 'buyChicken') game.buyChicken();
      else if (b.id === 'collectEgg') game.collectProduct('egg');
      else if (b.id === 'sellEgg') game.sellAnimalProduct('egg');
      else if (b.id === 'buyPasture') { game.startPastureMode(); this.panel = 'none'; }
      else if (b.id === 'confirmPasture') game.confirmPasture();
      else if (b.id === 'cancelPasture') game.cancelPastureMode();
      else if (b.id === 'buyCow') game.buyCow();
      else if (b.id === 'collectMilk') game.collectProduct('milk');
      else if (b.id === 'sellMilk') game.sellAnimalProduct('milk');
      else if (b.id === 'buySheep') game.buySheep();
      else if (b.id === 'collectWool') game.collectProduct('wool');
      else if (b.id === 'sellWool') game.sellAnimalProduct('wool');
      else if (b.id === 'buildBarn') game.buildBarn();
      else if (b.id === 'buildZoneSilo') game.buildZoneSilo();
      else if (b.id === 'upgradeDock') game.upgradeDock();
      else if (b.id === 'collectFish') game.collectProduct('fish');
      else if (b.id === 'sellFish') game.sellAnimalProduct('fish');
      else if (b.id === 'marketBtn') { this.panel = this.panel === 'market' ? 'none' : 'market'; this.marketKey = ''; this.refresh(); }
    });
    game.onChange(() => this.refresh());
    game.onMessage(m => this.toast(m));
    this.refresh();
  }

  refresh() {
    const g = this.game, now = Date.now(), away = g.truck.isAway(now);
    $('coins').innerHTML = `🪙 ${g.economy.coins} <small>· 🌾 ${g.economy.stored()}/${g.economy.capacity()} · 🪵 ${g.economy.wood}</small>`;
    $('clock').textContent = `${dayNightIcon(now)} ${fmtClock(now)}`;
    const tk = toolKey(g.selectedTool);

    const barKey = [...g.economy.unlockedCrops].sort().join(',') + '|' + (g.economy.hasAxe ? 1 : 0) + (g.economy.hasPickaxe ? 1 : 0);
    if (barKey !== this.seedBarKey) {
      this.seedBarKey = barKey;
      $('bar').innerHTML =
        CROP_LIST.filter(c => g.economy.unlockedCrops.has(c.id)).map(c => `<button data-tool="seed${c.id}">${c.emoji} ${c.name}<small>🪙${c.seedCost}</small></button>`).join('')
        + `<button data-tool="hoe">🧑‍🌾 Enxada</button>`
        + (g.economy.hasAxe ? `<button data-tool="axe">🪓 Machado</button>` : '')
        + (g.economy.hasPickaxe ? `<button data-tool="pickaxe">⛏️ Picareta</button>` : '')
        + `<button data-tool="dock">🎣 Deck</button>`
        + `<button id="harvestAll">🧺 Colher tudo <small id="rc">0</small></button>`
        + `<button id="marketBtn">🏪 Mercado</button>`;
    }
    this.el.querySelectorAll<HTMLButtonElement>('[data-tool]').forEach(b => b.classList.toggle('on', b.dataset.tool === tk));
    const rc = g.readyCount(now);
    if ($('rc')) $('rc').textContent = String(rc);
    const hA = document.getElementById('harvestAll') as HTMLButtonElement | null;
    if (hA) hA.disabled = rc === 0;
    document.getElementById('marketBtn')?.classList.toggle('on', this.panel === 'market');

    const secs = Math.ceil(g.truck.remainingMs(now) / 1000);
    const pill = $('truckpill'); pill.hidden = !away;
    if (away) pill.textContent = g.truck.loading(now) ? '🚚 carregando…' : `🚚 volta em ${secs}s`;

    // --- inventário: sempre visível, não é mais um painel que abre/fecha ---
    const inv = $('inv');
    {
      const plan = g.truck.plan(g.economy.inventory, now), load = g.truck.cargoCount(plan), value = g.truck.value(plan, now);
      const key = JSON.stringify([g.economy.inventory, away, load, Math.round(now / 2000)]);
      if (key !== this.invKey) {
        this.invKey = key;
        inv.innerHTML = `<div class="mgroup">🎒 Inventário</div>`
          + CROP_LIST.map(c => `<div class="row"><span>${c.emoji} ${CROPS[c.id].name}</span><span>×${g.economy.inventory[c.id]} <small>🪙${currentPrice(c.id, now)}/un</small></span></div>`).join('')
          + `<div class="tstat">🏚️ Silo ${g.economy.stored()}/${g.economy.capacity()}</div>`
          + `<div class="tstat" id="tstat"></div>`
          + `<button class="all" id="sellAll" ${away || !load ? 'disabled' : ''}>Vender tudo 🚚${load ? ` (${load} itens, +${value} 🪙)` : ''}</button>`;
      }
      const ts = document.getElementById('tstat');
      if (ts) ts.textContent = away ? `🚚 Em viagem — volta em ${secs}s` : `🚚 Pronto — carrega até ${g.truck.capacity()} itens`;
    }

    const letter = $('letter'); letter.hidden = !g.mailboxOpen;
    if (g.mailboxOpen) {
      const q = g.currentQuest(now), have = g.economy.inventory[q.crop];
      const msLeft = Math.max(0, q.createdAt + q.deadlineMs - now);
      const mins = Math.floor(msLeft / 60000), secs2 = Math.floor((msLeft % 60000) / 1000);
      const big = q.deadlineMs > QUEST_DAY_MS * 0.9;
      const key = `${q.seed}|${have}|${Math.floor(now / 1000)}`;
      if (key !== this.letterKey) {
        this.letterKey = key;
        letter.innerHTML = `<button class="close" id="closeLetter">✕</button>
          <h3>📬 Pedido da comunidade ${big ? '· 🎯 grande!' : ''}</h3>
          <p>Precisam de <b>${q.qty}× ${CROPS[q.crop].emoji} ${CROPS[q.crop].name}</b><br><small>você tem ${have}</small></p>
          <p><small>⏳ prazo: ${mins}m ${secs2}s</small></p>
          <p>Recompensa: ${q.rewardType === 'coins' ? `🪙${q.rewardCoins}` : `${q.rewardSeeds}× semente grátis de ${CROPS[q.crop].name}`}</p>
          <button class="all" id="deliverQuest" ${have < q.qty ? 'disabled' : ''}>Entregar</button>`;
      }
    }

    const pbar = $('pasturebar'); pbar.hidden = !g.pastureSelecting;
    if (g.pastureSelecting) {
      const valid = g.pastureSelectionValid(), cost = g.pastureSelectionCost();
      pbar.innerHTML = g.pastureSel
        ? `<span>${valid ? `Área válida — 🪙${cost}` : 'Área inválida (tem obstáculo, plantação ou já é pasto)'}</span>
           <button id="confirmPasture" ${valid ? '' : 'disabled'}>Confirmar</button>
           <button id="cancelPasture">Cancelar</button>`
        : `<span>Arraste no terreno pra escolher a área do pasto (🪙${PASTURE_TILE_PRICE}/bloco)</span><button id="cancelPasture">Cancelar</button>`;
    }

    const mk = $('market'); mk.hidden = this.panel !== 'market';
    if (this.panel === 'market') this.renderMarket(mk, g, now, tk);
  }

  private renderMarket(mk: HTMLElement, g: Game, now: number, tk: string) {
    const nextCrop = g.economy.nextLockedCrop();
    const nextSilo = SILO_TIERS[g.economy.siloTier], nextTruck = TRUCK_TIERS[g.truck.tier];
    const nextCoop = COOP_TIERS[g.economy.coopTier];
    const pendE = g.pendingProduct('egg', now), pendM = g.pendingProduct('milk', now), pendW = g.pendingProduct('wool', now), pendF = g.pendingProduct('fish', now);
    const nextDock = DOCK_TIERS[g.economy.dockTier], zone = g.zones[g.activeZone];
    const pastureCap = g.pastureCapacity(), animalsInPasture = g.economy.cows + g.economy.sheep;
    const key = [this.marketTab, g.economy.coins, g.economy.fences, g.zones.length, tk, g.economy.siloTier, g.truck.tier, nextCrop,
      g.economy.hasAxe, g.economy.hasPickaxe, g.economy.hasCoop, g.economy.coopTier, g.economy.chickens, g.economy.cows, g.economy.sheep,
      pastureCap, g.economy.wood, g.economy.dockTier, g.totalDocks(), zone.hasBarn, zone.hasSilo, JSON.stringify(g.economy.animalInventory), Math.floor(now / 1000)].join('|');
    if (key === this.marketKey) return;
    this.marketKey = key;

    const tabs = `<div class="mtabs">${TABS.map(t => `<button data-mtab="${t.id}" class="${this.marketTab === t.id ? 'on' : ''}">${t.label}</button>`).join('')}</div>`;

    const sections: Record<MarketTab, string> = {
      sementes: nextCrop
        ? `<div class="row"><span>Licença: ${CROPS[nextCrop].emoji} ${CROPS[nextCrop].name}</span><button id="buyLicense">Liberar 🪙${SEED_UNLOCK_COST[nextCrop]}</button></div>`
        : `<div class="tstat">Todas as sementes liberadas</div>`,
      silo: `<div class="tstat">${SILO_TIERS[g.economy.siloTier - 1].name} (${g.economy.capacity()})</div>
        ${nextSilo ? `<div class="row"><button id="upgradeSilo" class="all">Melhorar p/ ${nextSilo.name} (${nextSilo.capacity}) 🪙${nextSilo.cost}</button></div>` : `<div class="tstat">Nível máximo</div>`}`,
      caminhao: `<div class="tstat">${TRUCK_TIERS[g.truck.tier - 1].name} (${g.truck.capacity()})</div>
        ${nextTruck ? `<div class="row"><button id="upgradeTruck" class="all">Melhorar p/ ${nextTruck.name} (${nextTruck.capacity}) 🪙${nextTruck.cost}</button></div>` : `<div class="tstat">Nível máximo</div>`}`,
      cercas: `<div class="tstat">Você tem ×${g.economy.fences}</div>
        <div class="row"><button id="buyFence">Comprar 🪙6</button></div>
        <div class="row"><button data-tool="fence" class="all ${tk === 'fence' ? 'on' : ''}">Colocar cerca</button></div>
        <div class="row"><button data-tool="demolish" class="all ${tk === 'demolish' ? 'on' : ''}">🔨 Demolir cerca</button></div>`,
      ferramentas: `<div class="row">${g.economy.hasAxe ? `<button data-tool="axe" class="all ${tk === 'axe' ? 'on' : ''}">🪓 Usar machado</button>` : `<button id="buyAxe">Comprar machado 🪙${AXE_PRICE}</button>`}</div>
        <div class="row">${g.economy.hasPickaxe ? `<button data-tool="pickaxe" class="all ${tk === 'pickaxe' ? 'on' : ''}">⛏️ Usar picareta</button>` : `<button id="buyPickaxe">Comprar picareta 🪙${PICKAXE_PRICE}</button>`}</div>`,
      terreno: `<div class="tstat">${g.zones.length} terrenos ao todo — a fazenda principal e 4 vizinhos nos cantos.</div>`
        + g.zones.map((z, i) => `<div class="row"><span>${i === 0 ? '🏡' : BIOMES[z.biome].emoji} ${i === 0 ? 'Fazenda (início)' : (z.owned ? BIOMES[z.biome].name : '🌫️ ???')}</span><span>${i === g.activeZone ? '<b>atual</b>' : z.owned ? 'possuído' : `🪙${g.zoneCost(i)}`}</span></div>`).join('')
        + `<div class="tstat">Procure as placas de madeira perto da fazenda — passe o mouse pra ver o preço e clique pra comprar ou centralizar.</div>`
        + (g.activeZone !== 0 ? `
        <div class="mgroup">🏗️ Construção no terreno atual (${BIOMES[zone.biome].name})</div>
        <div class="row"><span>🏚️ Galpão</span><span>${zone.hasBarn ? '✅ construído' : `<button id="buildBarn" ${g.economy.wood >= BARN_WOOD_COST ? '' : 'disabled'}>🪵${BARN_WOOD_COST} (você tem ${g.economy.wood})</button>`}</span></div>
        <div class="row"><span>🏗️ Armazém</span><span>${zone.hasSilo ? '✅ construído' : `<button id="buildZoneSilo">🪙${ZONE_SILO_COST}</button>`}</span></div>
        ${!zone.hasBarn || !zone.hasSilo ? '<div class="tstat">Sem os dois, não dá pra plantar aqui ainda.</div>' : ''}` : ''),
      animais: `
        <div class="mgroup">🐔 Curral</div>
        ${g.economy.hasCoop
          ? `<div class="tstat">${COOP_TIERS[g.economy.coopTier - 1].name} — ${g.economy.chickens}/${COOP_TIERS[g.economy.coopTier - 1].capacity} galinhas</div>
             ${nextCoop ? `<div class="row"><button id="upgradeCoop" class="all">Melhorar p/ ${nextCoop.name} (${nextCoop.capacity}) 🪙${nextCoop.cost}</button></div>` : ''}
             <div class="row"><button id="buyChicken">Comprar galinha 🪙${CHICKEN_PRICE}</button></div>
             <div class="row"><span>${PRODUCTS.egg.emoji} pendente: ${pendE}</span><button id="collectEgg" ${pendE ? '' : 'disabled'}>Coletar</button></div>
             <div class="row"><span>Estoque: ${g.economy.animalInventory.egg}</span><button id="sellEgg" ${g.economy.animalInventory.egg ? '' : 'disabled'}>Vender (+${g.economy.animalInventory.egg * PRODUCTS.egg.sellPrice} 🪙)</button></div>`
          : `<div class="row"><button id="buyCoop">Comprar curral 🪙${COOP_BASE_COST}</button></div>`}
        <div class="mgroup">🐄 Pasto — ${pastureCap} blocos (${animalsInPasture} ocupados)</div>
        <div class="row"><button id="buyPasture">Comprar pasto (arrastar no terreno)</button></div>
        <div class="row"><button id="buyCow" ${animalsInPasture < pastureCap ? '' : 'disabled'}>Comprar vaca 🪙${COW_PRICE}</button></div>
        <div class="row"><span>${PRODUCTS.milk.emoji} pendente: ${pendM}</span><button id="collectMilk" ${pendM ? '' : 'disabled'}>Coletar</button></div>
        <div class="row"><span>Estoque: ${g.economy.animalInventory.milk}</span><button id="sellMilk" ${g.economy.animalInventory.milk ? '' : 'disabled'}>Vender (+${g.economy.animalInventory.milk * PRODUCTS.milk.sellPrice} 🪙)</button></div>
        <div class="row"><button id="buySheep" ${animalsInPasture < pastureCap ? '' : 'disabled'}>Comprar ovelha 🪙${SHEEP_PRICE}</button></div>
        <div class="row"><span>${PRODUCTS.wool.emoji} pendente: ${pendW} <small>(a cada 3 dias)</small></span><button id="collectWool" ${pendW ? '' : 'disabled'}>Coletar</button></div>
        <div class="row"><span>Estoque: ${g.economy.animalInventory.wool}</span><button id="sellWool" ${g.economy.animalInventory.wool ? '' : 'disabled'}>Vender (+${g.economy.animalInventory.wool * PRODUCTS.wool.sellPrice} 🪙)</button></div>`,
      pesca: `<div class="tstat">${g.totalDocks()} deck(s) construídos — nível: ${DOCK_TIERS[g.economy.dockTier - 1].name} (${DOCK_TIERS[g.economy.dockTier - 1].yieldPerDay} peixes/dia cada)</div>
        <div class="row"><button data-tool="dock" class="all ${tk === 'dock' ? 'on' : ''}">🎣 Construir deck 🪙${DOCK_PRICE} (na água, perto da margem)</button></div>
        ${nextDock ? `<div class="row"><button id="upgradeDock" class="all">Melhorar todos p/ ${nextDock.name} (${nextDock.yieldPerDay}/dia) 🪙${nextDock.cost}</button></div>` : `<div class="tstat">Decks no nível máximo</div>`}
        <div class="row"><span>${PRODUCTS.fish.emoji} pendente: ${pendF}</span><button id="collectFish" ${pendF ? '' : 'disabled'}>Coletar</button></div>
        <div class="row"><span>Estoque: ${g.economy.animalInventory.fish}</span><button id="sellFish" ${g.economy.animalInventory.fish ? '' : 'disabled'}>Vender (+${g.economy.animalInventory.fish * PRODUCTS.fish.sellPrice} 🪙)</button></div>`,
    };

    mk.innerHTML = tabs + `<div class="mpane">${sections[this.marketTab]}</div>`;
  }

  private toast(msg: string) {
    const t = $('toast');
    t.textContent = msg; t.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => t.classList.remove('show'), 1600);
  }
}
