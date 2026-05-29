import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import vm from 'vm';

describe('HitungFormulaEngine (Unit Test via Vitest)', () => {
  beforeAll(() => {
    const formulaEnginePath = path.resolve(__dirname, '../../app/kerja/hitung/hitung_formula.js');
    const formulaEngineCode = fs.readFileSync(formulaEnginePath, 'utf8');
    
    // Sandbox context
    const context = {
      window: {},
      console: console,
      Function: Function
    };
    
    vm.createContext(context);
    vm.runInContext(formulaEngineCode, context);
    
    globalThis.HitungFormulaEngine = context.window.HitungFormulaEngine;
  });

  it('harus terdefinisi di global scope setelah dievaluasi', () => {
    expect(globalThis.HitungFormulaEngine).toBeDefined();
  });

  it('harus dapat mengevaluasi aritmatika dasar', () => {
    const cells = {
      'A1': { value: 10, type: 'number' },
      'A2': { value: 20, type: 'number' }
    };
    const engine = new globalThis.HitungFormulaEngine(cells);
    expect(engine.evaluate('=A1+A2', 'B1')).toBe(30);
  });

  it('harus dapat mengevaluasi rumus SUM', () => {
    const cells = {
      'A1': { value: 5, type: 'number' },
      'A2': { value: 15, type: 'number' },
      'A3': { value: 25, type: 'number' }
    };
    const engine = new globalThis.HitungFormulaEngine(cells);
    expect(engine.evaluate('=SUM(A1:A3)', 'B1')).toBe(45);
  });

  it('harus dapat mengevaluasi formula kustom Indonesia (TAX & DISCOUNT)', () => {
    const cells = {
      'A1': { value: 100000, type: 'number' }
    };
    const engine = new globalThis.HitungFormulaEngine(cells);
    expect(engine.evaluate('=TAX(A1, 11)', 'B1')).toBe(11000);
    expect(engine.evaluate('=DISCOUNT(A1, 10)', 'B2')).toBe(10000);
  });

  it('harus mendeteksi circular reference', () => {
    const cells = {
      'A1': { formula: '=B1', type: 'formula' },
      'B1': { formula: '=A1', type: 'formula' }
    };
    const engine = new globalThis.HitungFormulaEngine(cells);
    const result = engine.evaluate('=B1', 'A1');
    expect(result.error).toBe(true);
    expect(result.type).toBe('#REF!');
  });
});
