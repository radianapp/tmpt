import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BerkasSearch } from '../../app/kerja/berkas/js/search.js';
import * as berkasDb from '../../app/kerja/berkas/js/berkas-db.js';

// Mock berkas-db.js module
vi.mock('../../app/kerja/berkas/js/berkas-db.js', () => {
  return {
    getFiles: vi.fn()
  };
});

describe('BerkasSearch (Unit Test)', () => {
  const dummyFiles = [
    {
      id: '1',
      name: 'Proposal Q2.pdf',
      type: 'pdf',
      folder_id: 'root',
      starred: true,
      tags: ['kerja', 'prioritas'],
      trash: false,
      created_at: '2026-05-01T00:00:00.000Z',
      updated_at: '2026-05-10T12:00:00.000Z',
      size_bytes: 1024
    },
    {
      id: '2',
      name: 'Form Survey Pelanggan',
      type: 'form',
      folder_id: 'folder-123',
      starred: false,
      tags: ['pemasaran'],
      trash: false,
      created_at: '2026-05-02T00:00:00.000Z',
      updated_at: '2026-05-11T12:00:00.000Z',
      size_bytes: 512
    },
    {
      id: '3',
      name: 'Logo Perusahaan.png',
      type: 'image',
      folder_id: 'root',
      starred: false,
      tags: ['design'],
      trash: true,
      created_at: '2026-05-03T00:00:00.000Z',
      updated_at: '2026-05-12T12:00:00.000Z',
      size_bytes: 2048
    }
  ];

  beforeEach(() => {
    vi.mocked(berkasDb.getFiles).mockResolvedValue(dummyFiles);
  });

  it('harus dapat menginisialisasi kelas BerkasSearch', () => {
    const searcher = new BerkasSearch();
    expect(searcher).toBeDefined();
  });

  it('harus menyaring berkas berdasarkan kata kunci pencarian (nama)', async () => {
    const searcher = new BerkasSearch();
    const results = await searcher.search('survey');
    expect(results.length).toBe(1);
    expect(results[0].name).toBe('Form Survey Pelanggan');
  });

  it('harus menyaring berkas berdasarkan kata kunci pencarian (tag)', async () => {
    const searcher = new BerkasSearch();
    const results = await searcher.search('kerja');
    expect(results.length).toBe(1);
    expect(results[0].id).toBe('1');
  });

  it('harus menyaring berkas yang ada di tempat sampah (trash) hanya jika dispesifikasikan', async () => {
    const searcher = new BerkasSearch();
    
    // Normal search should not return trashed files
    const normalResults = await searcher.search('');
    expect(normalResults.find(f => f.id === '3')).toBeUndefined();

    // Search with showTrash option
    const trashResults = await searcher.search('', { showTrash: true });
    expect(trashResults.length).toBe(1);
    expect(trashResults[0].id).toBe('3');
  });

  it('harus menyaring berkas berdasarkan tipe file', async () => {
    const searcher = new BerkasSearch();
    const results = await searcher.search('', { type: 'form' });
    expect(results.length).toBe(1);
    expect(results[0].name).toBe('Form Survey Pelanggan');
  });

  it('harus menyaring berkas berdasarkan folder_id', async () => {
    const searcher = new BerkasSearch();
    const results = await searcher.search('', { folderId: 'folder-123' });
    expect(results.length).toBe(1);
    expect(results[0].id).toBe('2');
  });

  it('harus mengurutkan hasil berdasarkan pilihan urutan (sort)', async () => {
    const searcher = new BerkasSearch();
    
    // Sort by name asc
    const resultsNameAsc = await searcher.search('', { sortBy: 'name', sortDir: 'asc' });
    expect(resultsNameAsc[0].name).toBe('Form Survey Pelanggan');
    expect(resultsNameAsc[1].name).toBe('Proposal Q2.pdf');

    // Sort by size desc
    const resultsSizeDesc = await searcher.search('', { sortBy: 'size', sortDir: 'desc' });
    expect(resultsSizeDesc[0].size_bytes).toBe(1024);
    expect(resultsSizeDesc[1].size_bytes).toBe(512);
  });
});
