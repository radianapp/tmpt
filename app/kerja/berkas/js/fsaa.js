// app/kerja/berkas/js/fsaa.js
// File System Access API helper (Chrome/Edge only)

export async function selectLocalFolder() {
  if (!window.showDirectoryPicker) {
    throw new Error('Browser Anda tidak mendukung File System Access API.');
  }
  const handle = await window.showDirectoryPicker();
  return handle;
}

export async function verifyPermission(fileHandle, readWrite) {
  const options = {};
  if (readWrite) {
    options.mode = 'readwrite';
  }
  if ((await fileHandle.queryPermission(options)) === 'granted') {
    return true;
  }
  if ((await fileHandle.requestPermission(options)) === 'granted') {
    return true;
  }
  return false;
}

export async function writeLocalFile(dirHandle, fileName, content) {
  try {
    const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(content);
    await writable.close();
    return true;
  } catch (e) {
    console.error("Gagal menulis file lokal:", e);
    return false;
  }
}

export async function deleteLocalFile(dirHandle, fileName) {
  try {
    await dirHandle.removeEntry(fileName);
    return true;
  } catch (e) {
    console.error("Gagal menghapus file lokal:", e);
    return false;
  }
}
