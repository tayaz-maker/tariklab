/**
 * "Nasıl Oynanır" for VETO-H! and GETT-OH!.
 *
 * Written for someone who has never played a card duel: what the goal is, what
 * is on screen, what one turn looks like, and what each button does. Only
 * behaviour that the engine actually implements is described here.
 */
import { pickLang, themeMeta } from "./theme-meta.js";

const VETO = {
  point: "OP",
  pointLong: { tr: "Oy Puanı", en: "Vote Points" },
  unit: { tr: "Kadro", en: "Campaigner" },
  spell: { tr: "Kampanya", en: "Campaign" },
  trap: { tr: "Skandal", en: "Scandal" },
  battle: { tr: "Tartışma", en: "Debate" },
  deck: { tr: "Kampanya Destesi", en: "Campaign Deck" },
  tribute: { tr: "adak", en: "tribute" },
};

const GETT = {
  point: "RP",
  pointLong: { tr: "Racon Puanı", en: "Racon Points" },
  unit: { tr: "Adam", en: "Crew" },
  spell: { tr: "Racon", en: "Racon" },
  trap: { tr: "İhbar", en: "Tip-off" },
  battle: { tr: "Kapışma", en: "Clash" },
  deck: { tr: "Racon Destesi", en: "Racon Deck" },
  tribute: { tr: "feda", en: "tribute" },
};

const HELP_VOCAB = { "veto-h": VETO, "gett-oh": GETT };

const pick = (value, lang) => (lang === "en" ? value.en : value.tr);

function sections(theme, lang) {
  const v = HELP_VOCAB[theme] || GETT;
  const en = lang === "en";
  const P = v.point;
  const unit = pick(v.unit, lang);
  const spell = pick(v.spell, lang);
  const trap = pick(v.trap, lang);
  const battle = pick(v.battle, lang);
  const deck = pick(v.deck, lang);
  const tribute = pick(v.tribute, lang);
  const game = themeMeta(theme).name;

  if (en)
    return [
      {
        h: "The goal",
        p: [
          `${game} is a two-player card duel against an AI opponent. Both players start with 8000 ${P} (${pick(v.pointLong, lang)}). You win by reducing your opponent to 0 ${P}.`,
          `You never need to know another card game to play. Everything below happens on one screen, one step at a time.`,
        ],
      },
      {
        h: "Starting a duel",
        list: [
          `Press New Duel. Step 1 asks for your ${deck}: five prepared 40-card decks, each with a different plan. Press View Deck to read every card in it before you commit.`,
          `Step 2 picks the opponent's style — how aggressive or patient the AI plays. It never sees your hidden cards.`,
          `Step 3 shows a summary. Press Start Duel, play rock-paper-scissors, and the winner chooses who goes first.`,
          `You are dealt 5 cards from your chosen deck. The deck contents are always exactly what you inspected; only the shuffle changes.`,
        ],
      },
      {
        h: "What you see on screen",
        list: [
          `Middle: the table. Your side is at the bottom, the opponent's at the top. Each side has 5 ${unit.toLowerCase()} zones and 5 support zones.`,
          `Bottom: your hand. Tap or click a card to select it.`,
          `Right: Card Detail — the selected card's full text and what you can do with it.`,
          `Left: the game log, so you can see what just happened.`,
          `Top: both ${P} totals, the turn number and the phase strip showing where you are in the turn.`,
        ],
      },
      {
        h: "How a turn works",
        p: [
          `A turn always runs in this order: Draw → Standby → Main 1 → ${battle} → Main 2 → End.`,
          `Whoever goes first does not draw on the very first turn and cannot enter ${battle} on that turn.`,
        ],
        list: [
          `Draw: take 1 card.`,
          `Main 1: play cards. This is where most decisions happen.`,
          `${battle}: attack with your ${unit.toLowerCase()}s.`,
          `Main 2: play whatever you held back.`,
          `End: if you hold more than 6 cards you discard down to 6.`,
        ],
      },
      {
        h: "What you can do on your turn",
        list: [
          `Summon a ${unit.toLowerCase()}: once per turn. Levels 1–4 are free. Levels 5–6 need 1 ${tribute}, level 7+ needs 2 — you give up ${unit.toLowerCase()}s already on the field to pay.`,
          `Set a card: place it face-down. A set ${unit.toLowerCase()} defends; a set ${trap.toLowerCase()} waits for its moment. Set cards cannot be used the same turn.`,
          `How many times: the once-per-turn limit covers only ${unit.toLowerCase()}s — summoning one or setting one uses the same single right. ${spell}s and ${trap.toLowerCase()}s are not limited that way: you may set as many as you hold, while support zones remain free. The opponent plays under exactly these rules, so several set cards in one of its turns is legal, not a cheat.`,
          `Play a ${spell.toLowerCase()}: use its effect immediately.`,
          `Attack in ${battle}: each ${unit.toLowerCase()} normally attacks once. Higher attack wins; equal attack destroys both. Against a defending card, attack is compared with its defense — beat a defender and nothing happens to your ${P}, but a stronger defender damages you instead.`,
          `Attack directly: if the opponent's field is empty, your attack hits their ${P} for its full value.`,
        ],
      },
      {
        h: "Responding to the opponent",
        p: [
          `When the opponent declares an action, you may respond once with a set ${trap.toLowerCase()} or a Quick card. There is no endless back-and-forth: one action, one response.`,
          `The game tells you when a response is possible. If you do not want to use one, press Pass.`,
        ],
      },
      {
        h: "How you win and how you lose",
        list: [
          `You win when the opponent reaches 0 ${P}.`,
          `You lose when you reach 0 ${P}.`,
          `You also lose if you must draw and your deck is empty, so a long duel is its own risk.`,
          `You can concede at any time with Surrender.`,
        ],
      },
      {
        h: "Controls",
        list: [
          `Mouse: click a card to select it, then click a highlighted zone or target. You can also drag a card onto a zone.`,
          `Touch: tap a card, then tap a highlighted zone. Press and hold a card to open its detail.`,
          `Legal targets glow. If an action is not allowed, the game says why rather than doing nothing.`,
          `Keyboard: 1–5 selects a card in hand, Space advances the phase, I opens Card Detail, H the history, A the archive, Esc cancels.`,
        ],
      },
      {
        h: "An example turn",
        p: [
          `You draw and reach Main 1 with a level 3 ${unit.toLowerCase()} in hand. You summon it — free, because it is under level 5. You also set a ${trap.toLowerCase()} face-down for later.`,
          `In ${battle} your ${unit.toLowerCase()} attacks. The opponent's field is empty, so the damage goes straight to their ${P}. You end your turn. On their turn they attack; your set ${trap.toLowerCase()} is now a turn old, so you may flip it in response.`,
        ],
      },
      {
        h: "Common mistakes",
        list: [
          `Setting a ${trap.toLowerCase()} and expecting it to work the same turn — it cannot. It waits until a later turn.`,
          `Summoning a level 5+ card without keeping ${tribute}s on the field to pay for it.`,
          `Attacking on the very first turn as the starting player — that turn has no ${battle}.`,
          `Forgetting the 6-card hand limit at End, and discarding something you wanted.`,
        ],
      },
      {
        h: "After the duel",
        list: [
          `A result screen shows the turning point, the standout card and an ${P} graph of the whole duel.`,
          `Action History lists every move of the duel, turn by turn.`,
          `Your record is kept in ${pickLang(themeMeta(theme).recordFile, "en")}: duels played, wins, losses and your most-used cards.`,
          `The duel autosaves. Continue from the main menu resumes exactly where you left off, including a pending response.`,
        ],
      },
      {
        h: "Card Archive",
        p: [
          `The archive holds all 300 cards. Search by name or effect and filter by type, series, level, attack range and deck. The Decks tab shows the five prepared decks with their full card lists.`,
          `Every card's detail lists its combos — other cards that search it, summon it, strengthen it or share its series — with the reason shown next to each one.`,
        ],
      },
    ];

  return [
    {
      h: "Amaç",
      p: [
        `${game}, yapay zekâya karşı oynanan iki kişilik bir kart düellosudur. İki taraf da 8000 ${P} (${pick(v.pointLong, lang)}) ile başlar. Rakibinin ${P} değerini sıfıra indirirsen kazanırsın.`,
        `Daha önce kart oyunu oynamış olman gerekmiyor. Aşağıdaki her şey tek ekranda, adım adım ilerler.`,
      ],
    },
    {
      h: "Oyun nasıl başlar?",
      list: [
        `Yeni Düello'ya bas. 1. adımda ${deck}'ni seçersin: her biri 40 karttan oluşan, farklı planları olan beş hazır deste. "Desteyi İncele" ile içindeki bütün kartları seçmeden önce okuyabilirsin.`,
        `2. adımda rakibin tarzını seçersin; yapay rakip bu tarza göre saldırgan veya sabırlı oynar. Senin gizli kartlarını asla görmez.`,
        `3. adımda özet çıkar. Düelloyu Başlat'a bastığında taş-kağıt-makas oynanır, kazanan başlama sırasını seçer.`,
        `Seçtiğin desteden 5 kartlık açılış eli dağıtılır. Destenin içeriği her zaman incelediğin listedir; sadece karılma sırası değişir.`,
      ],
    },
    {
      h: "Ekranda ne görüyorum?",
      list: [
        `Ortada masa var. Alt taraf senin, üst taraf rakibin. Her iki tarafta 5 ${unit} bölgesi ve 5 destek bölgesi bulunur.`,
        `Altta elin duruyor. Bir karta dokununca veya tıklayınca seçilir.`,
        `Sağda Kart Ayrıntısı var: seçtiğin kartın tam metni ve o kartla yapabileceğin hamleler.`,
        `Solda Oyun Akışı var; az önce ne olduğunu buradan takip edersin.`,
        `Üstte iki tarafın ${P} değeri, tur sayısı ve turun neresinde olduğunu gösteren aşama şeridi yer alır.`,
      ],
    },
    {
      h: "Bir tur nasıl işler?",
      p: [
        `Her tur şu sırayla ilerler: Kart Çekme → Hazırlık → Hamle 1 → ${battle} → Hamle 2 → Tur Sonu.`,
        `İlk başlayan oyuncu ilk turunda kart çekmez ve o tur ${battle} aşamasına giremez.`,
      ],
      list: [
        `Kart Çekme: 1 kart çekersin.`,
        `Hamle 1: kartlarını oynarsın. Kararların çoğu burada verilir.`,
        `${battle}: ${unit.toLowerCase()}larınla saldırırsın.`,
        `Hamle 2: sakladığın kartları oynayabilirsin.`,
        `Tur Sonu: elinde 6'dan fazla kart varsa 6'ya inene kadar kart atarsın.`,
      ],
    },
    {
      h: "Ne yapabilirim?",
      list: [
        `${unit} çağır: turda 1 kez. Kademe 1–4 bedelsizdir. Kademe 5–6 için 1 ${tribute}, kademe 7 ve üstü için 2 ${tribute} gerekir; bedeli sahandaki ${unit.toLowerCase()}larını vererek ödersin.`,
        `Kart set et: kartı kapalı koyarsın. Kapalı ${unit.toLowerCase()} savunmada bekler, kapalı ${trap.toLowerCase()} sırasını bekler. Set edilen kart aynı tur kullanılamaz.`,
        `Kaç kez: turda bir kez sınırı yalnız ${unit.toLowerCase()}lar içindir — birini çağırmak da set etmek de aynı tek hakkı harcar. ${spell} ve ${trap.toLowerCase()} kartları bu sınıra girmez: destek bölgen boş kaldıkça elindeki kadarını set edebilirsin. Rakip de tam olarak bu kurallarla oynar; bir turunda birkaç kart setlemesi kural dışı değildir.`,
        `${spell} oyna: etkisi hemen çalışır.`,
        `${battle}'da saldır: her ${unit.toLowerCase()} normalde turda 1 kez saldırır. Yüksek saldırı kazanır, eşitlikte iki kart da yok olur. Savunmadaki bir karta saldırırken saldırı değeri onun savunmasıyla karşılaştırılır; savunması seninkinden yüksekse aradaki fark sana hasar olarak döner.`,
        `Doğrudan saldır: rakibin sahası boşsa saldırın doğrudan ${P} değerini kırar.`,
      ],
    },
    {
      h: "Rakibin hamlesine cevap vermek",
      p: [
        `Rakip bir işlem ilan ettiğinde kapalı bir ${trap.toLowerCase()} veya Hızlı kartla bir kez cevap verebilirsin. Sonsuz zincir yoktur: bir işlem, bir cevap.`,
        `Cevap verebileceğin an oyun sana söyler. Kullanmak istemiyorsan Geç'e basarsın.`,
      ],
    },
    {
      h: "Nasıl kazanırım, nasıl kaybederim?",
      list: [
        `Rakibin ${P} değeri 0'a inerse kazanırsın.`,
        `Senin ${P} değerin 0'a inerse kaybedersin.`,
        `Kart çekmen gerektiğinde desten boşsa da kaybedersin; yani uzun süren düello kendi başına bir risktir.`,
        `İstediğin an Teslim Ol diyerek düelloyu bitirebilirsin.`,
      ],
    },
    {
      h: "Kontroller",
      list: [
        `Fare: karta tıkla, sonra parlayan bölgeye veya hedefe tıkla. Kartı sürükleyip bölgeye bırakabilirsin de.`,
        `Dokunmatik: karta dokun, sonra parlayan bölgeye dokun. Karta basılı tutarsan ayrıntısı açılır.`,
        `Uygun hedefler parlar. Bir hamle yapılamıyorsa oyun sessiz kalmaz, nedenini yazar.`,
        `Klavye: 1–5 elindeki kartı seçer, Boşluk aşamayı ilerletir, I Kart Ayrıntısı'nı, H geçmişi, A arşivi açar, Esc seçimi iptal eder.`,
      ],
    },
    {
      h: "Örnek bir tur",
      p: [
        `Kart çekip Hamle 1'e geldin; elinde kademe 3 bir ${unit.toLowerCase()} var. Kademesi 5'in altında olduğu için bedelsiz çağırırsın. Yanına ileride kullanmak üzere bir ${trap.toLowerCase()} set edersin.`,
        `${battle} aşamasında ${unit.toLowerCase()}ın saldırır. Rakibin sahası boş olduğu için hasar doğrudan ${P} değerine gider. Turu bitirirsin. Rakip kendi turunda saldırdığında set ettiğin ${trap.toLowerCase()} artık bir tur beklemiş olur; cevap olarak açabilirsin.`,
      ],
    },
    {
      h: "Sık yapılan hatalar",
      list: [
        `${trap} set edip aynı tur işe yaramasını beklemek. Set kart sonraki turu bekler.`,
        `Kademe 5 ve üstü kart çağırmaya çalışırken sahada bedeli ödeyecek ${unit.toLowerCase()} bırakmamak.`,
        `İlk başlayan oyuncuyken ilk tur saldırmaya çalışmak; o turda ${battle} aşaması yoktur.`,
        `Tur Sonu'ndaki 6 kart sınırını unutup elde tutmak istediğin kartı atmak zorunda kalmak.`,
      ],
    },
    {
      h: "Düello bittikten sonra",
      list: [
        `Sonuç ekranı dönüm noktasını, öne çıkan kartı ve düello boyunca ${P} değişimini gösteren grafiği verir.`,
        `Hamle Geçmişi düellodaki bütün hamleleri tur tur listeler.`,
        `${pickLang(themeMeta(theme).recordFile, "tr")} bölümünde geçmişin tutulur: oynadığın düello sayısı, galibiyet, mağlubiyet ve en çok kullandığın kartlar.`,
        `Düello otomatik kaydedilir. Ana menüdeki Devam Et, bekleyen bir cevap varsa bile tam kaldığın yerden sürdürür.`,
      ],
    },
    {
      h: "Kart Arşivi",
      p: [
        `Arşivde 300 kartın tamamı var. İsim veya etkiye göre arayabilir; tür, seri, kademe, saldırı aralığı ve deste türüne göre süzebilirsin. DESTELER sekmesinde beş hazır destenin tam kart listesi bulunur.`,
        `Her kartın ayrıntısında komboları listelenir: o kartı arayan, çağıran, güçlendiren veya aynı seriden olan kartlar — her satırda nedeni yazar.`,
      ],
    },
  ];
}

/** Renders the guide with `$` from the host app. */
export function duelHelpBody($, theme, lang) {
  const out = [];
  for (const section of sections(theme, lang)) {
    out.push($("h3", { class: "help-heading" }, section.h));
    for (const paragraph of section.p || []) out.push($("p", {}, paragraph));
    if (section.list)
      out.push($("ul", { class: "help-list" }, ...section.list.map((item) => $("li", {}, item))));
  }
  return out;
}

export { sections as duelHelpSections };
