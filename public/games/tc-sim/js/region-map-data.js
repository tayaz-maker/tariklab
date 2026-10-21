// Geographic anchors reviewed against municipal references; this artwork is not georectified.
// Compact label positions avoid touch-target collisions; leaders retain the same geographic anchor.
// Sources and the projection limitations are documented in docs/TC_SIM_REFERENCE_UI_ACCEPTANCE.md.
export const REGION_MAPS = Object.freeze({
  "istanbul": {
    "file": "tc-sim-2-istanbul.webp",
    "width": 1536,
    "height": 1024,
    "altEn": "Istanbul: Europe on the left, Asia on the right; the Golden Horn branches within Europe and the Bosphorus runs north to south.",
    "altPl": "Stambuł: Europa po lewej, Azja po prawej; Złoty Róg po stronie europejskiej, Bosfor biegnie z północy na południe.",
    "alt": "İstanbul: Avrupa yakası solda, Anadolu yakası sağda; Haliç Avrupa yakasının içinde, Boğaz kuzey güney yönünde.",
    "positions": {
      "sisli": [
        25,
        17
      ],
      "fatih": [
        24,
        69
      ],
      "besiktas": [
        57,
        34
      ],
      "beyoglu": [
        31,
        44
      ],
      "kadikoy": [
        83,
        82
      ],
      "uskudar": [
        72,
        54
      ],
      "umraniye": [
        89,
        37
      ],
      "bebek": [
        61.5,
        12
      ]
    },
    "compactPositions": {
      "sisli": [
        16,
        18
      ],
      "fatih": [
        26,
        82
      ],
      "besiktas": [
        50,
        44
      ],
      "beyoglu": [
        16,
        50
      ],
      "kadikoy": [
        84,
        84
      ],
      "uskudar": [
        84,
        52
      ],
      "umraniye": [
        84,
        20
      ],
      "bebek": [
        50,
        13
      ]
    }
  },
  "ankara": {
    "file": "tc-sim-2-ankara.webp",
    "width": 1536,
    "height": 1024,
    "altEn": "Ankara: Ulus north of Kızılay; Yenimahalle and Etimesgut to the west, Mamak to the east, Çankaya to the south.",
    "altPl": "Ankara: Ulus na północ od Kızılay; Yenimahalle i Etimesgut na zachodzie, Mamak na wschodzie, Çankaya na południu.",
    "alt": "Ankara: Ulus Kızılay’ın kuzeyinde; Yenimahalle ve Etimesgut batıda, Mamak doğuda, Çankaya güneyde.",
    "positions": {
      "yenimahalle": [
        28,
        22
      ],
      "etimesgut": [
        12,
        42
      ],
      "kizilay": [
        55,
        53
      ],
      "bahcelievler": [
        34,
        49
      ],
      "ulus": [
        57,
        28
      ],
      "kecioren": [
        68,
        14
      ],
      "cankaya": [
        68,
        80
      ],
      "mamak": [
        88,
        49
      ]
    },
    "compactPositions": {
      "yenimahalle": [
        17,
        14
      ],
      "etimesgut": [
        17,
        44
      ],
      "kizilay": [
        50,
        50
      ],
      "bahcelievler": [
        17,
        76
      ],
      "ulus": [
        50,
        14
      ],
      "kecioren": [
        83,
        14
      ],
      "cankaya": [
        60,
        85
      ],
      "mamak": [
        84,
        50
      ]
    }
  },
  "izmir": {
    "file": "tc-sim-2-izmir.webp",
    "width": 1536,
    "height": 1024,
    "altEn": "Izmir: the gulf opens west; Karşıyaka lies on the northern shore and Konak to the southeast. The southern shore is continuous, with no bridge across the gulf.",
    "altPl": "Izmir: zatoka otwiera się na zachód; Karşıyaka leży na północnym brzegu, Konak na południowym wschodzie. Ciągłe południowe wybrzeże, bez mostu przez zatokę.",
    "alt": "İzmir: Körfez batıya açık, Karşıyaka kuzey kıyıda, Konak güneydoğuda; güney kıyısı kesintisiz, körfez üzerinde köprü yok.",
    "positions": {
      "karsiyaka": [
        35,
        22
      ],
      "bornova": [
        89,
        22
      ],
      "alsancak": [
        76,
        34
      ],
      "konak": [
        77,
        52
      ],
      "buca": [
        91,
        83
      ],
      "goztepe": [
        49,
        78
      ],
      "balcova": [
        20,
        84
      ]
    },
    "compactPositions": {
      "karsiyaka": [
        20,
        15
      ],
      "bornova": [
        84,
        15
      ],
      "alsancak": [
        56,
        41
      ],
      "konak": [
        84,
        51
      ],
      "buca": [
        84,
        84
      ],
      "goztepe": [
        50,
        82
      ],
      "balcova": [
        16,
        82
      ]
    }
  }
});
