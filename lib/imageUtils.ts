/**
 * Pomocné utility pro lokální kompresi obrázků přímo v prohlížeči přes HTML5 Canvas.
 * Zmenšuje fotografii na max 800px a komprimuje do formátu WebP/JPEG s kvalitou 0.65.
 * Výsledný řetězec má obvykle pouze ~40-90 kB, což umožňuje bezplatné uložení
 * přímo do dokumentu Firestore bez nutnosti externího placeného úložiště.
 */

export async function compressImage(
  file: File,
  maxWidth = 800,
  quality = 0.65
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("Vybraný soubor není platný obrázek."));
      return;
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);

    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;

      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Zachování poměru stran při zmenšení nejdelší hrany na maxWidth
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxWidth) {
            width = Math.round((width * maxWidth) / height);
            height = maxWidth;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas context 2D není v prohlížeči dostupný."));
          return;
        }

        // Lepší vyhlazení při zmenšení
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, width, height);

        // Zkusíme WebP (úspornější), případně fallback na JPEG
        let dataUrl = canvas.toDataURL("image/webp", quality);
        if (!dataUrl.startsWith("data:image/webp")) {
          dataUrl = canvas.toDataURL("image/jpeg", quality);
        }

        resolve(dataUrl);
      };

      img.onerror = (err) => {
        reject(new Error("Nepodařilo se načíst obrázek do paměti."));
      };
    };

    reader.onerror = (err) => {
      reject(new Error("Chyba při čtení souboru obrázku."));
    };
  });
}

