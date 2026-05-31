// app/kerja/berkas/js/search.js
import { getFiles } from './berkas-db.js';

export class BerkasSearch {
  async search(query, options = {}) {
    const files = await getFiles();
    const queryClean = query ? query.trim().toLowerCase() : '';
    
    let filtered = files.filter(f => {
      // Exclude trashed files unless requested
      if (options.showTrash) {
        if (!f.trash) return false;
      } else {
        if (f.trash) return false;
      }

      // Starred filter
      if (options.starredOnly && !f.starred) return false;

      // Folder filter
      if (options.folderId !== undefined && f.folder_id !== options.folderId) return false;

      // Tag filter
      if (options.tag && (!f.tags || !f.tags.includes(options.tag))) return false;

      // Type filter
      if (options.type && options.type !== 'all' && f.type !== options.type) return false;

      // Name / Tag Keyword search
      if (queryClean) {
        const nameMatch = f.name.toLowerCase().includes(queryClean);
        const tagMatch = f.tags && f.tags.some(t => t.toLowerCase().includes(queryClean));
        return nameMatch || tagMatch;
      }

      return true;
    });

    // Ranking/Sorting
    return this.rankResults(filtered, queryClean, options.sortBy || 'updated_at', options.sortDir || 'desc');
  }

  rankResults(results, query, sortBy, sortDir) {
    const dirFactor = sortDir === 'asc' ? 1 : -1;
    
    return results.sort((a, b) => {
      // If there's a search query, prioritize exact name matches
      if (query) {
        const aExact = a.name.toLowerCase() === query;
        const bExact = b.name.toLowerCase() === query;
        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;

        const aStartsWith = a.name.toLowerCase().startsWith(query);
        const bStartsWith = b.name.toLowerCase().startsWith(query);
        if (aStartsWith && !bStartsWith) return -1;
        if (!aStartsWith && bStartsWith) return 1;
      }

      // Fallback sorting based on options
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name) * dirFactor;
      } else if (sortBy === 'size') {
        return ((a.size_bytes || 0) - (b.size_bytes || 0)) * dirFactor;
      } else if (sortBy === 'created_at') {
        return (new Date(a.created_at) - new Date(b.created_at)) * dirFactor;
      } else {
        // Default: updated_at
        return (new Date(a.updated_at) - new Date(b.updated_at)) * dirFactor;
      }
    });
  }
}
