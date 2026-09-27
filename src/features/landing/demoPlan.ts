import type { AnnotationRegion, VideoAction, VideoCaption } from '../../types';

/**
 * Landing-page demo: the animation plan the studio's own pipeline (OCR →
 * solution parsing → narration alignment) produced for question 3
 * (public/landing/soru3.webp). Precomputed so visitors do not download the
 * OCR models; regenerate it with the pipeline if the renderer's plan format changes.
 */
export const DEMO_PLAN: { duration: number; regions: AnnotationRegion[]; actions: VideoAction[]; captions: VideoCaption[] } = {
 "duration": 52.326,
 "regions": [
  {
   "id": "question-root",
   "label": "Soru Kökü / Metin",
   "type": "paragraph",
   "x": 0.3753,
   "y": 0.3477,
   "width": 0.3869,
   "height": 0.0657,
   "content": "‏الطلاب الكتب المفيدة في أوقاتهم‎ JA İ mm"
  },
  {
   "id": "option-a",
   "label": "A Seçeneği",
   "type": "option-a",
   "x": 0.2628,
   "y": 0.4459,
   "width": 0.1171,
   "height": 0.0583,
   "markerAnchor": {
    "x": 0.0598,
    "y": 0.3809
   },
   "content": "A) الفارغات‎ A)"
  },
  {
   "id": "option-b",
   "label": "B Seçeneği",
   "type": "option-b",
   "x": 0.5159,
   "y": 0.4459,
   "width": 0.0906,
   "height": 0.0583,
   "markerAnchor": {
    "x": 0.0773,
    "y": 0.3809
   },
   "content": "(5 ‏فارغة"
  },
  {
   "id": "option-c",
   "label": "C Seçeneği",
   "type": "option-c",
   "x": 0.2633,
   "y": 0.5496,
   "width": 0.0906,
   "height": 0.0676,
   "markerAnchor": {
    "x": 0.0773,
    "y": 0.3424
   },
   "content": "0 g oul"
  },
  {
   "id": "option-d",
   "label": "D Seçeneği",
   "type": "option-d",
   "x": 0.5164,
   "y": 0.5505,
   "width": 0.0999,
   "height": 0.0564,
   "markerAnchor": {
    "x": 0.07,
    "y": 0.3934
   },
   "content": "(نا‎ ‏الفارغة D)"
  },
  {
   "id": "option-e",
   "label": "E Seçeneği",
   "type": "option-e",
   "x": 0.4034,
   "y": 0.6579,
   "width": 0.0786,
   "height": 0.0666,
   "markerAnchor": {
    "x": 0.0891,
    "y": 0.3332
   },
   "content": "3 ‏فارخ‎"
  },
  {
   "id": "arabic-grounded-1-1",
   "label": "Arapça: \"يَقْرَأُ الطُّلَّابُ الْكُتُبَ الْمُفِيدَةَ فِي أَوْقَاتِهِمْ\"",
   "type": "phrase",
   "x": 0.4278,
   "y": 0.3497,
   "width": 0.3324,
   "height": 0.0617,
   "content": "يَقْرَأُ الطُّلَّابُ الْكُتُبَ الْمُفِيدَةَ فِي أَوْقَاتِهِمْ"
  },
  {
   "id": "arabic-grounded-2-1",
   "label": "Arapça: \"أَوْقَاتِهِمْ\"",
   "type": "word",
   "x": 0.4278,
   "y": 0.3497,
   "width": 0.0725,
   "height": 0.0608,
   "content": "أَوْقَاتِهِمْ"
  }
 ],
 "actions": [
  {
   "id": "act-1-arabic-grounded-1-1-underline",
   "targetRegionId": "arabic-grounded-1-1",
   "regionId": "arabic-grounded-1-1",
   "type": "underline",
   "start": 0.619,
   "startTime": 0.619,
   "duration": 4.209,
   "label": "underline: يَقْرَأُ الطُّلَّابُ الْكُتُبَ الْمُفِيدَةَ فِي أَوْقَاتِهِمْ",
   "drawDuration": 4.209
  },
  {
   "id": "act-2-arabic-grounded-2-1-underline",
   "targetRegionId": "arabic-grounded-2-1",
   "regionId": "arabic-grounded-2-1",
   "type": "underline",
   "start": 10.604,
   "startTime": 10.604,
   "duration": 6.679,
   "label": "underline: أَوْقَاتِهِمْ",
   "drawDuration": 1.048
  },
  {
   "id": "act-3-arabic-grounded-2-1-underline",
   "targetRegionId": "arabic-grounded-2-1",
   "regionId": "arabic-grounded-2-1",
   "type": "underline",
   "start": 22.633,
   "startTime": 22.633,
   "duration": 3.656,
   "label": "underline: أَوْقَاتِهِمْ",
   "drawDuration": 1.049
  },
  {
   "id": "act-4-option-a-focus",
   "targetRegionId": "option-a",
   "regionId": "option-a",
   "type": "focus",
   "start": 30.554,
   "startTime": 30.554,
   "duration": 3.259,
   "label": "focus: A şıkkı"
  },
  {
   "id": "act-5-option-a-reject",
   "targetRegionId": "option-a",
   "regionId": "option-a",
   "type": "reject",
   "start": 33.813,
   "startTime": 33.813,
   "duration": 18.513,
   "label": "reject: olmaz"
  },
  {
   "id": "act-6-option-b-focus",
   "targetRegionId": "option-b",
   "regionId": "option-b",
   "type": "focus",
   "start": 34.714,
   "startTime": 34.714,
   "duration": 4.401,
   "label": "focus: B ve E şıkları"
  },
  {
   "id": "act-7-option-e-focus",
   "targetRegionId": "option-e",
   "regionId": "option-e",
   "type": "focus",
   "start": 34.714,
   "startTime": 34.714,
   "duration": 4.401,
   "label": "focus: B ve E şıkları"
  },
  {
   "id": "act-8-option-b-reject",
   "targetRegionId": "option-b",
   "regionId": "option-b",
   "type": "reject",
   "start": 39.115,
   "startTime": 39.115,
   "duration": 13.211,
   "label": "reject: eliyoruz"
  },
  {
   "id": "act-9-option-e-reject",
   "targetRegionId": "option-e",
   "regionId": "option-e",
   "type": "reject",
   "start": 39.255,
   "startTime": 39.255,
   "duration": 13.071,
   "label": "reject: eliyoruz"
  },
  {
   "id": "act-10-option-c-focus",
   "targetRegionId": "option-c",
   "regionId": "option-c",
   "type": "focus",
   "start": 40.176,
   "startTime": 40.176,
   "duration": 3.128,
   "label": "focus: C şıkkı"
  },
  {
   "id": "act-11-option-c-reject",
   "targetRegionId": "option-c",
   "regionId": "option-c",
   "type": "reject",
   "start": 43.304,
   "startTime": 43.304,
   "duration": 9.022,
   "label": "reject: uygun değil"
  },
  {
   "id": "act-12-option-d-focus",
   "targetRegionId": "option-d",
   "regionId": "option-d",
   "type": "focus",
   "start": 44.671,
   "startTime": 44.671,
   "duration": 4.343,
   "label": "focus: D şıkkı"
  },
  {
   "id": "act-13-option-d-correct",
   "targetRegionId": "option-d",
   "regionId": "option-d",
   "type": "correct",
   "start": 49.014,
   "startTime": 49.014,
   "duration": 3.312,
   "label": "correct: Tam olarak uygundur"
  },
  {
   "id": "act-14-option-d-focus",
   "targetRegionId": "option-d",
   "regionId": "option-d",
   "type": "focus",
   "start": 50.745,
   "startTime": 50.745,
   "duration": 1.581,
   "label": "focus: Doğru cevap D şıkkı"
  }
 ],
 "captions": [
  {
   "text": "Soru 3.",
   "start": 0,
   "end": 0.659,
   "words": [
    {
     "from": 0,
     "to": 4,
     "start": 0,
     "end": 0.356
    },
    {
     "from": 5,
     "to": 6,
     "start": 0.356,
     "end": 0.659
    }
   ]
  },
  {
   "text": "يَقْرَأُ الطُّلَّابُ الْكُتُبَ الْمُفِيدَةَ فِي أَوْقَاتِهِمْ ----.",
   "start": 0.659,
   "end": 4.828,
   "words": [
    {
     "from": 0,
     "to": 8,
     "start": 0.659,
     "end": 1.17
    },
    {
     "from": 9,
     "to": 20,
     "start": 1.17,
     "end": 2.055
    },
    {
     "from": 21,
     "to": 30,
     "start": 2.055,
     "end": 2.695
    },
    {
     "from": 31,
     "to": 43,
     "start": 2.695,
     "end": 3.542
    },
    {
     "from": 44,
     "to": 47,
     "start": 3.542,
     "end": 3.821
    },
    {
     "from": 48,
     "to": 61,
     "start": 3.821,
     "end": 4.828
    }
   ]
  },
  {
   "text": "Öğrenciler faydalı kitapları ---- vakitlerinde okurlar.",
   "start": 5.159,
   "end": 9.16,
   "words": [
    {
     "from": 0,
     "to": 10,
     "start": 5.159,
     "end": 5.864
    },
    {
     "from": 11,
     "to": 18,
     "start": 5.864,
     "end": 6.428
    },
    {
     "from": 19,
     "to": 28,
     "start": 6.428,
     "end": 8.174
    },
    {
     "from": 34,
     "to": 46,
     "start": 8.174,
     "end": 8.174
    },
    {
     "from": 47,
     "to": 54,
     "start": 8.174,
     "end": 9.16
    }
   ]
  },
  {
   "text": "Boşluktan önce gelen أَوْقَاتِهِمْ kelimesi, أَوْقَات çoğul bir isimdir ve akılsız",
   "start": 9.16,
   "end": 15.08,
   "words": [
    {
     "from": 0,
     "to": 9,
     "start": 9.16,
     "end": 9.783
    },
    {
     "from": 10,
     "to": 14,
     "start": 9.783,
     "end": 10.146
    },
    {
     "from": 15,
     "to": 20,
     "start": 10.146,
     "end": 10.644
    },
    {
     "from": 21,
     "to": 34,
     "start": 10.644,
     "end": 11.652
    },
    {
     "from": 35,
     "to": 43,
     "start": 11.652,
     "end": 12.356
    },
    {
     "from": 45,
     "to": 53,
     "start": 12.356,
     "end": 13.038
    },
    {
     "from": 54,
     "to": 59,
     "start": 13.038,
     "end": 13.487
    },
    {
     "from": 60,
     "to": 63,
     "start": 13.487,
     "end": 13.712
    },
    {
     "from": 64,
     "to": 71,
     "start": 13.712,
     "end": 14.299
    },
    {
     "from": 72,
     "to": 74,
     "start": 14.299,
     "end": 14.466
    },
    {
     "from": 75,
     "to": 82,
     "start": 14.466,
     "end": 15.08
    }
   ]
  },
  {
   "text": "varlıklar için kullanılır.",
   "start": 15.08,
   "end": 17.283,
   "words": [
    {
     "from": 0,
     "to": 9,
     "start": 15.08,
     "end": 15.754
    },
    {
     "from": 10,
     "to": 14,
     "start": 15.754,
     "end": 16.145
    },
    {
     "from": 15,
     "to": 25,
     "start": 16.145,
     "end": 17.283
    }
   ]
  },
  {
   "text": "Akılsız çoğullar sıfatlarda müfred müennes gibi muamele görür.",
   "start": 17.283,
   "end": 22.038,
   "words": [
    {
     "from": 0,
     "to": 7,
     "start": 17.283,
     "end": 17.89
    },
    {
     "from": 8,
     "to": 16,
     "start": 17.89,
     "end": 18.512
    },
    {
     "from": 17,
     "to": 27,
     "start": 18.512,
     "end": 19.307
    },
    {
     "from": 28,
     "to": 34,
     "start": 19.307,
     "end": 19.811
    },
    {
     "from": 35,
     "to": 42,
     "start": 19.811,
     "end": 20.357
    },
    {
     "from": 43,
     "to": 47,
     "start": 20.357,
     "end": 20.699
    },
    {
     "from": 48,
     "to": 55,
     "start": 20.699,
     "end": 21.214
    },
    {
     "from": 56,
     "to": 61,
     "start": 21.214,
     "end": 22.038
    }
   ]
  },
  {
   "text": "Ayrıca أَوْقَاتِهِمْ zamire muzaf olduğu için marifedir;",
   "start": 22.038,
   "end": 26.289,
   "words": [
    {
     "from": 0,
     "to": 6,
     "start": 22.038,
     "end": 22.673
    },
    {
     "from": 7,
     "to": 20,
     "start": 22.673,
     "end": 23.682
    },
    {
     "from": 21,
     "to": 27,
     "start": 23.682,
     "end": 24.123
    },
    {
     "from": 28,
     "to": 33,
     "start": 24.123,
     "end": 24.541
    },
    {
     "from": 34,
     "to": 40,
     "start": 24.541,
     "end": 24.92
    },
    {
     "from": 41,
     "to": 45,
     "start": 24.92,
     "end": 25.303
    },
    {
     "from": 46,
     "to": 55,
     "start": 25.303,
     "end": 26.289
    }
   ]
  },
  {
   "text": "sıfatı da marife olmalıdır.",
   "start": 26.289,
   "end": 28.504,
   "words": [
    {
     "from": 0,
     "to": 6,
     "start": 26.289,
     "end": 26.826
    },
    {
     "from": 7,
     "to": 9,
     "start": 26.826,
     "end": 26.986
    },
    {
     "from": 10,
     "to": 16,
     "start": 26.986,
     "end": 27.443
    },
    {
     "from": 17,
     "to": 26,
     "start": 27.443,
     "end": 28.504
    }
   ]
  },
  {
   "text": "Şimdi şıklara bakalım.",
   "start": 28.504,
   "end": 30.594,
   "words": [
    {
     "from": 0,
     "to": 5,
     "start": 28.504,
     "end": 28.931
    },
    {
     "from": 6,
     "to": 13,
     "start": 28.931,
     "end": 29.535
    },
    {
     "from": 14,
     "to": 21,
     "start": 29.535,
     "end": 30.594
    }
   ]
  },
  {
   "text": "A şıkkı الْفَارِغَاتُ.",
   "start": 30.594,
   "end": 32.314,
   "words": [
    {
     "from": 0,
     "to": 1,
     "start": 30.594,
     "end": 30.724
    },
    {
     "from": 2,
     "to": 7,
     "start": 30.724,
     "end": 31.313
    },
    {
     "from": 8,
     "to": 21,
     "start": 31.313,
     "end": 32.314
    }
   ]
  },
  {
   "text": "Cemi müennes olduğu için olmaz.",
   "start": 32.314,
   "end": 34.754,
   "words": [
    {
     "from": 0,
     "to": 4,
     "start": 32.314,
     "end": 32.607
    },
    {
     "from": 5,
     "to": 12,
     "start": 32.607,
     "end": 33.165
    },
    {
     "from": 13,
     "to": 19,
     "start": 33.165,
     "end": 33.542
    },
    {
     "from": 20,
     "to": 24,
     "start": 33.542,
     "end": 33.853
    },
    {
     "from": 25,
     "to": 30,
     "start": 33.853,
     "end": 34.754
    }
   ]
  },
  {
   "text": "B ve E şıkları فَارِغَة ile فَارِغ, nekre oldukları için eliyoruz.",
   "start": 34.754,
   "end": 40.216,
   "words": [
    {
     "from": 0,
     "to": 1,
     "start": 34.754,
     "end": 35.003
    },
    {
     "from": 2,
     "to": 4,
     "start": 35.003,
     "end": 35.17
    },
    {
     "from": 5,
     "to": 6,
     "start": 35.17,
     "end": 35.304
    },
    {
     "from": 7,
     "to": 14,
     "start": 35.304,
     "end": 36.022
    },
    {
     "from": 15,
     "to": 23,
     "start": 36.022,
     "end": 36.765
    },
    {
     "from": 24,
     "to": 27,
     "start": 36.765,
     "end": 37.104
    },
    {
     "from": 28,
     "to": 34,
     "start": 37.104,
     "end": 37.781
    },
    {
     "from": 36,
     "to": 41,
     "start": 37.781,
     "end": 38.199
    },
    {
     "from": 42,
     "to": 51,
     "start": 38.199,
     "end": 38.852
    },
    {
     "from": 52,
     "to": 56,
     "start": 38.852,
     "end": 39.155
    },
    {
     "from": 57,
     "to": 65,
     "start": 39.155,
     "end": 40.216
    }
   ]
  },
  {
   "text": "C şıkkı الْفَارِغِ müzekkerdir;",
   "start": 40.216,
   "end": 43.055,
   "words": [
    {
     "from": 0,
     "to": 1,
     "start": 40.216,
     "end": 40.386
    },
    {
     "from": 2,
     "to": 7,
     "start": 40.386,
     "end": 40.975
    },
    {
     "from": 8,
     "to": 18,
     "start": 40.975,
     "end": 41.866
    },
    {
     "from": 19,
     "to": 30,
     "start": 41.866,
     "end": 43.055
    }
   ]
  },
  {
   "text": "bu da uygun değildir.",
   "start": 43.055,
   "end": 44.711,
   "words": [
    {
     "from": 0,
     "to": 2,
     "start": 43.055,
     "end": 43.196
    },
    {
     "from": 3,
     "to": 5,
     "start": 43.196,
     "end": 43.344
    },
    {
     "from": 6,
     "to": 11,
     "start": 43.344,
     "end": 43.757
    },
    {
     "from": 12,
     "to": 20,
     "start": 43.757,
     "end": 44.711
    }
   ]
  },
  {
   "text": "D şıkkı الْفَارِغَةِ, hem marife hem müfred müennestir.",
   "start": 44.711,
   "end": 49.054,
   "words": [
    {
     "from": 0,
     "to": 1,
     "start": 44.711,
     "end": 44.872
    },
    {
     "from": 2,
     "to": 7,
     "start": 44.872,
     "end": 45.462
    },
    {
     "from": 8,
     "to": 20,
     "start": 45.462,
     "end": 46.389
    },
    {
     "from": 22,
     "to": 25,
     "start": 46.389,
     "end": 46.684
    },
    {
     "from": 26,
     "to": 32,
     "start": 46.684,
     "end": 47.135
    },
    {
     "from": 33,
     "to": 36,
     "start": 47.135,
     "end": 47.431
    },
    {
     "from": 37,
     "to": 43,
     "start": 47.431,
     "end": 47.926
    },
    {
     "from": 44,
     "to": 54,
     "start": 47.926,
     "end": 49.054
    }
   ]
  },
  {
   "text": "Tam olarak uygundur.",
   "start": 49.054,
   "end": 50.785,
   "words": [
    {
     "from": 0,
     "to": 3,
     "start": 49.054,
     "end": 49.248
    },
    {
     "from": 4,
     "to": 10,
     "start": 49.248,
     "end": 49.808
    },
    {
     "from": 11,
     "to": 19,
     "start": 49.808,
     "end": 50.785
    }
   ]
  },
  {
   "text": "Doğru cevap D şıkkı.",
   "start": 50.785,
   "end": 52.326,
   "words": [
    {
     "from": 0,
     "to": 5,
     "start": 50.785,
     "end": 51.146
    },
    {
     "from": 6,
     "to": 11,
     "start": 51.146,
     "end": 51.569
    },
    {
     "from": 12,
     "to": 13,
     "start": 51.569,
     "end": 51.744
    },
    {
     "from": 14,
     "to": 19,
     "start": 51.744,
     "end": 52.326
    }
   ]
  }
 ]
};
