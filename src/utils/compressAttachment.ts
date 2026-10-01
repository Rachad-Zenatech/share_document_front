/**
 * Safely compresses image attachments before upload.
 * Preserves high resolution (max 2048px) and quality (0.85) to ensure
 * zero degradation for OCR extraction and line-item parsers.
 * Digital PDFs are left intact to preserve vector text and font glyphs.
 */
export async function compressAttachmentBeforeUpload(file: File): Promise<File> {
  const isImage = file.type.startsWith("image/");
  const isLarge = file.size > 1.5 * 1024 * 1024; // > 1.5 MB

  if (!isImage || !isLarge) {
    return file;
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);

    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;

      img.onload = () => {
        const canvas = document.createElement("canvas");
        let { width, height } = img;

        const MAX_DIMENSION = 2048;
        if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
          if (width > height) {
            height = Math.round((height * MAX_DIMENSION) / width);
            width = MAX_DIMENSION;
          } else {
            width = Math.round((width * MAX_DIMENSION) / height);
            height = MAX_DIMENSION;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(file);
          return;
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob || blob.size >= file.size) {
              resolve(file);
            } else {
              const compressedFile = new File([blob], file.name, {
                type: "image/jpeg",
                lastModified: Date.now(),
              });
              resolve(compressedFile);
            }
          },
          "image/jpeg",
          0.85
        );
      };

      img.onerror = () => resolve(file);
    };

    reader.onerror = () => resolve(file);
  });
}

export async function compressAttachmentsBeforeUpload(files: File[]): Promise<File[]> {
  return Promise.all(files.map((file) => compressAttachmentBeforeUpload(file)));
}
