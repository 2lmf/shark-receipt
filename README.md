# SharkReceipt: Tehnička Dokumentacija Sustava (v19.0) 🦈📖

SharkReceipt je visokotehnološki PWA sustav za automatizirano knjigovodstvo koji koristi kombinaciju Google Cloud ekosustava i OpenAI umjetne inteligencije za digitalizaciju i analizu računa.

## 1. Arhitektura Sustava
Sustav se sastoji od tri ključna sloja:
- **Frontend (PWA):** HTML5, Vanilla CSS i JavaScript (bez frameworka) – služi za interakciju s korisnikom, skeniranje kamerom i pregled podataka.
- **Backend (Google Apps Script - GAS):** Mozak operacije koji upravlja datotekama na Google Driveu, komunicira s OpenAI API-jem i zapisuje podatke u Google Sheets.
- **Baza Podataka:** Google Sheets ("Shark Dashboard") i Google Drive (mape IN/OUT).

---

## 2. Frontend Logika (`index.html`, `app.js`, `style.css`)
### 2.1. Dinamička Konfiguracija
Kroz tab **Postavke**, aplikacija omogućuje korisniku unos:
- `SHARK_GAS_URL`: Adresa deployanog backend servisa.
- `SHARK_API_KEY`: Korisnikov OpenAI API ključ (sprema se isključivo u `localStorage` preglednika).

### 2.2. Proces Skeniranja (Kamera/Upload)
Kada korisnik "uslika" račun:
1. Datoteka se pretvara u `Base64` format.
2. Šalje se na GAS s akcijom `analyzeAndUpload`.
3. Backend vraća pročitane AI podatke koje frontend prikazuje u **Review Modalu**.
4. Korisnik provjerava podatke (Dobavljač, Iznos, Kategorija) i klikom na "KNJIŽI" šalje konačnu potvrdu.

---

## 3. Backend Logika (`backend.gs`)
GAS služi kao siguran most (Proxy) između frontenda i vanjskih servisa.

### 3.1. Hibridni OCR Proces
S obzirom na to da OpenAI direktno ne podržava PDF datoteke na "Vision" način bez kompliciranih konverzija, SharkReceipt koristi **Hibridni OCR**:
1. **Drive OCR:** Ako je datoteka PDF, GAS je privremeno kopira i otvara kao "Google Doc" (što forsira Googleov interni OCR).
2. **Ekstrakcija Teksta:** GAS čita čisti tekst iz tog dokumenta.
3. **AI Vision:** Ako je datoteka slika (JPEG/PNG), šalje se direktno OpenAI-ju kao slika.
4. **Finalna Analiza:** OpenAI GPT-4o-mini prima ili tekst ili sliku te vraća strukturirani JSON objekt s knjigovodstvenim podacima.

---

## 4. Shark Sync & Sync-Flow 🌊
Najmoćnija značajka sustava je **Sync-Flow**:
- **Dohvat:** Klikom na "SHARK SYNC", frontend zove GAS akciju `sync`.
- **Ulančavanje (`isSyncFlow`):** Ako u mapi `IN` na Driveu ima više računa, sustav ih obrađuje jednog po jednog.
- **Interakcija:** Svaki račun se otvara u modalu. Čim ga korisnik proknjiži, modal se zatvara, sustav čeka 2 sekunde (da Drive stigne pomaknuti datoteku) i automatski otvara sljedeći račun.
- **Kraj:** Proces staje kada GAS vrati status `empty`.

---

## 5. Knjiženje i Brisanje
### 5.1. Google Sheets Dashboard
Podaci se upisuju u tablicu "Shark Dashboard". Svaki red sadrži datum, dobavljača, iznose, poreze i **Hyperlink** na samu datoteku računa koja je u međuvremenu premještena u mapu `OUT` na Driveu.

### 5.2. Pametno Brisanje (`deleteRow`)
Gumb **X** na karticama šalje zahtjev GAS-u s "ključem" (Datum + Dobavljač + Broj Računa). Backend pretražuje Sheet od dna prema vrhu i briše odgovarajući red.

---

## 6. UI/UX Detalji
- **Currency formatting:** Svi iznosi se formatiraju prema `hr-HR` standardu (točka za tisućice, zarez za decimale).
- **Responzivnost:** Tablica Dnevnik je optimizirana tako da se "Dobavljač" prelama, čime se izbjegava horizontalni skrol na mobitelu.
- **Sigurnost:** API ključ je u postavkama sakriven (`password` polje) s opcijom "oka" za pregled.

---

> [!TIP]
> **Održavanje:** Pri svakoj promjeni u `backend.gs`, potrebno je odraditi **New Deployment** u Google skripti kako bi promjene postale aktivne na Web App URL-u.

🦈 *SharkReceipt - Proždirač računa, čuvar vremena.*
