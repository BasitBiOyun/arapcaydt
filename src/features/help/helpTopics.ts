/**
 * The illustrated guide on the Yardım page, one topic per menu entry.
 * Pictures live in public/help; the studio's own screens are retaken with `npm run help:screenshots`.
 */
export interface HelpStep {
  /** One instruction; **bold** marks the words on the screen (button names). */
  text: string;
  image?: string;
  alt?: string;
}
export interface HelpTopic {
  id: string;
  title: string;
  summary: string;
  steps: HelpStep[];
  tips?: string[];
}

export const HELP_TOPICS: HelpTopic[] = [
  {
    id: 'baslarken',
    title: 'Başlarken',
    summary: 'Soru Stüdyosu, soru görselinizi ve çözümünüzü sesli, işaretli bir çözüm videosuna dönüştürür. Her şey tarayıcıda, beş kolay adımda olur.',
    steps: [
      { text: 'Girişten sonra **Kontrol Paneli** açılır. Burada kaldığınız soruyu, soru sayılarınızı ve son çalıştığınız soruları görürsünüz.', image: 'panel', alt: 'Kontrol Paneli ve sol menü' },
      { text: 'Soldaki menüden sayfalar arasında geçersiniz: **Yeni soru**, **Sorularım**, **Toplu Üretim**, **Ayarlar** ve bu **Yardım** sayfası.' },
      { text: 'Bir soru her zaman aynı beş adımdan geçer: **1 Soru** (görsel) → **2 Metin** (çözüm) → **3 Ses** → **4 İşaretler** → **5 İndir** (MP4 video).', image: 'adimlar', alt: 'Editörün üstündeki beş adım' },
      { text: 'Çalışmanız kendiliğinden kaydedilir. Sağ üstte **Kaydedildi** yazısını gördüğünüzde her şey hesabınızdadır; başka bir bilgisayardan girince kaldığınız yerden devam edersiniz.' },
    ],
    tips: [
      'Yazılar size küçük geliyorsa **Ayarlar → Yazı boyutu** bölümünden “Büyük” veya “Çok büyük” seçebilirsiniz.',
      'Tarayıcının geri tuşu stüdyo içinde bir önceki sayfaya döner; sayfayı yenilediğinizde aynı soru açık kalır.',
    ],
  },
  {
    id: 'yeni-soru',
    title: 'Yeni soru ekleme',
    summary: 'Yeni bir soru videosuna soru türünü seçip soru görselini yükleyerek başlarsınız.',
    steps: [
      { text: 'Sol menünün en üstündeki kırmızı **Yeni soru** düğmesine basın.', image: 'yeni-soru', alt: 'Yeni soru düğmesi' },
      { text: 'Açılan pencerede sorunun türünü seçin (örneğin **Deneme** veya **Çıkmış Soru**) ve **Projeyi Başlat**’a basın.', image: 'soru-tipi', alt: 'Soru türü seçme penceresi' },
      { text: 'Editör **1 Soru** adımında açılır. Soru görselini kutunun üzerine sürükleyin ya da kutuya tıklayıp bilgisayarınızdan seçin (PNG, JPG veya WebP).', image: 'gorsel-yukle', alt: 'Soru görseli yükleme alanı' },
      { text: 'Görsel yüklenince **Metne geç** düğmesiyle ikinci adıma geçin. Şıkların (A–E) yeri daha sonra, işaretler hazırlanırken görselden kendiliğinden bulunur.' },
    ],
    tips: [
      'Sorunun adını, koleksiyonunu (deneme adı) ve yılını sağdaki **Proje bilgileri** bölümünden değiştirebilirsiniz.',
      'Görseli yanlış yüklediyseniz **Görseli Değiştir** ile yenisini seçebilirsiniz.',
    ],
  },
  {
    id: 'cozum-metni',
    title: 'Çözüm metnini yazma',
    summary: 'Çözümü, öğrenciye anlatır gibi yazarsınız. Seslendirme ve işaretler bu metinden hazırlanır.',
    steps: [
      { text: 'Önce **Doğru cevap** kutusundan doğru şıkkı seçin. Ardından çözümü büyük metin kutusuna yazın veya yapıştırın.', image: 'cozum-metni', alt: 'Çözüm metni ve doğru cevap' },
      { text: 'Şıkları anlatırken şık harfini yazın: “A şıkkı … olmaz”, “B ve E şıklarını eliyoruz”, “Doğru cevap D şıkkı” gibi. Sistem bu cümlelerden hangi şıkkın ne zaman çarpı, hangisinin tik alacağını anlar.' },
      { text: 'Metnin altındaki kontrol kutusunda her şıkkın ne olacağını görürsünüz (✗ elenir / ✓ doğru cevap). Bir şık eksikse cümlenizi o şıkkı adıyla anarak düzeltin.' },
      { text: 'Arapça ifadeleri **harekeli** yazın; seslendirme böylece doğru okur ve ifadeler görselde bulunup altı çizilir. Bitince **Sese geç**’e basın.' },
    ],
    tips: ['Metin en fazla 10.000 karakter olabilir; sayaç kutunun altında görünür. 1.800 karakterden uzun metinler birkaç kısa bölümde seslendirilip tek ses dosyasında birleştirilir (her bölüm bir ses hakkı kullanır); kısa bölümler hem zamanında biter hem daha az atlanır.'],
  },
  {
    id: 'seslendirme',
    title: 'Seslendirme',
    summary: 'Çözüm metninizi stüdyo seslendirir ya da kendi okuduğunuz MP3’ü yüklersiniz.',
    steps: [
      { text: '**3 Ses** adımında **Seslendirme Oluştur**’a basın. Ses birkaç saniye ile bir dakika arasında hazırlanır. Kendi sesinizi kullanmak isterseniz **MP3 Yükle** ile dosyanızı seçin.', image: 'ses-olustur', alt: 'Seslendirme Oluştur ve MP3 Yükle düğmeleri' },
      { text: 'Sesi baştan sona dinleyin. Beğendiyseniz **Bu Sesi Kullan**’a basın; beğenmediyseniz metni düzeltip **Yeniden seslendir** diyebilirsiniz.', image: 'ses-onay', alt: 'Sesi dinleme ve onaylama' },
      { text: 'Bir cümle yanlış okunduysa ya da atlandıysa bütün sesi baştan üretmeyin: sesin altındaki **Sesi düzelt** bölümünü açın. Okunmamış görünen yerler en üstte **Bu yeri ekle** düğmesiyle listelenir. Başka bir cümleyi düzeltmek için listeden o cümleye tıklayın (birden çok cümle için ilk ve son cümleye), isterseniz “2:00 – 2:10” gibi zamanla seçin; **Dinle** ile kontrol edip **Seçili yeri yeniden seslendir**’e basın. Yalnız o yer yeniden seslendirilir (1 ses hakkı); sesin geri kalanı ve işaretleriniz korunur. Beğenmezseniz **Son düzeltmeyi geri al** deyin.', image: 'sesi-duzelt', alt: 'Sesi düzelt bölümü' },
      { text: 'Onaylanan ses “Onaylandı” olarak görünür. **İşaretlere geç** ile dördüncü adıma geçin.' },
    ],
    tips: [
      'Bir kelimenin nasıl okunacağından emin değilseniz **Telaffuzu kısa bir örnekle dene** bölümünden kısa bir deneme dinleyebilirsiniz.',
      'Kendi MP3’ünüzü yüklüyorsanız, okuduğunuz metin çözüm metniyle aynı olmalıdır; işaretler kelimelere göre yerleştirilir.',
      'Günlük ücretsiz ses hakkı biterse kendi Google anahtarınızı ekleyebilirsiniz (bkz. **Google anahtarı alma**).',
    ],
  },
  {
    id: 'isaretler',
    title: 'İşaretler ve kutular',
    summary: 'Çarpı, tik, çerçeve ve altı çizgiler sesle aynı anda çıkar. Stüdyo bunları kendisi yerleştirir; siz izleyip gerekirse düzeltirsiniz.',
    steps: [
      { text: 'İlk girişte **İşaretleri otomatik hazırla**’ya basın. Sonra önizlemede ▶ düğmesine basıp videoyu izleyin.', image: 'isaretler', alt: 'Önizleme ve işaret araçları' },
      { text: 'Bir işareti değiştirmek için videoyu durdurun ve görseldeki kutuya tıklayın. Soldaki araçlardan **✗ Çarpı**, **✓ Doğru işareti**, **◎ Çerçeve**, **▁ Altı çizgi** veya **▮ Vurgu** ekleyebilirsiniz.', image: 'isaret-secili', alt: 'Seçili kutu ve işaret menüsü' },
      { text: 'Önizlemenin altındaki **Zaman şeridi**nde her işaret bir kutucuktur. Kutucuğu sürükleyerek işaretin ne zaman çıkacağını, kenarından çekerek ne kadar kalacağını ayarlarsınız.', image: 'zaman-seridi', alt: 'Zaman şeridi' },
      { text: 'Bir şıkkın kutusu yanlış yerdeyse sağdaki **Görseldeki kutuları düzenle**’ye basın. Kutuya tıklayın, ortasından sürükleyerek taşıyın, kenarlarındaki mavi tutamaçlardan çekerek büyütün veya küçültün.', image: 'kutu-duzenle', alt: 'Kutu düzenleyici' },
      { text: 'Bitince **Kaydet ve önizlemeye dön**, ardından **İndirmeye geç**’e basın.' },
    ],
    tips: [
      'Yaptığınız son değişikliği **Geri al** düğmesiyle geri alabilirsiniz.',
      '**İşaretleri yeniden hazırla** elle yaptığınız düzeltmeleri siler; bu yüzden önce onayınızı ister.',
      'Önizleme hızını 1× ile 2× arasında seçerek videoyu hızlıca kontrol edebilirsiniz.',
    ],
  },
  {
    id: 'video-indir',
    title: 'Videoyu indirme',
    summary: 'Son adımda video, bilgisayarınızda MP4 dosyası olarak hazırlanır ve iner.',
    steps: [
      { text: '**5 İndir** adımında **Yayına hazır** listesini okuyun: bulunan şıklar, doğru cevap ve işaretlerin sese bağlılığı burada kontrol edilir. Kırmızı bir madde varsa yanındaki düğmeyle düzeltin.', image: 'video-indir', alt: 'Video indirme adımı' },
      { text: '**MP4 İndir (1080p)** düğmesine basın. Düğmede “MP4 Hazırlanıyor… %40” gibi ilerleme görünür; bitene kadar bu sekmeyi kapatmayın.' },
      { text: 'Video, tarayıcınızın **İndirilenler** klasörüne sorunun adıyla kaydedilir.' },
    ],
    tips: ['Altyazıları, soru boyutunu ve sondaki “Doğru cevap” kapanış kartını önizlemenin altındaki seçeneklerden açıp kapatabilirsiniz.'],
  },
  {
    id: 'soru-listesi',
    title: 'Sorularım ve koleksiyonlar',
    summary: 'Tüm sorularınız **Sorularım** sayfasındadır. Arayabilir, süzebilir, sıralayabilir ve birden çok soruya aynı anda işlem yapabilirsiniz.',
    steps: [
      { text: 'Üstteki kutuya soru adı, yıl veya Arapça bir kelime yazarak arayın. Altındaki kutularla koleksiyona, yıla, kategoriye veya aşamaya göre süzün; son kutudan sıralamayı seçin.', image: 'soru-listesi', alt: 'Soru listesi, arama ve sıralama' },
      { text: 'Bir soruya devam etmek için **Devam et**’e basın. Kopya kâğıt simgesi soruyu çoğaltır (metin ve ayarlar kopyalanır, ses yeniden hazırlanır).' },
      { text: 'Birden çok soru seçmek için satırların solundaki kutucukları işaretleyin (hepsi için **Tümünü seç**). Altta açılan koyu çubuktan **Koleksiyona taşı**, **Yedeğini indir (ZIP)** veya **Çöp kutusuna taşı** seçin.', image: 'toplu-secim', alt: 'Seçili sorular için işlem çubuğu' },
      { text: '**Koleksiyona taşı** penceresinde bir deneme adı yazın ya da önceki adlardan birine tıklayın ve **Taşı**’ya basın.', image: 'koleksiyon', alt: 'Koleksiyona taşıma penceresi' },
    ],
    tips: ['Seçtiğiniz sıralama bu bilgisayarda hatırlanır.'],
  },
  {
    id: 'cop-ve-yedek',
    title: 'Çöp kutusu ve yedekleme',
    summary: 'Silinen sorular 30 gün çöp kutusunda bekler. Ayrıca tüm sorularınızı tek bir ZIP dosyasıyla bilgisayarınıza yedekleyebilirsiniz.',
    steps: [
      { text: 'Bir soruyu sildiğinizde **Çöp kutusu** sekmesine gider. Oradan **Geri al** ile listenize döndürebilirsiniz. 30 gün dolunca soru kendiliğinden kalıcı olarak silinir; her satırda kaç gün kaldığı yazar.', image: 'cop-kutusu', alt: 'Çöp kutusu' },
      { text: 'Yedek almak için **Ayarlar → Yedekleme** bölümünde **Tüm sorularımı yedekle**’ye basın. İnen ZIP dosyasında sorularınız, soru görselleri ve sesler bulunur; dosyayı güvenli bir yerde (USB bellek, Google Drive gibi) saklayın.', image: 'yedekleme', alt: 'Yedekleme bölümü' },
      { text: 'Geri yüklemek için aynı bölümde **Yedekten geri yükle**’ye basıp ZIP dosyasını seçin. Hesabınızda zaten olan sorular silinmez ya da değiştirilmez; yedekteki hâli ayrı bir soru olarak eklenir.' },
    ],
    tips: ['Yalnız bazı soruları yedeklemek için **Sorularım** sayfasında soruları seçip **Yedeğini indir (ZIP)** düğmesini kullanın.'],
  },
  {
    id: 'toplu-uretim',
    title: 'Toplu üretim',
    summary: 'Bir denemenin bütün sorularını tek seferde hazırlayabilirsiniz: görseller, tek bir çözüm metni ve isteğe bağlı MP3’ler soru numarasına göre eşleşir.',
    steps: [
      { text: 'Sol menüden **Toplu Üretim**’i açın. **Soru görselleri** kutusuna tüm görselleri bırakın; dosya adlarında soru numarası olmalı (soru_3.png, S3.jpg, 3.png gibi).', image: 'toplu-uretim', alt: 'Toplu üretim sayfası' },
      { text: 'Sağdaki **Çözüm metinleri** kutusuna bütün çözümleri yazın. Her soru kendi satırında “Soru 3” gibi bir başlıkla başlamalıdır. İsterseniz MP3 dosyalarını da ekleyin; adındaki numara o soruya eşleşir.' },
      { text: 'Koleksiyon adını ve seçenekleri belirleyip **Başlat**’a basın. Tabloda her sorunun durumu görünür. İşlem bitene kadar sekmeyi açık tutun.' },
      { text: 'Videolar bitince tek bir ZIP dosyası olarak iner. Tekrar indirmek için **Hepsini ZIP olarak indir**, tek bir video için satırdaki **MP4** düğmesini kullanın.' },
    ],
    tips: ['Yarım kalan sorular olursa **Yarım kalanları tamamla** düğmesiyle kaldıkları yerden devam edebilirsiniz.'],
  },
  {
    id: 'google-anahtari',
    title: 'Google anahtarı alma',
    summary: 'Stüdyonun ortak günlük ses hakkı dolduğunda kendi ücretsiz Google AI Studio anahtarınızla çalışmaya devam edebilirsiniz. Anahtar almak iki dakika sürer ve ücretsizdir.',
    steps: [
      { text: 'Tarayıcıda **aistudio.google.com** adresini açın ve kendi Google hesabınızla giriş yapın. Sol alttaki anahtar simgesine (**Get API key**) tıklayın.', image: 'aistudio-1-anahtar-simgesi', alt: 'AI Studio: sol alttaki Get API key simgesi' },
      { text: 'Açılan **API Keys** sayfasında sağ üstteki **Create API key** düğmesine basın.', image: 'aistudio-2-anahtar-olustur', alt: 'AI Studio: Create API key düğmesi' },
      { text: '**Create a new key** penceresinde anahtara bir ad verin (örneğin “Soru Stüdyosu”). **Choose an imported project** listesini açın ve **Create project** ile yeni bir proje oluşturun; sonra anahtarı oluşturma düğmesine basın.', image: 'aistudio-3-proje-sec', alt: 'AI Studio: anahtar adı ve proje seçimi' },
      { text: 'Anahtar listede görünür. Anahtarın ayrıntı penceresinde **Copy key** düğmesine basarak anahtarı kopyalayın.', image: 'aistudio-4-anahtari-kopyala', alt: 'AI Studio: Copy key düğmesi' },
      { text: 'Stüdyoda **Ayarlar → Google anahtarım** bölümüne gidin, anahtarı kutuya yapıştırın ve **Kaydet**’e basın. Anahtar Google’da doğrulanır ve bölümün başında **Bağlı** yazar.', image: 'anahtar-kaydet', alt: 'Stüdyo: Google anahtarım bölümü' },
    ],
    tips: [
      '**Set up billing** (faturalandırma) bağlantısına basmayın: anahtar ücretsiz kotayla çalışır, size hiçbir ücret yansımaz.',
      'Anahtarınızı kimseyle paylaşmayın, e-posta veya mesajla göndermeyin. Stüdyo anahtarı şifreli saklar ve bir daha göstermez.',
      'Ücretsiz günlük hak her gün Türkiye saatiyle 10:00–11:00 arasında yenilenir.',
    ],
  },
  {
    id: 'ayarlar',
    title: 'Ayarlar ve yazı boyutu',
    summary: 'Yazı boyutunu, adınızı, şifrenizi ve yeni sorulara ait varsayılanları **Ayarlar** sayfasından değiştirirsiniz.',
    steps: [
      { text: '**Yazı boyutu** bölümünde **Normal**, **Büyük** veya **Çok büyük**’ü seçin. Yazılar ve düğmeler hemen büyür; seçiminiz hesabınızla girdiğiniz her bilgisayarda kullanılır.', image: 'yazi-boyutu', alt: 'Yazı boyutu seçimi' },
      { text: '**Yeni soru varsayılanları** bölümünde kategori, koleksiyon adı, sınav yılı, altyazı ve kapanış kartını bir kez ayarlayın; her yeni soru bu değerlerle başlar.', image: 'varsayilanlar', alt: 'Yeni soru varsayılanları' },
      { text: '**Profilim** bölümünden görünen adınızı ve şifrenizi değiştirebilirsiniz.' },
    ],
  },
  {
    id: 'sorun-bildir',
    title: 'Sorun bildirme ve sık sorulanlar',
    summary: 'Bir şey beklediğiniz gibi çalışmazsa tek tıkla yöneticiye haber verebilirsiniz.',
    steps: [
      { text: 'Sol menüdeki ya da editörün sağ üstündeki **Sorun bildir**’e basın, ne olduğunu kısaca yazın ve gönderin. Hangi sayfada olduğunuz gibi teknik bilgiler kendiliğinden eklenir.', image: 'sorun-bildir', alt: 'Sorun bildir penceresi' },
    ],
    tips: [
      '**Çalışmam kayboldu mu?** Hayır. Stüdyo her değişikliği birkaç saniye içinde kaydeder. İnternet kesilirse değişiklikler bu bilgisayarda saklanır ve bağlantı gelince gönderilir.',
      '**Silinen soru nerede?** Sorularım → Çöp kutusu sekmesinde, 30 gün boyunca.',
      '**Ses oluşturulmuyor.** Günlük ücretsiz hak dolmuş olabilir. Ertesi gün tekrar deneyin ya da kendi Google anahtarınızı ekleyin.',
      '**Video inmiyor.** İndirme bitene kadar sekmeyi açık tutun; tarayıcı birden çok dosya indirmek için izin isterse izin verin.',
    ],
  },
];

export const helpImage = (name: string) => `/help/${name}.webp`;
