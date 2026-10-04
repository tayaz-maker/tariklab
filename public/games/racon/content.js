(function (root) {
  "use strict";

  var NPCS = [
    { id: "m_hasan", ad: "Hasan Kısa", rol: "ayakçı", yas: "kırkına yakın", motivasyon: "Kuzenini karakolda tutmak, kendini sokakta.", sadakat: "Korkudan değil, hesap defterinden.", korku: "Kuzeninin adı dosyaya yazılırsa", para: "orta — yevmiye aksamasın yeter", statu: "düşük; sözü kısa", aile: "karakol kuzeni Nedim'in yeğeni değil, başka bir Nedim", beklenti: "Sessiz iş, açık pay.", kirmizi: "Kuzenini muhbire çevirmek.", kirginlik: "Bir kez payı kesildi, unutmadı.", gizli: "Kuzeni aracılığıyla küçük ihbarları yumuşatmak.", yuz: "Az konuşur, tespih çevirir.", baski: "Sıkışınca kuzenine koşar, ekibe değil.", iliskiler: { m_sabri: "eski mahalle", m_cevdet: "çekinir", p_cavus: "kuzen kapısı" }, unutmaz: ["pay kesmek", "kuzeni satmak", "ateş emri"], yakin: ["kontrollu", "sadik"], uzak: ["fevri", "hain"] },
    { id: "m_muharrem", ad: "Muharrem", rol: "şoför", yas: "otuz beş", motivasyon: "Son Kepenk'deki evin taksiti.", sadakat: "Direksiyon elindeyken durur; ateş duyunca kaçar.", korku: "Plaka deftere yazılır.", para: "yüksek — çocuklar okulda", statu: "yok; araba onun yüzü", aile: "eşi ve iki çocuk, Son Kepenk arka sokak", beklenti: "İş bitince evine bırakılsın.", kirmizi: "Çocukların önünde silah.", kirginlik: "Bir gece geç bırakıldı, kapı sürgülendi.", gizli: "Sessizler'e araba kiralamış, bir kez.", yuz: "Sigara içer, ayna ayarlar, susar.", baski: "Aile adı geçince direksiyonu bırakır.", iliskiler: { m_hasan: "iş", m_sabri: "selam", m_riza: "inşaat tanıdık" }, unutmaz: ["ates", "gec kalmak", "aile"], yakin: ["merhametli", "kontrollu"], uzak: ["fevri", "korkulan"] },
    { id: "m_sabri", ad: "Sabri", rol: "gözcü", yas: "elliye yakın", motivasyon: "Çarşamba esnafının selamı.", sadakat: "Mahalle sözü; para ikinci.", korku: "Esnafın yüz çevirmesi.", para: "düşük — yevmiyesi yetiyor", statu: "eski göz, mahalle bilir", aile: "bekâr, kahvede yerı sabit", beklenti: "Söz tutulsun, gürültü olmasın.", kirmizi: "Esnafa hakaret, cami önünde kavga.", kirginlik: "Bir düğüne çağrılmadı.", gizli: "Kartallar'ın bir adamını tanır, söylemez.", yuz: "Tespih, kısa cümle, uzun bakış.", baski: "Sessizce çekilir, ihbar etmez.", iliskiler: { m_hasan: "eski", p_kahveci: "masa", p_esnaf_st_carsamba: "koruma" }, unutmaz: ["soz", "esnaf", "cekil"], yakin: ["merhametli", "sadik"], uzak: ["paraOdakli", "fevri"] },
    { id: "m_riza", ad: "Rıza", rol: "kırıcı", yas: "kırk", motivasyon: "İnşaat payı, kalfa hakkı.", sadakat: "Pay gelince durur.", korku: "Kol kırığı, işsiz kalmak.", para: "yüksek — hakkı yensin istemez", statu: "kalfa; Cevdet'i çekemez", aile: "kardeşleri Üsküdar'da", beklenti: "Ağır işte ekstra.", kirmizi: "Payı Cevdet'le bölüşmek.", kirginlik: "Bir inşaatta adı geçmedi.", gizli: "Kendi kalfalarını sokmak.", yuz: "Güler, sonra faturayı uzatır.", baski: "Gürültü çıkarır, ekibi böler.", iliskiler: { m_cevdet: "kıskançlık", m_muharrem: "tanıdık", m_fazil: "hesap" }, unutmaz: ["pay", "Cevdet kayırma"], yakin: ["pragmatik", "paraOdakli"], uzak: ["merhametli"] },
    { id: "m_cevdet", ad: "Cevdet Sivri", rol: "tetikçi", yas: "otuz", motivasyon: "Adı korkuyla ansın.", sadakat: "Güç kimdeyse.", korku: "Sönük ölmek.", para: "orta — nam daha pahalı", statu: "yüksek ister, şimdi yok", aile: "yok sayar", beklenti: "Ağır iş, açık emir.", kirmizi: "Geri çekil emri, alay.", kirginlik: "Hasan'ın kuzeni yüzünden bir iş durdu.", gizli: "Taht boşalırsa oturmak.", yuz: "İnce, hızlı, şaka gibi tehdit.", baski: "Ateş eder, sonra sorar.", iliskiler: { m_hasan: "hor görür", m_riza: "rakip pay", m_nuri: "kullanır" }, unutmaz: ["cekil", "alay", "kuzen"], yakin: ["fevri", "korkulan"], uzak: ["merhametli", "kontrollu"] },
    { id: "m_nuri", ad: "Nuri", rol: "ağız", yas: "yirmi beş", motivasyon: "İsmail'in masasında yer.", sadakat: "Kahve evlatlığı; İsmail söyler o gider.", korku: "Kapıdan kovulmak.", para: "düşük", statu: "yok; dili var", aile: "yok, kahve yatak", beklenti: "Sözü taşınsın, pay küçük olsun.", kirmizi: "İsmail'e hakaret.", kirginlik: "Bir haber için para almadı.", gizli: "Duyduğunu iki tarafa satmak.", yuz: "Güler, çay koyar, dinler.", baski: "Ağzı açılır, sonra pişman.", iliskiler: { p_kahveci: "baba yerinde", m_zeki: "kulak ortağı", m_cevdet: "korkar" }, unutmaz: ["kovulmak", "İsmail"], yakin: ["pragmatik"], uzak: ["sadik"] },
    { id: "m_fazil", ad: "Fazıl", rol: "muhasebeci", yas: "kırk beş", motivasyon: "Defterin temiz görünmesi.", sadakat: "Rakam durduğu sürece.", korku: "Maliye, sahte fatura, isim.", para: "yüksek — kâr payı", statu: "sessiz güç", aile: "eşi bilmez işi", beklenti: "Kirli para ayrı kasa.", kirmizi: "İmzası açık çek.", kirginlik: "Bir kez kasa sayılmadı.", gizli: "Kendi payını yuvarlamak.", yuz: "Gözlük, kurşun kalem, az kelime.", baski: "Defteri kapatır, çekilir.", iliskiler: { m_cemil: "adliye kapısı", p_avukat: "evrak" }, unutmaz: ["kasa sayımı", "imza"], yakin: ["kontrollu", "pragmatik"], uzak: ["fevri"] },
    { id: "m_cemil", ad: "Cemil", rol: "ayakçı", yas: "otuz sekiz", motivasyon: "Adliye kâtibi tanıdık, bilgi satmak.", sadakat: "Dosya kimin lehineyse.", korku: "Kâtibin adı çıkmak.", para: "yüksek — bilgi pahalı", statu: "aracı", aile: "sessiz tutar", beklenti: "Zarf düzenli.", kirmizi: "Kâtibi yakmak.", kirginlik: "Bir zarf geç kaldı, kapı soğudu.", gizli: "Aynı bilgiyi iki kere satmak.", yuz: "Takım elbise değil, ceket.", baski: "Susar, fiyatı yükseltir.", iliskiler: { m_fazil: "hesap", p_avukat: "iş", p_cavus: "mesafe" }, unutmaz: ["zarf gecikmesi", "kâtip"], yakin: ["paraOdakli", "pragmatik"], uzak: ["sadik"] },
    { id: "m_zeki", ad: "Zeki Kambur", rol: "gözcü", yas: "yirmi iki", motivasyon: "Kahvede yer, kulağın ücreti.", sadakat: "Kim bakarsa ona.", korku: "Sabri'nin yerini almak ister, yakalanmak istemez.", para: "düşük", statu: "yok", aile: "anne Dilsiz Çatı'da", beklenti: "Küçük iş, büyük kulak.", kirmizi: "Annesinin adı.", kirginlik: "Bir çay parası unutuldu.", gizli: "Sabri'nin yerini sessizce devralmak.", yuz: "Eğilir, duyar, unutmuş gibi bakar.", baski: "Kaçar, sonra satar.", iliskiler: { m_sabri: "usta-çırak kıskançlığı", m_nuri: "orta", p_kahveci: "çay" }, unutmaz: ["çay parası", "alay"], yakin: ["pragmatik"], uzak: ["korkulan"] },
    { id: "p_berber", ad: "Necati", rol: "berber", yas: "elli", motivasyon: "Dükkân, lakap, mahalle ağzı.", sadakat: "Sözü kesilmesin.", korku: "Kepenk inmesi.", para: "borçlu — kira birikti", statu: "dil; makas onun mührü", aile: "kızı evlendi, damat uzakta", beklenti: "Borç silinsin ya da taksit.", kirmizi: "Dükkânda silah, ayna karşısı.", kirginlik: "Lakap bir kez alaya alındı.", gizli: "Kartallar'a da tıraş eder, söylemez.", yuz: "Makas konuşur, o değil.", baski: "Ağzı açılır sandalyede.", iliskiler: { m_hasan: "musteri", rival_kartallar: "sessiz musteri" }, unutmaz: ["borç", "lakap", "alay"], yakin: ["kontrollu"], uzak: ["fevri"] },
    { id: "p_kahveci", ad: "İsmail", rol: "kahveci", yas: "altmış", motivasyon: "Masanın düzeni, Nuri'nin yolu.", sadakat: "Ocak durduğu sürece.", korku: "Masa kan lekesi, karakol.", para: "orta — ocak döner", statu: "mahalle durak", aile: "Nuri evlatlık", beklenti: "Gürültü yok, çay para.", kirmizi: "Ocaktaki masada silah.", kirginlik: "Bir gece okey bozuldu, kimse özür dilemedi.", gizli: "Amca zamanında kasa tuttu, unutmadı.", yuz: "Çay koyar, gözü kapıda.", baski: "Masayı kapatır, konuşmaz.", iliskiler: { m_nuri: "evlat", m_sabri: "musteri", rival_amca: "eski defter" }, unutmaz: ["masa", "Nuri", "amca"], yakin: ["kontrollu", "sadik"], uzak: ["fevri"] },
    { id: "p_kapici", ad: "Rüstem", rol: "kapıcı", yas: "kırk sekiz", motivasyon: "Site anahtarı, sessiz kira.", sadakat: "Kim kapıyı ısıtırsa.", korku: "Tahliye, müteahhit.", para: "düşük — kapıcı konutu", statu: "yok; anahtar var", aile: "eşi üst katta temizlik", beklenti: "Kira dokunulmasın, çay parası.", kirmizi: "Karısının adı, konut.", kirginlik: "Bir kış kömür gelmedi.", gizli: "Bodrumda bir oda kiraladı, yazmıyor.", yuz: "Selam, süpürge, sus.", baski: "Anahtarı teslim eder, unutur.", iliskiler: { m_hasan: "selam", p_cavus: "korkar" }, unutmaz: ["kömür", "konut"], yakin: ["merhametli"], uzak: ["korkulan"] },
    { id: "p_cavus", ad: "Çavuş Nedim", rol: "emniyet", yas: "elli iki", motivasyon: "Dosya, zarf, doğru isim.", sadakat: "Yok — usul var.", korku: "İçişleri teftişi.", para: "zarf düzenli olsun", statu: "karakol", aile: "bilinmez", beklenti: "İsim doğru, gürültü az.", kirmizi: "Tehdit, diklenmek, yanlış adam.", kirginlik: "Bir zarf eksik geldi.", gizli: "Kendi kadrosunu korumak.", yuz: "Çay, sivil ceket, kısa not.", baski: "Dosyayı şişirir.", iliskiler: { m_hasan: "kuzen kapısı", p_avukat: "karşı masa" }, unutmaz: ["zarf", "diklenmek", "yanlış isim"], yakin: ["kontrollu"], uzak: ["fevri"] },
    { id: "p_avukat", ad: "Avukat Ferit", rol: "avukat", yas: "kırk", motivasyon: "Ücret, evrak, mesafe.", sadakat: "Para sürdükçe.", korku: "Baro, isim, dosya sızıntısı.", para: "çok yüksek", statu: "dışarıda temiz", aile: "ayrı tutar", beklenti: "Haftalık, soru yok.", kirmizi: "Mahkemede yalan tanık.", kirginlik: "Bir ücret gecikti, kapı kapandı.", gizli: "Aynı dosyada karşı tarafa da bakmış.", yuz: "Kravat, soğuk, saat.", baski: "Çekilir, dosyayı bırakır.", iliskiler: { m_cemil: "kâtip", m_fazil: "fatura" }, unutmaz: ["ücret", "yalan tanık"], yakin: ["pragmatik", "paraOdakli"], uzak: ["sadik"] },
    { id: "p_esnaf_st_fevzi", ad: "Kemal", rol: "esnaf", yas: "elli beş", motivasyon: "Kepenk, haraç yorgunluğu.", sadakat: "Kim korursa.", korku: "Cam, yangın, ikinci haraç.", para: "kırılgan", statu: "sokak esnafı", aile: "oğlu askerde", beklenti: "Tek el, tek fiyat.", kirmizi: "İkinci el, vitrin kırma.", kirginlik: "Kartallar bir kez cam kesti.", gizli: "Muhtara şikayet dilekçesi yazmış, atmamış.", yuz: "Terazi, az selam.", baski: "Kepenk indirir.", iliskiler: { m_sabri: "eski koruma", rival_kartallar: "korku" }, unutmaz: ["cam", "ikinci haraç"], yakin: ["kontrollu"], uzak: ["korkulan"] },
    { id: "rival_amca", ad: "Amca gölgesi", rol: "eski patron", yas: "yetmiş hissi", motivasyon: "Mahalle hâlâ onun dilinde.", sadakat: "Yok; ölçü var.", korku: "İsim unutulmak.", para: "artık almaz, bakar", statu: "gölge", aile: "ekip dağıldı", beklenti: "Söz ağır olsun, gürültü olmasın.", kirmizi: "Alay, açık ihanet, taht boşluğu.", kirginlik: "İki sezon kaçtı mı unutmaz.", gizli: "Halef beğenmezse kapıyı kapatmak.", yuz: "Görünmez; kahve konuşur.", baski: "Destek çeker, mahalle soğur.", iliskiler: { p_kahveci: "eski kasa", m_sabri: "eski göz" }, unutmaz: ["hedef kaçırmak", "alay", "gürültü"], yakin: ["kontrollu", "sadik"], uzak: ["fevri", "hain"] }
  ];

  function ident(S) {
    var i = (S.depth && S.depth.identity) || "kontrollu";
    if (i === "kontrollü") i = "kontrollu";
    return i;
  }
  function ensure(S) {
    S.flags = S.flags || {};
    S.flags.chainFlags = S.flags.chainFlags || {};
    S.flags.chains = S.flags.chains || {};
    if (S.depth && !S.depth.eventDirector) S.depth.eventDirector = { history: [], cooldowns: {} };
  }
  function flag(S, key) { ensure(S); return S.flags.chainFlags[key]; }
  function setFlag(S, key, value) { ensure(S); S.flags.chainFlags[key] = value; }
  function chainState(S, id) {
    ensure(S);
    if (!S.flags.chains[id]) S.flags.chains[id] = { stage: 0, status: "idle" };
    return S.flags.chains[id];
  }
  function crewMem(S, manId, type) {
    var m = (S.men || []).filter(function (x) { return x.id === manId; })[0];
    return !!(m && (m.memories || []).some(function (mem) { return mem.type === type; }));
  }
  function locBody(node, S) {
    var id = ident(S);
    if (node.idBody && node.idBody[id]) return node.idBody[id];
    if (node.lateBody && S.week >= 16) return node.lateBody;
    return node.body;
  }
  function applyEffects(S, H, effects, cause) {
    if (!effects || !H) return;
    var D = H.D;
    if (effects.cash) H.cashChange(effects.cash);
    if (effects.rep && H.addRep) {
      Object.keys(effects.rep).forEach(function (k) { H.addRep(k, effects.rep[k]); });
    }
    if (effects.dosya && effects.dosya > 0 && H.filePressure) H.filePressure(effects.dosya, cause || "zincir");
    if (effects.gonul) {
      Object.keys(effects.gonul).forEach(function (id) {
        var m = H.manBy(id);
        if (!m) return;
        m.gonul = H.clamp(m.gonul + effects.gonul[id], 0, 100);
        if (effects.gonul[id] < 0 && H.nedenEkle) H.nedenEkle(m, cause || "zincir");
      });
    }
    if (effects.husumet && S.rivals && S.rivals[0]) {
      S.rivals[0].husumet = H.clamp((S.rivals[0].husumet || 0) + effects.husumet, 0, 100);
    }
    if (effects.remember) {
      effects.remember.forEach(function (mem) {
        var m = H.manBy(mem.who);
        if (!m || !D) return;
        D.remember(m, {
          id: (mem.type || "m") + "-" + S.week + "-" + mem.who,
          type: mem.type,
          turn: S.week,
          sentiment: mem.sentiment || 0,
          weight: Math.abs(mem.sentiment || 1),
          tags: mem.tags || [cause || "chain", ident(S)]
        });
      });
    }
    if (effects.rel && H.relModEkle && H.personBy) {
      Object.keys(effects.rel).forEach(function (pid) {
        var p = H.personBy(pid);
        if (!p) return;
        H.relModEkle(p, effects.rel[pid], cause || "zincir", 0);
      });
    }
    if (effects.flags) {
      Object.keys(effects.flags).forEach(function (k) { setFlag(S, k, effects.flags[k]); });
    }
    if (effects.schedule && D) {
      var sch = effects.schedule;
      D.schedule(S.depth, {
        id: sch.id || ("chain-" + cause + "-" + S.week + "-" + (sch.echo || "x")),
        type: "chain-echo",
        dueTurn: S.week + (sch.due || 3),
        chainId: sch.chainId || cause,
        next: sch.next,
        cause: sch.cause || cause,
        echo: sch.echo || null
      });
    }
    if (effects.defter && H.defter) H.defter(effects.defter);
  }
  function eligible(S, H, chain, node) {
    var D = H && H.D;
    if (!D || !S.depth) return false;
    if (node.minWeek && S.week < node.minWeek) return false;
    if (node.maxWeek && S.week > node.maxWeek) return false;
    if (node.requireFlag && !flag(S, node.requireFlag)) return false;
    if (node.forbidFlag && flag(S, node.forbidFlag)) return false;
    if (node.requireMemory && !crewMem(S, node.requireMemory.who, node.requireMemory.type)) return false;
    if (node.requireMan && !H.manBy(node.requireMan)) return false;
    if (node.requirePerson && H.personBy && !H.personBy(node.requirePerson)) return false;
    if (node.requireIdentity) {
      var want = [].concat(node.requireIdentity);
      if (want.indexOf(ident(S)) < 0) return false;
    }
    if (node.minDosya != null && (S.dosya || 0) < node.minDosya) return false;
    if (node.maxDosya != null && (S.dosya || 0) > node.maxDosya) return false;
    if (node.minKasa != null && (S.kasa || 0) < node.minKasa) return false;
    if (node.minNam != null && ((S.rep && S.rep.nam) || 0) < node.minNam) return false;
    if (!D.canShowEvent(S.depth, node.id, S.week)) return false;
    return true;
  }

  var CHAINS = [
    { id: "hasan-kuzen", family: "emniyet", exclusive: ["cevdet-teklif"], npc: "m_hasan", stages: [
      { id: "hk-1", minWeek: 2, maxWeek: 8, cooldown: 8, title: "Hasan kapıda durdu",
        body: "Hasan içeri girmeden konuştu. 'Kuzenim karakolda sordu. Senin adın geçti, küçük.' Tespihi durdu.",
        idBody: { fevri: "Hasan kapıda. 'Kuzenim sordu. Ateşin duyulmuş. Küçük değil.'", merhametli: "Hasan sesini kıstı. 'Kuzenim yardım etmek istiyor. Adın dosyada ince.'", korkulan: "Hasan bakmadı. 'Kuzenim korkuyor. Senin adın ağır geldi.'" },
        choices: [
          { id: "zarf", label: "Zarfı kuzenine ver", effects: { cash: -2500, flags: { kuzenZarf: 1 }, gonul: { m_hasan: 8 }, remember: [{ who: "m_hasan", type: "kuzen-zarf", sentiment: 2 }], schedule: { due: 3, next: 1, echo: "zarf-tutti" } } },
          { id: "sus", label: "Konuşma, çay koy", effects: { flags: { kuzenSus: 1 }, gonul: { m_hasan: 2 }, rep: { saygi: 1 }, schedule: { due: 2, next: 1, echo: "sus-soru" } } },
          { id: "bekle", label: "Yarın bakacağım", effects: { gonul: { m_hasan: -4 }, remember: [{ who: "m_hasan", type: "kuzen-erteledi", sentiment: -1 }], schedule: { due: 2, next: 1, echo: "erte" } } }
        ] },
      { id: "hk-2", minWeek: 5, cooldown: 8, title: "Kuzen isim istedi",
        body: "Hasan kâğıt uzattı. 'Bir isim istiyorlar. Yanlış isim de olur, doğru isim de.' Cevdet'in adı boşlukta duruyor.",
        choices: [
          { id: "cevdet", label: "Cevdet'i yaz", effects: { flags: { kuzenCevdet: 1 }, gonul: { m_hasan: 6, m_cevdet: -18 }, remember: [{ who: "m_cevdet", type: "satildi", sentiment: -3 }, { who: "m_hasan", type: "kuzen-korudu", sentiment: 2 }], schedule: { due: 3, next: 2, echo: "isim-yazildi" } } },
          { id: "bos", label: "Boş kâğıt ver", effects: { flags: { kuzenBos: 1 }, dosya: 4, gonul: { m_hasan: -6 }, schedule: { due: 3, next: 2, echo: "bos-kagit" } } },
          { id: "bekle", label: "İsim yok", effects: { gonul: { m_hasan: -3 }, schedule: { due: 2, next: 2, echo: "isim-yok" } } }
        ] },
      { id: "hk-3", minWeek: 9, cooldown: 10, title: "Kuzen kapıyı araladı",
        body: "Nedim değil, başka bir sivil. Hasan dışarıda. 'Ya şimdi yumuşar, ya dosya şişer.'",
        choices: [
          { id: "yumusat", label: "Bir daha zarf, bu sefer düzgün", effects: { cash: -4000, flags: { kuzenMirasi: "yumusak" }, dosya: -3, gonul: { m_hasan: 10 }, remember: [{ who: "m_hasan", type: "kuzen-kapandi", sentiment: 2 }], schedule: { due: 4, next: "done", echo: "dosya-indi" } } },
          { id: "kes", label: "Kuzen kapısını kapat", effects: { flags: { kuzenMirasi: "kapali" }, gonul: { m_hasan: -12 }, remember: [{ who: "m_hasan", type: "kuzen-kapandi-sert", sentiment: -2 }], schedule: { due: 3, next: "done", echo: "kapi-kapandi" } } },
          { id: "bekle", label: "Hasan hallersin", effects: { flags: { kuzenMirasi: "hasan" }, gonul: { m_hasan: -5 }, schedule: { due: 3, next: "done", echo: "hasan-haller" } } }
        ] },
      { id: "hk-4", minWeek: 14, cooldown: 12, title: "Hasan'ın kuzeni unutmadı",
        body: "Haftalar geçti. Hasan yine kapıda. Bu kez çay istemiyor. 'O günkü kâğıt hâlâ duruyor.'",
        requireMemory: { who: "m_hasan", type: "kuzen-zarf" },
        choices: [
          { id: "odul", label: "Hasan'a pay ayır", effects: { cash: -1500, gonul: { m_hasan: 8 }, flags: { hasanPay: 1 }, schedule: { due: 2, next: "done", echo: "pay-verildi" } } },
          { id: "unut", label: "Eski defter", effects: { gonul: { m_hasan: -8 }, flags: { hasanKirgin: 1 }, schedule: { due: 2, next: "done", echo: "defter-acik" } } },
          { id: "bekle", label: "Yarın", effects: { schedule: { due: 2, next: "done" } } }
        ] }
    ]},
    { id: "cevdet-teklif", family: "rakipler", exclusive: ["hasan-kuzen"], npc: "m_cevdet", stages: [
      { id: "ct-1", minWeek: 3, maxWeek: 10, cooldown: 8, requireMan: "m_cevdet", title: "Cevdet gece geldi",
        body: "Cevdet kapıyı vurmadı, içeri süzüldü. 'Kartallar bir adam istiyor. Ben giderim. Sen izin ver.'",
        idBody: { merhametli: "Cevdet sırıttı. 'Merhametin iş bitirmiyor. Ben biterim.'", kontrollu: "Cevdet kısık. 'Ölçülü gidersem iz kalmaz. İzin.'", fevri: "Cevdet güldü. 'Senin gibi ateş seven biri durmaz. Gönder.'" },
        choices: [
          { id: "gonder", label: "Gönder, iz bırakma", effects: { flags: { cevdetGitti: 1 }, husumet: 8, gonul: { m_cevdet: 10, m_hasan: -6 }, remember: [{ who: "m_cevdet", type: "gonderildi", sentiment: 2 }], schedule: { due: 3, next: 1, echo: "gece-is" } } },
          { id: "dur", label: "Dur, bu iş bize değil", effects: { flags: { cevdetDur: 1 }, gonul: { m_cevdet: -10 }, remember: [{ who: "m_cevdet", type: "dur-denildi", sentiment: -2 }], schedule: { due: 2, next: 1, echo: "dur-kirgin" } } },
          { id: "bekle", label: "Sabah konuşuruz", effects: { gonul: { m_cevdet: -3 }, schedule: { due: 2, next: 1, echo: "sabah" } } }
        ] },
      { id: "ct-2", minWeek: 6, cooldown: 8, requireMan: "m_cevdet", title: "Kan sıçradı mı sıçramadı mı",
        body: "Mahallede bir isim eksik. Cevdet kahvede oturuyor. Sabri bakmıyor.",
        choices: [
          { id: "ustlen", label: "Üstlen, pay ver", effects: { cash: -2000, flags: { cevdetUst: 1 }, gonul: { m_cevdet: 6, m_sabri: -8 }, dosya: 6, schedule: { due: 3, next: 2, echo: "ustlendi" } } },
          { id: "inkar", label: "İnkar et, Cevdet'i uzak tut", effects: { flags: { cevdetInkar: 1 }, gonul: { m_cevdet: -8, m_sabri: 4 }, schedule: { due: 3, next: 2, echo: "inkar" } } },
          { id: "bekle", label: "Soru yok", effects: { schedule: { due: 2, next: 2, echo: "soru-yok" } } }
        ] },
      { id: "ct-3", minWeek: 10, cooldown: 10, requireMan: "m_cevdet", title: "Cevdet tahttan bahsetti",
        body: "Şaka gibi. Değil. 'Amca yaşlı. Sen ölçülü. Ben hızlıyım.' Rıza kapıda duydu.",
        choices: [
          { id: "kov", label: "Kov, kapı dışarı", effects: { flags: { cevdetMirasi: "kovuldu" }, gonul: { m_cevdet: -20, m_riza: 6 }, remember: [{ who: "m_cevdet", type: "kovuldu", sentiment: -3 }], schedule: { due: 3, next: "done", echo: "kovuldu" } } },
          { id: "tut", label: "Tut, gözüm üstünde", effects: { flags: { cevdetMirasi: "tutuldu" }, gonul: { m_cevdet: 4, m_hasan: -4 }, schedule: { due: 3, next: "done", echo: "tutuldu" } } },
          { id: "bekle", label: "Duymadım", effects: { flags: { cevdetMirasi: "duymadi" }, schedule: { due: 2, next: "done" } } }
        ] },
      { id: "ct-4", minWeek: 16, cooldown: 12, requireMan: "m_cevdet", title: "Sivri geri döndü",
        requireMemory: { who: "m_cevdet", type: "dur-denildi" },
        body: "Cevdet bir kâğıt bıraktı. 'O gece durdugum için Kartallar bana güldü. Hesap duruyor.'",
        choices: [
          { id: "hesap", label: "Hesabı kapat, para ver", effects: { cash: -3000, gonul: { m_cevdet: 6 }, flags: { sivriHesap: 1 }, schedule: { due: 2, next: "done" } } },
          { id: "gül", label: "Gülsünler", effects: { gonul: { m_cevdet: -10 }, husumet: 4, schedule: { due: 2, next: "done" } } },
          { id: "bekle", label: "Kâğıdı at", effects: { schedule: { due: 2, next: "done" } } }
        ] }
    ]},
    { id: "sabri-esnaf", family: "mahalle", exclusive: ["riza-pay"], npc: "m_sabri", stages: [
      { id: "se-1", minWeek: 1, maxWeek: 7, cooldown: 7, title: "Sabri Çarşamba'dan geldi",
        body: "Sabri tespihi cebine koydu. 'Kemal'in vitrini çizik. Kartallar değil, bizim çocuklar geçmiş. Esnaf yüzünü çeviriyor.'",
        idBody: { paraOdakli: "Sabri kısa kesti. 'Kemal ödemeyi kesti. Vitrin bahane.'", merhametli: "Sabri bakmadı. 'Kemal yaşlı. Vitrin onun yüzü. Bir selam yeter.'" },
        choices: [
          { id: "cam", label: "Camı öde, özür dile", effects: { cash: -1800, flags: { sabriCam: 1 }, rel: { p_esnaf_st_fevzi: 12 }, gonul: { m_sabri: 8 }, remember: [{ who: "m_sabri", type: "cam-odendi", sentiment: 2 }], schedule: { due: 3, next: 1, echo: "cam-yapildi" } } },
          { id: "tehdit", label: "Kemal'e gözdağı, şikâyet etmesin", effects: { flags: { sabriTehdit: 1 }, rel: { p_esnaf_st_fevzi: -16 }, gonul: { m_sabri: -8 }, remember: [{ who: "m_sabri", type: "esnaf-tehdit", sentiment: -2 }], schedule: { due: 2, next: 1, echo: "gozdagi" } } },
          { id: "bekle", label: "Vitrin durur", effects: { gonul: { m_sabri: -3 }, schedule: { due: 2, next: 1, echo: "vitrin" } } }
        ] },
      { id: "se-2", minWeek: 4, cooldown: 8, title: "Esnaf masası",
        body: "İsmail çay koydu, oturmadı. Sabri: 'Ya bir el, ya iki el. İki el olursa mahalle bölünür.'",
        choices: [
          { id: "tek", label: "Tek el, tek fiyat", effects: { flags: { tekEl: 1 }, gonul: { m_sabri: 6, m_riza: -6 }, rel: { p_kahveci: 6 }, schedule: { due: 3, next: 2, echo: "tek-el" } } },
          { id: "iki", label: "Rıza da alsın, bölüşün", effects: { flags: { ikiEl: 1 }, gonul: { m_riza: 8, m_sabri: -8 }, schedule: { due: 3, next: 2, echo: "iki-el" } } },
          { id: "bekle", label: "Masa dağılır", effects: { schedule: { due: 2, next: 2 } } }
        ] },
      { id: "se-3", minWeek: 9, cooldown: 10, title: "Cuma çıkışı",
        body: "Cami önü. Sabri selam verdi, selam alınmadı. Mahalle ölçüyor.",
        choices: [
          { id: "cami", label: "Cuma'ya dur, görünür ol", effects: { flags: { sabriMirasi: "cami" }, rep: { saygi: 4, nam: -2 }, gonul: { m_sabri: 8 }, remember: [{ who: "m_sabri", type: "cuma-durdu", sentiment: 2 }], schedule: { due: 3, next: "done", echo: "cuma" } } },
          { id: "yok", label: "Görünme, iş bitsin", effects: { flags: { sabriMirasi: "yok" }, rep: { nam: 2, saygi: -3 }, gonul: { m_sabri: -6 }, schedule: { due: 3, next: "done", echo: "gorunmedi" } } },
          { id: "bekle", label: "Başka cuma", effects: { flags: { sabriMirasi: "erte" }, schedule: { due: 2, next: "done" } } }
        ] },
      { id: "se-4", minWeek: 14, cooldown: 10, title: "Sabri söz sordu",
        requireMemory: { who: "m_sabri", type: "cam-odendi" },
        body: "Sabri kâğıt değil, söz istedi. 'Cam ödendi. Söz de duracak mı?'",
        choices: [
          { id: "soz", label: "Söz ver, esnaf tek el", effects: { flags: { sabriSoz: 1 }, gonul: { m_sabri: 6 }, schedule: { due: 2, next: "done" } } },
          { id: "yoksoz", label: "Söz yok, iş var", effects: { gonul: { m_sabri: -8 }, schedule: { due: 2, next: "done" } } },
          { id: "bekle", label: "Söz ağırdır", effects: { schedule: { due: 2, next: "done" } } }
        ] }
    ]},
    { id: "riza-pay", family: "ekip", exclusive: ["sabri-esnaf"], npc: "m_riza", stages: [
      { id: "rp-1", minWeek: 4, maxWeek: 12, cooldown: 8, requireMan: "m_riza", title: "Rıza faturayı uzattı",
        body: "Rıza güldü. 'Kırdık, taşıdık. Pay yok. Cevdet'in yevmiyesi benimkinden kalın. Bu kalfa hakkı değil.'",
        idBody: { paraOdakli: "Rıza faturayı uzattı. 'Pay görünür olsun. Kalfa hakkı, korku hakkı değil.'", merhametli: "Rıza sesini kıstı. 'İstiyorum ama mahalle çocuğunu da düşün.'", fevri: "Rıza gülmedi. 'Cevdet kalın alıyor. Ben kırıyorum. Pay ya da kapı.'" },
        choices: [
          { id: "pay", label: "Payı kes, Rıza'ya ver", effects: { cash: -2200, flags: { rizaPay: 1 }, gonul: { m_riza: 10, m_cevdet: -6 }, remember: [{ who: "m_riza", type: "pay-aldi", sentiment: 2 }], schedule: { due: 3, next: 1, echo: "pay" } } },
          { id: "yok", label: "Yevmiye yeter", effects: { flags: { rizaYok: 1 }, gonul: { m_riza: -10 }, remember: [{ who: "m_riza", type: "pay-yok", sentiment: -2 }], schedule: { due: 2, next: 1, echo: "pay-yok" } } },
          { id: "bekle", label: "Deftere yaz", effects: { gonul: { m_riza: -2 }, schedule: { due: 2, next: 1 } } }
        ] },
      { id: "rp-2", minWeek: 7, cooldown: 8, requireMan: "m_riza", title: "İnşaat kalfaları",
        body: "Rıza kendi adamlarını sokmak istiyor. Sabri 'mahalle çocuğu yeter' diyor.",
        choices: [
          { id: "kalfa", label: "Kalfaları al", effects: { cash: -1500, flags: { kalfa: 1 }, gonul: { m_riza: 8, m_sabri: -6 }, schedule: { due: 3, next: 2, echo: "kalfa" } } },
          { id: "mahalle", label: "Mahalle kalsın", effects: { gonul: { m_sabri: 6, m_riza: -6 }, flags: { kalfaYok: 1 }, schedule: { due: 3, next: 2 } } },
          { id: "bekle", label: "Karışma", effects: { schedule: { due: 2, next: 2 } } }
        ] },
      { id: "rp-3", minWeek: 12, cooldown: 10, requireMan: "m_riza", title: "Rıza Cevdet'i gösterdi",
        body: "İki adam aynı odada durmuyor. Biri gidecek.",
        choices: [
          { id: "riza", label: "Rıza kalsın", effects: { flags: { rizaMirasi: "kaldi" }, gonul: { m_riza: 8, m_cevdet: -12 }, schedule: { due: 3, next: "done" } } },
          { id: "cevdet", label: "Cevdet kalsın", effects: { flags: { rizaMirasi: "gitti" }, gonul: { m_cevdet: 8, m_riza: -12 }, schedule: { due: 3, next: "done" } } },
          { id: "bekle", label: "İkisi de dursun, ayrı iş", effects: { flags: { rizaMirasi: "ayri" }, schedule: { due: 2, next: "done" } } }
        ] },
      { id: "rp-4", minWeek: 16, cooldown: 10, requireMan: "m_riza", requireMemory: { who: "m_riza", type: "pay-yok" }, title: "Rıza işi yavaşlattı",
        body: "Duvar durdu. Rıza 'kolum ağrıyor' diyor. Kolu ağrımıyor.",
        choices: [
          { id: "zam", label: "Zam ver, iş aksamasın", effects: { cash: -1200, gonul: { m_riza: 6 }, schedule: { due: 2, next: "done" } } },
          { id: "kov", label: "Yavaşlayan kalsın dışarıda", effects: { gonul: { m_riza: -14 }, flags: { rizaKov: 1 }, schedule: { due: 2, next: "done" } } },
          { id: "bekle", label: "Ağrısın", effects: { schedule: { due: 2, next: "done" } } }
        ] }
    ]}
,
{ id: "muharrem-aile", family: "kisisel", exclusive: [], npc: "m_muharrem", stages: [
      { id: "ma-1", minWeek: 2, maxWeek: 9, cooldown: 8, title: "Muharrem eve yetişemedi",
        body: "Çocuk kapıda bekledi. Muharrem direksiyonda. 'Bu gece iş uzadı. Kapı sürgülendi. Bir daha olmasın.'",
        idBody: { fevri: "Muharrem bakmadı. 'Ateş sesi evden duyuldu. Çocuk sordu. Cevap yok.'", merhametli: "Muharrem sesini kıstı. 'Bırak bu gece. Ev soğumasın.'" },
        choices: [
          { id: "birak", label: "Bu gece bırak, evine gitsin", effects: { flags: { muharremEv: 1 }, gonul: { m_muharrem: 10 }, remember: [{ who: "m_muharrem", type: "eve-gitti", sentiment: 2 }], schedule: { due: 3, next: 1, echo: "ev" } } },
          { id: "is", label: "İş bitmeden ev yok", effects: { flags: { muharremIs: 1 }, gonul: { m_muharrem: -8 }, remember: [{ who: "m_muharrem", type: "is-oncelik", sentiment: -2 }], schedule: { due: 2, next: 1, echo: "is" } } },
          { id: "bekle", label: "Sabah konuş", effects: { gonul: { m_muharrem: -2 }, schedule: { due: 2, next: 1 } } }
        ] },
      { id: "ma-2", minWeek: 6, cooldown: 8, title: "Son Kepenk'de plaka",
        body: "Okul çıkışı bir sivil plaka sordu. Muharrem 'çocukların önünde' dedi, cümle bitti.",
        choices: [
          { id: "plaka", label: "Plakayı değiştir, para ver", effects: { cash: -2800, flags: { plaka: 1 }, gonul: { m_muharrem: 6 }, dosya: -2, schedule: { due: 3, next: 2, echo: "plaka" } } },
          { id: "devam", label: "Aynı araba, aynı iş", effects: { gonul: { m_muharrem: -8 }, dosya: 3, flags: { plakaYok: 1 }, schedule: { due: 3, next: 2 } } },
          { id: "bekle", label: "Plaka durur", effects: { schedule: { due: 2, next: 2 } } }
        ] },
      { id: "ma-3", minWeek: 11, cooldown: 10, title: "Eş kapıya geldi",
        body: "Kadın konuşmadı. Anahtar uzattı. Muharrem aldı, vermedi.",
        choices: [
          { id: "izin", label: "Üç gün izin, yevmiye durur", effects: { cash: -900, flags: { muharremMirasi: "izin" }, gonul: { m_muharrem: 12 }, remember: [{ who: "m_muharrem", type: "izin-aldi", sentiment: 2 }], schedule: { due: 3, next: "done", echo: "izin" } } },
          { id: "hayir", label: "İş durmaz", effects: { flags: { muharremMirasi: "hayir" }, gonul: { m_muharrem: -12 }, schedule: { due: 3, next: "done" } } },
          { id: "bekle", label: "Anahtar masada", effects: { flags: { muharremMirasi: "anahtar" }, schedule: { due: 2, next: "done" } } }
        ] },
      { id: "ma-4", minWeek: 16, cooldown: 10, requireMemory: { who: "m_muharrem", type: "is-oncelik" }, title: "Muharrem direksiyonu bıraktı",
        body: "Araba kapıda, adam yok. Sabri: 'Son Kepenk'e gitti. Geri döner ya da dönmez.'",
        choices: [
          { id: "git", label: "Son Kepenk'e git, özür", effects: { cash: -500, gonul: { m_muharrem: 8 }, flags: { muharremDon: 1 }, schedule: { due: 2, next: "done" } } },
          { id: "yeni", label: "Başka şoför ara", effects: { gonul: { m_muharrem: -10 }, flags: { muharremGitti: 1 }, schedule: { due: 2, next: "done" } } },
          { id: "bekle", label: "Kapı açık dursun", effects: { schedule: { due: 2, next: "done" } } }
        ] }
    ]},
    { id: "necati-borc", family: "para", exclusive: ["ismail-masa"], npc: "p_berber", stages: [
      { id: "nb-1", minWeek: 1, maxWeek: 8, cooldown: 8, title: "Necati makası durdurdu",
        body: "Ayna karşısında borç konuşulmaz. Konuşuldu. 'Kira birikti. Ya taksit, ya kepenk. Lakap da duruyor, alay da.'",
        idBody: { paraOdakli: "Necati kestirdi. 'Borç faizleniyor. Tıraş yetmiyor.'", fevri: "Necati sesini yükseltti. 'Alay etme. Makas durur, ağız durmaz.'" },
        choices: [
          { id: "sil", label: "Borcu sil, dükkân açık kalsın", effects: { cash: -3500, flags: { necatiSil: 1 }, rel: { p_berber: 18 }, remember: [{ who: "m_hasan", type: "berber-borc", sentiment: 1 }], schedule: { due: 3, next: 1, echo: "borc-silindi" } } },
          { id: "taksit", label: "Taksit yaz, faiz yok", effects: { cash: -800, flags: { necatiTaksit: 1 }, rel: { p_berber: 8 }, schedule: { due: 3, next: 1, echo: "taksit" } } },
          { id: "bekle", label: "Kepenk onun işi", effects: { rel: { p_berber: -8 }, schedule: { due: 2, next: 1, echo: "kepenk" } } }
        ] },
      { id: "nb-2", minWeek: 5, cooldown: 8, title: "Kartallar sandalyede",
        body: "Necati fısıldadı. 'Onlara da tıraş ettim. Sorma. Söylersem ayna kırılır.'",
        choices: [
          { id: "sor", label: "Ne konuştular, söyle", effects: { flags: { necatiSoyle: 1 }, rel: { p_berber: -6 }, husumet: 3, schedule: { due: 3, next: 2, echo: "soyledi" } } },
          { id: "sus", label: "Söyleme, dükkân dursun", effects: { flags: { necatiSus: 1 }, rel: { p_berber: 6 }, schedule: { due: 3, next: 2 } } },
          { id: "bekle", label: "Ayna susar", effects: { schedule: { due: 2, next: 2 } } }
        ] },
      { id: "nb-3", minWeek: 10, cooldown: 10, title: "Lakap alayı",
        body: "Bir çocuk sokakta lakabını yanlış söyledi. Necati kapıyı kilitledi.",
        choices: [
          { id: "duzelt", label: "Düzelt, söz ağır olsun", effects: { flags: { necatiMirasi: "lakap" }, rep: { nam: 3 }, rel: { p_berber: 8 }, schedule: { due: 3, next: "done", echo: "lakap" } } },
          { id: "alay", label: "Önemsiz, geç", effects: { flags: { necatiMirasi: "alay" }, rel: { p_berber: -12 }, schedule: { due: 3, next: "done" } } },
          { id: "bekle", label: "Ayna unutur", effects: { flags: { necatiMirasi: "unut" }, schedule: { due: 2, next: "done" } } }
        ] },
      { id: "nb-4", minWeek: 15, cooldown: 10, title: "Kepenk yarım",
        body: "Sabah yarım açık. Necati içeride, konuşmuyor. Borç ya bitti ya bitmedi.",
        choices: [
          { id: "tam", label: "Kalanı kapat, çay koy", effects: { cash: -1200, rel: { p_berber: 6 }, flags: { necatiKapandi: 1 }, schedule: { due: 2, next: "done" } } },
          { id: "birak", label: "Yarım dursun", effects: { rel: { p_berber: -6 }, schedule: { due: 2, next: "done" } } },
          { id: "bekle", label: "Öğlene kalır", effects: { schedule: { due: 2, next: "done" } } }
        ] }
    ]},
    { id: "ismail-masa", family: "mahalle", exclusive: ["necati-borc"], npc: "p_kahveci", stages: [
      { id: "im-1", minWeek: 2, maxWeek: 8, cooldown: 8, title: "İsmail masayı kapattı",
        body: "Okey dağıldı. Kan yok, ses var. 'Bu masada silah görülmeyecek. Nuri de dahil.'",
        idBody: { fevri: "İsmail bakmadı. 'Ateş seven burda oturmaz. Masanın kuralı eski.'", kontrollu: "İsmail çay koydu. 'Ölçü durur, masa durur.'" },
        choices: [
          { id: "kural", label: "Kuralı kabul et", effects: { flags: { masaKural: 1 }, rel: { p_kahveci: 10 }, gonul: { m_nuri: 4 }, remember: [{ who: "m_nuri", type: "masa-kural", sentiment: 1 }], schedule: { due: 3, next: 1, echo: "kural" } } },
          { id: "gorme", label: "Görmedim, oturdum", effects: { flags: { masaGorme: 1 }, rel: { p_kahveci: -10 }, gonul: { m_nuri: -4 }, schedule: { due: 2, next: 1, echo: "gorme" } } },
          { id: "bekle", label: "Başka masa", effects: { schedule: { due: 2, next: 1 } } }
        ] },
      { id: "im-2", minWeek: 6, cooldown: 8, title: "Nuri kapıda bekliyor",
        body: "İsmail içeri almadı. 'Evlatlık değil, haberci. Haberin fiyatı var.'",
        choices: [
          { id: "al", label: "Nuri'yi içeri al, pay ver", effects: { cash: -600, flags: { nuriMasa: 1 }, gonul: { m_nuri: 8 }, rel: { p_kahveci: 4 }, remember: [{ who: "m_nuri", type: "masaya-aldi", sentiment: 2 }], schedule: { due: 3, next: 2 } } },
          { id: "disari", label: "Dışarıda dursun", effects: { gonul: { m_nuri: -8 }, flags: { nuriDis: 1 }, schedule: { due: 3, next: 2 } } },
          { id: "bekle", label: "Çay soğur", effects: { schedule: { due: 2, next: 2 } } }
        ] },
      { id: "im-3", minWeek: 11, cooldown: 10, title: "Amca defteri",
        body: "İsmail bir defter çıkardı. Eski yazı. 'Amca zamanında kasa buradaydı. Sen de buradasın. Ölçü aynı.'",
        choices: [
          { id: "olcu", label: "Ölçüyü tut", effects: { flags: { ismailMirasi: "olcu" }, rel: { p_kahveci: 8 }, rep: { racon: 3 }, schedule: { due: 3, next: "done", echo: "olcu" } } },
          { id: "yeni", label: "Eski defter kapansın", effects: { flags: { ismailMirasi: "yeni" }, rel: { p_kahveci: -8 }, schedule: { due: 3, next: "done" } } },
          { id: "bekle", label: "Defter masada", effects: { flags: { ismailMirasi: "defter" }, schedule: { due: 2, next: "done" } } }
        ] },
      { id: "im-4", minWeek: 16, cooldown: 10, requireMemory: { who: "m_nuri", type: "masa-kural" }, title: "Masa leke tuttu",
        body: "Bir gece birisi kuralı bozdu. İsmail Nuri'ye sordu. Nuri sana bakıyor.",
        choices: [
          { id: "koru", label: "Nuri'yi koru", effects: { gonul: { m_nuri: 8 }, rel: { p_kahveci: -6 }, flags: { nuriKoru: 1 }, schedule: { due: 2, next: "done" } } },
          { id: "ver", label: "Nuri konuşsun", effects: { gonul: { m_nuri: -10 }, rel: { p_kahveci: 6 }, schedule: { due: 2, next: "done" } } },
          { id: "bekle", label: "Leke durur", effects: { schedule: { due: 2, next: "done" } } }
        ] }
    ]},
    { id: "rustem-anahtar", family: "mahalle", exclusive: [], npc: "p_kapici", stages: [
      { id: "ra-1", minWeek: 3, maxWeek: 10, cooldown: 8, title: "Rüstem kömür sordu",
        body: "Kapıcı konutu soğuk. 'Kış geldi. Geçen yıl gelmedi. Karım üst katta, ben bodrumda.'",
        idBody: { merhametli: "Rüstem üşüdü. 'Kömür yok. Karım üstte, ben altta. Bir kış yeter.'", korkulan: "Rüstem korkarak sordu. 'Kömür. Geçen yıl gelmedi. Bu kez adın yeter.'", kontrollu: "Rüstem ölçülü. 'Site öder ya da sen. Konut soğuk, kış kısa değil.'" },
        choices: [
          { id: "komur", label: "Kömür gönder", effects: { cash: -1400, flags: { komur: 1 }, rel: { p_kapici: 14 }, remember: [{ who: "m_hasan", type: "komur-gitti", sentiment: 1 }], schedule: { due: 3, next: 1, echo: "komur" } } },
          { id: "yok", label: "Site öder, sen değil", effects: { rel: { p_kapici: -10 }, flags: { komurYok: 1 }, schedule: { due: 2, next: 1 } } },
          { id: "bekle", label: "Hava ısınır", effects: { schedule: { due: 2, next: 1 } } }
        ] },
      { id: "ra-2", minWeek: 7, cooldown: 8, title: "Bodrum odası",
        body: "Rüstem anahtarı gösterdi, vermedi. 'Bir oda var. Yazmıyor. Sen sorma, ben vermeyeyim.'",
        choices: [
          { id: "al", label: "Odayı tut, kira ver", effects: { cash: -700, flags: { bodrum: 1 }, rel: { p_kapici: 6 }, schedule: { due: 3, next: 2, echo: "oda" } } },
          { id: "bos", label: "Oda kapansın", effects: { flags: { bodrumYok: 1 }, rel: { p_kapici: -4 }, schedule: { due: 3, next: 2 } } },
          { id: "bekle", label: "Anahtar cebinde", effects: { schedule: { due: 2, next: 2 } } }
        ] },
      { id: "ra-3", minWeek: 12, cooldown: 10, title: "Müteahhit kapıda",
        body: "Rüstem korktu. 'Konut giderse karım da gider. Sen bir söz ver.'",
        choices: [
          { id: "soz", label: "Konut duracak, söz", effects: { flags: { rustemMirasi: "soz" }, rel: { p_kapici: 10 }, schedule: { due: 3, next: "done", echo: "soz" } } },
          { id: "yok", label: "Söz yok, iş var", effects: { flags: { rustemMirasi: "yok" }, rel: { p_kapici: -12 }, schedule: { due: 3, next: "done" } } },
          { id: "bekle", label: "Müteahhit geçer", effects: { flags: { rustemMirasi: "gecer" }, schedule: { due: 2, next: "done" } } }
        ] },
      { id: "ra-4", minWeek: 18, cooldown: 10, title: "Rüstem tanık oldu",
        body: "Gece bir araba durdu. Rüstem gördü. 'Söylersem konut, söylemezsem dosya.'",
        choices: [
          { id: "sus", label: "Görmedin", effects: { rel: { p_kapici: 4 }, dosya: -2, flags: { rustemTanik: "sus" }, schedule: { due: 2, next: "done" } } },
          { id: "soyle", label: "Çavuşa doğru söyle", effects: { rel: { p_kapici: -8 }, dosya: 4, flags: { rustemTanik: "soyle" }, schedule: { due: 2, next: "done" } } },
          { id: "bekle", label: "Gece unutulur", effects: { schedule: { due: 2, next: "done" } } }
        ] }
    ]},
    { id: "nedim-dosya", family: "emniyet", exclusive: ["ferit-zarf"], npc: "p_cavus", stages: [
      { id: "nd-1", minWeek: 4, maxWeek: 12, cooldown: 8, minDosya: 12, title: "Çavuş Nedim çay istedi",
        body: "Sivil ceket. 'Dosya şişiyor. İsim doğru olsun. Yanlış isim ikimizi de yakar. Zarf usulü bilirsin.'",
        idBody: { fevri: "Nedim bakmadı. 'Ateşin dosyası kalın. Zarf yetmez, isim lazım.'", kontrollu: "Nedim not aldı. 'Ölçülü gidenin dosyası incelir. Zarf da öyle.'" },
        choices: [
          { id: "zarf", label: "Zarfı usulünce ver", effects: { cash: -2500, flags: { nedimZarf: 1 }, dosya: -4, rel: { p_cavus: 8 }, schedule: { due: 3, next: 1, echo: "zarf" } } },
          { id: "diklen", label: "Çay yeter, zarf yok", effects: { flags: { nedimDik: 1 }, dosya: 6, rel: { p_cavus: -12 }, remember: [{ who: "m_hasan", type: "cavus-diklen", sentiment: -1 }], schedule: { due: 2, next: 1, echo: "diklen" } } },
          { id: "bekle", label: "Dosya bekler", effects: { schedule: { due: 2, next: 1 } } }
        ] },
      { id: "nd-2", minWeek: 8, cooldown: 8, title: "Yanlış isim teklifi",
        body: "Nedim kâğıt uzattı. Boş değil, yanlış dolu. Hasan'ın kuzeni bu kâğıtta yok; başka biri var.",
        choices: [
          { id: "imza", label: "İmzala, geçsin", effects: { flags: { yanlisIsim: 1 }, dosya: -3, gonul: { m_hasan: -6 }, schedule: { due: 3, next: 2, echo: "yanlis" } } },
          { id: "red", label: "Yanlış isim yok", effects: { flags: { dogruIsim: 1 }, dosya: 4, rel: { p_cavus: -6 }, schedule: { due: 3, next: 2 } } },
          { id: "bekle", label: "Kâğıt durur", effects: { schedule: { due: 2, next: 2 } } }
        ] },
      { id: "nd-3", minWeek: 13, cooldown: 10, title: "Teftiş fısıltısı",
        body: "İçişleri. Nedim korktu. 'Ya şimdi temiz görünürüm, ya ikimiz biteriz.'",
        choices: [
          { id: "temiz", label: "Bir hafta sessiz, dosya incelir", effects: { flags: { nedimMirasi: "temiz" }, dosya: -5, rel: { p_cavus: 6 }, schedule: { due: 4, next: "done", echo: "teftis" } } },
          { id: "yak", label: "Nedim'i bırak, kendi kurtul", effects: { flags: { nedimMirasi: "yak" }, rel: { p_cavus: -16 }, dosya: 8, schedule: { due: 3, next: "done" } } },
          { id: "bekle", label: "Teftiş geçer", effects: { flags: { nedimMirasi: "gecer" }, schedule: { due: 2, next: "done" } } }
        ] },
      { id: "nd-4", minWeek: 18, cooldown: 10, title: "Zarf eksik geldi",
        body: "Nedim saydı. 'Eksik. Unutulmaz bu.'",
        choices: [
          { id: "tamamla", label: "Eksiği tamamla", effects: { cash: -1800, rel: { p_cavus: 6 }, schedule: { due: 2, next: "done" } } },
          { id: "yok", label: "Eksik kalsın", effects: { dosya: 5, rel: { p_cavus: -8 }, schedule: { due: 2, next: "done" } } },
          { id: "bekle", label: "Sayar yine", effects: { schedule: { due: 2, next: "done" } } }
        ] }
    ]},
    { id: "ferit-zarf", family: "para", exclusive: ["nedim-dosya"], npc: "p_avukat", stages: [
      { id: "fz-1", minWeek: 5, maxWeek: 14, cooldown: 8, minKasa: 8000, title: "Ferit saatine baktı",
        body: "Kravat. 'Ücret haftalık. Soru yok. Mahkemede yalan tanık yok. Bu kadar.'",
        idBody: { paraOdakli: "Ferit gülümsemedi. 'Paran konuşsun, ben konuşmam.'", merhametli: "Ferit kısık. 'Merhamet dilekçede yazılmaz. Ücret yazılır.'" },
        choices: [
          { id: "tut", label: "Tut, haftalık bağla", effects: { cash: -6000, flags: { feritTut: 1 }, rel: { p_avukat: 10 }, schedule: { due: 3, next: 1, echo: "avukat" } } },
          { id: "yok", label: "Avukat yok, çavuş yeter", effects: { flags: { feritYok: 1 }, rel: { p_avukat: -8 }, schedule: { due: 2, next: 1 } } },
          { id: "bekle", label: "Saat durur", effects: { schedule: { due: 2, next: 1 } } }
        ] },
      { id: "fz-2", minWeek: 9, cooldown: 8, title: "Karşı taraf",
        body: "Cemil fısıldadı. 'Ferit aynı dosyada karşıya da bakmış. Söylersem ücret kaçar, söylemezsem yalan durur.'",
        choices: [
          { id: "kov", label: "Kov, başka avukat", effects: { flags: { feritKov: 1 }, rel: { p_avukat: -14 }, gonul: { m_cemil: 4 }, schedule: { due: 3, next: 2, echo: "kov" } } },
          { id: "tut", label: "Tut, ağzını kapat", effects: { cash: -2000, flags: { feritKapat: 1 }, gonul: { m_cemil: -4 }, schedule: { due: 3, next: 2 } } },
          { id: "bekle", label: "Dosya durur", effects: { schedule: { due: 2, next: 2 } } }
        ] },
      { id: "fz-3", minWeek: 14, cooldown: 10, title: "Ücret gecikti",
        body: "Kapı soğudu. Ferit not bıraktı. 'Gecikme baroya gider, mahalleye değil.'",
        choices: [
          { id: "ode", label: "Hemen öde, kapı açılsın", effects: { cash: -6000, flags: { feritMirasi: "ode" }, rel: { p_avukat: 8 }, schedule: { due: 3, next: "done", echo: "ode" } } },
          { id: "kes", label: "Kes, bitsin", effects: { flags: { feritMirasi: "kes" }, rel: { p_avukat: -12 }, dosya: 4, schedule: { due: 3, next: "done" } } },
          { id: "bekle", label: "Not durur", effects: { flags: { feritMirasi: "not" }, schedule: { due: 2, next: "done" } } }
        ] },
      { id: "fz-4", minWeek: 18, cooldown: 10, title: "Yalan tanık teklifi",
        body: "Ferit bu kez sordu. 'Mahkeme. Bir isim lazım. Yalan olur. Ücret ayrı.'",
        choices: [
          { id: "yalan", label: "Yalanı al, dosya insin", effects: { cash: -4000, dosya: -6, flags: { yalanTanik: 1 }, rel: { p_avukat: -4 }, schedule: { due: 3, next: "done" } } },
          { id: "yok", label: "Yalan yok", effects: { rel: { p_avukat: 4 }, flags: { yalanYok: 1 }, schedule: { due: 3, next: "done" } } },
          { id: "bekle", label: "Duruşma ertelenir", effects: { schedule: { due: 2, next: "done" } } }
        ] }
    ]}
    ,{ id: "kartal-ateskes", family: "rakipler", exclusive: ["kartal-provokasyon"], npc: "rival_kartallar", stages: [
      { id: "ka-1", minWeek: 3, maxWeek: 10, cooldown: 8, title: "Kartallar kahve önünde durdu",
        body: "Konuşmadılar. Bir adam içeri bakıp çıktı. Sabri: 'Ya masa, ya sokak. İkisini birden istersen kan çıkar.'",
        idBody: { korkulan: "Kartallar selam vermedi. Korkun yetmiş, onlar deniyor.", merhametli: "Kartallar bekliyor. Bir çay uzatsan masa açılır, silah kapanır." },
        choices: [
          { id: "masa", label: "Masa teklif et, ateşkes", effects: { cash: -1000, flags: { ateskes: 1 }, husumet: -8, gonul: { m_sabri: 6, m_cevdet: -6 }, remember: [{ who: "m_sabri", type: "ateskes-masa", sentiment: 1 }], schedule: { due: 3, next: 1, echo: "masa" } } },
          { id: "sokak", label: "Sokakta dur, çekilmesinler", effects: { flags: { sokakDur: 1 }, husumet: 6, gonul: { m_cevdet: 6, m_sabri: -4 }, schedule: { due: 2, next: 1, echo: "sokak" } } },
          { id: "bekle", label: "Kahve önü boşalsın", effects: { schedule: { due: 2, next: 1 } } }
        ] },
      { id: "ka-2", minWeek: 7, cooldown: 8, title: "Geçici hat",
        body: "Kül Merdiven çizgi oldu. Kim geçer?",
        choices: [
          { id: "hat", label: "Hattı kabul et, üç hafta", effects: { flags: { hat: 1 }, husumet: -4, schedule: { due: 3, next: 2, echo: "hat" } } },
          { id: "gec", label: "Çizgi yok, geç", effects: { flags: { hatYok: 1 }, husumet: 8, dosya: 3, schedule: { due: 3, next: 2 } } },
          { id: "bekle", label: "Çizgi solar", effects: { schedule: { due: 2, next: 2 } } }
        ] },
      { id: "ka-3", minWeek: 12, cooldown: 10, title: "Düğün daveti",
        body: "Kartallar düğün kâğıdı bıraktı. Masa denk geçebilir. Gitmezsen hakaret sayılır.",
        choices: [
          { id: "git", label: "Katıl, ₺1.000", effects: { cash: -1000, flags: { kartalMirasi: "dugun" }, husumet: -6, rep: { saygi: 3 }, schedule: { due: 3, next: "done", echo: "dugun" } } },
          { id: "gitme", label: "Gitme, iş var", effects: { flags: { kartalMirasi: "yok" }, husumet: 10, schedule: { due: 3, next: "done" } } },
          { id: "bekle", label: "Kâğıt durur", effects: { flags: { kartalMirasi: "kagit" }, schedule: { due: 2, next: "done" } } }
        ] },
      { id: "ka-4", minWeek: 18, cooldown: 10, requireMemory: { who: "m_sabri", type: "ateskes-masa" }, title: "Ateşkes çatladı",
        body: "Bir çocuk taş attı, cam indi. Kartallar 'sizin çocuk' diyor. Sabri 'değil' diyor.",
        choices: [
          { id: "ode", label: "Camı öde, hat dursun", effects: { cash: -1600, husumet: -3, gonul: { m_sabri: 4 }, schedule: { due: 2, next: "done" } } },
          { id: "sucla", label: "Onların çocuğu de", effects: { husumet: 8, gonul: { m_sabri: -4 }, schedule: { due: 2, next: "done" } } },
          { id: "bekle", label: "Taş durur", effects: { schedule: { due: 2, next: "done" } } }
        ] }
    ]},
    { id: "kartal-provokasyon", family: "rakipler", exclusive: ["kartal-ateskes"], npc: "rival_kartallar", stages: [
      { id: "kp-1", minWeek: 4, maxWeek: 11, cooldown: 8, title: "Kül Merdiven'da kepenk çizildi",
        body: "Bizim sokak değil. Çizgi bize bakıyor. Cevdet 'cevap ver' diyor. Sabri 'yem' diyor.",
        idBody: { fevri: "Çizgi taze. Cevdet gülümsedi. Sen de gülüyorsun, mahalle görüyor.", kontrollu: "Sabri kısık. 'Yem bu. Ölçülü dur, çizgi onlarda kalsın.'" },
        choices: [
          { id: "cevap", label: "Cevap ver, onların vitrini", effects: { flags: { provokasyon: 1 }, husumet: 12, dosya: 6, gonul: { m_cevdet: 8, m_sabri: -8 }, remember: [{ who: "m_cevdet", type: "cevap-verdi", sentiment: 2 }], schedule: { due: 3, next: 1, echo: "cevap" } } },
          { id: "yem", label: "Yem yeme, çizgi onlarda", effects: { flags: { yemYok: 1 }, gonul: { m_sabri: 6, m_cevdet: -6 }, remember: [{ who: "m_sabri", type: "yem-yenmedi", sentiment: 1 }], schedule: { due: 2, next: 1, echo: "yem" } } },
          { id: "bekle", label: "Boya kurusun", effects: { schedule: { due: 2, next: 1 } } }
        ] },
      { id: "kp-2", minWeek: 8, cooldown: 8, title: "İçeriden haber",
        body: "Zeki kulağını uzattı. 'Kartallar'ın biri size gelecek. Satılık. Fiyatı var.'",
        choices: [
          { id: "al", label: "Al, dinle", effects: { cash: -2500, flags: { iceri: 1 }, husumet: 4, gonul: { m_zeki: 6 }, schedule: { due: 3, next: 2, echo: "iceri" } } },
          { id: "yok", label: "Satılık adam yok", effects: { gonul: { m_zeki: -4 }, flags: { iceriYok: 1 }, schedule: { due: 3, next: 2 } } },
          { id: "bekle", label: "Kulak kapanır", effects: { schedule: { due: 2, next: 2 } } }
        ] },
      { id: "kp-3", minWeek: 13, cooldown: 10, title: "Kan hattı",
        body: "Biri yaralandı. Kim olduğu net değil. Mahalle net olmanı bekliyor.",
        choices: [
          { id: "kan", label: "Kan davası aç", effects: { flags: { kartalMirasi: "kan" }, husumet: 20, dosya: 10, gonul: { m_cevdet: 8 }, schedule: { due: 3, next: "done", echo: "kan" } } },
          { id: "kapa", label: "Kapat, para ve sessizlik", effects: { cash: -4000, flags: { kartalMirasi: "kapa" }, husumet: -4, gonul: { m_sabri: 6 }, schedule: { due: 3, next: "done" } } },
          { id: "bekle", label: "Yara kurur", effects: { flags: { kartalMirasi: "yara" }, schedule: { due: 2, next: "done" } } }
        ] },
      { id: "kp-4", minWeek: 18, cooldown: 10, requireMemory: { who: "m_cevdet", type: "cevap-verdi" }, title: "Cevdet daha fazlasını istedi",
        body: "Bir vitrin yetmedi. 'Devam. Ya da ben kendi devam ederim.'",
        choices: [
          { id: "devam", label: "Devam, seninle", effects: { husumet: 8, dosya: 5, gonul: { m_cevdet: 6 }, schedule: { due: 2, next: "done" } } },
          { id: "dur", label: "Dur, yeter", effects: { gonul: { m_cevdet: -10 }, schedule: { due: 2, next: "done" } } },
          { id: "bekle", label: "Vitrin durur", effects: { schedule: { due: 2, next: "done" } } }
        ] }
    ]},
    { id: "fazil-defter", family: "para", exclusive: [], npc: "m_fazil", stages: [
      { id: "fd-1", minWeek: 5, maxWeek: 14, cooldown: 8, requireMan: "m_fazil", title: "Fazıl kalemi durdurdu",
        body: "Gözlük. 'Kirli kasa temiz kasaya sızıyor. İmzam yok. Ya ayırırız, ya defter kapanır.'",
        idBody: { kontrollu: "Fazıl kalemi kapadı. 'Ölçü: kirli ayrı, temiz ayrı. İmzam yoksa defter yok.'", paraOdakli: "Fazıl rakamı gösterdi. 'Karışık kasa hızlı döner, sonra maliye döner.'", fevri: "Fazıl bakmadı. 'Ateş defteri yakar. Ayır, ya da ben çekilirim.'" },
        choices: [
          { id: "ayir", label: "Kasaları ayır", effects: { flags: { kasaAyir: 1 }, gonul: { m_fazil: 10 }, remember: [{ who: "m_fazil", type: "kasa-ayirdi", sentiment: 2 }], schedule: { due: 3, next: 1, echo: "ayir" } } },
          { id: "karis", label: "Karışık dursun, hızlı döner", effects: { flags: { kasaKaris: 1 }, gonul: { m_fazil: -8 }, remember: [{ who: "m_fazil", type: "kasa-karis", sentiment: -2 }], schedule: { due: 2, next: 1 } } },
          { id: "bekle", label: "Kalem durur", effects: { schedule: { due: 2, next: 1 } } }
        ] },
      { id: "fd-2", minWeek: 9, cooldown: 8, requireMan: "m_fazil", title: "Yuvarlama",
        body: "Cemil fısıldadı. 'Fazıl kendi payını yuvarlıyor. Küçük. Küçük durmaz.'",
        choices: [
          { id: "yuzle", label: "Yüzle, payı kes", effects: { gonul: { m_fazil: -12, m_cemil: 4 }, flags: { fazilYuz: 1 }, schedule: { due: 3, next: 2, echo: "yuz" } } },
          { id: "gorme", label: "Görme, defter dönsün", effects: { flags: { fazilGorme: 1 }, gonul: { m_fazil: 4, m_cemil: -4 }, schedule: { due: 3, next: 2 } } },
          { id: "bekle", label: "Yuvarlar durur", effects: { schedule: { due: 2, next: 2 } } }
        ] },
      { id: "fd-3", minWeek: 14, cooldown: 10, requireMan: "m_fazil", title: "Maliye fısıltısı",
        body: "Fazıl korktu. 'Sahte fatura birikti. Ya yakarız, ya imza isterler.'",
        choices: [
          { id: "yak", label: "Yak, iz kalmasın", effects: { flags: { fazilMirasi: "yak" }, dosya: 3, gonul: { m_fazil: 6 }, schedule: { due: 3, next: "done", echo: "yak" } } },
          { id: "imza", label: "İmza at, temiz görün", effects: { flags: { fazilMirasi: "imza" }, gonul: { m_fazil: -10 }, dosya: 6, schedule: { due: 3, next: "done" } } },
          { id: "bekle", label: "Fatura durur", effects: { flags: { fazilMirasi: "fatura" }, schedule: { due: 2, next: "done" } } }
        ] },
      { id: "fd-4", minWeek: 18, cooldown: 10, requireMan: "m_fazil", requireMemory: { who: "m_fazil", type: "kasa-ayirdi" }, title: "Fazıl sayım istedi",
        body: "Defter açık. 'Bir kez sayılmadı. Bu kez sayılsın.'",
        choices: [
          { id: "say", label: "Say, açık", effects: { gonul: { m_fazil: 8 }, flags: { sayim: 1 }, schedule: { due: 2, next: "done" } } },
          { id: "yok", label: "Sayım yok", effects: { gonul: { m_fazil: -8 }, schedule: { due: 2, next: "done" } } },
          { id: "bekle", label: "Defter kapanır", effects: { schedule: { due: 2, next: "done" } } }
        ] }
    ]},
    { id: "nuri-agiz", family: "ekip", exclusive: [], npc: "m_nuri", stages: [
      { id: "na-1", minWeek: 3, maxWeek: 10, cooldown: 8, requireMan: "m_nuri", title: "Nuri iki tarafa konuştu",
        body: "Haber aynı, fiyat iki. İsmail duydu. 'Evlatlık değil, pazar.'",
        idBody: { pragmatik: "Nuri iki fiyat söyledi. İşe yarar, İsmail kızar.", sadik: "Nuri iki tarafa konuştu. Sadakat tek ağız ister.", fevri: "Nuri ağzı açıldı. Ateşli haftada dil pahalıdır." },
        choices: [
          { id: "tek", label: "Tek ağız, tek pay", effects: { flags: { nuriTek: 1 }, gonul: { m_nuri: -4 }, rel: { p_kahveci: 6 }, remember: [{ who: "m_nuri", type: "tek-agiz", sentiment: -1 }], schedule: { due: 3, next: 1, echo: "tek" } } },
          { id: "kullan", label: "Kullan, iki taraftan dinle", effects: { flags: { nuriCift: 1 }, gonul: { m_nuri: 6 }, rel: { p_kahveci: -8 }, remember: [{ who: "m_nuri", type: "cift-agiz", sentiment: 1 }], schedule: { due: 2, next: 1 } } },
          { id: "bekle", label: "Ağız kapanır", effects: { schedule: { due: 2, next: 1 } } }
        ] },
      { id: "na-2", minWeek: 7, cooldown: 8, requireMan: "m_nuri", title: "Cevdet Nuri'yi istedi",
        body: "Cevdet: 'Bu çocuk bana lazım. Ağzı ince.' Nuri korktu.",
        choices: [
          { id: "ver", label: "Cevdet'e ver", effects: { gonul: { m_cevdet: 6, m_nuri: -10 }, flags: { nuriCevdet: 1 }, schedule: { due: 3, next: 2, echo: "ver" } } },
          { id: "koru", label: "Nuri kahvede kalsın", effects: { gonul: { m_nuri: 8, m_cevdet: -4 }, rel: { p_kahveci: 4 }, flags: { nuriKoru2: 1 }, schedule: { due: 3, next: 2 } } },
          { id: "bekle", label: "Çocuk durur", effects: { schedule: { due: 2, next: 2 } } }
        ] },
      { id: "na-3", minWeek: 12, cooldown: 10, requireMan: "m_nuri", title: "Nuri kovulma korkusu",
        body: "İsmail kapıyı gösterdi. 'Bir daha çift konuşursan yatak yok.'",
        choices: [
          { id: "ozur", label: "Özür, tek ağız yemini", effects: { flags: { nuriMirasi: "yemin" }, gonul: { m_nuri: 4 }, rel: { p_kahveci: 6 }, schedule: { due: 3, next: "done" } } },
          { id: "kov", label: "Kovulsun, ağız fazla", effects: { flags: { nuriMirasi: "kov" }, gonul: { m_nuri: -16 }, schedule: { due: 3, next: "done" } } },
          { id: "bekle", label: "Kapı aralık", effects: { flags: { nuriMirasi: "aralik" }, schedule: { due: 2, next: "done" } } }
        ] },
      { id: "na-4", minWeek: 16, cooldown: 10, requireMan: "m_nuri", requireMemory: { who: "m_nuri", type: "cift-agiz" }, title: "Haber geri döndü",
        body: "Kartallar Nuri'nin dilinden bir cümle duydu. Sabri yüzünü çevirdi.",
        choices: [
          { id: "inkar", label: "Nuri yalan söyledi de", effects: { gonul: { m_nuri: -8, m_sabri: 2 }, schedule: { due: 2, next: "done" } } },
          { id: "ustlen", label: "Üstlen, çocuk işi", effects: { gonul: { m_nuri: 6, m_sabri: -4 }, dosya: 3, schedule: { due: 2, next: "done" } } },
          { id: "bekle", label: "Cümle uçar", effects: { schedule: { due: 2, next: "done" } } }
        ] }
    ]},
    { id: "zeki-kulak", family: "ekip", exclusive: [], npc: "m_zeki", stages: [
      { id: "zk-1", minWeek: 2, maxWeek: 9, cooldown: 8, requireMan: "m_zeki", title: "Zeki çay parası sordu",
        body: "Eğildi. 'Duydum. Sabri duymadı. Çay parası unutulursa kulak da unutur.'",
        idBody: { paraOdakli: "Zeki elini açtı. 'Kulak ucuz değil. Çay parası, küçük.'", merhametli: "Zeki eğildi. 'Anam Dilsiz Çatı'da. Çay parası değil, yerim.'", kontrollu: "Zeki kısık. 'Sabri duymadı. Ben duydum. Ölçülü öde, kulak durur.'" },
        choices: [
          { id: "cay", label: "Çay parasını ver", effects: { cash: -200, flags: { zekiCay: 1 }, gonul: { m_zeki: 8 }, remember: [{ who: "m_zeki", type: "cay-aldi", sentiment: 1 }], schedule: { due: 3, next: 1, echo: "cay" } } },
          { id: "yok", label: "Kulak ücretsiz", effects: { gonul: { m_zeki: -8 }, remember: [{ who: "m_zeki", type: "cay-yok", sentiment: -2 }], schedule: { due: 2, next: 1 } } },
          { id: "bekle", label: "Çay soğur", effects: { schedule: { due: 2, next: 1 } } }
        ] },
      { id: "zk-2", minWeek: 6, cooldown: 8, requireMan: "m_zeki", title: "Sabri'nin yeri",
        body: "Zeki Sabri'nin sandalyesine bakıyor. 'Yaşlı. Ben dururum. Sen seç.'",
        choices: [
          { id: "sabri", label: "Sabri durur, Zeki çırak", effects: { gonul: { m_sabri: 8, m_zeki: -8 }, flags: { zekiCirak: 1 }, schedule: { due: 3, next: 2, echo: "cirak" } } },
          { id: "zeki", label: "Zeki'ye kulak ver, Sabri dinlensin", effects: { gonul: { m_zeki: 10, m_sabri: -10 }, flags: { zekiYer: 1 }, schedule: { due: 3, next: 2 } } },
          { id: "bekle", label: "Sandalye boş değil", effects: { schedule: { due: 2, next: 2 } } }
        ] },
      { id: "zk-3", minWeek: 11, cooldown: 10, requireMan: "m_zeki", title: "Annesinin adı",
        body: "Dilsiz Çatı. Biri Zeki'nin annesinden bahsetti. Zeki eğilmedi, dikildi.",
        choices: [
          { id: "koru", label: "Adı kapat, mahalle duymasın", effects: { flags: { zekiMirasi: "anne" }, gonul: { m_zeki: 10 }, remember: [{ who: "m_zeki", type: "anne-korundu", sentiment: 2 }], schedule: { due: 3, next: "done" } } },
          { id: "gec", label: "Geç, iş var", effects: { flags: { zekiMirasi: "gec" }, gonul: { m_zeki: -12 }, schedule: { due: 3, next: "done" } } },
          { id: "bekle", label: "Dilsiz Çatı uzak", effects: { flags: { zekiMirasi: "uzak" }, schedule: { due: 2, next: "done" } } }
        ] },
      { id: "zk-4", minWeek: 16, cooldown: 10, requireMan: "m_zeki", requireMemory: { who: "m_zeki", type: "cay-yok" }, title: "Kulak satıldı",
        body: "Bir cümle dışarı çıktı. Zeki 'çay parasıydı' demiyor, bakıyor.",
        choices: [
          { id: "ode", label: "Geç öde, kulak kapansın", effects: { cash: -800, gonul: { m_zeki: 4 }, schedule: { due: 2, next: "done" } } },
          { id: "kov", label: "Satan kulak dışarı", effects: { gonul: { m_zeki: -14 }, flags: { zekiKov: 1 }, schedule: { due: 2, next: "done" } } },
          { id: "bekle", label: "Cümle uçtu", effects: { schedule: { due: 2, next: "done" } } }
        ] }
    ]},
    { id: "cemil-adliye", family: "emniyet", exclusive: [], npc: "m_cemil", stages: [
      { id: "ca-1", minWeek: 6, maxWeek: 14, cooldown: 8, requireMan: "m_cemil", title: "Cemil kâtibi andı",
        body: "Ceket. 'Adliyede bir kâğıt duruyor. Fiyatı var. Geç kalırsak kapı soğur.'",
        idBody: { paraOdakli: "Cemil fiyatı söyledi. 'Kâğıt duruyor. Geç kalırsan iki kat.'", kontrollu: "Cemil ölçülü. 'Zarf düzenli giderse kapı ısınır. Düzensizse soğur.'", fevri: "Cemil acele. 'Kâtip ısınmadan al. Ateşli haftada adliye duymaz.'" },
        choices: [
          { id: "al", label: "Al, zarfı düzenli ver", effects: { cash: -3200, flags: { katip: 1 }, gonul: { m_cemil: 8 }, remember: [{ who: "m_cemil", type: "zarf-gitti", sentiment: 1 }], schedule: { due: 3, next: 1, echo: "katip" } } },
          { id: "yok", label: "Kâtip yok, bekleriz", effects: { gonul: { m_cemil: -6 }, flags: { katipYok: 1 }, schedule: { due: 2, next: 1 } } },
          { id: "bekle", label: "Kâğıt durur", effects: { schedule: { due: 2, next: 1 } } }
        ] },
      { id: "ca-2", minWeek: 10, cooldown: 8, requireMan: "m_cemil", title: "İki kere satış",
        body: "Fazıl fark etti. 'Aynı bilgi iki kez satıldı. Cemil'in payı kalın.'",
        choices: [
          { id: "kes", label: "Payı kes, yüzle", effects: { gonul: { m_cemil: -10, m_fazil: 6 }, flags: { cemilKes: 1 }, schedule: { due: 3, next: 2, echo: "kes" } } },
          { id: "kullan", label: "Kullan, bilgi ucuz olmaz", effects: { gonul: { m_cemil: 6, m_fazil: -6 }, flags: { cemilKullan: 1 }, schedule: { due: 3, next: 2 } } },
          { id: "bekle", label: "Bilgi uçar", effects: { schedule: { due: 2, next: 2 } } }
        ] },
      { id: "ca-3", minWeek: 15, cooldown: 10, requireMan: "m_cemil", title: "Kâtip ısındı",
        body: "Cemil korktu. 'Kâtibin adı çıkmak üzere. Ya soğuturuz, ya yakarız.'",
        choices: [
          { id: "sogut", label: "Soğut, para ve mesafe", effects: { cash: -2000, flags: { cemilMirasi: "sogut" }, gonul: { m_cemil: 6 }, schedule: { due: 3, next: "done" } } },
          { id: "yak", label: "Kâtibi bırak, Cemil dursun", effects: { flags: { cemilMirasi: "yak" }, gonul: { m_cemil: -8 }, dosya: 5, schedule: { due: 3, next: "done" } } },
          { id: "bekle", label: "Adliye uzak", effects: { flags: { cemilMirasi: "uzak" }, schedule: { due: 2, next: "done" } } }
        ] },
      { id: "ca-4", minWeek: 19, cooldown: 10, requireMan: "m_cemil", requireMemory: { who: "m_cemil", type: "zarf-gitti" }, title: "Zarf geç kaldı",
        body: "Kapı soğudu. Cemil: 'Geç kaldık. Bir daha fiyatı kalın.'",
        choices: [
          { id: "kalin", label: "Kalın öde, kapı açılsın", effects: { cash: -2500, gonul: { m_cemil: 4 }, schedule: { due: 2, next: "done" } } },
          { id: "kapa", label: "Kapı kapansın", effects: { gonul: { m_cemil: -8 }, flags: { katipKapandi: 1 }, schedule: { due: 2, next: "done" } } },
          { id: "bekle", label: "Kâtip unutur", effects: { schedule: { due: 2, next: "done" } } }
        ] }
    ]}

    ,{ id: "amca-golge", family: "itibar", exclusive: [], npc: "rival_amca", stages: [
      { id: "ag-1", minWeek: 6, maxWeek: 14, cooldown: 8, title: "Amca kahveden geçti",
        body: "Görünmedi. İsmail çay koydu, boş masaya. 'Ölçü duruyor. Gürültü durmuyor. İki sezon kaçtı mı unutmaz.'",
        idBody: { fevri: "İsmail bakmadı. 'Amca ateşi sevmez. Senin haftan gürültülü.'", kontrollu: "İsmail başını salladı. 'Ölçülü gidenin yeri durur.'" },
        choices: [
          { id: "olcu", label: "Ölçüyü tut, gürültüyü kes", effects: { flags: { amcaOlcu: 1 }, rep: { racon: 3, nam: -2 }, gonul: { m_sabri: 4 }, remember: [{ who: "m_sabri", type: "amca-olcu", sentiment: 1 }], schedule: { due: 3, next: 1, echo: "olcu" } } },
          { id: "gürültü", label: "Gürültü iş bitirir", effects: { flags: { amcaGurultu: 1 }, rep: { nam: 3, racon: -3 }, schedule: { due: 2, next: 1 } } },
          { id: "bekle", label: "Boş masa durur", effects: { schedule: { due: 2, next: 1 } } }
        ] },
      { id: "ag-2", minWeek: 10, cooldown: 8, title: "Hedef kâğıdı",
        body: "Bir çocuk kâğıt bıraktı. Amca yazısı değil, onun dili. 'Dosya inecek ya da sokak duracak.'",
        choices: [
          { id: "dosya", label: "Dosyayı indir, iş yavaşlasın", effects: { flags: { amcaDosya: 1 }, dosya: -4, cash: -2000, schedule: { due: 3, next: 2, echo: "dosya" } } },
          { id: "sokak", label: "Sokak dursun, dosya kalsın", effects: { flags: { amcaSokak: 1 }, husumet: 4, schedule: { due: 3, next: 2 } } },
          { id: "bekle", label: "Kâğıt uçar", effects: { schedule: { due: 2, next: 2 } } }
        ] },
      { id: "ag-3", minWeek: 16, cooldown: 10, title: "Halef fısıltısı",
        body: "Amca görünmez, soru görünür. 'Sen mi, başka mı. Taht boşluğu alaydır.'",
        choices: [
          { id: "ben", label: "Ben dururum, halef sonra", effects: { flags: { amcaMirasi: "ben" }, rep: { racon: 4 }, schedule: { due: 3, next: "done", echo: "ben" } } },
          { id: "hasan", label: "Hasan'ı göster", effects: { flags: { amcaMirasi: "hasan" }, gonul: { m_hasan: 8, m_cevdet: -6 }, schedule: { due: 3, next: "done" } } },
          { id: "bekle", label: "Fısıltı durur", effects: { flags: { amcaMirasi: "fisilti" }, schedule: { due: 2, next: "done" } } }
        ] },
      { id: "ag-4", minWeek: 20, cooldown: 12, requireMemory: { who: "m_sabri", type: "amca-olcu" }, title: "Amca ölçüyü sordu",
        body: "İsmail: 'O günkü ölçü durdu mu. Amca unutmaz, sen unutma.'",
        choices: [
          { id: "durdu", label: "Durdu, duruyor", effects: { rep: { racon: 3 }, gonul: { m_sabri: 4 }, schedule: { due: 2, next: "done" } } },
          { id: "kacti", label: "Kaçtı, iş değişti", effects: { rep: { racon: -4 }, schedule: { due: 2, next: "done" } } },
          { id: "bekle", label: "Soru kalır", effects: { schedule: { due: 2, next: "done" } } }
        ] }
    ]},
    { id: "merhamet-anne", family: "kisisel", exclusive: ["korku-mahalle"], npc: "m_muharrem", stages: [
      { id: "me-1", minWeek: 3, maxWeek: 9, cooldown: 8, title: "Bir anne kapıda",
        body: "Oğul içeride değil. Kadın konuşmadı, bekledi. Muharrem 'benim mahallem değil' dedi, durdu.",
        idBody: { merhametli: "Kadın bekliyor. Sen de bekliyorsun. Para ikinci.", korkulan: "Kadın korktu. Senin adın yeter, kapı açılır.", fevri: "Kadın sesini yükseltmedi. Sen yükseltirsen mahalle duyar." },
        requireIdentity: ["merhametli", "kontrollu", "sadik"],
        choices: [
          { id: "birak", label: "Oğlunu bırak, borç kalsın", effects: { flags: { anneBirak: 1 }, cash: -800, gonul: { m_muharrem: 6, m_hasan: -4 }, remember: [{ who: "m_muharrem", type: "anne-birakildi", sentiment: 2 }], schedule: { due: 3, next: 1, echo: "birak" } } },
          { id: "al", label: "Borç çıksın, oğul dursun", effects: { flags: { anneAl: 1 }, cash: 1200, gonul: { m_hasan: 4, m_muharrem: -6 }, schedule: { due: 2, next: 1 } } },
          { id: "bekle", label: "Kadın bekler", effects: { schedule: { due: 2, next: 1 } } }
        ] },
      { id: "me-2", minWeek: 7, cooldown: 8, title: "Mahalle yorumu",
        body: "Sabri: 'Bıraktın. Esnaf gördü. Korku inmedi, selam indi.'",
        choices: [
          { id: "selam", label: "Selam yeter", effects: { flags: { anneSelam: 1 }, rep: { saygi: 3, korku: -2 }, schedule: { due: 3, next: 2 } } },
          { id: "korku", label: "Korku geri gelsin", effects: { flags: { anneKorku: 1 }, rep: { korku: 4, saygi: -2 }, schedule: { due: 3, next: 2 } } },
          { id: "bekle", label: "Yorum uçar", effects: { schedule: { due: 2, next: 2 } } }
        ] },
      { id: "me-3", minWeek: 12, cooldown: 10, title: "Oğul geri geldi",
        body: "Borç değil, teşekkür de değil. Bir bilgi. 'Kartallar Son Kepenk'de araba arıyor.'",
        choices: [
          { id: "dinle", label: "Dinle, bırak", effects: { flags: { merhametMirasi: "bilgi" }, gonul: { m_muharrem: 4 }, schedule: { due: 3, next: "done" } } },
          { id: "kullan", label: "Kullan, oğula pay yok", effects: { flags: { merhametMirasi: "kullan" }, husumet: 3, schedule: { due: 3, next: "done" } } },
          { id: "bekle", label: "Bilgi durur", effects: { flags: { merhametMirasi: "durur" }, schedule: { due: 2, next: "done" } } }
        ] },
      { id: "me-4", minWeek: 16, cooldown: 10, requireMemory: { who: "m_muharrem", type: "anne-birakildi" }, title: "Anne unutmadı",
        body: "Bir ekmek bıraktı, konuşmadı. Muharrem 'bu mahalle böyle' dedi.",
        choices: [
          { id: "al", label: "Ekmeği al, selam ver", effects: { gonul: { m_muharrem: 4 }, rep: { saygi: 2 }, schedule: { due: 2, next: "done" } } },
          { id: "geri", label: "Geri ver, borç bitmedi", effects: { gonul: { m_muharrem: -4 }, schedule: { due: 2, next: "done" } } },
          { id: "bekle", label: "Ekmek soğur", effects: { schedule: { due: 2, next: "done" } } }
        ] }
    ]},
    { id: "korku-mahalle", family: "itibar", exclusive: ["merhamet-anne"], npc: "m_hasan", stages: [
      { id: "km-1", minWeek: 3, maxWeek: 9, cooldown: 8, title: "Selamlar kısaldı",
        body: "Hasan: 'Korku inince selam uzar. Şu an kısa. Bir örnek lazım, kan değil, örnek.'",
        idBody: { korkulan: "Hasan başını indirdi. 'Adın yeterdi. Yetmiyor. Bir vitrin konuşur.'", merhametli: "Hasan bakmadı. 'Örnek dersen merhametin biter. İstiyor musun?'" },
        requireIdentity: ["korkulan", "fevri", "paraOdakli"],
        choices: [
          { id: "ornek", label: "Bir kepenk, gece", effects: { flags: { korkuOrnek: 1 }, husumet: 4, dosya: 5, gonul: { m_hasan: 6, m_sabri: -8 }, remember: [{ who: "m_hasan", type: "ornek-kepenk", sentiment: 1 }], schedule: { due: 3, next: 1, echo: "ornek" } } },
          { id: "yok", label: "Örnek yok, iş sessiz", effects: { flags: { korkuYok: 1 }, gonul: { m_sabri: 4, m_hasan: -4 }, schedule: { due: 2, next: 1 } } },
          { id: "bekle", label: "Selam uzar belki", effects: { schedule: { due: 2, next: 1 } } }
        ] },
      { id: "km-2", minWeek: 7, cooldown: 8, title: "Esnaf yüzü",
        body: "Kemal kepenk indirdi erken. Korku geldi, müşteri gitmedi.",
        choices: [
          { id: "indir", label: "Korkuyu tut, kepenk açılsın", effects: { rel: { p_esnaf_st_fevzi: -8 }, rep: { korku: 4 }, schedule: { due: 3, next: 2 } } },
          { id: "ac", label: "Özür, cam parası", effects: { cash: -900, rel: { p_esnaf_st_fevzi: 8 }, rep: { korku: -2, saygi: 2 }, schedule: { due: 3, next: 2 } } },
          { id: "bekle", label: "Kepenk onun", effects: { schedule: { due: 2, next: 2 } } }
        ] },
      { id: "km-3", minWeek: 12, cooldown: 10, title: "Aşırı sertin geri tepmesi",
        body: "Bir çocuk sokakta adını yanlış söyledi. Gülmedi. Mahalle gülmedi.",
        choices: [
          { id: "gec", label: "Geç, çocuk işi", effects: { flags: { korkuMirasi: "gec" }, rep: { saygi: 2, korku: -2 }, gonul: { m_sabri: 4 }, schedule: { due: 3, next: "done" } } },
          { id: "duzelt", label: "Düzelt, örnek dursun", effects: { flags: { korkuMirasi: "ornek" }, rep: { korku: 3, saygi: -3 }, gonul: { m_sabri: -6 }, schedule: { due: 3, next: "done" } } },
          { id: "bekle", label: "Ad durur", effects: { flags: { korkuMirasi: "ad" }, schedule: { due: 2, next: "done" } } }
        ] },
      { id: "km-4", minWeek: 16, cooldown: 10, requireMemory: { who: "m_hasan", type: "ornek-kepenk" }, title: "Hasan örnek sordu",
        body: "O geceki kepenk duruyor. Hasan: 'İşe yaradı. Bir daha?'",
        choices: [
          { id: "bir", label: "Bir yeter", effects: { gonul: { m_hasan: -4, m_sabri: 4 }, schedule: { due: 2, next: "done" } } },
          { id: "daha", label: "Bir daha, başka sokak", effects: { dosya: 4, husumet: 4, gonul: { m_hasan: 6 }, schedule: { due: 2, next: "done" } } },
          { id: "bekle", label: "Kepenk eski", effects: { schedule: { due: 2, next: "done" } } }
        ] }
    ]},
    { id: "borc-kisa", family: "para", exclusive: [], npc: "m_hasan", stages: [
      { id: "bk-1", minWeek: 1, maxWeek: 7, cooldown: 7, title: "Kısa vadeli kasa",
        body: "Hasan bir kâğıt uzattı. 'Bu hafta çıkar, gelecek hafta iki kat. Kirli. Çabuk.'",
        choices: [
          { id: "al", label: "Al, bu hafta kurtul", effects: { cash: 4000, flags: { kisaBorc: 1 }, remember: [{ who: "m_hasan", type: "kisa-borc", sentiment: 0 }], schedule: { due: 2, next: 1, echo: "borc-geldi" } } },
          { id: "yok", label: "Kısa borç yok", effects: { flags: { kisaYok: 1 }, gonul: { m_hasan: -2 }, schedule: { due: 2, next: 1 } } },
          { id: "bekle", label: "Kâğıt durur", effects: { schedule: { due: 2, next: 1 } } }
        ] },
      { id: "bk-2", minWeek: 3, cooldown: 6, requireFlag: "kisaBorc", title: "İki kat kapıda",
        body: "Adam güldü. 'Dört bin sekiz oldu. Ya şimdi, ya vitrin.'",
        choices: [
          { id: "ode", label: "Öde, bitsin", effects: { cash: -8000, flags: { kisaOde: 1 }, schedule: { due: 3, next: 2, echo: "ode" } } },
          { id: "erte", label: "Ertele, faiz işler", effects: { flags: { kisaErte: 1 }, schedule: { due: 2, next: 2, echo: "erte" } } },
          { id: "bekle", label: "Adam bekler", effects: { schedule: { due: 2, next: 2 } } }
        ] },
      { id: "bk-3", minWeek: 6, cooldown: 8, title: "Uzun vadeli bedel",
        body: "Vitrin duruyor. Adam durmuyor. Fazıl: 'Kısa borç defteri kirletir.'",
        choices: [
          { id: "kapat", label: "Kapat, ne pahasına", effects: { cash: -10000, flags: { borcMirasi: "kapat" }, gonul: { m_fazil: 6 }, schedule: { due: 3, next: "done" } } },
          { id: "devret", label: "Cevdet'e devret, o haller", effects: { flags: { borcMirasi: "cevdet" }, gonul: { m_cevdet: -8, m_hasan: 4 }, husumet: 4, schedule: { due: 3, next: "done" } } },
          { id: "bekle", label: "Defter açık", effects: { flags: { borcMirasi: "acik" }, schedule: { due: 2, next: "done" } } }
        ] },
      { id: "bk-4", minWeek: 12, cooldown: 10, requireMemory: { who: "m_hasan", type: "kisa-borc" }, title: "Hasan aynı kâğıdı getirdi",
        body: "Yine kısa. Yine çabuk. 'Geçen sefer kurtardık.'",
        choices: [
          { id: "yok", label: "Bir kez yeter", effects: { gonul: { m_hasan: -4 }, flags: { kisaBir: 1 }, schedule: { due: 2, next: "done" } } },
          { id: "yine", label: "Yine al", effects: { cash: 3000, flags: { kisaIki: 1 }, schedule: { due: 2, next: "done" } } },
          { id: "bekle", label: "Kâğıt cebinde", effects: { schedule: { due: 2, next: "done" } } }
        ] }
    ]},
    { id: "sessizler-teklif", family: "rakipler", exclusive: [], npc: "rival_sessizler", stages: [
      { id: "st-1", minWeek: 8, maxWeek: 16, cooldown: 8, title: "Sessizler konuştu",
        body: "İsimleri gibi. Bir not: 'Kartallar size, biz kenarda. Ortak sınır, ortak sessizlik. Pay küçük.'",
        choices: [
          { id: "kabul", label: "Kabul, sınır çiz", effects: { flags: { sessizKabul: 1 }, husumet: -2, remember: [{ who: "m_sabri", type: "sessiz-sinir", sentiment: 1 }], schedule: { due: 3, next: 1, echo: "sinir" } } },
          { id: "red", label: "Kenar yok, mahalle tek", effects: { flags: { sessizRed: 1 }, husumet: 4, schedule: { due: 2, next: 1 } } },
          { id: "bekle", label: "Not durur", effects: { schedule: { due: 2, next: 1 } } }
        ] },
      { id: "st-2", minWeek: 12, cooldown: 8, title: "Test",
        body: "Sessizler bir sokakta durdu, iş yapmadı. Bakıyorlar. Cevdet 'tuzak' diyor.",
        choices: [
          { id: "dokunma", label: "Dokunma, test bitsin", effects: { flags: { sessizTest: 1 }, gonul: { m_sabri: 4, m_cevdet: -4 }, schedule: { due: 3, next: 2 } } },
          { id: "kov", label: "Kov, sokak senin", effects: { flags: { sessizKov: 1 }, husumet: 6, gonul: { m_cevdet: 4 }, schedule: { due: 3, next: 2 } } },
          { id: "bekle", label: "Dururlar", effects: { schedule: { due: 2, next: 2 } } }
        ] },
      { id: "st-3", minWeek: 16, cooldown: 10, title: "Küçük pay",
        body: "Pay gerçekten küçük. Fazıl 'hesap tutmaz' diyor. Sabri 'sınır tutar' diyor.",
        choices: [
          { id: "sinir", label: "Sınır kalsın, pay önemsiz", effects: { flags: { sessizMirasi: "sinir" }, gonul: { m_sabri: 6, m_fazil: -4 }, schedule: { due: 3, next: "done" } } },
          { id: "pay", label: "Pay artsın ya da bitsin", effects: { flags: { sessizMirasi: "pay" }, gonul: { m_fazil: 6, m_sabri: -4 }, schedule: { due: 3, next: "done" } } },
          { id: "bekle", label: "Küçük durur", effects: { flags: { sessizMirasi: "kucuk" }, schedule: { due: 2, next: "done" } } }
        ] },
      { id: "st-4", minWeek: 20, cooldown: 10, requireMemory: { who: "m_sabri", type: "sessiz-sinir" }, title: "Sınır çatladı",
        body: "Kartallar sessizlerin tarafına geçti. Sabri 'sözümüz vardı' diyor.",
        choices: [
          { id: "tut", label: "Sözü tut, sessizlere yardım", effects: { husumet: 6, gonul: { m_sabri: 6 }, schedule: { due: 2, next: "done" } } },
          { id: "birak", label: "Sınır bitti", effects: { gonul: { m_sabri: -6 }, schedule: { due: 2, next: "done" } } },
          { id: "bekle", label: "Çatlak durur", effects: { schedule: { due: 2, next: "done" } } }
        ] }
    ]},
    { id: "soz-agirligi", family: "itibar", exclusive: [], npc: "m_sabri", stages: [
      { id: "sa-1", minWeek: 4, maxWeek: 11, cooldown: 8, title: "Sözün ağırlığı",
        body: "Sabri kahvede bir cümle kurdu, mahalle duydu. 'Bu adamın sözü durur.' Durur mu, durmaz mı, bu hafta belli olur.",
        idBody: { sadik: "Sabri seni bağladı. Söz durmazsa o durmaz.", fevri: "Sabri bağladı. Ateş sözü eritir, mahalle bakar." },
        choices: [
          { id: "tut", label: "Sözü tut, işi yavaşlat", effects: { flags: { sozTut: 1 }, gonul: { m_sabri: 8 }, rep: { racon: 3 }, remember: [{ who: "m_sabri", type: "soz-tutuldu", sentiment: 2 }], schedule: { due: 3, next: 1, echo: "soz" } } },
          { id: "boz", label: "Söz ikinci, kasa birinci", effects: { flags: { sozBoz: 1 }, gonul: { m_sabri: -10 }, cash: 2000, remember: [{ who: "m_sabri", type: "soz-bozuldu", sentiment: -2 }], schedule: { due: 2, next: 1 } } },
          { id: "bekle", label: "Cümle uçar", effects: { schedule: { due: 2, next: 1 } } }
        ] },
      { id: "sa-2", minWeek: 8, cooldown: 8, title: "Küçük düşürülme",
        body: "Kartallar kahvede güldü. 'Sözü uçtu.' Sabri tespihi durdurdu.",
        choices: [
          { id: "cevap", label: "Cevap ver, sözü geri al", effects: { husumet: 6, dosya: 3, gonul: { m_sabri: 4 }, schedule: { due: 3, next: 2, echo: "cevap" } } },
          { id: "sus", label: "Gülmek ucuz", effects: { gonul: { m_sabri: -6 }, rep: { nam: -2 }, schedule: { due: 3, next: 2 } } },
          { id: "bekle", label: "Kahve dağılır", effects: { schedule: { due: 2, next: 2 } } }
        ] },
      { id: "sa-3", minWeek: 13, cooldown: 10, title: "Bölge prestiji",
        body: "Kırık Avlu'da adın geçiyor. Doğru mu, yanlış mı, sen seçeceksin.",
        choices: [
          { id: "kabul", label: "Kabul et, görünür ol", effects: { flags: { sozMirasi: "gorunur" }, rep: { nam: 4, racon: 2 }, dosya: 4, schedule: { due: 3, next: "done" } } },
          { id: "inkar", label: "İnkar, mahalle küçük kalsın", effects: { flags: { sozMirasi: "kucuk" }, rep: { nam: -2 }, gonul: { m_sabri: 4 }, schedule: { due: 3, next: "done" } } },
          { id: "bekle", label: "Ad geçer", effects: { flags: { sozMirasi: "gecer" }, schedule: { due: 2, next: "done" } } }
        ] },
      { id: "sa-4", minWeek: 18, cooldown: 10, requireMemory: { who: "m_sabri", type: "soz-tutuldu" }, title: "Sabri bir söz daha istedi",
        body: "Bu kez büyük. 'Esnaf tek el. Yazılı değil, senin dilin.'",
        choices: [
          { id: "ver", label: "Söz ver", effects: { gonul: { m_sabri: 6, m_riza: -4 }, flags: { ikinciSoz: 1 }, schedule: { due: 2, next: "done" } } },
          { id: "yok", label: "Bir söz yeter", effects: { gonul: { m_sabri: -6 }, schedule: { due: 2, next: "done" } } },
          { id: "bekle", label: "Dil durur", effects: { schedule: { due: 2, next: "done" } } }
        ] }
    ]},
    { id: "yevmiye-kiskanclik", family: "ekip", exclusive: [], npc: "m_hasan", stages: [
      { id: "yk-1", minWeek: 5, maxWeek: 12, cooldown: 8, title: "Yevmiye kıskançlığı",
        body: "Hasan Sabri'den kalın alıyor. Sabri konuşmadı. Muharrem konuştu. 'Pay görünür olunca gönül iner.'",
        choices: [
          { id: "esit", label: "Eşitle, herkes aynı", effects: { cash: -900, flags: { esitPay: 1 }, gonul: { m_sabri: 6, m_hasan: -4, m_muharrem: 4 }, remember: [{ who: "m_sabri", type: "pay-esit", sentiment: 1 }], schedule: { due: 3, next: 1, echo: "esit" } } },
          { id: "hasan", label: "Hasan kıdemli, fark dursun", effects: { gonul: { m_hasan: 6, m_sabri: -6, m_muharrem: -4 }, flags: { hasanFark: 1 }, remember: [{ who: "m_hasan", type: "kidem", sentiment: 1 }], schedule: { due: 2, next: 1 } } },
          { id: "bekle", label: "Yevmiye günü gelir", effects: { schedule: { due: 2, next: 1 } } }
        ] },
      { id: "yk-2", minWeek: 9, cooldown: 8, title: "Adam kayırma algısı",
        body: "Cevdet işe alındıysa payı kalın. Alınmadıysa söylenti kalın. Ekip bakıyor.",
        choices: [
          { id: "acik", label: "Açık söyle, defter göster", effects: { gonul: { m_fazil: 4, m_hasan: -2 }, flags: { defterAcik: 1 }, schedule: { due: 3, next: 2 } } },
          { id: "kapali", label: "Defter kapalı, iş bitirilsin", effects: { gonul: { m_hasan: 2, m_sabri: -4 }, flags: { defterKapali: 1 }, schedule: { due: 3, next: 2 } } },
          { id: "bekle", label: "Söylenti durur", effects: { schedule: { due: 2, next: 2 } } }
        ] },
      { id: "yk-3", minWeek: 14, cooldown: 10, title: "Haksız ceza",
        body: "Bir iş kaçtı. Hasan suçlandı. Sabri 'ben de oradaydım' diyor.",
        choices: [
          { id: "hasan", label: "Hasan'ı kes, örnek olsun", effects: { gonul: { m_hasan: -12, m_sabri: -4 }, flags: { yevmiyeMirasi: "hasan" }, remember: [{ who: "m_hasan", type: "haksiz-ceza", sentiment: -2 }], schedule: { due: 3, next: "done" } } },
          { id: "paylas", label: "Suç ortak, ceza yok", effects: { gonul: { m_hasan: 4, m_sabri: 4 }, flags: { yevmiyeMirasi: "ortak" }, schedule: { due: 3, next: "done" } } },
          { id: "bekle", label: "İş kaçar, durur", effects: { flags: { yevmiyeMirasi: "kacar" }, schedule: { due: 2, next: "done" } } }
        ] },
      { id: "yk-4", minWeek: 18, cooldown: 10, requireMemory: { who: "m_hasan", type: "haksiz-ceza" }, title: "Hasan unutmadı",
        body: "Tespih durdu. 'O günkü kesinti hâlâ duruyor. Kuzen bile sordu.'",
        choices: [
          { id: "iade", label: "İade et, sessiz", effects: { cash: -700, gonul: { m_hasan: 8 }, schedule: { due: 2, next: "done" } } },
          { id: "yok", label: "Kesinti kesintidir", effects: { gonul: { m_hasan: -8 }, schedule: { due: 2, next: "done" } } },
          { id: "bekle", label: "Tespih döner", effects: { schedule: { due: 2, next: "done" } } }
        ] }
    ]},
    { id: "fener-cenaze", family: "kisisel", exclusive: [], npc: "m_muharrem", stages: [
      { id: "fc-1", minWeek: 8, maxWeek: 16, cooldown: 8, title: "Son Kepenk'de cenaze",
        body: "Muharrem'in mahallesi. 'Bugün iş yok. Cenaze var. Gelirsen sözün ağırlaşır, gelmezsen ev soğur.'",
        idBody: { merhametli: "Muharrem bekliyor. Gelmen yeter, çelenk ikinci.", fevri: "Muharrem kısık. 'Ateşli haftada cenazeye gelinmez sandım. Yanıldım mı?'" },
        choices: [
          { id: "git", label: "Git, görünür ol", effects: { flags: { cenazeGit: 1 }, gonul: { m_muharrem: 12 }, rep: { saygi: 3, nam: -1 }, remember: [{ who: "m_muharrem", type: "cenaze-geldi", sentiment: 2 }], schedule: { due: 3, next: 1, echo: "cenaze" } } },
          { id: "para", label: "Çelenk gönder, sen dur", effects: { cash: -800, flags: { cenazeCelenk: 1 }, gonul: { m_muharrem: 2 }, schedule: { due: 2, next: 1 } } },
          { id: "bekle", label: "Cenaze biter", effects: { gonul: { m_muharrem: -6 }, schedule: { due: 2, next: 1 } } }
        ] },
      { id: "fc-2", minWeek: 12, cooldown: 8, title: "Eski borç, yeni tabut",
        body: "Merhumun oğlu bir kâğıt uzattı. Eski borç. Muharrem 'bu mahalle hesabı' dedi.",
        choices: [
          { id: "sil", label: "Borcu sil, tabut önünde", effects: { cash: -2000, flags: { cenazeSil: 1 }, gonul: { m_muharrem: 8 }, rel: { p_esnaf_st_fevzi: 4 }, schedule: { due: 3, next: 2, echo: "sil" } } },
          { id: "yaz", label: "Borç durur, defter durur", effects: { gonul: { m_muharrem: -6 }, flags: { cenazeYaz: 1 }, schedule: { due: 3, next: 2 } } },
          { id: "bekle", label: "Kâğıt cebe", effects: { schedule: { due: 2, next: 2 } } }
        ] },
      { id: "fc-3", minWeek: 16, cooldown: 10, title: "Son Kepenk'in bakışı",
        body: "Muharrem eve gitti, döndü. 'Sordular. Sen nasıl birisin diye. Ben cevap vermedim.'",
        choices: [
          { id: "iyi", label: "İyi de, mahalle duysun", effects: { flags: { fenerMirasi: "iyi" }, gonul: { m_muharrem: 6 }, rep: { saygi: 2 }, schedule: { due: 3, next: "done" } } },
          { id: "sus", label: "Cevap yok, iş var", effects: { flags: { fenerMirasi: "sus" }, gonul: { m_muharrem: -4 }, schedule: { due: 3, next: "done" } } },
          { id: "bekle", label: "Soru kalır", effects: { flags: { fenerMirasi: "soru" }, schedule: { due: 2, next: "done" } } }
        ] },
      { id: "fc-4", minWeek: 20, cooldown: 10, requireMemory: { who: "m_muharrem", type: "cenaze-geldi" }, title: "Muharrem bir cenaze daha sordu",
        body: "Bu kez uzak. 'Gelmezsen anlarım. Gelirsen ev bir daha ısınır.'",
        choices: [
          { id: "git", label: "Yine git", effects: { gonul: { m_muharrem: 8 }, cash: -400, schedule: { due: 2, next: "done" } } },
          { id: "yok", label: "Bir kez yeter", effects: { gonul: { m_muharrem: -6 }, schedule: { due: 2, next: "done" } } },
          { id: "bekle", label: "Uzak durur", effects: { schedule: { due: 2, next: "done" } } }
        ] }
    ]}
  ];


  var ECHO = {
    "zarf-tutti": "Kuzen zarfı aldı. Dosya inceldi, Hasan tespihi döndürdü.",
    "sus-soru": "Susmak soruyu büyüttü. Karakol yine sordu.",
    "erte": "Yarın bitti. Kâğıt duruyor.",
    "isim-yazildi": "İsim yazıldı. Cevdet bir şey demedi, demeyecek de değil.",
    "bos-kagit": "Boş kâğıt kabul edilmedi. Dosya şişti.",
    "gece-is": "Gece işi bitti. Mahallede bir isim eksik.",
    "dur-kirgin": "Cevdet durdu. Kıskançlık durmadı.",
    "cam-yapildi": "Cam takıldı. Kemal selam verdi, kısa.",
    "gozdagi": "Gözdağı tutuldu. Esnaf kepenk indirdi.",
    "pay": "Rıza payı aldı. Cevdet saydı.",
    "ev": "Muharrem eve yetişti. Kapı açıldı.",
    "borc-silindi": "Necati borcu sildi, makas döndü.",
    "kural": "Masa kuralı duruyor. Silah görünmedi.",
    "komur": "Kömür geldi. Rüstem selam verdi.",
    "zarf": "Zarf usulünce gitti. Nedim not aldı.",
    "avukat": "Ferit kapıyı açtı. Saat durdu.",
    "masa": "Ateşkes masası kuruldu. Çay soğumadı.",
    "cevap": "Cevap vitrine işlendi. Kartallar gördü.",
    "cenaze": "Cenazeye gidildi. Son Kepenk sordu, Muharrem cevap vermedi.",
    "soz": "Söz tutuldu. Sabri tespihi döndürdü.",
    "borc-geldi": "Kısa borç geldi. Gelecek hafta iki kat kapıda."
  };

  function autoBekleStale(S, H) {
    var papers = (S.inbox || []).filter(function (x) {
      return x.kind === "chain" && !x.kapali && (x.week || 0) < S.week;
    });
    papers.forEach(function (p) { choose(p, "bekle", S, H); });
  }

  function tick(S, H, UI) {
    if (!S || !H || !H.D) return;
    ensure(S);
    autoBekleStale(S, H);
    if (UI && H.num(UI.spawnLeft, 1) <= 0) return;
    if ((S.inbox || []).some(function (x) { return x.kind === "chain" && !x.kapali; })) return;
    var candidates = [];
    CHAINS.forEach(function (chain) {
      var st = chainState(S, chain.id);
      if (st.status === "done" || st.status === "dead" || st.status === "active") return;
      if ((chain.exclusive || []).some(function (id) {
        var other = S.flags.chains[id];
        return other && (other.status === "done" || other.status === "active");
      })) return;
      var node = chain.stages[st.stage];
      if (!node) { st.status = "done"; return; }
      if (!eligible(S, H, chain, node)) return;
      candidates.push({ chain: chain, node: node, st: st });
    });
    if (!candidates.length) return;
    candidates.sort(function (a, b) {
      return (a.node.minWeek || 0) - (b.node.minWeek || 0) || a.chain.id.localeCompare(b.chain.id);
    });
    var pick = candidates[0];
    H.D.noteEvent(S.depth, pick.node.id, S.week, pick.node.cooldown || 8);
    pick.st.status = "active";
    var body = locBody(pick.node, S);
    var hint = ident(S);
    H.pushInbox(pick.node.title, body, {
      kind: "chain",
      chainId: pick.chain.id,
      nodeId: pick.node.id,
      identityHint: hint,
      family: pick.chain.family,
      choices: pick.node.choices.map(function (c) { return { id: c.id, label: c.label }; })
    });
    if (UI) UI.spawnLeft = H.num(UI.spawnLeft, 1) - 1;
  }

  function choose(paper, choiceId, S, H) {
    if (!paper || !S || !H) return;
    ensure(S);
    var chain = CHAINS.filter(function (c) { return c.id === paper.chainId; })[0];
    if (!chain) { paper.kapali = true; paper.read = true; return; }
    var st = chainState(S, chain.id);
    var node = chain.stages.filter(function (n) { return n.id === paper.nodeId; })[0] || chain.stages[st.stage];
    if (!node) { paper.kapali = true; paper.read = true; return; }
    var choice = node.choices.filter(function (c) { return c.id === choiceId; })[0]
      || node.choices.filter(function (c) { return c.id === "bekle"; })[0]
      || node.choices[node.choices.length - 1];
    applyEffects(S, H, choice.effects, chain.id);
    if (H.defter) H.defter(node.title + " · " + choice.label);
    var next = choice.effects && choice.effects.schedule && choice.effects.schedule.next;
    if (next === "done" || next === "dead") {
      st.status = next === "dead" ? "dead" : "done";
      st.stage = chain.stages.length;
    } else if (typeof next === "number" && isFinite(next)) {
      st.stage = next;
      st.status = "idle";
    } else {
      st.stage = Math.min(chain.stages.length, st.stage + 1);
      st.status = st.stage >= chain.stages.length ? "done" : "idle";
    }
    if ((chain.exclusive || []).length && st.status === "done") {
      chain.exclusive.forEach(function (id) {
        var other = chainState(S, id);
        if (other.status === "idle") other.status = "dead";
      });
    }
    paper.kapali = true;
    paper.read = true;
    paper.choice = choice.id;
  }

  function resolve(effect, S, H) {
    if (!effect || (effect.type !== "chain-echo" && effect.type !== "chain")) return false;
    ensure(S);
    var chain = CHAINS.filter(function (c) { return c.id === effect.chainId; })[0];
    if (!chain) return true;
    var st = chainState(S, chain.id);
    if (effect.next === "done" || effect.next === "dead") {
      st.status = effect.next === "dead" ? "dead" : "done";
      st.stage = chain.stages.length;
    } else if (typeof effect.next === "number" && isFinite(effect.next)) {
      st.stage = effect.next;
      if (st.status === "active") st.status = "idle";
    }
    if (effect.echo && H && H.pushInbox) {
      var text = ECHO[effect.echo] || (chain.id + " geri döndü.");
      H.pushInbox("Yankı: " + chain.id, text, { kind: "echo", chainId: chain.id, echo: effect.echo });
    }
    return true;
  }

  function coverage() {
    var nodes = [];
    CHAINS.forEach(function (c) { c.stages.forEach(function (n) { nodes.push(n); }); });
    var choices = [];
    nodes.forEach(function (n) { (n.choices || []).forEach(function (ch) { choices.push(ch); }); });
    var delayed = choices.filter(function (c) { return c.effects && c.effects.schedule; }).length;
    var memory = choices.filter(function (c) { return c.effects && c.effects.remember; }).length;
    var idSens = nodes.filter(function (n) { return n.idBody || n.requireIdentity; }).length;
    var memReq = nodes.filter(function (n) { return n.requireMemory; }).length;
    var exclusive = CHAINS.filter(function (c) { return (c.exclusive || []).length; }).length;
    var ids = nodes.map(function (n) { return n.id; });
    var dup = ids.filter(function (id, i) { return ids.indexOf(id) !== i; });
    return {
      npcs: NPCS.length,
      chains: CHAINS.length,
      nodes: nodes.length,
      choices: choices.length,
      delayed: delayed,
      memory: memory,
      memoryNodes: memReq,
      identity: idSens,
      exclusive: exclusive,
      duplicateIds: dup
    };
  }

  function summarize(S) {
    ensure(S);
    var f = S.flags.chainFlags || {};
    var traces = [];
    if (f.kuzenMirasi) traces.push("Kuzen kapısı: " + f.kuzenMirasi);
    if (f.cevdetMirasi) traces.push("Cevdet: " + f.cevdetMirasi);
    if (f.sabriMirasi) traces.push("Sabri/esnaf: " + f.sabriMirasi);
    if (f.rizaMirasi) traces.push("Rıza: " + f.rizaMirasi);
    if (f.muharremMirasi) traces.push("Muharrem: " + f.muharremMirasi);
    if (f.necatiMirasi) traces.push("Necati: " + f.necatiMirasi);
    if (f.ismailMirasi) traces.push("İsmail: " + f.ismailMirasi);
    if (f.nedimMirasi) traces.push("Nedim: " + f.nedimMirasi);
    if (f.feritMirasi) traces.push("Ferit: " + f.feritMirasi);
    if (f.kartalMirasi) traces.push("Kartallar: " + f.kartalMirasi);
    if (f.amcaMirasi) traces.push("Amca: " + f.amcaMirasi);
    if (f.merhametMirasi) traces.push("Merhamet: " + f.merhametMirasi);
    if (f.korkuMirasi) traces.push("Korku: " + f.korkuMirasi);
    if (f.sozMirasi) traces.push("Söz: " + f.sozMirasi);
    if (f.fenerMirasi) traces.push("Son Kepenk: " + f.fenerMirasi);
    return traces;
  }

  root.RaconContent = {
    NPCS: NPCS,
    CHAINS: CHAINS,
    tick: tick,
    choose: choose,
    resolve: resolve,
    coverage: coverage,
    summarize: summarize,
    ident: ident,
    applyEffects: applyEffects
  };
})(typeof window !== "undefined" ? window : globalThis);
