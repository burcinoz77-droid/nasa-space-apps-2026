# English glossary (NASA terminology)

The app is in English for the Space Apps judges. This list is the single source for the terms used on screen,
in ASTRA's answers and in the event log, so the four parts stay consistent. Where NASA has an established term
it is used as is; the reference is given in the last column.

Ekip için: kod yorumları ve README'ler Türkçe kaldı; ekranda görünen her metin, ASTRA'nın komutları ve cevapları
İngilizce. Yeni bir metin eklerken önce bu listeye bakın.

## Alert levels (Caution & Warning)

| Türkçe (eski) | English | Note / source |
| --- | --- | --- |
| KRİTİK (kırmızı) | **WARNING** | NASA C&W class 2: immediate action. NASA-STD-3001 Vol. 2 App. F: red = warning |
| DİKKAT (sarı) | **CAUTION** | C&W class 3: attention needed. Yellow |
| NORMAL (yeşil) | **NOMINAL** | NASA usage for "within expected limits" |
| bilgi (mavi) | **advisory** | C&W class 4. Blue |
| Onayla | **Acknowledge** (button), **ACK** (log) | C&W acknowledgement |
| olay | **event** | |
| otonom / otomatik adım | **automatic safing action** | pre-approved, logged |

## Crew, roles, locations

| Türkçe | English | Note |
| --- | --- | --- |
| Sağlık sorumlusu | **Crew Medical Officer (CMO)** | ISS crew role |
| Görev uzmanı | **Mission Specialist** | |
| Uçuş mühendisi | **Flight Engineer** | ISS title |
| Komutan | **Commander** | |
| Kokpit ekibi (gemide, yörüngede) | **orbit crew (IVA)** | intravehicular activity |
| Gezegen ekibi (yüzeyde, giysili) | **surface crew (EVA)** | extravehicular activity |
| uzay yürüyüşü | **EVA** | |
| kask vizörü | **helmet HUD** | xEMU informatics |
| xEMU giysisi | **xEMU suit** | Exploration EMU |

## Ground and communication

| Türkçe | English | Note |
| --- | --- | --- |
| Uçuş cerrahı / uçuş doktoru | **Flight Surgeon** | NASA JSC |
| Houston görev kontrol | **MCC-Houston** | Mission Control Center |
| Ana istasyon (Dünya) | **Ground (MCC-Houston)** | |
| Dünya bağlantısı aktif / yok | **AOS / LOS** | acquisition / loss of signal |
| tek yön gecikme | **one-way light time (OWLT)** | |
| gidiş-dönüş | **round trip** | |

## Mission, vehicle, scenarios

| Türkçe | English | Note |
| --- | --- | --- |
| görev günü | **Mission Day (MD)** | |
| gemi | **vehicle** (ARES-1) | |
| gemi olayı | **vehicle event** | |
| Normal gün | **Nominal day** | |
| Güneş fırtınası | **Solar particle event (SPE)** | |
| Mars 180. gün yükü | **Mars Day 180 workload** | |
| CO₂ temizleyici arızası | **CO₂ scrubber failure (CDRA)** | Carbon Dioxide Removal Assembly |
| EVA aşırı efor | **EVA overexertion** | |
| Radyasyon sığınağına geçiş | **Storm shelter ingress** | SPE countermeasure |
| Havalandırma artırıldı | **Ventilation increased** | |
| Zorunlu dinlenme | **Mandatory crew rest** | |
| revir | **medical bay** | |
| ilaç kiti | **medical kit** | ISS Crew Health Care System (CHeCS) |
| teşhis / tedavi | **diagnosis / treatment** | only the Flight Surgeon diagnoses |

## Health data

| Türkçe | English |
| --- | --- |
| kişisel normal / baseline | **personal baseline** |
| sağlık skoru | **health score** |
| kalp-damar · solunum-metabolik · biyokimya · bilişsel · çevre | **cardiovascular · respiratory/metabolic · biochemical · cognitive · environmental** |
| Baş · Göğüs · Alt gövde · Çevre | **Head · Chest · Lower body · Environment** |
| sapma | **deviation** |
| resmi normal aralık | **reference range** |

## ASTRA (two layers)

| Türkçe | English |
| --- | --- |
| Katman 1 (kural motoru, gemide) | **Layer 1** (onboard rule engine) |
| Katman 2 (dil modeli) | **Layer 2** (ASTRA AI) |
| ASTRA açıklaması | **ASTRA explanation** |
| Yedek mod | **Offline mode** (rule-based answer) |
| "Sayılar doğrulandı" | **"Numbers verified"** |
| ASTRA teşhis koymaz, ilaç önermez | **ASTRA does not diagnose or recommend medication** |

## Format

- Numbers: `36.8 °C`, `87%`, `12 min 30 s`, thousands with a comma (`1,344`).
- Time: 24-hour clock (`14:05:22`).
- Mixed case for labels (NASA-STD-3001); acronyms in capitals (EVA, OWLT, CDRA).
