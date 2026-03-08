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
            body: JSON.stringify({
                action: "upload",
                filename: `Shark_${Date.now()}_${file.name}`,
                mimeType: file.type,
                data: base64Content
            })
        });

        // Nakon uploada, automatski pokrećemo sinkronizaciju (obradu)
        await handleSync();

    } catch (err) {
        console.error("Greška pri uploadu:", err);
        btnContent.innerHTML = '<i class="fas fa-times"></i> UPLOAD FAIL';
        setTimeout(() => {
            btnContent.innerHTML = originalContent;
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

function initModal() {
    const modal = document.getElementById('previewModal');
    const closeBtn = document.querySelector('.close-modal');

    if (closeBtn) {
        closeBtn.onclick = () => modal.classList.remove('active');
    }

    window.onclick = (event) => {
        if (event.target == modal) modal.classList.remove('active');
    }
}

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
