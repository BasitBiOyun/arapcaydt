Arapça YDT OCR veri seti (kaynak: Masaüstü/Arapça YDT, orijinallere dokunulmadı)

konu_testleri/          89 soru, ETİKETLİ (görüntü + doğru metin)
  images/               temiz soru görüntüleri (jpg 1016x1141)
  images_cevapli/       aynı sorular, doğru şık kırmızı (_CA_)
  labels.jsonl          image, set, qnum, instruction_tr, stem_ar, options{A..E}, arabic_text
                        Metin her setin .docx dosyasından alındı. "----" boşluğunun satır içi
                        yeri görüntüdeki satır kırılımından farklı olabilir; kelimeler aynı.
cikmis_sorular/<yıl>/   602 soru görüntüsü (2018-2026), ETİKETSİZ; pptx'lerden slayt başına
  images.jsonl          en büyük görsel, aynı görseller (hash) tekilleştirildi.
slaytlar_2026_1920x1080/ 80 png slayt (2026), ETİKETSİZ
deneme1/                YDT_Arapca_Deneme_1_v2.pdf + sayfa_metin/ (62 sayfa pdftotext) + data1-4.py kaynak
metin_korpusu/          69 analiz docx -> txt (gerçek Arapça metin, görüntüsüz; sentetik üretim için)
olustur.py              bu klasörü yeniden üreten betik ("Arapça YDT" içinde çalıştırılır)
