export default async function handler(req, res) {
    // 1. Pastikan hanya metode POST yang diizinkan
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { base64Data, mimeType } = req.body;
        
        // 2. Mengambil API Key dari Environment Variable (AMAN)
        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            return res.status(500).json({ error: 'API Key belum dikonfigurasi di Vercel.' });
        }

        // 3. Menyiapkan payload untuk dikirim ke Gemini
        const payload = {
            contents: [{
                role: "user",
                parts: [
                    { text: "Ekstrak data KK ke format JSON." },
                    { inlineData: { mimeType: mimeType, data: base64Data } }
                ]
            }]
        };

        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

        // 4. Kirim request ke Google Gemini
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        
        // 5. Mengirim balik hasil ke frontend
        return res.status(200).json(data);

    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}