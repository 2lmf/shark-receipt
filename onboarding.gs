/**
 * SHARKRECEIPT | ONE-CLICK ONBOARDING SCRIPT
 * Ovaj skript automatski postavlja cijeli sustav kod klijenta.
 */

function setupSharkReceipt() {
  const ui = SpreadsheetApp.getUi();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  if (!ss) {
    // Ovo se događa ako skripta nije "Bound" (povezana) uz Sheet
    // U tom slučaju bismo trebali openById, ali vraćamo na tvoj originalni zahtjev
    console.log("Greška: Skripta nije pokrenuta iz tablice.");
    return;
  }
  
  // 1. KREIRANJE FOLDERA NA DRIVEU
  ui.alert("🚀 Započinjem SharkReceipt Setup...", "Sustav će sada kreirati potrebne foldere na tvom Driveu i pripremiti tablicu.", ui.ButtonSet.OK);
  
  try {
    let parentFolder;
    const parents = DriveApp.getFileById(ss.getId()).getParents();
    
    if (parents.hasNext()) {
      parentFolder = parents.next();
    } else {
      parentFolder = DriveApp.getRootFolder();
    }
    
    // Provjera/Kreiranje "Novi Računi"
    let folderIn = getOrCreateFolder(parentFolder, "01_Novi_Računi_Shark");
    // Provjera/Kreiranje "Arhiva"
    let folderOut = getOrCreateFolder(parentFolder, "02_Arhiva_Računa_Shark");
    
    // Spremamo ID-eve u postavke skripte da ih backend može naći
    const scriptProps = PropertiesService.getScriptProperties();
    scriptProps.setProperty("FOLDER_IN_ID", folderIn.getId());
    scriptProps.setProperty("FOLDER_OUT_ID", folderOut.getId());
    
    // 2. POSTAVLJANJE TABLICE (SHEETA)
    setupSheetLayout(ss);
    
    // 3. ZAVRŠETAK
    ui.alert("✅ SharkReceipt je SPREMAN!", 
             "Kreirani su folderi:\n" + 
             "- " + folderIn.getName() + "\n" +
             "- " + folderOut.getName() + "\n\n" +
             "Sada možeš početi uploadati račune i koristiti 'Shark Sync'!", 
             ui.ButtonSet.OK);
             
  } catch (e) {
    Logger.log("Setup Error: " + e.toString());
    ui.alert("❌ Greška pri instalaciji", 
             "Opis pogreške: " + e.message + "\n\n" +
             "Savjet: Provjeri jesi li odobrio sve tražene dozvole (Drive, Spreadsheet) pri pokretanju.", 
             ui.ButtonSet.OK);
  }
}

/**
 * Pomoćna funkcija za kreiranje foldera ako ne postoji
 */
function getOrCreateFolder(parent, folderName) {
  const folders = parent.getFoldersByName(folderName);
  if (folders.hasNext()) {
    return folders.next();
  } else {
    return parent.createFolder(folderName);
  }
}

/**
 * Postavlja vizualni layout tablice (Shark Theme)
 */
function setupSheetLayout(ss) {
  let sheet = ss.getSheetByName("Shark Dashboard");
  if (!sheet) {
    sheet = ss.insertSheet("Shark Dashboard");
  }
  
  sheet.clear();
  
  // Zaglavlja - Prošireno za knjigovodstvo
  const headers = [["DATUM", "DOBAVLJAČ", "ADRESA", "OIB", "BROJ RAČUNA", "IZNOS (EUR)", "OSNOVICA", "PDV", "KATEGORIJA", "NAČIN PLAĆANJA", "IBAN", "LINK NA RAČUN"]];
  
  // Styling (Profesionalni svijetlo-narančasti stil)
  const fullRange = sheet.getRange(1, 1, sheet.getMaxRows(), sheet.getMaxColumns());
  fullRange.setBackground("#FFFFFF").setFontColor("#333333"); // Bijela pozadina i tamni tekst
  
  // Zaglavlje: Narančasto s crnim tekstom za bolju čitljivost
  const headerRange = sheet.getRange(1, 1, 1, headers[0].length);
  headerRange.setValues(headers)
             .setBackground("#E67E22")
             .setFontColor("#000000")
             .setFontWeight("bold")
             .setFontFamily("Orbitron");
             
  sheet.getRange(2, 1, 100, sheet.getLastColumn()).setFontFamily("Outfit");
  
  // Zamrzavanje zaglavlja
  sheet.setFrozenRows(1);
  
  // Auto-resize stupaca
  sheet.autoResizeColumns(1, headers[0].length);
  
  SpreadsheetApp.setActiveSheet(sheet);
}

/**
 * Dodaje Shark izbornik u Google Sheet
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('🦈 SHARKRECEIPT')
      .addItem('🚀 Instaliraj/Inicijaliziraj Sustav', 'setupSharkReceipt')
      .addSeparator()
      .addItem('🔄 Shark Sync (Novi Računi)', 'syncReceipts') // Ovu funkciju ćemo kasnije dodati
      .addToUi();
}
