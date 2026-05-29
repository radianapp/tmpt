// shared/opfs.js - OPFS (Origin Private File System) wrapper for TMPT binary files

export async function getOpfsRoot() {
  if (!navigator.storage || !navigator.storage.getDirectory) {
    throw new Error('OPFS tidak didukung di browser ini.');
  }
  return await navigator.storage.getDirectory();
}

export async function writeOpfsFile(fileName, content) {
  const root = await getOpfsRoot();
  const fileHandle = await root.getFileHandle(fileName, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(content);
  await writable.close();
  return fileHandle;
}

export async function readOpfsFile(fileName) {
  const root = await getOpfsRoot();
  const fileHandle = await root.getFileHandle(fileName);
  const file = await fileHandle.getFile();
  return file;
}

export async function deleteOpfsFile(fileName) {
  const root = await getOpfsRoot();
  await root.removeEntry(fileName);
}

export async function listOpfsFiles() {
  const root = await getOpfsRoot();
  const files = [];
  for await (const entry of root.values()) {
    if (entry.kind === 'file') {
      files.push(entry.name);
    }
  }
  return files;
}
