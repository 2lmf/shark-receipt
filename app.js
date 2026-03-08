// --- CONFIG ---
const GAS_URL = "https://script.google.com/macros/s/AKfycbwiBlzkjGQcE8w7l28SeB3VkNhVMhZhFWAw_1s8epZyrqu3dG0uOvy1npx1uIyvtQ4/exec"; // Povezano s deployed backendom

let receiptsData = [];

// --- DOM ELEMENTS ---
const receiptGrid = document.getElementById('receiptGrid');
const btnSync = document.getElementById('btnSync');
const monthlyTotalEl = document.getElementById('monthlyTotal');
const pendingCountEl = document.getElementById('pendingCount');

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("🦈 SharkReceipt initialized!");
    if (GAS_URL === "OVDJE_ZALIJEPI_WEB_APP_URL") {
        console.warn("Shark: Molim zalijepite Web App URL u app.js");
        renderReceipts([]); // Prikaz praznog stanja
    } else {
        fetchData();
    }

    // Event Listeners
    btnSync.addEventListener('click', handleSync);

    // File Upload Listener
    const fileInput = document.getElementById('fileInput');
    if (fileInput) {
        fileInput.addEventListener('change', handleFileUpload);
    }

    initNavigation();
    initModal();
});

// --- FILE UPLOAD LOGIC ---

async function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    // Loader state
    const btnContent = btnSync.querySelector('.btn-content');
    const originalContent = btnContent.innerHTML;
    btnSync.disabled = true;
    btnContent.innerHTML = '<i class="fas fa-upload fa-spin"></i> SHARK UPLOADING...';

    try {
        const base64 = await toBase64(file);
        const base64Content = base64.split(',')[1];

        const response = await fetch(GAS_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'text/plain;charset=utf-8'
            },
            body: JSON.stringify({
                action: "analyzeAndUpload",
                filename: `Shark_${Date.now()}_${file.name}`,
                mimeType: file.type,
                data: base64Content
            })
        });

        console.log("Slanje slike na analizu...");

        // PAŽNJA: no-cors ne vara JSON. Moramo koristiti hack s JSONP-om ili GAS mora slati JSON na poseban način.
        // Prije smo koristili 'no-cors' pa nismo mogli dohvatiti odgovor iz GAS-a, ali ovdje to pokušavamo. 
        // Ako aplikacija pukne ovdje jer response.json() ne radi, morat ćemo maknuti 'no-cors' ili GAS podesiti za čisti CORS. 
        try {
            const result = await response.json();

            if (result.status === "success" && result.data) {
                btnContent.innerHTML = '<i class="fas fa-check"></i> PROČITANO';
                btnSync.style.background = '#00D084';

                // Popuni formu s podacima
                fillModalForm(result.data, result.fileName);

                // Otvori modal
                const modal = document.getElementById('previewModal');
                modal.classList.add('active');

            } else {
                throw new Error(result.message || "Neuspjela analiza");
            }
        } catch (jsonErr) {
            // Često padne zbog 'no-cors' ograničenja, ali sad smo na fetch() pa je to očekivano ako backend ne postavi headers
            console.error("Ne mogu čitati JSON odgovor. Google script možda blokira CORS umjesto dopusti.", jsonErr);
            throw jsonErr;
        }

    } catch (err) {
        console.error("Greška pri skeniranju/obradi:", err);
        btnContent.innerHTML = '<i class="fas fa-times"></i> SCAN FAIL';
    } finally {
        setTimeout(() => {
            btnContent.innerHTML = originalContent;
            btnSync.style.background = '#FFFFFF';
            btnSync.disabled = false;
        }, 3000);
    }
}

const toBase64 = file => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
});

// --- NAVIGATION ---

function initNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');
    const tabContents = document.querySelectorAll('.tab-content');

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const tabId = link.getAttribute('data-tab');

            // Update Nav Links
            navLinks.forEach(nl => nl.classList.remove('active'));
            link.classList.add('active');

            // Update Tab Contents
            tabContents.forEach(tc => tc.classList.remove('active'));
            const targetTab = document.getElementById(`tab-${tabId}`);
            if (targetTab) targetTab.classList.add('active');

            console.log(`Switched to tab: ${tabId}`);
        });
    });
}

// --- MODAL LOGIC (REVIEW & EDIT) ---

function fillModalForm(data, rawImageName) {
    document.getElementById('editDobavljac').value = data.dobavljac || "";
    document.getElementById('editDatum').value = data.datum || "";
    document.getElementById('editIznos').value = parseFloat(data.iznos) || 0;
    document.getElementById('editPdv').value = parseFloat(data.pdv) || 0;

    // Set matching option for Kategorija if exists, default to 'Ostalo'
    const catSelect = document.getElementById('editKategorija');
    let matchedOption = Array.from(catSelect.options).find(opt =>
        opt.value.toLowerCase() === (data.kategorija || "").toLowerCase()
    );
    if (matchedOption) {
        catSelect.value = matchedOption.value;
    } else {
        catSelect.value = "Ostalo";
    }

    // Skrivena polja
    document.getElementById('editOib').value = data.oib || "";
    document.getElementById('editAdresa').value = data.adresa || "";
    document.getElementById('editBrojRacuna').value = data.broj_racuna || "";
    document.getElementById('editOsnovica').value = data.osnovica || 0;
    document.getElementById('editNacinPlacanja').value = data.nacin_placanja || "";
    document.getElementById('editIban').value = data.iban || "";
    document.getElementById('editRawImageName').value = rawImageName || "";
}

async function confirmAndSaveReceipt() {
    const confirmBtn = document.getElementById('btnConfirmScan');
    const originalText = confirmBtn.innerHTML;

    confirmBtn.disabled = true;
    confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> SPREMANJE...';

    // Skupi podatke nazad u objekt
    const verifiedData = {
        dobavljac: document.getElementById('editDobavljac').value,
        datum: document.getElementById('editDatum').value,
        iznos: parseFloat(document.getElementById('editIznos').value || 0),
        pdv: parseFloat(document.getElementById('editPdv').value || 0),
        kategorija: document.getElementById('editKategorija').value,

        oib: document.getElementById('editOib').value,
        adresa: document.getElementById('editAdresa').value,
        broj_racuna: document.getElementById('editBrojRacuna').value,
        osnovica: parseFloat(document.getElementById('editOsnovica').value || 0),
        nacin_placanja: document.getElementById('editNacinPlacanja').value,
        iban: document.getElementById('editIban').value
    };

    const fileNameToProcess = document.getElementById('editRawImageName').value;

    try {
        const response = await fetch(GAS_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({
                action: "saveConfirmedData",
                data: verifiedData,
                fileName: fileNameToProcess
            })
        });

        // Simulirajmo čekanje dok no-cors ne završi i obnavljamo dashboard
        setTimeout(async () => {
            await fetchData();
            const modal = document.getElementById('previewModal');
            modal.classList.remove('active');

            confirmBtn.innerHTML = originalText;
            confirmBtn.disabled = false;
        }, 1500);

    } catch (err) {
        console.error("Greška kod spremanja:", err);
        confirmBtn.innerHTML = "GREŠKA!";
        setTimeout(() => {
            confirmBtn.innerHTML = originalText;
            confirmBtn.disabled = false;
        }, 2000);
    }
}

function initModal() {
    const modal = document.getElementById('previewModal');
    const closeBtn = document.querySelector('.close-modal');
    const cancelBtn = document.getElementById('btnCancelScan');
    const confirmBtn = document.getElementById('btnConfirmScan');

    const closeModal = () => modal.classList.remove('active');

    if (closeBtn) closeBtn.onclick = closeModal;
    if (cancelBtn) cancelBtn.onclick = closeModal;

    if (confirmBtn) {
        confirmBtn.onclick = confirmAndSaveReceipt;
    }

    window.onclick = (event) => {
        if (event.target == modal) closeModal();
    }
}

// --- DATA FETCHING ---

async function fetchData() {
    try {
        const response = await fetch(GAS_URL);
        const result = await response.json();

        if (result.status === "success") {
            receiptsData = result.items;
            renderReceipts(receiptsData);
            updateStats();
        }
    } catch (err) {
        console.error("Greška pri dohvatu podataka:", err);
    }
}

function renderReceipts(data) {
    receiptGrid.innerHTML = '';

    if (data.length === 0) {
        receiptGrid.innerHTML = '<p class="no-data">Nema dostupnih računa. Ubacite slike u folder i kliknite Shark Sync!</p>';
        return;
    }

    data.forEach((receipt, index) => {
        const card = document.createElement('div');
        card.className = `receipt-card new`;
        card.style.animationDelay = `${index * 0.1}s`;

        // Određivanje ikone na temelju kategorije (FontAwesome Free kompatibilno)
        let icon = "fa-file-invoice-dollar";
        if (receipt.kategorija.toLowerCase().includes("gorivo")) icon = "fa-gas-pump";
        if (receipt.kategorija.toLowerCase().includes("ured")) icon = "fa-laptop";
        if (receipt.kategorija.toLowerCase().includes("reprezentacija")) icon = "fa-utensils";
        if (receipt.kategorija.toLowerCase().includes("it")) icon = "fa-microchip";

        card.innerHTML = `
            <div class="img-thumb">
                <i class="fas ${icon}"></i>
            </div>
            <div class="receipt-info">
                <h3>${receipt.dobavljac}</h3>
                <div class="meta">
                    <span>${receipt.datum}</span>
                    <span>•</span>
                    <span>${receipt.kategorija}</span>
                </div>
            </div>
            <div class="receipt-amount">
                <span class="price">${parseFloat(receipt.iznos).toFixed(2)}</span>
                <span class="label">EUR</span>
            </div>
        `;

        card.addEventListener('click', () => {
            if (receipt.link) window.open(receipt.link, '_blank');
        });

        receiptGrid.appendChild(card);
    });
}

function updateStats() {
    let total = 0;
    receiptsData.forEach(r => {
        total += parseFloat(r.iznos) || 0;
    });
    monthlyTotalEl.innerText = `${total.toFixed(2)} €`;
    pendingCountEl.innerText = receiptsData.length;
}

async function handleSync() {
    const btnContent = btnSync.querySelector('.btn-content');
    const originalContent = btnContent.innerHTML;

    // Start animation
    btnSync.disabled = true;
    btnContent.innerHTML = '<i class="fas fa-spinner fa-spin"></i> SHARKING...';

    try {
        // Pozivamo POST na GAS Web App
        const response = await fetch(GAS_URL, {
            method: 'POST',
            mode: 'no-cors' // Google Apps Script često zahtijeva no-cors za jednostavne POST-ove
        });

        // Budući da 'no-cors' ne vraća body, čekamo par sekundi i osvježavamo podatke
        setTimeout(async () => {
            await fetchData();

            btnContent.innerHTML = '<i class="fas fa-check"></i> GOTOVO!';
            btnSync.style.background = '#00D084';

            // Reset button
            setTimeout(() => {
                btnContent.innerHTML = originalContent;
                btnSync.style.background = '#FFFFFF';
                btnSync.disabled = false;
            }, 2000);
        }, 3000);

    } catch (err) {
        console.error("Greška pri sinkronizaciji:", err);
        btnContent.innerHTML = '<i class="fas fa-times"></i> GREŠKA';
        btnSync.disabled = false;
    }
}
