export default async function handler(req, res) {
    // Hanya izinkan method POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { base64Data, mimeType } = req.body;

        if (!base64Data || !mimeType) {
            return res.status(400).json({ error: 'Data gambar dan tipe MIME diperlukan.' });
        }

        // Ambil API Key dari Environment Variable Vercel secara aman
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ error: 'Konfigurasi server bermasalah (API Key tidak ditemukan di Environment Variables Vercel).' });
        }

        const systemPrompt = `Anda adalah sistem AI pemindai Kartu Keluarga (KK) Indonesia yang sangat canggih. Tugas Anda adalah:
1. Membaca dan menjernihkan teks Kartu Keluarga yang buram atau kurang jelas pada gambar yang diberikan.
2. Mengekstrak informasi Kepala Keluarga, Nomor KK, Alamat, serta seluruh daftar anggota keluarga yang tercantum.
3. Mengembalikan output dalam format JSON murni yang sesuai dengan skema yang diminta tanpa teks tambahan.`;

        const userPrompt = `Analisis gambar Kartu Keluarga ini. Jernihkan teks yang buram secara mental, lalu ekstrak data ke dalam struktur JSON dengan format berikut:
{
  "no_kk": "Nomor KK",
  "kepala_keluarga": "Nama Kepala Keluarga",
  "alamat": "Alamat Lengkap",
  "anggota": [
    {
      "nama_lengkap": "Nama lengkap anggota",
      "nik": "NIK 16 digit",
      "jenis_kelamin": "Laki-laki / Perempuan",
      "tempat_lahir": "Tempat lahir",
      "tanggal_lahir": "Tanggal lahir (DD-MM-YYYY)",
      "jenis_pekerjaan": "Pekerjaan",
      "alamat_lengkap": "Alamat lengkap atau domisili sesuai KK"
    }
  ]
}`;

        const payload = {
            contents: [{
                role: "user",
                parts: [
                    { text: userPrompt },
                    { inlineData: { mimeType: mimeType, data: base64Data } }
                ]
            }],
            systemInstruction: { parts: [{ text: systemPrompt }] },
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: "OBJECT",
                    properties: {
                        no_kk: { type: "STRING" },
                        kepala_keluarga: { type: "STRING" },
                        alamat: { type: "STRING" },
                        anggota: {
                            type: "ARRAY",
                            items: {
                                type: "OBJECT",
                                properties: {
                                    nama_lengkap: { type: "STRING" },
                                    nik: { type: "STRING" },
                                    jenis_kelamin: { type: "STRING" },
                                    tempat_lahir: { type: "STRING" },
                                    tanggal_lahir: { type: "STRING" },
                                    jenis_pekerjaan: { type: "STRING" },
                                    alamat_lengkap: { type: "STRING" }
                                },
                                required: ["nama_lengkap", "nik", "jenis_kelamin", "tempat_lahir", "tanggal_lahir", "jenis_pekerjaan", "alamat_lengkap"]
                            }
                        }
                    },
                    required: ["no_kk", "kepala_keluarga", "alamat", "anggota"]
                }
            }
        };

const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`;            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error("Gagal dari Google API: " + errText);
        }

        const result = await response.json();
        return res.status(200).json(result);

    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
