// "Arşiv Odası" (working title): an original short interactive novella written for
// TarikLab. All people, places and events are fictional. No text here is adapted,
// translated or quoted from any other work. See docs/ip/.
//
// Structure: opening → choice 1 → choice 2 → choice 3 → one of two endings.
// Each choice changes the prose that follows and moves `evidence` and `resolve`;
// the ending is decided by both (see story-rules in reader.js).

export const TITLE = { tr: "Arşiv Odası", en: "The Records Room" };

export const PASSAGES = {
  start: {
    stamp: { tr: "DOSYA AÇILDI", en: "FILE OPENED" },
    heading: { tr: "Boş klasör", en: "The empty folder" },
    tr: [
      "Belediye arşivinde gece vardiyası saat dokuzda başlar ve kimse bunu bir ayrıcalık saymaz. Defne üç aydır eski tapu kartlarını tarıyor; tarayıcının ışığı her geçişte odanın tavanına aynı soluk şeridi çiziyor.",
      'Sabah danışmaya yaşlı bir kadın gelmişti. Saniye Hanım. Kırk yıl oturduğu evin yıkıldığını, şimdi tazminat için o evde oturduğunu kanıtlaması gerektiğini söylemişti. Adres: Ilgın Sokağı 7. Kayıt sistemi sokağı tanıyordu ama yedi numarayı tanımıyordu. "Öyle bir bina hiç olmamış," demişti nöbetçi memur, ekrana bakmadan.',
      'Şimdi Defne\'nin önünde, alfabetik sıranın tam olması gereken yerinde, üzerinde "Ilgın 7 — yıkım" yazan bir klasör duruyor. İçi boş. Yalnızca bir fiş: el yazısıyla, mürekkebi solmuş, "Bkz. kutu 44."',
      "Katalogda kutu 44 yok. Kırk üçten sonra kırk beş geliyor, sanki biri araya hiç sayı koymamış gibi.",
    ],
    en: [
      "The night shift in the municipal archive starts at nine, and nobody counts it as a privilege. Defne has been scanning old land cards for three months; with every pass the scanner draws the same pale stripe across the ceiling.",
      'That morning an elderly woman had come to the front desk. Saniye Hanım. She said the house she had lived in for forty years had been demolished, and now, for compensation, she had to prove she had lived there. Address: Ilgın Street, number 7. The records system knew the street but not number seven. "That building never existed," the clerk on duty had said, without looking up from the screen.',
      'Now, in front of Defne, exactly where the alphabet says it should be, lies a folder marked "Ilgın 7 — demolition". It is empty. Only an index card: handwritten, the ink faded, "See box 44."',
      "The catalogue has no box 44. After forty-three comes forty-five, as if nobody ever put a number in between.",
    ],
    choices: [
      {
        id: "basement",
        tr: "Bodruma in. Kataloğa girmemiş kutular orada.",
        en: "Go down to the basement. The uncatalogued boxes are there.",
        effect: { evidence: 1 },
        next: "c1-basement",
      },
      {
        id: "request",
        tr: "Arşiv şefine resmî bir arama talebi yaz.",
        en: "Write a formal search request to the head of the archive.",
        effect: { evidence: -1 },
        next: "c1-request",
      },
      {
        id: "call",
        tr: "Saniye Hanım'ın bıraktığı numarayı ara.",
        en: "Call the number Saniye Hanım left.",
        effect: { resolve: 1 },
        next: "c1-call",
      },
    ],
  },

  "c1-basement": {
    stamp: { tr: "BODRUM · YETKİSİZ", en: "BASEMENT · UNAUTHORISED" },
    heading: { tr: "Numarasız raflar", en: "Unnumbered shelves" },
    tr: [
      "Bodrum anahtarı nöbetçi masasının çekmecesinde, bir lastik bantla iki eski pul arasında duruyor. Defne yönetmeliği biliyor: gece bodruma tek başına inilmez. Yine de iner.",
      'Aşağıda hava ıslak kâğıt kokuyor. Raflardaki kutuların çoğunun üzerinde numara yok, yalnızca kalemle yazılmış yıllar var. Doksan sekiz yazan bir kutunun kapağı eğri kapanmış; içinde bir devir defteri ve defterin arasına sıkışmış, kenarı yırtık bir ruhsat sayfası. Sayfanın köşesinde bir damga: "Ilgın 7 — iskân."',
      "Bir binanın hiç var olmadığını söyleyen bir sistem için fazla somut bir damga.",
    ],
    en: [
      "The basement key lives in the night desk drawer, held by a rubber band between two old stamps. Defne knows the regulation: nobody goes down alone at night. She goes down anyway.",
      'Down there the air smells of damp paper. Most boxes on the shelves have no number, only years written in pencil. One marked ninety-eight has a lid that closed crooked; inside is a transfer ledger, and wedged between its pages a permit sheet with a torn edge. In the corner, a stamp: "Ilgın 7 — occupancy."',
      "Quite a solid stamp, for a system that says the building never existed.",
    ],
    next: "choice2",
  },
  "c1-request": {
    stamp: { tr: "TALEP · KAYITLI", en: "REQUEST · LOGGED" },
    heading: { tr: "Sıraya giren soru", en: "A question in the queue" },
    tr: [
      "Defne talebi dikkatle yazar: klasör adı, fişteki not, katalogdaki boşluk. Doğru olan budur; arşiv, herkesin kafasına göre kutu açtığı bir yer olursa arşiv olmaktan çıkar.",
      "Gece yarısına doğru e-posta kutusuna kısa bir yanıt düşer. Arşiv şefi Kemal Bey'den: \"Yarın konuşuruz. Kutu numaraları bazen birleştirilir, merak etme.\" Mesajın saati 23.52. Kemal Bey'in bu saatte uyanık olması tuhaf.",
      "Defne yine de bodruma iner, bu kez talebinin kaydı elinde. Doksan sekiz yazan kutuyu bulduğunda kapağın yeni açılmış olduğunu fark eder. Devir defteri yerinde, ama aradaki sayfalardan biri eksik; yalnızca yırtık kenarı kalmış.",
    ],
    en: [
      "Defne writes the request carefully: the folder name, the note on the card, the gap in the catalogue. This is the right way; an archive where anyone opens boxes as they please stops being an archive.",
      "Close to midnight a short reply lands in her inbox. From the head of the archive, Kemal Bey: \"We'll talk tomorrow. Box numbers are sometimes merged, don't worry.\" It is timestamped 23:52. Strange, that Kemal Bey is awake at this hour.",
      "Defne goes down to the basement anyway, this time with the record of her request in hand. When she finds the box marked ninety-eight, she notices the lid has been opened recently. The transfer ledger is there, but a page is missing; only its torn edge remains.",
    ],
    next: "choice2",
  },
  "c1-call": {
    stamp: { tr: "TELEFON · 21.40", en: "PHONE CALL · 21:40" },
    heading: { tr: "Ilgın ağacı", en: "The tamarisk" },
    tr: [
      "Saniye Hanım ikinci çalışta açar, sanki telefonun başında bekliyormuş gibi. Defne kim olduğunu söyler; karşı tarafta kısa bir sessizlik, sonra bir çaydanlık sesi.",
      '"Sokağa adını veren ağaç bizim kapının önündeydi," der Saniye Hanım. "Ilgın. Belediye doksanların sonunda kesti, yol genişleyecek diye. O yıl evin tapusunu da yeniden yazdırdılar, bir kutuya koydular, bize bir makbuz verdiler. Makbuz sel baskınında gitti."',
      'Defne bodruma iner. Doksan sekiz yazan bir kutunun kapağı eğri kapanmış. İçinde bir devir defteri; defterin bir sayfasında, kurşun kalemle, küçük bir ağaç çizilmiş. Yanında: "Ilgın 7 — kutu 44\'ten aktarıldı."',
    ],
    en: [
      "Saniye Hanım picks up on the second ring, as if she had been waiting by the phone. Defne says who she is; a short silence on the other end, then the sound of a kettle.",
      '"The tree that gave the street its name stood in front of our door," Saniye Hanım says. "A tamarisk. The municipality cut it down at the end of the nineties, to widen the road. That same year they had the deed rewritten, put it in a box and gave us a receipt. The receipt went in the flood."',
      'Defne goes down to the basement. A box marked ninety-eight has a lid that closed crooked. Inside is a transfer ledger; on one page someone has drawn a small tree in pencil. Beside it: "Ilgın 7 — transferred from box 44."',
    ],
    next: "choice2",
  },

  choice2: {
    stamp: { tr: "BULGU", en: "FINDING" },
    heading: { tr: "Devir defteri", en: "The transfer ledger" },
    tr: [
      'Defter bir şeyi açıkça söylüyor: Ilgın 7\'nin kayıtları bir zamanlar vardı ve bir gün başka bir kutuya "aktarıldı". Aktarmayı onaylayan imza okunmuyor; yanındaki kurum kodu ise artık kullanılmayan bir müdürlüğe ait.',
      "Tarayıcının ışığı yukarıda bir yerde hâlâ geçip duruyor. Defne defteri iki eliyle tutuyor ve ne yapacağını seçmesi gerektiğini biliyor, çünkü sabah geldiğinde bu oda yine herkesin odası olacak.",
    ],
    en: [
      'The ledger says one thing plainly: Ilgın 7\'s records once existed and were one day "transferred" to another box. The signature approving the transfer is illegible; the office code beside it belongs to a directorate that no longer exists.',
      "Upstairs, somewhere, the scanner light keeps passing. Defne holds the ledger in both hands and knows she has to choose, because when morning comes this room will belong to everyone again.",
    ],
    variants: {
      basement: {
        tr: "Ruhsat sayfası hâlâ defterin arasında; damga, kurumuş mürekkebe rağmen net.",
        en: "The permit sheet is still inside the ledger; the stamp is sharp despite the dried ink.",
      },
      request: {
        tr: "Yırtılan sayfa ruhsat sayfası olmalı; artık yok. Elinde yalnızca defterin satırı kaldı.",
        en: "The torn-out page must have been the permit; it is gone. Only the ledger line is left.",
      },
      call: {
        tr: "Kurşun kalemle çizilmiş ağacın yanındaki not, aynı elden: biri bu binayı unutmak istememiş.",
        en: "The note beside the pencilled tree is in the same hand: someone did not want this building forgotten.",
      },
    },
    choices: [
      {
        id: "photo",
        tr: "Bulduklarının fotoğrafını çek; defteri yerine koy.",
        en: "Photograph what you found; put the ledger back.",
        effect: { evidence: 2 },
        next: "c2-photo",
      },
      {
        id: "refnum",
        tr: "Yalnızca defterin sıra numarasını ve aktarma kodunu not al.",
        en: "Write down only the ledger's serial number and the transfer code.",
        effect: { evidence: 1 },
        next: "c2-refnum",
      },
      {
        id: "report",
        tr: "Defteri şefin masasına bırak, bir not ekle.",
        en: "Leave the ledger on the head's desk with a note.",
        effect: { evidence: 0 },
        next: "c2-report",
      },
    ],
  },
  "c2-photo": {
    stamp: { tr: "KOPYA · TELEFONDA", en: "COPY · ON PHONE" },
    heading: { tr: "Üç fotoğraf", en: "Three photographs" },
    tr: [
      "Üç fotoğraf: defterin satırı, aktarma kodu, kutunun üstündeki yıl. Telefonun ekranında kâğıdın sarısı olduğundan daha sarı görünüyor. Defne defteri kutuya, kutuyu rafa koyar ve kapağı eğri kapatır; bulduğu gibi.",
      "Yukarı çıkarken kendini bir hırsız gibi değil, bir tanık gibi hissetmeye çalışır. Bu ikisi arasındaki farkın bir kısmı niyette, bir kısmı da yarın ne yapacağında.",
    ],
    en: [
      "Three photographs: the ledger line, the transfer code, the year on the box. On the phone screen the paper looks yellower than it is. Defne puts the ledger back in the box, the box back on the shelf, and closes the lid crooked, just as she found it.",
      "On the way up she tries to feel like a witness rather than a thief. Part of the difference is intention; part of it is what she does tomorrow.",
    ],
    next: "choice3",
  },
  "c2-refnum": {
    stamp: { tr: "NOT · CEPTE", en: "NOTE · IN POCKET" },
    heading: { tr: "Bir sıra numarası", en: "A serial number" },
    tr: [
      "Defne bir fişin arkasına iki satır yazar: defterin sıra numarası ve aktarma kodu. Fotoğraf çekmez; kayıt, kaydı kopyalamakla değil, kaydın nerede durduğunu bilmekle korunur diye düşünür.",
      "Fişi cebine koyarken ağırlığını hisseder. İki satır; birinin yeniden bulmasına yetecek kadar, birinin inkâr etmesine yetmeyecek kadar.",
    ],
    en: [
      "Defne writes two lines on the back of an index card: the ledger's serial number and the transfer code. She takes no photographs; a record is protected, she thinks, not by copying it but by knowing where it stands.",
      "Putting the card in her pocket, she feels its weight. Two lines: enough for someone to find it again, not enough for someone to deny it.",
    ],
    next: "choice3",
  },
  "c2-report": {
    stamp: { tr: "TESLİM · ŞEF MASASI", en: "HANDED IN · HEAD'S DESK" },
    heading: { tr: "Doğru kanal", en: "The proper channel" },
    tr: [
      "Defne defteri Kemal Bey'in masasına bırakır ve üstüne kısa bir not yazar: nerede bulduğunu, neden önemli olduğunu, Saniye Hanım'ın başvuru numarasını. İmzalar, saati ekler.",
      "Doğru kanal budur. Yine de odadan çıkarken, defterin artık onun elinde olmadığını, kimin elinde olacağını da bilmediğini fark eder.",
    ],
    en: [
      "Defne leaves the ledger on Kemal Bey's desk with a short note on top: where she found it, why it matters, Saniye Hanım's application number. She signs it and adds the time.",
      "This is the proper channel. Still, as she leaves the room, she realises the ledger is no longer in her hands, and she does not know whose hands it will be in.",
    ],
    next: "choice3",
  },

  choice3: {
    stamp: { tr: "SABAH · 08.30", en: "MORNING · 08:30" },
    heading: { tr: "İki kapı", en: "Two doors" },
    tr: [
      'Sabah Kemal Bey onu odasına çağırır. Sesi yorgun, sözleri dikkatli. "Bu tazminat dosyaları belediyeyi batırır," der. "Bir bina kayıttan düşmüşse düşmüştür. Biz arşiviz, mahkeme değiliz. Dosyayı kapatalım."',
      "Danışmada Saniye Hanım bekliyor. Elinde bir naylon dosya, dosyanın içinde bir şey yok; yalnızca umudu.",
    ],
    en: [
      'In the morning Kemal Bey calls her into his office. His voice is tired, his words careful. "These compensation files will sink the municipality," he says. "If a building dropped out of the record, it dropped out. We are an archive, not a court. Let\'s close the file."',
      "At the front desk Saniye Hanım is waiting. She holds a plastic sleeve with nothing in it; only her hope.",
    ],
    variants: {
      report: {
        tr: "Masasında, senin notunla birlikte devir defteri duruyor. Kapalı.",
        en: "On his desk lies the transfer ledger, your note on top. Closed.",
      },
    },
    choices: [
      {
        id: "give",
        tr: "Fotoğrafları Saniye Hanım'a ver ve resmî başvuru yolunu anlat.",
        en: "Give Saniye Hanım the photographs and explain the formal application route.",
        needs: { took: "photo" },
        why: { tr: "Elinde fotoğraf yok.", en: "You have no photographs." },
        effect: { resolve: 2 },
        next: "fork",
      },
      {
        id: "tell",
        tr: "Kaydın hangi kutuda, hangi numarada durduğunu söyle; avukatının resmen istemesini öner.",
        en: "Tell her which box and number the record sits under; suggest her lawyer requests it formally.",
        effect: { resolve: 1 },
        next: "fork",
      },
      {
        id: "follow",
        tr: 'Şefin dediğini yap: "Bulunamadı" yaz ve dosyayı kapat.',
        en: 'Do as the head says: write "not found" and close the file.',
        effect: { resolve: -5 },
        next: "fork",
      },
    ],
  },

  "end-record": {
    ending: true,
    stamp: { tr: "KAYIT YERİNDE", en: "THE RECORD STANDS" },
    heading: { tr: "Son: Kayıt yerinde", en: "Ending: The record stands" },
    tr: [
      "İki hafta sonra bir avukat yazısı gelir, resmî, soğuk ve kusursuz: devir defterinin şu sıra numarasındaki sayfanın bir örneği istenmektedir. Arşiv, isteneni vermek zorundadır; arşivin tek gücü de budur.",
      "Kemal Bey Defne'ye bir ihtar yazısı verir, gece bodruma tek başına indiği için. Defne yazıyı imzalar. Kâğıdı dosyasına koyarken, bunun da bir kayıt olduğunu, bir gün birinin onu da arayabileceğini düşünür.",
      "Ilgın 7 yeniden sisteme girer. Ekranda artık bir satır var: yapım yılı, iskân tarihi, yıkım tarihi. Saniye Hanım'ın adı bir kutucuğun içinde duruyor, kırk yılın özeti olarak fazla küçük ama yokluktan iyi.",
      "Bir akşam danışmaya bir kese kâğıdı bırakılır. İçinde kurutulmuş, pembe küçük çiçekler. Not yok. Defne onları boş klasörün içine koyar; artık boş olmayan klasörün.",
    ],
    en: [
      "Two weeks later a lawyer's letter arrives, formal, cold and flawless: a copy is requested of the page at such-and-such serial number of the transfer ledger. The archive must provide what is requested; that is the only power an archive has.",
      "Kemal Bey hands Defne a written warning for going down to the basement alone at night. Defne signs it. Filing the paper, she thinks that this too is a record, and one day someone may come looking for it.",
      "Ilgın 7 goes back into the system. There is a line on the screen now: year built, occupancy date, demolition date. Saniye Hanım's name sits in a small box, too small to sum up forty years but better than absence.",
      "One evening someone leaves a paper bag at the front desk. Inside, small dried pink flowers. No note. Defne puts them in the empty folder; the folder that is no longer empty.",
    ],
    extra: {
      call: {
        tr: "Tamarisk çiçekleri, diye düşünür Defne. Ilgın. Telefondaki çaydanlık sesini hatırlar.",
        en: "Tamarisk blossom, Defne thinks. Ilgın. She remembers the sound of the kettle on the phone.",
      },
    },
  },
  "end-folder": {
    ending: true,
    stamp: { tr: "DOSYA KAPANDI", en: "FILE CLOSED" },
    heading: { tr: "Son: Boş klasör", en: "Ending: The empty folder" },
    tr: [
      "Dosya kapanır. Sistemde Ilgın Sokağı hâlâ altı numaradan sekiz numaraya atlıyor; arada bir bina, bir ağaç, kırk yıl yok.",
      'Saniye Hanım bir daha gelmez. Defne onun telefon numarasını birkaç kez ekranda açar, aramadan kapatır. Ne diyeceğini bilmiyor; "bulunamadı" kelimesinin, bir şeyin gerçekten bulunamadığı anlamına gelmediğini söylemek bile bir şey söylemek sayılır mı?',
      "Kutu 44 kataloğa hiç girmez. Doksan sekiz yazan kutunun kapağı bir gün düz kapanmış olarak bulunur; içinde devir defteri yoktur.",
      'Defne boş klasörü atmaz. Fişi de: "Bkz. kutu 44." Kendi el yazısıyla altına bir satır ekler, tarihiyle birlikte. Arşivde bir şeyi korumanın en küçük yolu budur: unutulduğunu kaydetmek.',
    ],
    en: [
      "The file is closed. In the system Ilgın Street still jumps from number six to number eight; in between there is no building, no tree, no forty years.",
      'Saniye Hanım does not come back. Defne opens her phone number on the screen a few times and closes it without calling. She does not know what she would say; would even saying that "not found" does not mean something truly could not be found count as saying something?',
      "Box 44 never enters the catalogue. One day the lid of the box marked ninety-eight is found closed straight; the transfer ledger is no longer inside.",
      'Defne does not throw the empty folder away. Nor the card: "See box 44." In her own hand she adds a line beneath it, with the date. It is the smallest way an archive can protect something: by recording that it was forgotten.',
    ],
  },
};

/** How choices add up. The ending needs a real way to help and the will to use it. */
export function endingFor(state) {
  const { evidence = 0, resolve = 0 } = state.vars || {};
  return resolve >= 1 && evidence + resolve >= 3 ? "end-record" : "end-folder";
}
