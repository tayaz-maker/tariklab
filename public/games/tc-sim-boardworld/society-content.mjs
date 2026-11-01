/** Finite society rules. UI translates these keys; names and original records remain data. */
export const SOCIETY_COPY = {
  invitation: "Birlikte zaman önerisi",
  invitationWhy: "Bir süredir görüşmediğiniz için uygun bir saat ayırmayı önerdi.",
  request: "Doğrudan iletişim isteği",
  requestWhy: "Günlük düzeninde desteğe ve konuşmaya ihtiyaç duydu; bunu kendisi bildirdi.",
  accepted: "Davet onaylandı; artık gerçek bir takvim taahhüdü.",
  declined: "Onaylanmamış öneri kapandı; tutulmamış söz oluşmadı.",
  expired: "Yanıt süresi doldu; geçici NPC rezervasyonu serbest kaldı.",
  contact: "Gerçek sosyal temas",
  contactWhy: "İki kişi aynı yerde ve uygun zaman aralığında görüştü.",
  contactChange:
    "Karşılıklı ilişki ve öğrenilmiş bilgi, tamamlanan görüşmenin sonucuyla güncellendi.",
  reconcile: "Uzlaşma girişimi",
  reconcileWhy: "Geçmiş çatışma sürüyordu; taraflar görüşmeye zaman ayırdı.",
  reconcileGood: "Yeterli karşılıklı güvenle çatışma azaldı; geçmiş yükümlülükler silinmedi.",
  reconcileBad: "Karşılıklı güven henüz yetersizdi; uzlaşma gerçekleşmedi.",
  report: "Kaynaklı bilgi aktarımı",
  reportWhy:
    "Bir kişi yalnızca gerçekten öğrendiği, paylaşılabilir bir bilgiyi temasından sonra iletti.",
  reportChange: "Bilginin kaynağı, gecikmesi ve güvenilirliği korundu; özel bilgiler aktarılmadı.",
  corrected: "Kanıta dayalı düzeltme",
  correctedWhy:
    "Olayın kaynağıyla daha sonra tamamlanan bir yükümlülük, güven onarımına kanıt oldu.",
  correctedChange:
    "Yalnızca aynı olayın uyguladığı güven kaybı geri alındı; başka geçmiş silinmedi.",
  forgotten: "Eski duyumun etkisi sona erdi",
  forgottenWhy:
    "Yeni deneyimler eski duyumun önüne geçti; bu duyum artık değerlendirmeye katılmıyor.",
  forgottenChange:
    "Yalnızca eski duyumun ek güven kaybı geri alındı; gerçek yükümlülüklerin geçmişi korundu.",
  district: "Mahalle arz ve hizmet dengesi",
  districtWhy:
    "Toplu üretici sevkiyatı, hane tüketimi ve tamamlanan yerel faaliyetler haftalık dengeyi değiştirdi.",
  observed: "Yerinde gözlem",
  direct: "Kendisi doğrudan haber verdi",
  relayed: "Gerçek görüşme sonrası kaynaklı mesaj",
  private: "Özel: başkasına iletilmez",
  shareable: "Kaynak belirtilerek paylaşılabilir",
  colleague: "İş çevresi",
  neighbor: "Komşuluk",
  friend: "Arkadaşlık",
  acquaintance: "Tanışıklık",
  reliability: "Tutulan söz ve yükümlülük",
  work: "Gözlenen çalışma",
  service: "Tamamlanan yerel hizmet",
  finance: "Özel bütçe paylaşımı",
  health: "Özel sağlık bilgisi",
  romance: "Özel ilişki bilgisi",
  other: "Özel eski kayıt",
  noStock:
    "Semt stoğu bu alışveriş için yetersiz; sonraki günlük sevkiyatı bekle. Ücretsiz öğün seçeneği korunur.",
  noCapital: "Güncel malzeme fiyatı için işletme kasası yetersiz.",
  noFunds: "Güncel yerel fiyat için kullanılabilir bakiye yetersiz.",
  reschedule: "Başka bir gün öner",
  rescheduleDetail:
    "Aynı süre ve mekân için takvim, ulaşım ve karşı tarafın uygunluğu yeniden denetlenir. Onaylanmadan taahhüt oluşmaz.",
  oneRevision: "Bu davet için bir alternatif gün önerildi; kabul et veya kapat.",
  acknowledge: "İletişim isteğini kapat",
  acknowledgeDetail: "Önemli bir karar ya da yardım sözü vermeden mesajı okundu olarak kapat.",
  clarify: "Tamamlanan yükümlülüğü açıkla",
  clarifyDetail:
    "Sonraki gerçek buluşma veya tutulan sözle kazanılan güven onarımı açıklanır. Yalnızca bu kaydın ek güven kaybı geri alınır; eski yükümlülük silinmez.",
  noEvidence: "Bu olay için henüz doğrulanabilir bir onarım yok.",
  duplicate: "Bu bilgi veya düzeltme zaten işlendi.",
  summary:
    "Davetler isteğe bağlıdır. Görünen ağ öğrenilmiş bilgidir; özel hayat ve hesaplar kendiliğinden açılmaz.",
};
export const SOCIETY_LIMITS = {
  offers: 8,
  openOffers: 3,
  actorCooldown: 14,
  facts: 12,
  transmissions: 24,
  feed: 64,
  knownEdges: 48,
  edgeMeta: 180,
  secondaryEdges: 48,
  sessions: 6,
};
export const SOCIETY_TOPICS = [
  "reliability",
  "work",
  "service",
  "finance",
  "health",
  "romance",
  "other",
];
