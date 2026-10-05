const heart = "https://www.nhlbi.nih.gov/health/heart/anatomy",
  lungs = "https://www.nhlbi.nih.gov/health/lungs",
  digestion =
    "https://www.niddk.nih.gov/health-information/digestive-diseases/digestive-system-how-it-works",
  kidneys = "https://www.niddk.nih.gov/health-information/kidney-disease/kidneys-how-they-work";
export const notes = {
  FMA7480: [
    "Göğüs kafesi; kaburgalar ve sternum gibi yapılarla göğüsteki organların korunmasına katkı verir. Bu görünüm, kaynak veri setinin bileşik göğüs kafesi grubudur.",
    "https://training.seer.cancer.gov/anatomy/skeletal/divisions/axial.html",
  ],
  FMA7088: [
    "Kalp, kanı akciğerlere ve vücudun diğer bölümlerine pompalayan kaslı organdır. Bu modelde kaynakta kalbe bağlı alt yüzeyler birlikte seçilir.",
    heart,
  ],
  FMA7309: [
    "Sağ akciğer, solunum sisteminin eşli organlarından biridir. Akciğerlerde oksijen ile karbondioksit alışverişi gerçekleşir. Sağ ve sol, modelin kendi yönleridir.",
    lungs,
  ],
  FMA7310: [
    "Sol akciğer, solunum sisteminin eşli organlarından biridir. Akciğerlerde oksijen ile karbondioksit alışverişi gerçekleşir. Sağ ve sol, modelin kendi yönleridir.",
    lungs,
  ],
  FMA7197: [
    "Karaciğer, yağların sindirimine yardımcı olan safrayı üretir. Model, kaynak veri setindeki karaciğer grubunu ve ona ait alt yüzeyleri birlikte gösterir.",
    digestion,
  ],
  FMA7148: [
    "Mide, besinleri sindirim sıvılarıyla karıştırır. Çizim yerine kaynak veri setinden alınmış üç boyutlu yüzeyi inceliyorsun.",
    digestion,
  ],
  FMA7204: [
    "Böbrekler kandaki atıkları ve fazla suyu süzerek idrar oluşumuna katkı sağlar. Burada erkek referans modelinin sağ böbreği gösteriliyor.",
    kidneys,
  ],
  FMA7205: [
    "Böbrekler kandaki atıkları ve fazla suyu süzerek idrar oluşumuna katkı sağlar. Burada erkek referans modelinin sol böbreği gösteriliyor.",
    kidneys,
  ],
  FMA13295: [
    "Diyafram solunumda görev alan kastır. Bu katman yalnız diyafram yüzeyini içerir; bütün kas sistemini temsil etmez.",
    lungs,
  ],
};
export const systems = { iskelet: "İskelet", organ: "Organlar", kas: "Kas" };
