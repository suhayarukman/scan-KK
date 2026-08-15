export default async function handler(req, res) {
  // Hanya izinkan method POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { base64Data, mimeType } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'API Key belum diset di environment variable Vercel.' });
  }

  if (!base64Data || !mimeType) {
    return res.status(400).json({ error: 'Data gambar atau tipe MIME tidak valid.' });
  }

  try {
    // Menggunakan model Gemini 3.5 Flash terbaru yang stabil
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: "Ekstraklah data Kartu Keluarga ini ke dalam format JSON murni tanpa teks lain di luar JSON dengan struktur: { \"no_kk\": \"...\", \"kepala_keluarga\": \"...\", \"alamat\": \"...\", \"anggota\": [ { \"nama_lengkap\": \"...\", \"nik\": \"...\", \"jenis_kelamin\": \"...\", \"tempat_lahir\": \"...\", \"tanggal_lahir\": \"...\", \"jenis_pekerjaan\": \"...\", \"alamat_lengkap\": \"...\" } ] }"
              },
              {
                inline_data: {
                  mime_type: mimeType,
                  data: base64Data
                }
              }
            ]
          }
        ]
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
      const errorMessage = data.error?.message || 'Terjadi kesalahan pada Google API';
      return res.status(response.status).json({ error: errorMessage });
    }

    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ error: 'Server error: ' + error.message });
  }
}
