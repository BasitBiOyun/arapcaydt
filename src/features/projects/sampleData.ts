import { QuestionProject } from '../../types';

// Authentic SVG Question Sheet 1 (2023 YDT Soru 14: İsm-i Mevsûl)
export const SAMPLE_QUESTION_IMAGE_1 = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="900" height="720" viewBox="0 0 900 720" style="background:#FFFFFF; font-family:'IBM Plex Sans', sans-serif;">
  <!-- Header / Exam strip -->
  <rect width="900" height="42" fill="#F4F3EE"/>
  <text x="30" y="26" font-size="14" font-weight="700" fill="#2B2A27">2023-YDT / ARAPÇA</text>
  <text x="750" y="26" font-size="13" font-weight="500" fill="#666560">ARAPÇA TESTİ</text>
  <line x1="0" y1="42" x2="900" y2="42" stroke="#E2E1D9" stroke-width="1.5"/>

  <!-- Question Number -->
  <circle cx="50" cy="85" r="18" fill="#8B1E2D"/>
  <text x="50" y="91" font-size="15" font-weight="700" fill="#FFFFFF" text-anchor="middle">14</text>

  <!-- Instruction -->
  <text x="80" y="85" font-size="14" font-weight="600" fill="#2B2A27">14. - 16. sorularda, cümlede boş bırakılan yerlere uygun düşen sözcük veya ifadeyi bulunuz.</text>

  <!-- Arabic Question Stem Box -->
  <rect x="50" y="125" width="800" height="150" rx="4" fill="#FCFBF9" stroke="#E5E4DC" stroke-width="1.5"/>
  <text x="820" y="190" font-family="'Amiri', 'Traditional Arabic', serif" font-size="28" font-weight="700" fill="#1C1917" direction="rtl" text-anchor="start">
    كَرَّمَتِ الجَامِعَةُ البَاحِثِينَ ....... سَاهَمُوا فِي تَطْوِيرِ اللُّقَاحِ الجَدِيدِ.
  </text>
  <text x="820" y="238" font-size="14" fill="#6E6D68" direction="rtl" text-anchor="start">
    (Üniversite, yeni aşının geliştirilmesine katkıda bulunan araştırmacıları ödüllendirdi.)
  </text>

  <!-- Options -->
  <!-- Option A -->
  <rect x="50" y="300" width="800" height="58" rx="4" fill="#FFFFFF" stroke="#ECEBE4" stroke-width="1"/>
  <text x="75" y="335" font-size="16" font-weight="700" fill="#8B1E2D">A)</text>
  <text x="820" y="338" font-family="'Amiri', serif" font-size="24" fill="#2B2A27" direction="rtl" text-anchor="start">الَّذِي</text>

  <!-- Option B (Correct) -->
  <rect x="50" y="375" width="800" height="58" rx="4" fill="#FFFFFF" stroke="#ECEBE4" stroke-width="1"/>
  <text x="75" y="410" font-size="16" font-weight="700" fill="#8B1E2D">B)</text>
  <text x="820" y="413" font-family="'Amiri', serif" font-size="24" font-weight="700" fill="#2B2A27" direction="rtl" text-anchor="start">الَّذِينَ</text>

  <!-- Option C -->
  <rect x="50" y="450" width="800" height="58" rx="4" fill="#FFFFFF" stroke="#ECEBE4" stroke-width="1"/>
  <text x="75" y="485" font-size="16" font-weight="700" fill="#8B1E2D">C)</text>
  <text x="820" y="488" font-family="'Amiri', serif" font-size="24" fill="#2B2A27" direction="rtl" text-anchor="start">الَّتِي</text>

  <!-- Option D -->
  <rect x="50" y="525" width="800" height="58" rx="4" fill="#FFFFFF" stroke="#ECEBE4" stroke-width="1"/>
  <text x="75" y="560" font-size="16" font-weight="700" fill="#8B1E2D">D)</text>
  <text x="820" y="563" font-family="'Amiri', serif" font-size="24" fill="#2B2A27" direction="rtl" text-anchor="start">اللَّاتِي</text>

  <!-- Option E -->
  <rect x="50" y="600" width="800" height="58" rx="4" fill="#FFFFFF" stroke="#ECEBE4" stroke-width="1"/>
  <text x="75" y="635" font-size="16" font-weight="700" fill="#8B1E2D">E)</text>
  <text x="820" y="638" font-family="'Amiri', serif" font-size="24" fill="#2B2A27" direction="rtl" text-anchor="start">الَّلذَانِ</text>
</svg>
`)}`;

// Authentic SVG Question Sheet 2 (2022 YDT Soru 24: Harf-i Cer Uyumu)
export const SAMPLE_QUESTION_IMAGE_2 = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="900" height="720" viewBox="0 0 900 720" style="background:#FFFFFF; font-family:'IBM Plex Sans', sans-serif;">
  <rect width="900" height="42" fill="#F4F3EE"/>
  <text x="30" y="26" font-size="14" font-weight="700" fill="#2B2A27">2022-YDT / ARAPÇA</text>
  <text x="750" y="26" font-size="13" font-weight="500" fill="#666560">ARAPÇA TESTİ</text>
  <line x1="0" y1="42" x2="900" y2="42" stroke="#E2E1D9" stroke-width="1.5"/>

  <circle cx="50" cy="85" r="18" fill="#8B1E2D"/>
  <text x="50" y="91" font-size="15" font-weight="700" fill="#FFFFFF" text-anchor="middle">24</text>
  <text x="80" y="85" font-size="14" font-weight="600" fill="#2B2A27">Cümlede boş bırakılan yere uygun düşen harf-i cer veya edatı seçiniz.</text>

  <rect x="50" y="125" width="800" height="150" rx="4" fill="#FCFBF9" stroke="#E5E4DC" stroke-width="1.5"/>
  <text x="820" y="190" font-family="'Amiri', serif" font-size="28" font-weight="700" fill="#1C1917" direction="rtl" text-anchor="start">
    يَعْتَمِدُ النَّجَاحُ فِي اخْتِبَارِ اللُّغَةِ ....... الِاسْتِمْرَارِ فِي التَّدْرِيبِ.
  </text>
  <text x="820" y="238" font-size="14" fill="#6E6D68" direction="rtl" text-anchor="start">
    (Dil sınavında başarı, alıştırmaları sürdürmeye dayanır / bağlıdır.)
  </text>

  <rect x="50" y="300" width="800" height="58" rx="4" fill="#FFFFFF" stroke="#ECEBE4" stroke-width="1"/>
  <text x="75" y="335" font-size="16" font-weight="700" fill="#8B1E2D">A)</text>
  <text x="820" y="338" font-family="'Amiri', serif" font-size="24" fill="#2B2A27" direction="rtl" text-anchor="start">مِنْ</text>

  <rect x="50" y="375" width="800" height="58" rx="4" fill="#FFFFFF" stroke="#ECEBE4" stroke-width="1"/>
  <text x="75" y="410" font-size="16" font-weight="700" fill="#8B1E2D">B)</text>
  <text x="820" y="413" font-family="'Amiri', serif" font-size="24" fill="#2B2A27" direction="rtl" text-anchor="start">إِلَى</text>

  <rect x="50" y="450" width="800" height="58" rx="4" fill="#FFFFFF" stroke="#ECEBE4" stroke-width="1"/>
  <text x="75" y="485" font-size="16" font-weight="700" fill="#8B1E2D">C)</text>
  <text x="820" y="488" font-family="'Amiri', serif" font-size="24" fill="#2B2A27" direction="rtl" text-anchor="start">فِي</text>

  <rect x="50" y="525" width="800" height="58" rx="4" fill="#FFFFFF" stroke="#ECEBE4" stroke-width="1"/>
  <text x="75" y="560" font-size="16" font-weight="700" fill="#8B1E2D">D)</text>
  <text x="820" y="563" font-family="'Amiri', serif" font-size="24" font-weight="700" fill="#2B2A27" direction="rtl" text-anchor="start">عَلَى</text>

  <!-- Option E -->
  <rect x="50" y="600" width="800" height="58" rx="4" fill="#FFFFFF" stroke="#ECEBE4" stroke-width="1"/>
  <text x="75" y="635" font-size="16" font-weight="700" fill="#8B1E2D">E)</text>
  <text x="820" y="638" font-family="'Amiri', serif" font-size="24" fill="#2B2A27" direction="rtl" text-anchor="start">عَنْ</text>
</svg>
`)}`;

export const INITIAL_PROJECTS: QuestionProject[] = [
  {
    id: 'proj_ydt_2023_q14',
    title: '2023 YDT Arapça - Soru 14 (İsm-i Mevsûl Uyuşumu)',
    examYear: '2023',
    questionNumber: 14,
    category: 'nahiv',
    correctAnswer: 'B',
    status: 'audio_approved',
    createdAt: '2026-09-10T09:30:00Z',
    updatedAt: '2026-09-13T16:45:00Z',
    imageUrl: SAMPLE_QUESTION_IMAGE_1,
    imageFileName: 'ydt_2023_soru_14.png',
    arabicQuestionSnippet: 'كَرَّمَتِ الجَامِعَةُ البَاحِثِينَ ....... سَاهَمُوا فِي تَطْوِيرِ اللُّقَاحِ الجَدِيدِ.',
    solutionText: `Değerli öğrenciler, 2023 YDT Arapça 14. sorumuzda bir İsm-i Mevsûl (bağlaç zamir) uyuşumu sorgulanmaktadır.

Cümlemizde boşluktan önce gelen "البَاحِثِينَ" (el-bâhisîn) kelimesi, müzekker ve çoğuldur (cemi müzekker salim). 

Ayrıca boşluktan sonra gelen sıla cümlesindeki fiilimiz "سَاهَمُوا" (sâhemû) da cemi müzekker zamiri olan "vavul-cemaa" içermektedir.

Seçenekleri incelediğimizde:
A şıkkı "الَّذِي" tekil müzekker için kullanılır, elenir.
C şıkkı "الَّتِي" tekil müennes veya gayr-i akil çoğullar içindir, elenir.
D şıkkı "اللَّاتِي" cemi müennes içindir, elenir.
E şıkkı "الَّلذَانِ" tesniye (ikil) müzekker içindir, elenir.

Bu durumda cemi akil müzekker için uygun olan doğru cevabımız B seçeneği "الَّذِينَ" (ellezîne) olacaktır.`,
    audioNarration: {
      audioUrl: '',
      duration: 18,
      voiceId: 'eUUtjbi66JcWz3T4Gvvo',
      voiceName: 'Eğitmen Sesi',
      modelId: 'eleven_multilingual_v2',
      generatedAt: '2026-09-13T16:40:00Z',
      isApproved: true,
      mode: 'mock',
      wordAlignments: [
        { word: 'Değerli', start: 0.5, end: 1.1 },
        { word: 'öğrenciler,', start: 1.2, end: 1.8 },
        { word: '2023', start: 2.0, end: 2.6 },
        { word: 'YDT', start: 2.7, end: 3.2 },
        { word: 'Arapça', start: 3.3, end: 3.9 },
        { word: 'sorumuzda', start: 4.1, end: 4.8 },
        { word: 'İsm-i', start: 5.0, end: 5.4 },
        { word: 'Mevsûl', start: 5.5, end: 6.1 },
        { word: 'uyuşumu', start: 6.2, end: 6.9 },
        { word: 'sorgulanmaktadır.', start: 7.1, end: 8.0 },
      ],
    },
    videoConfig: {
      aspectRatio: '16:9',
      fps: 30,
      backgroundColor: '#FFFFFF',
      showWatermark: true,
      teacherTag: 'Arapça YDT Akademi',
      regions: [
        {
          id: 'reg_q14_stem',
          label: 'Soru Kökü (Metin)',
          type: 'question',
          x: 0.055,
          y: 0.173,
          width: 0.89,
          height: 0.208,
        },
        {
          id: 'reg_q14_a',
          label: 'A Şıkkı (الَّذِي)',
          type: 'option-a',
          x: 0.055,
          y: 0.416,
          width: 0.89,
          height: 0.08,
        },
        {
          id: 'reg_q14_b',
          label: 'B Şıkkı (الَّذِينَ - Doğru)',
          type: 'option-b',
          x: 0.055,
          y: 0.52,
          width: 0.89,
          height: 0.08,
        },
        {
          id: 'reg_q14_c',
          label: 'C Şıkkı (الَّتِي)',
          type: 'option-c',
          x: 0.055,
          y: 0.625,
          width: 0.89,
          height: 0.08,
        },
        {
          id: 'reg_q14_d',
          label: 'D Şıkkı (اللَّاتِي)',
          type: 'option-d',
          x: 0.055,
          y: 0.729,
          width: 0.89,
          height: 0.08,
        },
        {
          id: 'reg_q14_e',
          label: 'E Şıkkı (الَّلذَانِ)',
          type: 'option-e',
          x: 0.055,
          y: 0.833,
          width: 0.89,
          height: 0.08,
        },
      ],
      timelineActions: [
        {
          id: 'act_q14_hl_stem',
          start: 2.0,
          duration: 4.5,
          targetRegionId: 'reg_q14_stem',
          type: 'highlight',
          label: 'Soru Kökünü Vurgula',
        },
        {
          id: 'act_q14_foc_a',
          start: 7.5,
          duration: 2.0,
          targetRegionId: 'reg_q14_a',
          type: 'focus',
          label: 'A Şıkkına Odaklan',
        },
        {
          id: 'act_q14_rej_a',
          start: 8.0,
          duration: 3.0,
          targetRegionId: 'reg_q14_a',
          type: 'reject',
          label: 'A Şıkkını Ele (الَّذِي)',
        },
        {
          id: 'act_q14_foc_c',
          start: 9.8,
          duration: 1.8,
          targetRegionId: 'reg_q14_c',
          type: 'focus',
          label: 'C Şıkkına Odaklan',
        },
        {
          id: 'act_q14_rej_c',
          start: 10.3,
          duration: 2.5,
          targetRegionId: 'reg_q14_c',
          type: 'reject',
          label: 'C Şıkkını Ele (الَّتِي)',
        },
        {
          id: 'act_q14_rej_d',
          start: 11.8,
          duration: 2.5,
          targetRegionId: 'reg_q14_d',
          type: 'reject',
          label: 'D Şıkkını Ele (اللَّاتِي)',
        },
        {
          id: 'act_q14_rej_e',
          start: 13.0,
          duration: 2.5,
          targetRegionId: 'reg_q14_e',
          type: 'reject',
          label: 'E Şıkkını Ele (الَّلذَانِ)',
        },
        {
          id: 'act_q14_foc_b',
          start: 14.5,
          duration: 2.5,
          targetRegionId: 'reg_q14_b',
          type: 'focus',
          label: 'B Şıkkına Odaklan',
        },
        {
          id: 'act_q14_corr_b',
          start: 15.0,
          duration: 3.0,
          targetRegionId: 'reg_q14_b',
          type: 'correct',
          label: 'Doğru Cevap: B (الَّذِينَ)',
        },
      ],
      annotations: [
        {
          id: 'ann_q14_highlight_cue',
          type: 'highlight',
          target: 'stem',
          x: 48,
          y: 22,
          width: 25,
          height: 8,
          startTime: 3.5,
          duration: 12,
          color: '#FDE047',
          label: 'Müzekker Çoğul İsim (الباحثين)',
        },
        {
          id: 'ann_q14_cross_a',
          type: 'cross',
          target: 'A',
          x: 7.5,
          y: 44,
          startTime: 9.0,
          duration: 9.0,
          color: '#DC2626',
          label: 'الذي (Müfred Müzekker - Elendi)',
        },
        {
          id: 'ann_q14_cross_c',
          type: 'cross',
          target: 'C',
          x: 7.5,
          y: 65,
          startTime: 11.0,
          duration: 7.0,
          color: '#DC2626',
          label: 'التي (Müennes - Elendi)',
        },
        {
          id: 'ann_q14_check_b',
          type: 'check',
          target: 'B',
          x: 7.5,
          y: 54,
          startTime: 14.0,
          duration: 4.0,
          color: '#16A34A',
          label: 'الذين (Cemi Müzekker - Doğru Cevap)',
        },
      ],
    },
  },
  {
    id: 'proj_ydt_2022_q24',
    title: '2022 YDT Arapça - Soru 24 (Harf-i Cer: اعتمد على)',
    examYear: '2022',
    questionNumber: 24,
    category: 'nahiv',
    correctAnswer: 'D',
    status: 'audio_generated',
    createdAt: '2026-09-08T11:15:00Z',
    updatedAt: '2026-09-12T14:20:00Z',
    imageUrl: SAMPLE_QUESTION_IMAGE_2,
    imageFileName: 'ydt_2022_soru_24.png',
    arabicQuestionSnippet: 'يَعْتَمِدُ النَّجَاحُ فِي اخْتِبَارِ اللُّغَةِ ....... الِاسْتِمْرَارِ فِي التَّدْرِيبِ.',
    solutionText: `Bu soruda "اعتمد" (ı’temede) fiilinin aldığı kalıp harf-i cer sorulmaktadır.

Arapçada bir şeye dayanmak, güvenmek, bağlı olmak anlamındaki "اِعْتَمَدَ - يَعْتَمِدُ" fiili daima "عَلَى" harf-i ceri ile kullanılır.

Bu kalıp YDT ve YDS sınavlarında en sık çıkan fiil-harfi cer birlikteliklerinden biridir. Dolayısıyla doğru cevabımız D seçeneğidir.`,
    audioNarration: {
      audioUrl: '',
      duration: 14,
      voiceId: 'eUUtjbi66JcWz3T4Gvvo',
      voiceName: 'Eğitmen Sesi',
      modelId: 'eleven_multilingual_v2',
      generatedAt: '2026-09-12T14:18:00Z',
      isApproved: false,
      mode: 'mock',
    },
    videoConfig: {
      aspectRatio: '16:9',
      fps: 30,
      backgroundColor: '#FFFFFF',
      showWatermark: true,
      annotations: [],
    },
  },
  {
    id: 'proj_ydt_2021_q07',
    title: '2021 YDT Arapça - Soru 7 (Eş Anlamlı Kelime Bilgisi)',
    examYear: '2021',
    questionNumber: 7,
    category: 'kelime',
    correctAnswer: 'A',
    status: 'draft',
    createdAt: '2026-09-05T14:00:00Z',
    updatedAt: '2026-09-05T14:00:00Z',
    imageUrl: SAMPLE_QUESTION_IMAGE_1,
    imageFileName: 'ydt_2021_soru_7.png',
    arabicQuestionSnippet: 'تَفَاقَمَتِ الأَزْمَةُ الاِقْتِصَادِيَّةُ فِي الآوِنَةِ الأَخِيرَةِ.',
    solutionText: `Soru kökünde altı çizili olan "تَفَاقَمَ" (tefâkame) fiilinin eş anlamlısı istenmektedir. 

Bu fiil "kötüleşmek, şiddetlenmek, büyüme göstermek" anlamına gelir. Doğru seçenek "اِشْتَدَّ" fiilini barındıran A şıkkıdır.`,
    videoConfig: {
      aspectRatio: '16:9',
      fps: 30,
      backgroundColor: '#FFFFFF',
      showWatermark: true,
      annotations: [],
    },
  },
];
