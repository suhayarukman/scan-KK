let currentImageData = null;
let videoStream = null;
let allExtractedData = [];

// Tab Switching Logic
function switchTab(mode) {
    const camContainer = document.getElementById('camContainer');
    const uploadContainer = document.getElementById('uploadContainer');
    const btnCamTab = document.getElementById('btnCamTab');
    const btnUploadTab = document.getElementById('btnUploadTab');

    if (mode === 'cam') {
        camContainer.classList.remove('hidden');
        uploadContainer.classList.add('hidden');
        btnCamTab.className = "py-2.5 px-4 rounded-xl text-sm font-medium bg-indigo-50 text-indigo-700 border border-indigo-200 transition";
        btnUploadTab.className = "py-2.5 px-4 rounded-xl text-sm font-medium bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100 transition";
    } else {
        stopCamera();
        camContainer.classList.add('hidden');
        uploadContainer.classList.remove('hidden');
        btnUploadTab.className = "py-2.5 px-4 rounded-xl text-sm font-medium bg-indigo-50 text-indigo-700 border border-indigo-200 transition";
        btnCamTab.className = "py-2.5 px-4 rounded-xl text-sm font-medium bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100 transition";
    }
}

// Camera Management
async function startCamera() {
    try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error("Browser Anda tidak mendukung akses kamera langsung.");
        }
        
        let constraints = {
            video: {
                facingMode: { ideal: "environment" },
                width: { ideal: 1280 },
                height: { ideal: 720 }
            }
        };

        try {
            videoStream = await navigator.mediaDevices.getUserMedia(constraints);
        } catch (e) {
            videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
        }

        const video = document.getElementById('webcam');
        video.srcObject = videoStream;
        await video.play();
        
        video.classList.remove('hidden');
        document.getElementById('camPlaceholder').classList.add('hidden');
        document.getElementById('camControls').classList.remove('hidden');
    } catch (err) {
        console.error(err);
        showToast("Gagal membuka kamera: Pastikan izin kamera telah diizinkan (allow) di browser Anda.", "error");
    }
}

function stopCamera() {
    if (videoStream) {
        videoStream.getTracks().forEach(track => track.stop());
        videoStream = null;
    }
    const video = document.getElementById('webcam');
    video.pause();
    video.srcObject = null;
    video.classList.add('hidden');
    document.getElementById('camPlaceholder').classList.remove('hidden');
    document.getElementById('camControls').classList.add('hidden');
}

function captureImage() {
    const video = document.getElementById('webcam');
    const canvas = document.getElementById('snapshotCanvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    stopCamera();
    processImageInput(dataUrl);
}

// File Selection & Drag Drop
function handleFileSelect(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            processImageInput(e.target.result);
        };
        reader.readAsDataURL(file);
    }
}

// Global Paste Event Listener
window.addEventListener('paste', e => {
    const items = (e.clipboardData || e.originalEvent.clipboardData).items;
    for (let index in items) {
        let item = items[index];
        if (item.kind === 'file') {
            let blob = item.getAsFile();
            let reader = new FileReader();
            reader.onload = function(event) {
                processImageInput(event.target.result);
                switchTab('upload');
            };
            reader.readAsDataURL(blob);
        }
    }
});

// Compress image
async function compressImage(dataUrl, maxWidth = 1200, quality = 0.8) {
    return new Promise((resolve) => {
        const img = new Image();
        img.src = dataUrl;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            if (width > maxWidth) {
                height = Math.round((height * maxWidth) / width);
                width = maxWidth;
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = () => resolve(dataUrl);
    });
}

async function processImageInput(dataUrl) {
    const compressedUrl = await compressImage(dataUrl);
    currentImageData = compressedUrl;
    document.getElementById('previewImg').src = compressedUrl;
    document.getElementById('previewSection').classList.remove('hidden');
    
    const processingBadge = document.getElementById('processingBadge');
    processingBadge.classList.remove('hidden');

    const base64Data = compressedUrl.split(',')[1];
    const mimeType = compressedUrl.split(';')[0].split(':')[1];

    try {
        await callGeminiAI(base64Data, mimeType);
    } catch (error) {
        showToast("Gagal memproses gambar: " + error.message, "error");
    } finally {
        processingBadge.classList.add('hidden');
    }
}

// MEMANGGIL BACKEND AMAN DI /api/gemini
async function callGeminiAI(base64Data, mimeType) {
    try {
        const response = await fetch('/api/gemini', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ base64Data, mimeType })
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error || "Gagal terhubung ke server backend.");
        }

        const result = await response.json();
        const textCandidate = result?.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (!textCandidate) {
            throw new Error("AI tidak mengembalikan data yang valid.");
        }

        const parsedData = JSON.parse(textCandidate);
        renderExtractedData(parsedData);

    } catch (error) {
        throw new Error(error.message);
    }
}

function renderExtractedData(data) {
    document.getElementById('metaNoKK').textContent = data.no_kk || '-';
    document.getElementById('metaKepala').textContent = data.kepala_keluarga || '-';
    document.getElementById('metaAlamat').textContent = data.alamat || '-';
    document.getElementById('kkMeta').classList.remove('hidden');

    if (data.anggota && Array.isArray(data.anggota)) {
        data.anggota.forEach(item => {
            allExtractedData.push({
                no_kk: data.no_kk || '-',
                nama_lengkap: item.nama_lengkap || '',
                nik: item.nik || '',
                jenis_kelamin: item.jenis_kelamin || '',
                tempat_lahir: item.tempat_lahir || '',
                tanggal_lahir: item.tanggal_lahir || '',
                jenis_pekerjaan: item.jenis_pekerjaan || '',
                alamat_lengkap: item.alamat_lengkap || data.alamat || ''
            });
        });
    }

    refreshTableDisplay();
    document.getElementById('btnExport').disabled = allExtractedData.length === 0;
    showToast("Berhasil memindai dan menambahkan data KK ke tabel!", "success");
}

function refreshTableDisplay() {
    const tbody = document.getElementById('dataTableBody');
    tbody.innerHTML = '';

    if (allExtractedData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" class="text-center py-8 text-slate-400">Tidak ada anggota keluarga ditemukan.</td></tr>`;
        return;
    }

    allExtractedData.forEach((item, index) => {
        const row = document.createElement('tr');
        row.className = "border-b border-slate-100 hover:bg-slate-50 transition";
        row.innerHTML = `
            <td class="py-1 px-2 font-medium text-slate-600 leading-tight">${index + 1}</td>
            <td class="py-1 px-2 font-mono text-slate-700 leading-tight">${item.no_kk}</td>
            <td class="py-1 px-2 font-semibold text-slate-900 leading-tight">${item.nama_lengkap}</td>
            <td class="py-1 px-2 font-mono text-slate-700 leading-tight">${item.nik}</td>
            <td class="py-1 px-2 text-slate-700 leading-tight">${item.jenis_kelamin}</td>
            <td class="py-1 px-2 text-slate-700 leading-tight">${item.tempat_lahir}</td>
            <td class="py-1 px-2 text-slate-700 leading-tight">${item.tanggal_lahir}</td>
            <td class="py-1 px-2 text-slate-700 leading-tight">${item.jenis_pekerjaan}</td>
            <td class="py-1 px-2 text-slate-700 leading-tight">${item.alamat_lengkap}</td>
        `;
        tbody.appendChild(row);
    });
}

function clearAllData() {
    allExtractedData = [];
    refreshTableDisplay();
    document.getElementById('kkMeta').classList.add('hidden');
    document.getElementById('btnExport').disabled = true;
    showToast("Semua data berhasil direset.", "info");
}

function exportToExcel() {
    if (allExtractedData.length === 0) return;

    const workbook = XLSX.utils.book_new();
    const chunkSize = 10;

    for (let i = 0; i < allExtractedData.length; i += chunkSize) {
        const chunk = allExtractedData.slice(i, i + chunkSize);
        const pageNum = Math.floor(i / chunkSize) + 1;

        const exportData = chunk.map((item, index) => ({
            "No": i + index + 1,
            "No. KK": item.no_kk,
            "Nama Lengkap": item.nama_lengkap,
            "NIK": item.nik,
            "Jenis Kelamin": item.jenis_kelamin,
            "Tempat Lahir": item.tempat_lahir,
            "Tanggal Lahir": item.tanggal_lahir,
            "Jenis Pekerjaan": item.jenis_pekerjaan,
            "Alamat Lengkap": item.alamat_lengkap
        }));

        const worksheet = XLSX.utils.json_to_sheet(exportData);
        
        worksheet['!cols'] = [
            {wch: 5}, {wch: 22}, {wch: 25}, {wch: 20}, 
            {wch: 15}, {wch: 18}, {wch: 15}, {wch: 22}, {wch: 35}
        ];

        XLSX.utils.book_append_sheet(workbook, worksheet, `Bagian_${pageNum}`);
    }

    XLSX.writeFile(workbook, "Data_Kartu_Keluarga_Per10.xlsx");
    showToast("File Excel berhasil diunduh dengan pembagian per 10 data!", "success");
}

function showToast(message, type) {
    const toast = document.getElementById('statusMsg');
    toast.textContent = message;
    toast.classList.remove('hidden', 'bg-emerald-50', 'text-emerald-700', 'bg-rose-50', 'text-rose-700', 'bg-slate-100', 'text-slate-600');
    
    if (type === 'success') {
        toast.classList.add('bg-emerald-50', 'text-emerald-700');
    } else if (type === 'error') {
        toast.classList.add('bg-rose-50', 'text-rose-700');
    } else {
        toast.classList.add('bg-slate-100', 'text-slate-600');
    }

    setTimeout(() => {
        toast.classList.add('hidden');
    }, 4000);
}
