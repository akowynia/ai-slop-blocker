export interface BannedPatternConfig {
  phrase: string;
  pattern: RegExp;
  weight: number;
}

export let BANNED_PHRASES: string[] = [];


export interface AnalysisResult {
  isSlop: boolean;
  score: number;
  matchedPhrases: string[];
  emojiCount: number;
  emojiDensity: number;
}

export const BANNED_CONFIGS = [
  { phrase: "budowanie relacji", pattern: /budow(a(nie|nia|niu|ć)|ujemy|ują|uje) (prawdziwych? )?relacj[aięye]/i, weight: 15 },
  { phrase: "świetna atmosfera", pattern: /(świetn|wspaniał|wyjątkow|super)(a|ą|e|ej|ym)? (atmosfer[aęy]|atmosferze)/i, weight: 15 },
  { phrase: "doskonale wiemy", pattern: /doskonale (wiem(y)?|zdaj(emy|ę) sobie sprawę)/i, weight: 15 },
  { phrase: "nie zabrakło uśmiechu/energii", pattern: /nie zabrakło (uśmiech(u|ów)?|dobrej energii|pozytywnej energii)/i, weight: 15 },
  { phrase: "pozytywne emocje / dobra energia", pattern: /(dobrej|pozytywnej|super) energi(i|ą|a)|pozytywn(ych|e|ymi) emocj(i|e|ami)/i, weight: 15 },
  { phrase: "dziecięca ciekawość", pattern: /dziecięc(a|ą|ej|e) ciekawość(cią|ci)?/i, weight: 15 },
  { phrase: "inteligencja emocjonalna", pattern: /inteligencj(a|ą|ę|i) emocjonaln(a|ą|ej)/i, weight: 15 },
  { phrase: "inkluzywność", pattern: /inkluzywność/i, weight: 15 },
  { phrase: "kultura włączająca", pattern: /kultur(a|ę|ze) włączając(a|ą|ej)/i, weight: 15 },
  { phrase: "neuroróżnorodność", pattern: /neuroróżnorodność/i, weight: 15 },
  { phrase: "zespołowa tradycja", pattern: /zespołow(a|ą|ej) tradycj(a|ę|i)/i, weight: 15 },
  { phrase: "odblokować potencjał", pattern: /(odblokować|odblokuj(my|cie)?|odblokowani(a|e|u)) (swój |swojego )?potencjał(u)?/i, weight: 15 },
  { phrase: "zmieniać zasady gry", pattern: /zmieni(a|ają|ć|ło|ły|i|ią)? (nasze |swoje )?zasady gry/i, weight: 15 },
  { phrase: "game changer", pattern: /game changer/i, weight: 15 },
  { phrase: "synergia technologii", pattern: /synergi(a|ę|i|ą) technologii/i, weight: 15 },
  { phrase: "kompleksowe podejście", pattern: /kompleksow(e|ego|ym|u) podejści(e|a|em|u)/i, weight: 15 },
  { phrase: "niezwykle istotne/ważne", pattern: /(niezwykle|niezmiernie|szczególnie) (istotn(y|a|e|ego|ej|ym|ą|i)|ważn(y|a|e|ego|ej|ym|ą|i)|miło)/i, weight: 15 },
  { phrase: "z dumą ogłaszamy/informujemy", pattern: /z dumą (ogłaszam(y|ę)?|informuję|informujemy|dziel(ę|imy) się)/i, weight: 15 },
  { phrase: "miło poinformować", pattern: /miło (mi )?poinformować/i, weight: 15 },
  { phrase: "dzielić się wiedzą", pattern: /dziel(ić|imy|ę|ą|enie|enia|eniu|ący) się (swoją )?wiedz(ą|y)/i, weight: 15 },
  { phrase: "wymiana doświadczeń", pattern: /wymian(a|ę|y|ie|ą) doświadczeń/i, weight: 15 },
  { phrase: "luźne rozmowy", pattern: /luźn(e|ych|ymi) (rozmow(y|ach|ami|ę|om|ów)?|rozmowa)/i, weight: 15 },
  { phrase: "stawiać poprzeczkę / standardy", pattern: /(podnos(ić|imy|enia|enie)|stawia(my|ć))\s+(sobie\s+)?(poprzeczkę|standardy|standardów)/i, weight: 15 },
  { phrase: "zaprojektowany z myślą o", pattern: /zaprojektowan(y|ą|e|ego|ym|ych) z myślą o/i, weight: 15 },
  { phrase: "zmieniamy się dla", pattern: /zmieniamy się dla/i, weight: 15 },
  { phrase: "dopasowany do potrzeb", pattern: /dopasowan(y|a|e|ego|ej|ym|ych) do potrzeb/i, weight: 15 },
  { phrase: "zgrany zespół", pattern: /zgran(y|ego|ym|ych|e|i) (zespół|zespoł(u|em|y|ach|om))/i, weight: 15 },
  { phrase: "z przyjemnością dzielimy się", pattern: /z przyjemnością (dziel(ę|imy) się|ogłaszam(y)?)/i, weight: 15 },
  { phrase: "trudno uwierzyć, jak wiele", pattern: /trudno uwierzyć, jak wiele/i, weight: 15 },
  { phrase: "z ogromną radością", pattern: /z ogromną radością/i, weight: 15 },
  { phrase: "część tego wydarzenia", pattern: /częścią tego wydarzenia/i, weight: 15 },
  { phrase: "być częścią", pattern: /byli(śmy|ście)? częścią/i, weight: 15 },
  { phrase: "dobre słowo i obecność", pattern: /dobre słowo i obecność/i, weight: 15 },
  { phrase: "ogromna satysfakcja", pattern: /ogromną satysfakcję/i, weight: 15 },
  { phrase: "pomoc i wsparcie", pattern: /pomoc i wsparcie/i, weight: 15 },
  { phrase: "rozwój", pattern: /(dalsz(ego|ym|ego)|nasz(ego|ym)|swoj(ego|ym)) rozwoj(u|em|owi)/i, weight: 15 },
  { phrase: "wartościowe znajomości", pattern: /wartościow(ych|e|ymi) znajomości/i, weight: 15 },
  { phrase: "wspieranie się / pomoc wzajemna", pattern: /wspieraliśmy się|pomagaliśmy sobie nawzajem/i, weight: 15 },
  { phrase: "motywowanie do", pattern: /motywowaliśmy do|motywowało do/i, weight: 15 },
  { phrase: "poranki w biurze", pattern: /porank(i|u)? w biurze/i, weight: 15 },
  { phrase: "wkładać całe serce", pattern: /wkłada(ją|my|ć|liśmy|łyśmy) całe serce/i, weight: 15 },
  { phrase: "realna motywacja", pattern: /realn(ą|a|e) motywacj(ę|a|i)/i, weight: 15 },
  { phrase: "ze sobą pogadać", pattern: /ze sobą pogadać/i, weight: 15 },
  { phrase: "budowanie energii", pattern: /buduje? naszą energię/i, weight: 15 },
  { phrase: "niesamowity potencjał", pattern: /niesamowity potencjał/i, weight: 15 },
  { phrase: "wyjątkowa społeczność", pattern: /wyjątkow(a|ą|ej) społeczność(cią|ci)?/i, weight: 15 },
  { phrase: "uchylić rąbka", pattern: /uchylić rąbka/i, weight: 15 },
  { phrase: "porwać zabawie", pattern: /porwać zabawie/i, weight: 15 },
  { phrase: "dziękujemy za ten", pattern: /dziękujemy za ten/i, weight: 15 },
  { phrase: "podzielić się przemyśleniami/refleksjami", pattern: /podzielić się (obserwacjami|refleksjami|przemyśleniami|wrażeniami)/i, weight: 15 },
  { phrase: "realna zmiana", pattern: /realn(ą|a) zmian(ę|a|y)/i, weight: 15 },
  { phrase: "otwarty na współpracę", pattern: /otwart(y|ą|e|ym|ych|i) na współpracę/i, weight: 15 },
  { phrase: "wspólnie poszukiwać rozwiązań", pattern: /wspólnie poszukuj(e|emy|ą) rozwiązań/i, weight: 15 },
  { phrase: "wyniki biznesowe", pattern: /wyniki biznesowe/i, weight: 15 },
  { phrase: "najlepszy dowód", pattern: /najlepszy dowód/i, weight: 15 },
  { phrase: "rozwój zespołu", pattern: /rozwój (naszego )?zespołu/i, weight: 15 },
  { phrase: "zmiana sposobu myślenia", pattern: /zmian(ę|a|y) sposobu myślenia/i, weight: 15 },
  { phrase: "save the date", pattern: /save the date/i, weight: 15 },
  { phrase: "widzimy się", pattern: /widzimy się/i, weight: 15 },
  { phrase: "szykujemy się na", pattern: /szykujemy się na/i, weight: 15 },
  { phrase: "gorąco zachęcam", pattern: /gorąco zachęcam/i, weight: 15 },
  { phrase: "bądźmy w kontakcie", pattern: /bądźmy w kontakcie/i, weight: 15 },
  { phrase: "współtworzenie", pattern: /współtworzeni(em|u) (z nami|tego)/i, weight: 15 },
  { phrase: "chcesz się podzielić", pattern: /chcesz się podzielić/i, weight: 15 },
  { phrase: "opowiedzieć o swoich doświadczeniach", pattern: /opowiedzieć o swoich doświadczeniach/i, weight: 15 },
  { phrase: "partnerem wydarzenia", pattern: /partnerem wydarzenia/i, weight: 15 },
  { phrase: "certyfikat do kolekcji / powiększa kolekcję", pattern: /powiększa moją kolekcję|certyfikat do kolekcji/i, weight: 8 },
  { phrase: "ejajowa fascynacja", pattern: /ejajow(ej|a|y)? fascynacj(i|ą|a|e)/i, weight: 25 },
  { phrase: "krok dalej", pattern: /krok dalej/i, weight: 8 },
  { phrase: "dziękuję za kurs/szkolenie", pattern: /dziękuję za (ten )?(kurs|szkolenie)/i, weight: 8 },
  { phrase: "perspektywa architektoniczna / wiedza ustrukturyzowana", pattern: /perspektywa architektoniczna|wiedza ustrukturyzowana/i, weight: 8 },
  { phrase: "ukończenie stażu/szkolenia/kursu", pattern: /(?:ukończ|zakończ)(?:ył(?:[ea]m|a|y|yśmy)?|yl(?:i|iśmy)?)\b.*\b(?:staż[u]?|szkolenie|program[u]?|kurs[u]?)/i, weight: 8 },
  { phrase: "potężna dawka", pattern: /potężn(a|ą) dawk(a|ę|i)/i, weight: 8 },
  { phrase: "niepowołane ręce", pattern: /niepowołane ręce/i, weight: 8 },
  { phrase: "wygenerowano przy użyciu AI", pattern: /wygenerowan(y|e|o) przy użyciu AI/i, weight: 8 },
  { phrase: "satysfakcjonujące doświadczenie", pattern: /satysfakcjonując(e|ego) doświadczeni(e|a)/i, weight: 8 },
  { phrase: "wartościowe doświadczenie", pattern: /wartościowe doświadczenie/i, weight: 8 },
  { phrase: "ogromne zaangażowanie", pattern: /ogromne zaangażowanie|zaangażowanie,? aktywność/i, weight: 8 },
  { phrase: "dostarczyć wartościowej wiedzy", pattern: /dostarczyć wartościowej wiedzy/i, weight: 8 },
  { phrase: "dajcie znać", pattern: /dajcie znać|co o tym sądzicie|co wy na to/i, weight: 8 },
  { phrase: "skupić się na", pattern: /skup(?:ił(?:[ea]m|a|y|yśmy)?|il(?:i|iśmy)?) się na/i, weight: 8 },
  { phrase: "to doświadczenie", pattern: /to doświadczenie/i, weight: 8 },
  { phrase: "moje podejście do", pattern: /moj(e|ego|emu) podejści(e|a|u) do/i, weight: 8 },
  { phrase: "mieć przyjemność", pattern: /(miał([ea]m|a|i)?|miel(i|iśmy)?|miałyśmy) przyjemność/i, weight: 8 },
  { phrase: "skoncentrowany na", pattern: /skoncentrowan(y|ą|e|ym|ych|i) na/i, weight: 8 },
  { phrase: "rozwijanie kompetencji", pattern: /(rozwij(ał([ea]m|iśmy|yśmy|a|i)?|anie|ać)|rozwin(ął([ea]m|i)?|ęłam|ąć)) (swoich |swoje )?kompetencj(i|e|ami)/i, weight: 8 },
  { phrase: "diagnostyka halucynacji", pattern: /diagnostyk(a|i|ę) halucynacji/i, weight: 8 },
  { phrase: "kolejny krok w", pattern: /kolejny krok w/i, weight: 8 },
  { phrase: "świadoma praca z", pattern: /świadom(a|ą|ej) prac(a|ę) z/i, weight: 8 },
  { phrase: "dziękuję za cenne doświadczenie", pattern: /dziękuję za to cenne doświadczenie/i, weight: 8 },
  { phrase: "szczególnie bliskie", pattern: /szczególnie bliskie/i, weight: 8 },
  { phrase: "pokazało mi, jak", pattern: /pokazało mi, jak/i, weight: 8 },
  { phrase: "życie w ciągłym pędzie", pattern: /żył([ea]m|iśmy|yśmy|a|i)? w ciągłym pędzie/i, weight: 15 },
  { phrase: "własne granice", pattern: /własnych granicach|moich granicach/i, weight: 15 },
  { phrase: "brutalna prawda", pattern: /brutaln(a|ą) prawd(a|ę)/i, weight: 15 },
  { phrase: "toksyczna energia / toksyczni ludzie", pattern: /toksyczn(a|ą|ej|e) energi(a|ę|i)|toksycznych ludzi/i, weight: 15 },
  { phrase: "święty spokój", pattern: /święty spokój/i, weight: 15 },
  { phrase: "na własnych warunkach", pattern: /na własnych warunkach/i, weight: 15 },
  { phrase: "w zgodzie ze sobą", pattern: /w zgodzie ze sobą/i, weight: 15 },
  { phrase: "wypalenie zawodowe", pattern: /wypalił([ea]m|iśmy|yśmy|a|i)? się|wypaleni(e|a|u) zawodow(ym|e|ego)/i, weight: 15 },
  { phrase: "użyteczność dla", pattern: /użyteczność dla/i, weight: 15 },
  { phrase: "każdego dnia pracuję", pattern: /każdego dnia pracuję/i, weight: 15 },
  { phrase: "kultura organizacyjna", pattern: /kultur(a|ę) organizacyjn(ą|a|ej)/i, weight: 15 },
  { phrase: "niezastąpiony", pattern: /niezastąpion/i, weight: 15 },
  { phrase: "najważniejsza lekcja", pattern: /najważniejsza lekcja/i, weight: 15 },
  { phrase: "LinkedIn-owy pamiętniczek", pattern: /linkedin-owego pamiętniczka/i, weight: 15 },
  { phrase: "kto ma wiedzieć", pattern: /kto ma wiedzieć/i, weight: 15 },
  { phrase: "pozdro dla kumatych", pattern: /pozdro dla kumatych/i, weight: 15 },
  { phrase: "od rana lecimy", pattern: /od rana lecimy/i, weight: 15 },
  { phrase: "zbieram je jak pokemony", pattern: /zbieram je jak pokemony/i, weight: 15 },
  { phrase: "poniedziałek poniedziałkowi", pattern: /poniedziałek poniedziałkowi/i, weight: 15 },
  { phrase: "robić dzień", pattern: /robi(ą| ) nam dzień/i, weight: 15 },
  { phrase: "wewnętrzne dziecko", pattern: /wewnętrzne(go)? dziec(ko|ka)/i, weight: 15 },
  { phrase: "pasywna agresja", pattern: /pasywn(ą|a|ej) agresj(ą|i|a)/i, weight: 15 },
  { phrase: "nauczyć się słuchać", pattern: /nauczył([ea]m|iśmy|yśmy|a|i)? się słuchać/i, weight: 15 },
  { phrase: "pismo od prawnika", pattern: /pismem od prawnika/i, weight: 15 },
  { phrase: "czy może jednak nie", pattern: /czy może jednak nie/i, weight: 15 },
  { phrase: "nie móc się powstrzymać", pattern: /nie (mógł|mogł)([ea]m|a|i)? się powstrzymać|nie mogliśmy się powstrzymać/i, weight: 15 },
  { phrase: "rzadko tak mówię", pattern: /rzadko tak mówię/i, weight: 15 },
  { phrase: "zapisz karuzelę", pattern: /zapisz (tę )?karuzelę/i, weight: 15 },
  { phrase: "poukładamy razem", pattern: /poukładamy (to )?razem/i, weight: 15 },
  { phrase: "wirtualna kawka", pattern: /wirtualn(ą|a) kawk(ę|a)/i, weight: 15 },
  { phrase: "zapraszam na/do", pattern: /zaprasza(m|my)/i, weight: 15 },
  { phrase: "zapisy:", pattern: /zapisy:/i, weight: 15 },
  { phrase: "rabat / zniżka", pattern: /rabat|offem na pożegnanie/i, weight: 15 },
  { phrase: "grono eksperckie", pattern: /gronie eksperckim|do grona/i, weight: 8 },
  { phrase: "nowy artykuł / zapraszamy do lektury", pattern: /nowy artykuł|zapraszamy do lektury/i, weight: 8 },
  { phrase: "inspirujące treści", pattern: /inspirując(ych|e) treśc(i)?/i, weight: 15 },
  { phrase: "redefinicja roli", pattern: /redefinicj(a|ę|i) roli/i, weight: 15 },
  { phrase: "przetrwanie na rynku", pattern: /przetrwania na rynku/i, weight: 15 },
  { phrase: "human in the loop", pattern: /human in the loop/i, weight: 15 },
  { phrase: "obsługa klienta", pattern: /obsługa klienta od oferty/i, weight: 15 },
  { phrase: "zwiększyć konkurencyjność", pattern: /zwiększyć swoją konkurencyjność/i, weight: 15 },
  { phrase: "time-2-market", pattern: /time-2-market/i, weight: 15 },
  { phrase: "wystąpienia przed lustrem", pattern: /wystąpień przed lustrem|wystąpienia przed lustrem/i, weight: 15 },
  { phrase: "stabilne zatrudnienie / benefity", pattern: /stabilne zatrudnienie|umowę o pracę|prywatną opiekę|opiekę medyczną/i, weight: 15 },
  { phrase: "dofinansowanie z funduszu", pattern: /dofinansowanie z funduszu/i, weight: 15 },
  { phrase: "płatne polecenia", pattern: /płatnych poleceń/i, weight: 15 },
  { phrase: "wyjątkowe doświadczenia", pattern: /wyjątkow(ych|e) doświadczeń/i, weight: 15 },
  { phrase: "check-in", pattern: /check-in ✅/i, weight: 15 },
  { phrase: "nowa strona internetowa", pattern: /nową stronę internetową/i, weight: 15 },
  { phrase: "romantyczny weekend", pattern: /romantyczny weekend/i, weight: 15 },
  { phrase: "dobrostan", pattern: /dobrostan(u)?/i, weight: 15 },
  { phrase: "budowanie świadomości", pattern: /budowanie świadomości/i, weight: 15 },
  { phrase: "sprawczość", pattern: /sprawczość/i, weight: 15 },
  { phrase: "działania rozwojowe", pattern: /działań rozwojowych|działania rozwojowe/i, weight: 15 },
  { phrase: "kampania edukacyjna", pattern: /kampani(a|ę|i) edukacyjn(ą|a|ej|e)/i, weight: 15 },
  { phrase: "motoryzacyjna pasja", pattern: /motoryzacyjną pasją/i, weight: 15 },
  { phrase: "zapoznanie się z materiałem", pattern: /zapoznania się z materiałem/i, weight: 15 },
  { phrase: "weryfikuje wszystko", pattern: /weryfikuje wszystko|jak dużą rolę odgrywają/i, weight: 15 },
  { phrase: "sprawdzić w praktyce", pattern: /sprawdzić (to )?w praktyce/i, weight: 15 },
  { phrase: "zmienia wszystko", pattern: /zmienia wszystko/i, weight: 15 },
  { phrase: "idealny moment", pattern: /idealny moment/i, weight: 8 },
  { phrase: "pewność siebie", pattern: /pewność siebie/i, weight: 15 },
  { phrase: "pierwszy krok", pattern: /pierwszy krok/i, weight: 8 },
  { phrase: "świetna robota", pattern: /świetnej roboty/i, weight: 8 },
  { phrase: "wiele utalentowanych", pattern: /wiele utalentowanych/i, weight: 15 },
  { phrase: "nie do przemyślenia", pattern: /nie do przemyślenia/i, weight: 15 },
  { phrase: "wiem jedno", pattern: /wiem jedno/i, weight: 8 },
  { phrase: "na zaproszenie", pattern: /na zaproszenie/i, weight: 8 },
  { phrase: "poprowadzenie warsztatów/szkoleń", pattern: /poprowadz(ę|i|ił[ea]m|iłam|iłem|iliście|iliśmy|iłyśmy|ą) (warsztat[y]?|szkoleni[ea]|warsztaty)/i, weight: 8 },
  { phrase: "bez teorii", pattern: /bez teorii/i, weight: 8 },
  { phrase: "jak to wygląda naprawdę", pattern: /jak to wygląda naprawdę/i, weight: 8 },
  { phrase: "kto wpada", pattern: /kto wpada/i, weight: 8 },
  { phrase: "X lat w branży", pattern: /\b(rok|lat(a|ach)?)\b.*\bw branży\b/i, weight: 8 },
  { phrase: "zrealizowanych projektów", pattern: /zrealizowanych projektów/i, weight: 8 },
  { phrase: "chcieć podziękować", pattern: /chciał([ea]m|bym|abym|a|i)? podziękować/i, weight: 8 },
  { phrase: "podziękować za ten czas", pattern: /podziękować za ten czas/i, weight: 8 },
  { phrase: "wielka scena", pattern: /wielk(iej|ą|ą) scen(y|ie|ą)/i, weight: 15 },
  { phrase: "notes zapisany / fajny czas", pattern: /notes zapisany|fajny czas/i, weight: 8 },
  { phrase: "skłonić do refleksji", pattern: /skłoni(ć|ło|ła) (mnie )?do refleksji/i, weight: 8 },
  { phrase: "wymiana zdań", pattern: /wymian(a|ę|y) zdań/i, weight: 8 },
  { phrase: "najlepszy lider", pattern: /najlepsz(y|ego|ym) lider(a|em)?/i, weight: 15 },
  { phrase: "odpowiedzialność", pattern: /odpowiedzialność (drugiego człowieka|pracownika|za własne)/i, weight: 15 },
  { phrase: "granica między", pattern: /przebiega granica|granic(a|ą) między/i, weight: 15 },
  { phrase: "osiągnąć sukces", pattern: /osiągnąć sukces(u)?/i, weight: 15 },
  { phrase: "doskonałe towarzystwo", pattern: /doskonał(e|ego|ym) towarzystw(o|a|em)/i, weight: 8 },
  { phrase: "zdobycie certyfikatu", pattern: /(?:zdobyt[yae]|zdoby(łam|łem|ć))\b.*\bcertyfikat\b|\bcertyfikat\b.*\bzdobyt[yae]/i, weight: 8 },
  { phrase: "zabieram ze sobą", pattern: /zabieram\s+ze\s+sobą/i, weight: 8 },
  { phrase: "dawka/garść wiedzy", pattern: /(?:dawk[aęi]|garść|porcj[aę])\s+(?:merytorycznej\s+)?wiedz[yaę]/i, weight: 8 },
  { phrase: "hype na", pattern: /hype\s+na\b/i, weight: 8 },
  { phrase: "dynamicznie zmieniający się świat", pattern: /dynamicznie zmieniającym się świecie|w dzisiejszym/i, weight: 25 },
  { phrase: "AI slop: zanurzmy się / kluczowy aspekt / era cyfrowa", pattern: /zanurzmy się|kluczowym aspektem|w erze cyfrowej|w dobie cyfryzacji/i, weight: 25 },
  { phrase: "AI slop: warto zauważyć / spójrzmy na", pattern: /warto zauważyć|spójrzmy na|nie ulega wątpliwości/i, weight: 25 },
  { phrase: "AI slop: w tym artykule / era AI", pattern: /w tym artykule|przejdźmy do szczegółów|w erze sztucznej inteligencji/i, weight: 25 },
  { phrase: "AI slop: kluczem do sukcesu / kluczowa rola / warto podkreślić", pattern: /kluczem do sukcesu|warto podkreślić|warto wspomnieć|odgrywa kluczową rolę/i, weight: 25 },
  { phrase: "talenty Gallupa / testy Gallupa", pattern: /talent(y|ów|ami|ach)? gallupa|test(y|ów|ami|ach)? gallupa/i, weight: 15 },
  { phrase: "nawigować potencjałem", pattern: /nawigować\s+(?:potencjałem|potencjał)/i, weight: 25 },
  { phrase: "wspieranie mocnych stron", pattern: /(?:wspier(ać|anie|ania|aniu)|odkryw(ać|anie|ania|aniu)|rozwij(ać|anie|ania|aniu))\s+mocn(ych|e)\s+stron/i, weight: 15 },
  { phrase: "budowanie synergii", pattern: /budow(a(nie|nia|niu|ć)|ujemy|ują|uje)?\s+synergi(i|ę|a|ą)/i, weight: 15 },
  { phrase: "dojrzałość lidera / moc lidera", pattern: /(?:moc|dojrzałość|zadanie|rola)\s+lidera/i, weight: 15 },
  { phrase: "rola przewodnika", pattern: /rol(i|a|ę|ą)\s+przewodnika/i, weight: 15 },
  { phrase: "dowozić wyniki", pattern: /dowozi(ć|my|cie|ą)\s+wynik(i|ów)?/i, weight: 15 },
  { phrase: "energia i sens pracy", pattern: /energi(a|ę|i)\s+i\s+sens\s+pracy/i, weight: 15 },
  { phrase: "projektować środowisko", pattern: /projektow(ać|anie|ania|aniu)\s+środowisk(o|a|u)/i, weight: 15 },
  { phrase: "naprawiać pracowników", pattern: /naprawia(ć|niu|nia)["'”’»]?\s+pracowników/i, weight: 15 },
  { phrase: "naturalne predyspozycje", pattern: /naturaln(e|ych|ymi)\s+predyspozycj(e|i|ami)/i, weight: 15 },
  { phrase: "wybrzmieć najpełniej", pattern: /wybrzmieć\s+(?:najpełniej|pełnią)/i, weight: 25 },
  { phrase: "najsurowsi sędziowie", pattern: /najsurowszymi\s+sędziami/i, weight: 25 },
  { phrase: "zderzenie z oczekiwaniami", pattern: /własne\s+oczekiwania\s+zderzą\s+się/i, weight: 25 },
];

// Inicjalizacja activeRules i BANNED_PHRASES na podstawie konfiguracji
let activeRules: BannedPatternConfig[] = [...BANNED_CONFIGS];

BANNED_PHRASES.push(...BANNED_CONFIGS.map(c => c.phrase));

export function setRules(rules: BannedPatternConfig[]): void {
  activeRules = rules;
  BANNED_PHRASES = rules.map(c => c.phrase);
}

// Słowa bezpieczne (decomposed)
const SAFE_PATTERNS = [
  /pierwsz[aąe]j? pomoc[y|a|ą]?/i,
  /samarytani(n|na|em)/i,
  /medyczn[yeo]g?o?y?/i,
  /medycyn[yaę]/i,
  /ratownik(a|ów|i)?/i,
  /ratownictw(o|a)?/i,
  /konsekwencj[eai] prawn[eao]g?o?/i,
  /sytuacj[eai] kryzysow[eao]g?o?/i,
  /zabezpieczeń|zabezpieczenia/i,
  /\bdezinformacj[aęi]\b/i,
  /plastics treaty/i,
  /\bzanieczyszcze(nia|ń)\b/i,
  /\bśrodowisk(o|a|u)\b/i,
  /koncert(y|ów|ami)?/i,
  /festiwal(u)?/i,
  /muzyk(a|i)?/i,
  /\bbada(nia|ń|niach)\b/i,
  /tabel[aęi]/i,
  /statystyk[ai]/i,
  /metod(ach)? płatności/i,
  /system(ach)? płatności/i,
  /televoting/i,
  /eurowizj[aęi]/i,
  /programistyczn[ea]/i,
  /programowanie/i,
  /kod(y|u)?/i,
  /bibliotek[ai]/i,
  /architektoniczn[ea]/i,
  /demografi[aęi]/i,
  /dzietność/i
];

const SUPER_SAFE_PATTERNS = [
  /cyberbezpieczeństw[oaeu]/i,
  /cybersecurity/i,
  /podatnośc[i|y|iach]?/i,
  /vulnerabilit(y|ies)/i,
  /luki bezpieczeństwa|luki/i,
  /ctf/i,
  /pentester/i,
  /pentest/i,
  /bezpieczeństwo sieci/i,
  /architektur(a|y) sieci/i,
  /hardening(u)?/i,
  /firewall/i,
  /ids\/ips/i,
  /vpn/i,
  /vlan/i,
  /ipv6/i,
  /zero trust/i,
  /rag/i,
  /sqlite/i,
  /prompt injection/i,
  /złośliwy kod/i,
  /malware/i,
  /nask/i,
  /ośrodek analizy dezinformacji/i,
  /system(u)? kaucyjn(ego|y)/i,
  /odpad(y|ów)?/i,
  /surow(iec|ce|ców)/i,
  /model(e)? językow(e|y|ych)/i,
  /llm/i,
  /agentow(ych|e)?/i,
  /autonomiczny(ch)? agentów/i,
  /bielik(a|iem|u)?/i,
  /bielik ai/i
];

export function analyzeText(text: string, threshold: number = 45): AnalysisResult {
  const result: AnalysisResult = {
    isSlop: false,
    score: 0,
    matchedPhrases: [],
    emojiCount: 0,
    emojiDensity: 0
  };

  if (!text || text.trim().length < 70) {
    return result;
  }

  // Czyszczenie linków markdown w celu poprawnego działania nameChainRegex
  const cleanText = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  const normalizedText = cleanText.toLowerCase();
  let score = 0;

  // 1. Sprawdzanie zakazanych fraz i sumowanie ich zróżnicowanych wag
  for (const config of activeRules) {
    if (config.pattern.test(cleanText)) {
      score += config.weight;
      if (!result.matchedPhrases.includes(config.phrase)) {
        result.matchedPhrases.push(config.phrase);
      }
    }
  }

  // 2. Detekcja sztucznego formatowania Unicode
  const unicodeFormattingRegex = /[\u{1D400}-\u{1D7FF}]/gu;
  const hasUnicodeFormatting = unicodeFormattingRegex.test(cleanText);
  if (hasUnicodeFormatting) {
    score += 40;
    result.matchedPhrases.push("[UNICODE]");
  }

  // 3. Detekcja name-dropping chain
  const nameChainRegex = /(?:[A-ZĆŁŚÓŻŹĄĘŃ][a-zćłśóżźąęń]+\s+[A-ZĆŁŚÓŻŹĄĘŃ][a-zćłśóżźąęń]+(?:\s*,\s*|\s+)(?:PhD|DSc|PhD,\s*DSc)?\s*){3,}/g;
  const hasNameChain = nameChainRegex.test(cleanText);
  if (hasNameChain) {
    score += 35;
    result.matchedPhrases.push("[NAMES_CHAIN]");
  }

  // 4. Liczenie emoji i sprawdzanie gęstości
  const emojiRegex = /\p{Emoji_Presentation}|\p{Emoji}\uFE0F/gu;
  const emojiMatches = cleanText.match(emojiRegex);
  const emojiCount = emojiMatches ? emojiMatches.length : 0;
  result.emojiCount = emojiCount;

  const textLength = cleanText.length;
  const emojiDensity = textLength > 0 ? (emojiCount / textLength) * 100 : 0;
  result.emojiDensity = parseFloat(emojiDensity.toFixed(2));

  if (emojiDensity > 5) {
    score += 25;
    result.matchedPhrases.push("[EMOJI_DENSITY]");
  }

  // 5. Sprawdzanie struktury tekstu (linie zaczynające się od emoji)
  const lines = cleanText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const emojiStartCount = lines.filter(l => /^(?:\p{Emoji_Presentation}|\p{Emoji}\uFE0F)/u.test(l)).length;
  if (lines.length >= 3) {
    const emojiStartRatio = emojiStartCount / lines.length;
    if (emojiStartRatio >= 0.4) {
      score += 25;
      result.matchedPhrases.push("[EMOJI_START_HIGH]");
    } else if (emojiStartRatio >= 0.2) {
      score += 10;
      result.matchedPhrases.push("[EMOJI_START_MED]");
    }
  }

  // Hasztagi
  const hashtagRegex = /(?:hasztag)?#\w+/g;
  const hashtags = cleanText.match(hashtagRegex);
  const hashtagCount = hashtags ? hashtags.length : 0;
  if (hashtagCount >= 5) {
    score += 15;
    result.matchedPhrases.push("[HASHTAGS]");
  }

  // Heurystyka wykrywania cert-flex / staży w celu osłabienia kar safe-words (tylko dla zwykłych SAFE_PATTERNS)
  const certKeywords = ["certyfikat", "ukończyłem", "ukończyłam", "staż", "szkolenie", "powiększa moją kolekcję", "kolekcję", "kolekcji", "kurs", "kursu", "program", "programu", "zdobyty"];
  const hasCertKeywords = certKeywords.some(w => normalizedText.includes(w));
  const isCertFlex = hasCertKeywords && (result.matchedPhrases.length >= 1 || emojiCount >= 4 || hashtagCount >= 4);

  // 6. Aplikowanie kar za bezpieczne słowa (Safe Words) - osłabiane przy cert-flex
  const penaltySafe = isCertFlex ? Math.round(15 / 5) : 15;
  for (const pattern of SAFE_PATTERNS) {
    if (pattern.test(cleanText)) {
      score -= penaltySafe;
    }
  }

  // 7. Aplikowanie kar za super bezpieczne słowa (Super Safe Words - IT & Tech) - ZAWSZE PEŁNA KARA,
  // co gwarantuje pełną ochronę merytorycznych postów technicznych przed zabluruowaniem.
  const penaltySuperSafe = 35;
  for (const pattern of SUPER_SAFE_PATTERNS) {
    if (pattern.test(cleanText)) {
      score -= penaltySuperSafe;
    }
  }

  // Dodatkowy bonus +30 pkt za flex w pierwszej linii i ścianę hasztagów
  const firstLine = lines[0] || '';
  const hasFirstLineFlex = /(?:zdobyt[yae]|zdoby(ła|łe)m|mamy to|oficjalnie)/i.test(firstLine);
  if (hasFirstLineFlex && hashtagCount >= 5) {
    score += 30;
    result.matchedPhrases.push("[FIRST_LINE_FLEX_WALL]");
  }

  result.score = Math.max(0, Math.min(score, 100));
  result.isSlop = result.score >= threshold;

  return result;
}