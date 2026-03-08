/**
 * SHARKRECEIPT | AI BACKEND CORE 🦈🤖
 * Ova skripta upravlja sinkronizacijom, Gemini AI obradom i arhiviranjem.
 */

const GEMINI_API_KEY = "AIzaSyCekebPey7Zz_zHTlP-9lAkoWFyFf-xJxU"; // Ugrađen ključ
const MODEL_NAME = "gemini-flash-latest"; // Naziv točno prema popisu iz dijagnostike

/**
 * POMOĆNA FUNKCIJA: Lista sve dostupne modele za tvoj API ključ
 */
function listAvailableModels() {
  const url = "https://generativelanguage.googleapis.com/v1beta/models?key=" + GEMINI_API_KEY;
  const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  Logger.log("Dostupni modeli: " + response.getContentText());
}

/**
 * Glavna funkcija za sinkronizaciju novih računa
 */
function syncReceipts() {
  const ui = SpreadsheetApp.getUi();
  const scriptProps = PropertiesService.getScriptProperties();
  const folderInId = scriptProps.getProperty("FOLDER_IN_ID");
  const folderOutId = scriptProps.getProperty("FOLDER_OUT_ID");
  
  if (!folderInId || !folderOutId) {
    ui.alert("❌ Greška: Folderi nisu postavljeni. Pokreni 'Instaliraj Sustav' prvo.");
    return;
  }
  
  const folderIn = DriveApp.getFolderById(folderInId);
  const folderOut = DriveApp.getFolderById(folderOutId);
  const files = folderIn.getFiles();
  
  let count = 0;
  
  while (files.hasNext()) {
    const file = files.next();
    const mimeType = file.getMimeType();
    
    // Procesiramo samo slike i PDF-ove
    if (mimeType.indexOf("image/") > -1 || mimeType === "application/pdf") {
      const isSuccess = processSingleFile(file, folderOut);
      if (isSuccess) count++;
    }
    
    if (count >= 5) break; 
  }
  
  if (count > 0) {
    ui.alert("✅ Shark je uspješno obradio i proknjižio " + count + " računa!");
  } else {
    ui.alert("⚠️ Provjera završena", "Nije pronađen nijedan valjan račun ili je došlo do greške pri obradi. Provjeri Logger (Ctrl+Enter u skripti) za detalje.", ui.ButtonSet.OK);
  }
}

/**
 * Obrada pojedinačne datoteke putem Geminija
 * @return {boolean} true ako je sve uspješno proknjiženo
 */
function processSingleFile(file, archiveFolder) {
  Logger.log("--- Pokrećem obradu: " + file.getName() + " ---");
  const blob = file.getBlob();
  const base64Data = Utilities.base64Encode(blob.getBytes());
  
  const prompt = "Ti si stručnjak za hrvatsko računovodstvo. Iz priložene slike računa izvuci podatke u JSON formatu na hrvatskom jeziku. " +
                 "STROGO PRAVILO: Dobavljač je FIRMA KOJA JE PRODALA robu/uslugu. " +
                 "BROJ RAČUNA: Izvuci GA DOSLOVNO onako kako je napisan na papiru (npr. 123/1/1), NEMOJ ga formatirati ili pretvarati u datum. " +
                 "Vrati ISKLJUČIVO čisti JSON (bez markdown tagova) sa sljedećim poljima: " +
                 "datum (DD.MM.YYYY), dobavljac (Naziv firme koja je prodala), adresa (Sjedište prodavača), oib (OIB prodavača - 11 znamenki), broj_racuna (Točna oznaka računa s papira), " +
                 "iznos (Ukupno s PDV-om, float), osnovica (Iznos bez PDV-a, float), pdv (Ukupni iznos PDV-a, float), " +
                 "kategorija (Gorivo, Ured, Reprezentacija, IT oprema, ostalo), nacin_placanja (Gotovina, Kartica ili Transakcijski), iban (IBAN prodavača). " +
                 "Ako polje nije vidljivo, vrati prazan string. Za brojeve iznosa koristi točku.";

  const payload = {
    contents: [{
      parts: [
        { text: prompt },
        { inline_data: { mime_type: file.getMimeType(), data: base64Data } }
      ]
    }]
  };

  const options = {
    method: "POST",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  try {
    const url = "https://generativelanguage.googleapis.com/v1beta/models/" + MODEL_NAME + ":generateContent?key=" + GEMINI_API_KEY;
    const response = UrlFetchApp.fetch(url, options);
    const resultText = response.getContentText();
    const json = JSON.parse(resultText);
    
    if (json.candidates && json.candidates[0].content && json.candidates[0].content.parts) {
      let rawAiText = json.candidates[0].content.parts[0].text;
      Logger.log("AI Odgovor primljen.");
      
      // Robusno čišćenje JSON-a
      let cleanJson = rawAiText.replace(/```json/gi, "").replace(/```/g, "").trim();
      
      try {
        const data = JSON.parse(cleanJson);
        Logger.log("JSON uspješno parsiran: " + data.dobavljac);
        
        // Upis u Sheet
        const sheetFilled = appendDataToSheet(data, file.getUrl());
        
        if (sheetFilled) {
          // Arhiviranje datoteke - tek nakon uspješnog upisa
          file.moveTo(archiveFolder);
          Logger.log("File arhiviran.");
          return true;
        }
      } catch (parseErr) {
        Logger.log("Greška pri parsiranju JSON-a: " + parseErr.toString());
        Logger.log("Sirov tekst: " + rawAiText);
      }
    } else {
      Logger.log("Greška: Gemini vratio prazan odgovor ili error: " + resultText);
    }
  } catch (e) {
    Logger.log("Kritična greška u UrlFetch-u: " + e.toString());
  }
  return false;
}

/**
 * Upisivanje podataka u tablicu
 */
function appendDataToSheet(data, fileUrl) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName("Shark Dashboard");
    
    if (!sheet) {
      Logger.log("Greška: Tablica 'Shark Dashboard' nije pronađena.");
      return false;
    }
    
    const rowData = [
      "'" + (data.datum || ""), // Forsira tekstualni format datuma
      data.dobavljac || "Nepoznato",
      data.adresa || "",
      "'" + (data.oib || ""),
      "'" + (data.broj_racuna || ""), // Forsira tekstualni format za broj računa (npr. 3-1-1)
      data.iznos || 0,
      data.osnovica || 0,
      data.pdv || 0,
      data.kategorija || "Razno",
      data.nacin_placanja || "",
      data.iban || "",
      '=HYPERLINK("' + fileUrl + '"; "🔎 Vidi Račun")'
    ];
    
    sheet.appendRow(rowData);
    Logger.log("Podaci uspješno dodani u Sheet.");
    return true;
  } catch (e) {
    Logger.log("Greška pri upisu u Sheet: " + e.toString());
    return false;
  }
}

/**
 * API ENDPOINT: Handle GET requests (Dohvat podataka za Dashboard)
 */
function doGet(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Shark Dashboard");
  const rows = sheet.getDataRange().getValues();
  
  // Uzimamo zadnjih 10 računa (preskačemo zaglavlje)
  const data = rows.slice(1).reverse().slice(0, 10).map(row => {
    return {
      datum: row[0],
      dobavljac: row[1],
      iznos: row[5],
      kategorija: row[8],
      link: row[11] ? row[11].match(/"([^"]+)"/)[1] : "" // Izvlačenje URL-a iz Hyperlink formule
    };
  });
  
  return ContentService.createTextOutput(JSON.stringify({
    status: "success",
    items: data
  })).setMimeType(ContentService.MimeType.JSON);
}

/**
 * API ENDPOINT: Handle POST requests (Pokretanje Shark Sync-a s mobitela)
 */
function doPost(e) {
  try {
    const result = syncReceiptsViaApi();
    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      message: result
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Verzija sync funkcije koja vraća string umjesto UI Alert-a (za API)
 */
function syncReceiptsViaApi() {
  const scriptProps = PropertiesService.getScriptProperties();
  const folderInId = scriptProps.getProperty("FOLDER_IN_ID");
  const folderOutId = scriptProps.getProperty("FOLDER_OUT_ID");
  
  const folderIn = DriveApp.getFolderById(folderInId);
  const folderOut = DriveApp.getFolderById(folderOutId);
  const files = folderIn.getFiles();
  
  let count = 0;
  while (files.hasNext()) {
    const file = files.next();
    const mimeType = file.getMimeType();
    if (mimeType.indexOf("image/") > -1 || mimeType === "application/pdf") {
      const isSuccess = processSingleFile(file, folderOut);
      if (isSuccess) count++;
    }
  }
  return count > 0 ? "Obrađeno " + count + " računa." : "Nema novih računa.";
}
