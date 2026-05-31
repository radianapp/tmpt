// app/kerja/berkas/js/opfs.js
import { getOpfsRoot, writeOpfsFile, readOpfsFile, deleteOpfsFile } from '/shared/opfs.js';

export async function saveFileToOpfs(fileName, data) {
  return await writeOpfsFile(fileName, data);
}

export async function getFileFromOpfs(fileName) {
  return await readOpfsFile(fileName);
}

export async function removeFileFromOpfs(fileName) {
  return await deleteOpfsFile(fileName);
}

export async function getOpfsStorageEstimation() {
  if (navigator.storage && navigator.storage.estimate) {
    const estimate = await navigator.storage.estimate();
    return {
      usage: estimate.usage || 0,
      quota: estimate.quota || 0
    };
  }
  return { usage: 0, quota: 0 };
}

export async function getOpfsFolderSize() {
  try {
    const root = await getOpfsRoot();
    let totalSize = 0;
    for await (const entry of root.values()) {
      if (entry.kind === 'file') {
        const file = await entry.getFile();
        totalSize += file.size;
      }
    }
    return totalSize;
  } catch (e) {
    console.error("Gagal menghitung ukuran OPFS:", e);
    return 0;
  }
}
