# Help — status notifikasi WhatsApp Aircon

## Arti status

- **Antre (QUEUED):** notifikasi sudah dibuat, menunggu gateway.
- **Terkirim (SENT):** gateway/WhatsApp menerima submission.
- **Diterima perangkat (DELIVERED):** WhatsApp memberi ACK_DEVICE; ini acceptance transport utama.
- **Dibaca terkonfirmasi (READ_CONFIRMED):** WhatsApp memberi ACK_READ=3.
- **Status baca tidak teramati (READ_UNOBSERVED):** pesan sudah DELIVERED, tetapi WhatsApp tidak memberi ACK_READ dalam jendela observasi. Ini bukan gagal dan bukan berarti pesan belum dibaca.
- **Gagal (FAILED):** gateway melaporkan kegagalan permanen.
- **Berinteraksi (INTERACTED):** pelanggan membalas; ini sinyal terpisah dari READ_CONFIRMED.

## Mengapa status bisa berhenti di DELIVERED?

WhatsApp Web tidak menjamin pengiriman sinyal ACK_READ untuk setiap pesan. Karena itu Aircon tidak menjanjikan open/read rate dan tidak mengubah pesan menjadi gagal hanya karena READ_CONFIRMED tidak tersedia.

## Jika notifikasi belum terkirim

Pastikan WhatsApp usaha sudah tersambung di Pengaturan → Hubungkan WhatsApp. Notifikasi yang tertahan karena sesi belum siap tetap berada di antrean gateway dan dapat dikirim setelah sesi siap.

## Jika pelanggan membalas

Balasan dicatat sebagai interaksi pelanggan. Jangan menyimpulkan atau memaksa status READ_CONFIRMED dari balasan tersebut.
