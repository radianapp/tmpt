import { describe, it, expect } from 'vitest';
import { Viewport } from '../../app/kerja/papan/js/viewport.js';
import { HistoryManager } from '../../app/kerja/papan/js/history.js';

describe('Papan Tulis Module (Unit Test)', () => {
  describe('Viewport Coordinate Conversion', () => {
    it('harus mengonversi koordinat world ke screen dengan benar pada zoom 1.0', () => {
      const vp = new Viewport();
      vp.scrollX = 100;
      vp.scrollY = 200;
      vp.zoom = 1.0;

      const screen = vp.toScreen(50, 50);
      expect(screen.x).toBe((50 + 100) * 1.0);
      expect(screen.y).toBe((50 + 200) * 1.0);
    });

    it('harus mengonversi koordinat screen ke world dengan benar pada zoom 2.0', () => {
      const vp = new Viewport();
      vp.scrollX = 50;
      vp.scrollY = 50;
      vp.zoom = 2.0;

      // screen = (world + scroll) * zoom
      // world = (screen / zoom) - scroll
      const world = vp.toWorld(200, 200);
      expect(world.x).toBe((200 / 2.0) - 50);
      expect(world.y).toBe((200 / 2.0) - 50);
    });

    it('harus melakukan zoom pada titik fokus tertentu dengan benar', () => {
      const vp = new Viewport();
      vp.scrollX = 0;
      vp.scrollY = 0;
      vp.zoom = 1.0;

      // Zoom at center (100, 100) with factor 2
      vp.zoomAt(100, 100, 2.0);
      expect(vp.zoom).toBe(2.0);
      
      // The point under cursor (100,100) screen should still map to (100,100) world
      const world = vp.toWorld(100, 100);
      expect(world.x).toBeCloseTo(100);
      expect(world.y).toBeCloseTo(100);
    });
  });

  describe('History Manager', () => {
    it('harus melakukan undo dan redo dengan benar', () => {
      const history = new HistoryManager();
      let elements = [{ id: '1', type: 'rectangle' }];

      history.push(elements);
      elements = [{ id: '1', type: 'rectangle' }, { id: '2', type: 'ellipse' }];

      // Undo
      const undone = history.undo(elements);
      expect(undone).toBeDefined();
      expect(undone.length).toBe(1);
      expect(undone[0].id).toBe('1');

      // Redo
      const redone = history.redo(undone);
      expect(redone).toBeDefined();
      expect(redone.length).toBe(2);
      expect(redone[1].type).toBe('ellipse');
    });
  });

  describe('Z-Order Array Manipulation', () => {
    it('harus memindahkan elemen terpilih ke depan (to-front) dengan benar', () => {
      let elements = [
        { id: '1', zIndex: 1 },
        { id: '2', zIndex: 2 },
        { id: '3', zIndex: 3 }
      ];
      const selected = [elements[0]]; // element 1
      
      const isSelected = (el) => selected.some(sel => sel.id === el.id);
      const unselected = elements.filter(el => !isSelected(el));
      const selectedElems = elements.filter(isSelected);
      const newElements = [...unselected, ...selectedElems];
      
      newElements.forEach((el, index) => {
        el.zIndex = index + 1;
      });

      expect(newElements[2].id).toBe('1');
      expect(newElements[2].zIndex).toBe(3);
      expect(newElements[0].id).toBe('2');
      expect(newElements[0].zIndex).toBe(1);
    });

    it('harus memindahkan elemen terpilih ke belakang (to-back) dengan benar', () => {
      let elements = [
        { id: '1', zIndex: 1 },
        { id: '2', zIndex: 2 },
        { id: '3', zIndex: 3 }
      ];
      const selected = [elements[2]]; // element 3
      
      const isSelected = (el) => selected.some(sel => sel.id === el.id);
      const unselected = elements.filter(el => !isSelected(el));
      const selectedElems = elements.filter(isSelected);
      const newElements = [...selectedElems, ...unselected];
      
      newElements.forEach((el, index) => {
        el.zIndex = index + 1;
      });

      expect(newElements[0].id).toBe('3');
      expect(newElements[0].zIndex).toBe(1);
      expect(newElements[2].id).toBe('2');
      expect(newElements[2].zIndex).toBe(3);
    });
  });
});
