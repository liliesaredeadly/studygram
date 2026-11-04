const PassportPhoto = (() => {
  const maxFileBytes = 10 * 1024 * 1024;
  const maxPhotoSide = 600;
  const jpegData = /^data:image\/jpeg;base64,\/9j\/[A-Za-z0-9+/]+={0,2}$/;

  async function getImageType(file) {
    const header = new Uint8Array(await file.slice(0, 12).arrayBuffer());
    const hasBytes = (offset, signature) => signature.every((byte, index) => header[offset + index] === byte);
    if (hasBytes(0, [0xff, 0xd8, 0xff])) return 'image/jpeg';
    if (hasBytes(0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
    if (hasBytes(0, [0x52, 0x49, 0x46, 0x46]) && hasBytes(8, [0x57, 0x45, 0x42, 0x50])) return 'image/webp';
    return null;
  }

  async function read(file) {
    if (!file?.size) throw new Error('Choose a photo that contains an image.');
    if (file.size > maxFileBytes) throw new Error('Choose a photo under 10 MB.');

    let type;
    try {
      type = await getImageType(file);
    } catch {
      throw new Error('This photo couldn’t be opened. Try another file.');
    }
    if (!type) throw new Error('Choose a JPG, PNG or WebP photo.');

    let bitmap;
    try {
      bitmap = await createImageBitmap(file.slice(0, file.size, type));
      const scale = Math.min(1, maxPhotoSide / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext('2d', { alpha: false });
      context.fillStyle = '#f6ecd9';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      // Re-encoding keeps only the pixels and omits original image metadata.
      const photo = canvas.toDataURL('image/jpeg', 0.82);
      if (!jpegData.test(photo)) throw new Error('JPEG encoding failed.');
      return photo;
    } catch {
      throw new Error('This photo couldn’t be opened. Try another file.');
    } finally {
      bitmap?.close();
    }
  }

  function create(photo, avatar, label, size) {
    if (typeof photo !== 'string' || !jpegData.test(photo)) {
      const image = createPassportAvatar(avatar, size);
      image.alt = label ?? image.alt;
      return image;
    }

    const image = document.createElement('img');
    image.className = 'passport-uploaded-photo';
    image.src = photo;
    image.alt = label ?? 'Student portrait';
    image.draggable = false;
    return image;
  }

  return { read, create };
})();
