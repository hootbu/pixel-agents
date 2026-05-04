[English](README.md) | **Türkçe**

<p align="center">
  <img src="Pixel_agents_logo.png" alt="Pixel Agents" width="320">
</p>

<p align="center">
  <a href="https://marketplace.visualstudio.com/items?itemName=hootbu.pixel-agent"><img src="https://img.shields.io/visual-studio-marketplace/v/hootbu.pixel-agent?label=VS%20Code%20Marketplace&color=blue" alt="Sürüm"></a>
  <a href="https://marketplace.visualstudio.com/items?itemName=hootbu.pixel-agent"><img src="https://img.shields.io/visual-studio-marketplace/i/hootbu.pixel-agent?color=brightgreen" alt="Kurulumlar"></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/hootbu/pixel-agents?color=yellow" alt="Lisans"></a>
  <a href="https://github.com/hootbu/pixel-agents"><img src="https://img.shields.io/github/stars/hootbu/pixel-agents?style=social" alt="Yıldızlar"></a>
</p>

# Pixel Agents

Claude Code çalışırken dönen yükleme animasyonuna bakmaktan sıkıldınız mı? Pixel Agents, her Claude terminalini sanal bir ofiste animasyonlu bir karaktere dönüştürür ve **AI'nızın gerçek zamanlı olarak ne yaptığını görmenizi** sağlar.

Açtığınız her Claude Code terminali, ofiste dolaşan, masalarda oturan ve ajanın ne yaptığını görsel olarak yansıtan bir karakter oluşturur — kod yazarken yazıyor, dosya ararken okuyor, sizin müdahalenizi beklerken bekliyor.

<details>
<summary><strong>İçindekiler</strong></summary>

- [Özellikler](#özellikler)
- [Oturma Yerleri](#oturma-yerleri)
- [Görev Paneli ve Alt-Ajanlar](#görev-paneli-ve-alt-ajanlar)
- [Başarımlar](#başarımlar)
- [Ofis Evcil Hayvanları](#ofis-evcil-hayvanları)
- [Token Kullanımı](#token-kullanımı)
- [Kostüm Modu](#kostüm-modu)
- [Gereksinimler](#gereksinimler)
- [Başlarken](#başlarken)
- [Düzen Editörü](#düzen-editörü)
- [Nasıl Çalışır](#nasıl-çalışır)
- [Teknoloji Yığını](#teknoloji-yığını)
- [Yol Haritası](#yol-haritası)
- [Katkıda Bulunma](#katkıda-bulunma)
- [Lisans](#lisans)

</details>

pablodelucca tarafından geliştirilen orijinal [Pixel Agents eklentisine](https://marketplace.visualstudio.com/items?itemName=pablodelucca.pixel-agents) dayanmaktadır. Bu fork **Emir Yorgun** ([@hootbu](https://github.com/hootbu)) tarafından aşağıdaki eklemelerle geliştirilmiştir:

**🎮 Görselleştirme ve Ofis Yaşamı**
- Alt-ajan görselleştirmesi — Task aracı, ana ajana bağlı ayrı karakterler olarak ortaya çıkar
- Ofis evcil hayvanları — AI davranışlarıyla kediler ve köpekler, Ayarlar'dan yapılandırılabilir
- Ruh hali reaksiyonları — ajan aktivitesine göre mutlu, hata ve stresli emoji balonları

**📊 İçgörüler ve Takip**
- Gerçek zamanlı ajan aktivite takibi ile görev paneli
- Ajan bazlı dağılım ve renkli ilerleme çubuklarıyla gerçek zamanlı token kullanım paneli
- Başarım sistemi — ilerleme takibi ve galeri ile 8 açılabilir başarım

**🎨 Özelleştirme**
- Oturma yeri yönetimi ve masa atama sistemi
- Piksel yazı — yerleşik font oluşturucu ve z-katman kontrolü ile duvarlara özel yazı yerleştirme
- Kostüm modu — 6 karakter modeli ve renk kaydırma ile ajanların görünüşünü çalışma zamanında değiştirme

**🔧 Güvenilirlik ve UX**
- "Düşünüyor..." göstergesi ve daha akıllı izin zamanlayıcıları ile uyarlanabilir durum algılama
- Yakınlaştırma kalıcılığı ve piksel-mükemmel 1px yakınlaştırma adımları
- Panel geçişlerinde durum koruma
- Ajan turu tamamlandığında ses bildirimleri
- Ajan bazlı izin modu — + Agent'a bastıktan sonra Normal veya Skip Permissions (`--dangerously-skip-permissions`) seçimi

![Pixel Agents ekran görüntüsü](webview-ui/public/Screenshot.png)

## Özellikler

- **Bir ajan, bir karakter** — her Claude Code terminali kendi animasyonlu karakterine sahip olur
- **Canlı aktivite takibi** — karakterler, ajanın gerçekte ne yaptığına göre animasyon yapar (yazma, okuma, komut çalıştırma)
- **Oturma yeri yönetimi** — ajanları belirli masalara atayın, tıkla-seç arayüzüyle yeniden atayın, sandalye mobilyalarından otomatik oluşturulan koltuklar
- **Görev paneli ve alt-ajanlar** — ajan aktivitelerini gösteren gerçek zamanlı panel; Task aracı alt-ajanları, ana ajana bağlı ayrı karakterler olarak ortaya çıkar
- **Ofis düzeni editörü** — yerleşik editör ile zemin, duvar ve mobilyalarla ofisinizi tasarlayın
- **Konuşma balonları** — ajan girdi beklerken veya izin gerektiğinde görsel göstergeler
- **Ses bildirimleri** — ajan turunu bitirdiğinde isteğe bağlı bildirim sesi
- **Kalıcı düzenler** — ofis tasarımınız kaydedilir ve VS Code pencereleri arasında paylaşılır
- **Yakınlaştırma kalıcılığı** — seçtiğiniz yakınlaştırma seviyesi oturumlar ve pencere yeniden yüklemeleri arasında hatırlanır
- **Panel durumu koruma** — başka bir panele (ör. Debug) geçip geri dönmek tüm durumu korur — artık düzen sıfırlanması yok
- **Piksel-mükemmel yakınlaştırma** — 1px artışlarla yakınlaştırma, seviye piksel olarak görüntülenir (ör. 16px)
- **Piksel yazı** — duvarlara ayarlanabilir font boyutu, ölçek ve renk ile özel piksel sanat yazısı yerleştirin; z-katman butonu ile yazıyı duvarların önünde ama karakterlerin arkasında gösterin
- **Token kullanım paneli** — ajan bazlı dağılım, renkli ilerleme çubukları (Girdi/Çıktı/Cache Yazma/Cache Okuma) ve biçimlendirilmiş toplamlarla gerçek zamanlı token takibi
- **Ruh hali reaksiyonları** — ajanlar emoji balonları gösterir (tur tamamlandığında mutlu, hatalarda hata, uzun turlarda stresli)
- **Başarımlar** — toast bildirimleri ve Ayarlar'daki galeri görünümü ile 8 açılabilir başarım
- **Ofis evcil hayvanları** — kediler ve köpekler AI güdümlü davranışlarla ofiste dolaşır (dolaşma, boş ajanlara yaklaşma, uyuma, aktif ajanlardan kaçma); Ayarlar'dan 5'e kadar evcil hayvan yapılandırılabilir
- **Kostüm modu** — herhangi bir ajanın görünüşünü çalışma zamanında değiştirin; 6 karakter modelinden seçin ve renk kaydırma ile ince ayar yapın, oturumlar arası kalıcı
- **Çeşitli karakterler** — renk kaydırmalı varyantlarla 6 farklı karakter

<p align="center">
  <img src="webview-ui/public/characters.png" alt="Pixel Agents karakterleri" width="320" height="72" style="image-rendering: pixelated;">
</p>

## Oturma Yerleri

Oturma yerleri, düzen editöründe yerleştirilen sandalye mobilyalarından otomatik olarak oluşturulur. Her sandalye ayak izi karesi bir koltuk olur; çok kareli sandalyeler (koltuklar gibi) birden fazla oturma yeri üretir.

- **Otomatik atama** — bir ajan oluştuğunda, ilk müsait koltuğu alır
- **Koltuk Modu** — araç çubuğundan Koltuk Modunu açın, seçmek için bir ajana tıklayın (beyaz çerçeve), ardından yeniden atamak için müsait bir koltuğa tıklayın
- **Görsel göstergeler** — mavi = sizin koltuğunuz, yeşil = müsait, kırmızı = başka bir ajan tarafından dolu
- **Akıllı yön** — karakterler mobilya yönüne göre otomatik olarak bitişik masaya bakar
- **Kalıcılık** — koltuk atamaları çalışma alanı başına kaydedilir ve oturumlar arasında geri yüklenir

Boştayken, ajanlar 2-4 dakika oturur, ardından ofiste dolaşır ve atanmış koltuklarına geri döner.

## Görev Paneli ve Alt-Ajanlar

Görev paneli (sağ alt araç çubuğundaki düğme ile açılır) tüm aktif ajanları ve mevcut aktivitelerini gerçek zamanlı olarak gösterir.

- **Canlı durum** — her ajan mevcut araç aktivitesini gösterir (Okuma, Yazma, Komut çalıştırma, Boşta)
- **Alt-ajan oluşturma** — Claude Code'un Task aracı bir alt-ajan oluşturduğunda, ana ajanın yakınında matrix tarzı animasyonla yeni bir karakter belirir
- **İç içe görüntüleme** — alt-ajanlar, Görev panelinde ana ajanlarının altında girintili olarak görünür
- **İzin balonları** — alt-ajan kullanıcı onayına ihtiyaç duyduğunda kehribar noktalar ve konuşma balonları belirir
- **Otomatik temizlik** — alt-ajanlar görevleri tamamlandığında otomatik olarak kaybolur
- **Odaklanmak için tıkla** — Görev panelinde herhangi bir ajana tıklayarak terminaline atlayın

Alt-ajanlar, ana ajanın karakter paletini miras alır ve en yakın boş koltuğa yerleştirilir.

<p align="center">
  <img src="webview-ui/public/Tasks.png" alt="Task Panel" width="240">
</p>

## Başarımlar

Pixel Agents, kullanımınızı takip eden 8 açılabilir başarım içerir:

- **İlk Ajan** — ilk ajanınızı oluşturun
- **Takım Oyuncusu** — aynı anda 3+ ajan çalıştırın
- **Token Milyoneri** — tüm ajanlarda 1 milyon token kullanın
- **Gece Kuşu** — gece yarısından sonra ajan kullanın
- **Böcek Avcısı** — 10 ajan turu tamamlayın
- **Mimar** — ofis düzeninizi özelleştirin
- **Maraton** — 1 saat ajan çalışma süresi biriktirin
- **Dekoratör** — 20+ mobilya yerleştirin

Başarımlar açıldığında toast bildirimi olarak görünür. Tüm başarımları ve ilerlemeyi Ayarlar penceresinden erişilebilen galeride görüntüleyin.

<p align="center">
  <img src="webview-ui/public/Achievements.png" alt="Achievements Gallery" width="300">
</p>

## Ofis Evcil Hayvanları

Ofisinize kediler ve köpekler ekleyin — AI güdümlü davranışlarla dolaşırlar:

- **Dolaşma** — evcil hayvanlar ofisi rastgele keşfeder
- **Boş ajanlara yaklaşma** — evcil hayvanlar masalarında boş oturan ajanlara doğru yürür
- **Uyuma** — evcil hayvanlar zaman zaman rastgele noktalarda şekerleme yapar
- **Aktif ajanlardan kaçma** — evcil hayvanlar aktif olarak çalışan ajanlardan kaçar

Aynı anda 5'e kadar evcil hayvan eklenebilir. Evcil hayvan isimlerini, renklerini (renk kaydırma) yapılandırın ve evcil hayvanlarınızı Ayarlar penceresinden yönetin. Evcil hayvanlar varsayılan olarak etkindir.

## Token Kullanımı

Ajan bazlı dağılım ve renkli ilerleme çubukları (Girdi, Çıktı, Cache Yazma, Cache Okuma) ile token tüketimini gerçek zamanlı takip edin.

<p align="center">
  <img src="webview-ui/public/Usage.png" alt="Token Kullanım Paneli" width="280">
</p>

## Kostüm Modu

Herhangi bir ajanın görünüşünü çalışma zamanında değiştirin — 6 karakter modelinden seçin ve renk kaydırma ile ince ayar yapın. Kostüm tercihleri oturumlar arası kalıcıdır.

<p align="center">
  <img src="webview-ui/public/ChooseCostume.png" alt="Kostüm Seç" width="220">
</p>

## Gereksinimler

- VS Code 1.109.0 veya üstü
- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) kurulu ve yapılandırılmış

## Başlarken

### Release'den kurulum

1. [Releases](https://github.com/hootbu/pixel-agents/releases) sayfasına gidin
2. En son `.vsix` dosyasını indirin
3. Terminal ile kurun:
   ```bash
   code --install-extension pixel-agent-1.2.5.vsix
   ```
   Veya VS Code'da: **Cmd+Shift+P → Install from VSIX** ile indirilen dosyayı seçin.
4. VS Code'u yeniden yükleyin (**Cmd+Shift+P → Reload Window**)

### Kaynaktan kurulum

```bash
git clone https://github.com/hootbu/pixel-agents.git
cd pixel-agents
npm install
cd webview-ui && npm install && cd ..
npm run build
```

Ardından VS Code'da **F5**'e basarak Extension Development Host'u başlatın.

### .vsix ile derleme ve kurulum

`.vsix` eklentisini tek adımda derleyip kurmak için `~/.zshrc` dosyanıza şu alias'ı ekleyin:

```bash
alias pxbuild="cd ~/pixel-agents && npm run build && npx vsce package --no-dependencies && code --install-extension pixel-agent-1.2.5.vsix --force"
```

Ardından herhangi bir terminalden `pxbuild` çalıştırın. Kurulumdan sonra VS Code'u yeniden yükleyin (**Cmd+Shift+P → Reload Window**).

### Kullanım

1. **Pixel Agents** panelini açın (terminalinizin yanında alt panel alanında görünür)
2. Yeni bir Claude Code terminali ve karakteri oluşturmak için **+ Agent**'a tıklayın
3. Claude ile kodlamaya başlayın — karakterin gerçek zamanlı tepki vermesini izleyin
4. Seçmek için bir karaktere tıklayın, ardından yeniden atamak için bir koltuğa tıklayın
5. Ajan aktivitelerini ve alt-ajan oluşturmayı izlemek için **Görev panelini** açın
6. Ofis editörünü açıp alanınızı özelleştirmek için **Layout**'a tıklayın

## Düzen Editörü

Yerleşik editör ofisinizi tasarlamanıza olanak tanır:

- **Zemin** — Tam HSB renk kontrolü
- **Duvarlar** — Renk özelleştirmeli otomatik döşenen duvarlar
- **Piksel yazı** — iki font boyutu (3x5, 5x7), ayarlanabilir piksel ölçeği (1-3x) ve hex renk seçici ile duvarlara yazı yerleştirin; yerleştirme sonrası düzenleme butonu
- **Z-katman kontrolü** — mobilyayı yürüyen karakterlerin arkasında tutarak duvarların önüne çıkarın; seçili öğelerdeki katman butonu ile değiştirin
- **Araçlar** — Seçme, boyama, silme, yerleştirme, damlalık, seçici
- **Geri Al/Yinele** — Ctrl+Z / Ctrl+Y ile 50 seviye
- **Dışa/İçe Aktarma** — Ayarlar penceresi üzerinden JSON dosyaları olarak düzen paylaşımı

Izgara 64×64 kareye kadar genişletilebilir. Mevcut ızgaranın dışındaki hayalet kenarlığa tıklayarak büyütün.

### Ofis Varlıkları

Bu projede kullanılan ofis tileset'i **[Office Interior Tileset (16x16)](https://donarg.itch.io/officetileset)** olup **Donarg** tarafından itch.io'da **2 USD** karşılığında sunulmaktadır.

Bu, projenin özgürce kullanılamayan tek parçasıdır. Tileset, lisansı nedeniyle bu depoya dahil edilmemiştir. Pixel Agents'ı tam ofis mobilyaları ve dekorasyonları ile yerel olarak kullanmak için tileset'i satın alın ve varlık içe aktarma hattını çalıştırın:

```bash
npm run import-tileset
```

Uyarı: içe aktarma hattı tam olarak basit değildir — hazır tileset varlıkları ile çalışmak en kolay değildir ve süreci olabildiğince sorunsuz hale getirmek için elimden geleni yaptım, ancak bazı manuel ayarlamalar gerekebilir. Piksel sanat ofis varlıkları oluşturma deneyiminiz varsa ve topluluk için ücretsiz kullanılabilir tileset'ler katkıda bulunmak isterseniz, bu çok takdir edilecektir.

Eklenti tileset olmadan da çalışacaktır — varsayılan karakterler ve temel düzeni elde edersiniz, ancak tam mobilya kataloğu içe aktarılan varlıkları gerektirir.

## Nasıl Çalışır

Pixel Agents, her ajanın ne yaptığını takip etmek için Claude Code'un JSONL transkript dosyalarını izler. Bir ajan bir araç kullandığında (dosya yazma veya komut çalıştırma gibi), eklenti bunu algılar ve karakterin animasyonunu buna göre günceller. Claude Code'da herhangi bir değişiklik gerekmez — tamamen gözlemseldir.

Webview, canvas rendering, BFS yol bulma ve bir karakter durum makinesi (boşta → yürüme → yazma/okuma) ile hafif bir oyun döngüsü çalıştırır. Her şey 1px yakınlaştırma artışlarıyla piksel-mükemmeldir ve yakınlaştırma tercihiniz VS Code'un global state'i aracılığıyla oturumlar arasında kalıcıdır.

## Teknoloji Yığını

- **Eklenti**: TypeScript, VS Code Webview API, esbuild
- **Webview**: React 19, TypeScript, Vite, Canvas 2D

## Bilinen Sınırlamalar

- **Ajan-terminal senkronizasyonu** — ajanların Claude Code terminal örneklerine bağlanma şekli çok sağlam değildir ve bazen senkronizasyon bozulur, özellikle terminaller hızlıca açılıp kapatıldığında veya oturumlar arasında geri yüklendiğinde.
- **Sezgisel tabanlı durum algılama** — Claude Code'un JSONL transkript formatı tüm durum geçişleri için mükemmel net sinyaller sağlamaz. Algılama, uyarlanabilir zaman aşımları, erken tamamlanma sinyalleri ve daha akıllı boşta algılama ile önemli ölçüde iyileştirilmiş olsa da, özellikle salt metin turları ve hızlı araç dizileri etrafında uç durumlar kalmaktadır.
- **Windows/macOS testi** — eklenti Windows 11 ve macOS'ta test edilmiştir. Linux'ta çalışabilir, ancak dosya izleme, yollar veya terminal davranışı ile ilgili beklenmeyen sorunlar olabilir.

## Yol Haritası

Bu fork'ta uygulanmış:

- ~~**Masalar dizin olarak / koltuk atama**~~ — ajanlar Koltuk Modu ile belirli masalara atanabilir
- ~~**Alt-ajan görselleştirmesi**~~ — Task aracı alt-ajanları, gerçek zamanlı takip ile ayrı karakterler olarak ortaya çıkar
- ~~**Panel durumu koruma**~~ — webview bağlamı gizlendiğinde korunur, panel geçişinde artık durum kaybı yok
- ~~**Yakınlaştırma kalıcılığı ve piksel-mükemmel adımlar**~~ — yakınlaştırma seviyesi oturumlar arasında kaydedilir, 1px artışlar, px gösterimi
- ~~**Daha iyi durum algılama**~~ — uyarlanabilir izin zamanlayıcıları, erken tamamlanma sinyalleri ve yeni "Düşünüyor..." göstergesi ile daha akıllı ajan durum geçişleri (aşağıya bakın)
- ~~**Piksel yazı ve z-katman**~~ — duvarlara font/ölçek/renk seçenekleriyle özel piksel sanat yazısı; duvarlar ve karakterlere göre çizim sırasını kontrol eden z-katman değiştirici
- ~~**Token kullanım paneli**~~ — renkli dağılımla gerçek zamanlı ajan bazlı token takibi
- ~~**Ruh hali reaksiyonları**~~ — ajan aktivitesine göre mutlu, hata ve stresli emoji balonları
- ~~**Başarım sistemi**~~ — ilerleme takibi ve galeri ile 8 açılabilir başarım
- ~~**Ofis evcil hayvanları**~~ — AI davranışlarıyla kediler ve köpekler, Ayarlar'dan yapılandırılabilir
- ~~**Kostüm modu**~~ — 6 karakter modeli ve renk kaydırma ile ajanların görünüşünü çalışma zamanında değiştirme
- ~~**Ajan bazlı izin modu**~~ — + Agent'a bastıktan sonra ajan başına Normal veya Skip Permissions (`--dangerously-skip-permissions`) seçimi

### Daha İyi Durum Algılama

Orijinal sezgisel tabanlı durum algılama, bir ajanın kullanıcı izni için takılıp kalmadığını tahmin etmek için sabit 7 saniyelik bir zaman aşımı kullanıyordu. Bu, sık sık yanlış pozitifler üretiyordu — Bash komutları veya MCP entegrasyonları gibi yavaş araçlar, araç hala normal şekilde çalışıyor olsa bile "Onay gerekiyor" balonu tetikliyordu.

Temel iyileştirmeler:

- **Uyarlanabilir izin zaman aşımları** — zaman aşımı, her şey için sabit 7s yerine araç türüne göre ölçeklenir (hızlı araçlar için 5s, ağ için 15s, Bash için 20s)
- **Erken tamamlanma sinyalleri** — araç tamamlanmasını erken algılamak için `mcp_progress` ve `hook_progress` olaylarını dinler, yanlış izin balonlarını ortadan kaldırır
- **"Düşünüyor..." göstergesi** — Görev paneli, yanıltıcı "Boşta" yerine Claude işlem yaparken mavi titreyen nokta ile "Düşünüyor..." gösterir
- **Daha akıllı boşta algılama** — bekleme zamanlayıcısı artık metadata kayıtları tarafından sıfırlanmaz ve `turn_duration` yayılmadığı turları yakalamak için bir yedek zamanlayıcı bulunur

Katkılara açık:

- **Ajan-terminal güvenilirliğini iyileştirme** — karakterler ve Claude Code örnekleri arasında daha sağlam bağlantı ve senkronizasyon
- **Topluluk varlıkları** — herkesin üçüncü taraf varlıklar satın almadan kullanabileceği ücretsiz piksel sanat tileset'leri veya karakterler
- **Ajan oluşturma ve tanımlama** — ajanları özel beceriler, sistem promptları, isimler ve görünümlerle başlatmadan önce tanımlama
- **Claude Code ajan takımları** — [ajan takımları](https://code.claude.com/docs/en/agent-teams) için yerel destek, çoklu ajan koordinasyonunu ve iletişimini görselleştirme
- **Git worktree desteği** — aynı dosyalar üzerinde paralel çalışmadan kaynaklanan çakışmayı önlemek için farklı worktree'lerde çalışan ajanlar
- **Diğer ajantik framework'ler için destek** — [OpenCode](https://github.com/nichochar/opencode) veya piksel sanat arayüzünde çalıştırmak isteyebileceğiniz herhangi bir ajantik deney (ilham için [simile.ai](https://simile.ai/)'ya bakın)

Bunlardan herhangi biri ilginizi çekiyorsa, bir issue açın veya PR gönderin.

## Katkıda Bulunma

Bu projeye nasıl katkıda bulunacağınız için [CONTRIBUTORS.md](CONTRIBUTORS.md) dosyasına bakın.

Katılmadan önce lütfen [Davranış Kurallarımızı](CODE_OF_CONDUCT.md) okuyun.

### Geliştirici

Bu fork **Emir Yorgun** ([@hootbu](https://github.com/hootbu)) tarafından sürdürülmektedir. Yukarıda listelenen tüm eklemeler, [pablodelucca](https://github.com/pablodelucca) tarafından geliştirilen orijinal proje üzerine inşa edilmiştir.

## ⭐ Bu Repo'ya Yıldız Verin

Pixel Agents Claude Code iş akışınızı daha eğlenceli hale getiriyorsa, **lütfen repo'ya yıldız verin** — bu, başkalarının projeyi keşfetmesine yardımcı olur ve ivmeyi sürdürür. Issues artık açık: bir hata bildirin veya bir özellik isteyin [Issues](https://github.com/hootbu/pixel-agents/issues) sayfasında, ya da [Discussions](https://github.com/hootbu/pixel-agents/discussions)'da merhaba demeye gelin. Pull request'ler de çok hoş karşılanır.

## Lisans

Bu proje [MIT Lisansı](LICENSE) altında lisanslanmıştır.
