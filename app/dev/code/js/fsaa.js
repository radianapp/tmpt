// app/dev/code/js/fsaa.js

/**
 * Verify permission for a FileSystemHandle, requesting it if necessary.
 */
export async function verifyPermission(fileHandle, readWrite = true, requestIfNeed = false) {
  const options = {};
  if (readWrite) {
    options.mode = 'readwrite';
  }
  
  if ((await fileHandle.queryPermission(options)) === 'granted') {
    return true;
  }
  
  if (requestIfNeed) {
    try {
      if ((await fileHandle.requestPermission(options)) === 'granted') {
        return true;
      }
    } catch (err) {
      console.warn('Gagal meminta izin:', err);
    }
  }
  
  return false;
}

/**
 * Recursively read directory entries to build a file tree.
 */
export async function readDirectoryRecursive(dirHandle, relativePath = '') {
  const tree = [];
  try {
    for await (const entry of dirHandle.values()) {
      const entryPath = relativePath ? `${relativePath}/${entry.name}` : entry.name;
      
      // Skip hidden files/directories (like .git, .vscode, etc.)
      if (entry.name.startsWith('.')) continue;

      if (entry.kind === 'file') {
        tree.push({
          type: 'file',
          name: entry.name,
          path: entryPath,
          handle: entry
        });
      } else if (entry.kind === 'directory') {
        const children = await readDirectoryRecursive(entry, entryPath);
        tree.push({
          type: 'directory',
          name: entry.name,
          path: entryPath,
          handle: entry,
          children: children.sort((a, b) => {
            // Folders first, then files
            if (a.type !== b.type) {
              return a.type === 'directory' ? -1 : 1;
            }
            return a.name.localeCompare(b.name);
          })
        });
      }
    }
  } catch (err) {
    console.error('Error reading directory:', err);
  }
  
  return tree.sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === 'directory' ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });
}

/**
 * Read text content from a file handle.
 */
export async function readFileContent(fileHandle) {
  const file = await fileHandle.getFile();
  return await file.text();
}

/**
 * Write text content to a file handle.
 */
export async function writeFileContent(fileHandle, content) {
  const writable = await fileHandle.createWritable();
  await writable.write(content);
  await writable.close();
}

/**
 * Create a new file in a directory.
 */
export async function createLocalFile(parentDirHandle, fileName) {
  return await parentDirHandle.getFileHandle(fileName, { create: true });
}

/**
 * Create a new directory.
 */
export async function createLocalDirectory(parentDirHandle, dirName) {
  return await parentDirHandle.getDirectoryHandle(dirName, { create: true });
}
