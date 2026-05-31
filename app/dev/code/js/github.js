// app/dev/code/js/github.js
const toast = (msg, type) => window.TMPT_UI.toast(msg, type);

/**
 * Fetch files and folders recursively from a GitHub repository branch.
 */
export async function fetchGitHubRepoContents(token, owner, repo, branch = 'main') {
  try {
    // We can fetch the git tree recursively for the branch head
    // 1. Get branch reference to find the commit SHA
    const branchRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/branches/${branch}`, {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (!branchRes.ok) throw new Error('Gagal memuat info branch');
    const branchInfo = await branchRes.json();
    const treeSha = branchInfo.commit.commit.tree.sha;

    // 2. Fetch recursive tree
    const treeRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/${treeSha}?recursive=true`, {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (!treeRes.ok) throw new Error('Gagal memuat file tree');
    const treeData = await treeRes.json();

    // 3. Build a structured tree hierarchy from the flat tree list
    return buildGitHubTree(treeData.tree);
  } catch (err) {
    console.error('Error fetching GitHub contents:', err);
    toast('Gagal memuat struktur file dari GitHub.', 'error');
    return [];
  }
}

function buildGitHubTree(flatTree) {
  const root = [];
  const map = {};

  flatTree.forEach(item => {
    // Skip hidden files/folders
    if (item.path.startsWith('.') || item.path.includes('/.')) return;

    const parts = item.path.split('/');
    const name = parts[parts.length - 1];
    const isDir = item.type === 'tree';

    const node = {
      type: isDir ? 'directory' : 'file',
      name: name,
      path: item.path,
      sha: item.sha,
      size: item.size || 0
    };

    if (isDir) {
      node.children = [];
    }

    map[item.path] = node;

    if (parts.length === 1) {
      root.push(node);
    } else {
      const parentPath = parts.slice(0, parts.length - 1).join('/');
      const parent = map[parentPath];
      if (parent && parent.children) {
        parent.children.push(node);
      }
    }
  });

  const sortNodes = (nodes) => {
    return nodes.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'directory' ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    }).map(n => {
      if (n.children) {
        n.children = sortNodes(n.children);
      }
      return n;
    });
  };

  return sortNodes(root);
}

/**
 * Fetch raw content of a file from GitHub.
 */
export async function fetchGitHubFileContent(token, owner, repo, path, branch = 'main') {
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`;
  
  const res = await fetch(url, {
    headers: {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github.v3+json'
    }
  });

  if (!res.ok) throw new Error('Gagal memuat isi file dari GitHub');
  const data = await res.json();
  
  // Content is base64 encoded
  const decoded = decodeURIComponent(escape(atob(data.content.replace(/\s/g, ''))));
  return {
    content: decoded,
    sha: data.sha // Save SHA to overwrite later
  };
}

/**
 * Commit/Write content of a file to GitHub.
 */
export async function commitGitHubFileContent(token, owner, repo, path, content, sha, branch = 'main', message = 'Update from TMPT Code') {
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
  const encodedContent = btoa(unescape(encodeURIComponent(content)));

  const payload = {
    message,
    content: encodedContent,
    branch
  };

  if (sha) {
    payload.sha = sha;
  }

  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.message || 'Gagal menyimpan file ke GitHub');
  }

  const data = await res.json();
  return data.content.sha; // Return new sha reference
}
