import { describe, it, expect } from 'vitest';
import { SEO_CONFIG } from '../../shared/seo-config.js';
import {
  buildOrganizationSchema,
  buildWebSiteSchema,
  buildBreadcrumbSchema,
  buildWebApplicationSchema,
  buildFAQSchema,
  buildHowToSchema
} from '../../shared/seo-schemas.js';

describe('SEO System (Unit Test)', () => {
  describe('SEO Configurations', () => {
    it('setiap entry SEO_CONFIG harus memiliki properti dasar yang wajib', () => {
      Object.keys(SEO_CONFIG).forEach(key => {
        const config = SEO_CONFIG[key];
        expect(config.title).toBeDefined();
        expect(typeof config.title).toBe('string');
        expect(config.title.length).toBeGreaterThan(0);

        if (!config.noindex) {
          expect(config.desc).toBeDefined();
          expect(typeof config.desc).toBe('string');
          expect(config.desc.length).toBeGreaterThan(0);
          expect(config.desc.length).toBeLessThanOrEqual(160); // Rekomendasi max length deskripsi SEO
          
          expect(config.canonical).toBeDefined();
          expect(config.canonical.startsWith('https://tmpt.my.id')).toBe(true);
        }
      });
    });
  });

  describe('JSON-LD Schema Builders', () => {
    it('harus menghasilkan struktur Organization schema yang valid', () => {
      const schema = buildOrganizationSchema();
      expect(schema['@context']).toBe('https://schema.org');
      expect(schema['@type']).toBe('Organization');
      expect(schema.name).toBe('TMPT');
      expect(schema.url).toBe('https://tmpt.my.id');
    });

    it('harus menghasilkan struktur WebSite schema yang valid', () => {
      const schema = buildWebSiteSchema();
      expect(schema['@context']).toBe('https://schema.org');
      expect(schema['@type']).toBe('WebSite');
      expect(schema.name).toBe('TMPT');
      expect(schema.potentialAction).toBeDefined();
    });

    it('harus menghasilkan BreadcrumbList yang valid', () => {
      const breadcrumbs = [
        { name: 'Beranda', url: '/' },
        { name: 'Tools', url: '/app/tools/' }
      ];
      const schema = buildBreadcrumbSchema(breadcrumbs);
      expect(schema['@context']).toBe('https://schema.org');
      expect(schema['@type']).toBe('BreadcrumbList');
      expect(schema.itemListElement.length).toBe(2);
      expect(schema.itemListElement[0].name).toBe('Beranda');
      expect(schema.itemListElement[0].item).toBe('https://tmpt.my.id/');
    });

    it('harus menghasilkan WebApplication yang valid', () => {
      const appConfig = {
        name: 'Favicon Converter',
        url: 'https://tmpt.my.id/app/tools/favicon/',
        description: 'PNG to ICO',
        category: 'UtilityApplication'
      };
      const schema = buildWebApplicationSchema(appConfig);
      expect(schema['@context']).toBe('https://schema.org');
      expect(schema['@type']).toBe('WebApplication');
      expect(schema.name).toBe('Favicon Converter');
      expect(schema.applicationCategory).toBe('UtilityApplication');
    });

    it('harus menghasilkan FAQPage schema yang valid', () => {
      const faqs = [
        { question: 'Apakah gratis?', answer: 'Ya, sepenuhnya gratis.' }
      ];
      const schema = buildFAQSchema(faqs);
      expect(schema['@context']).toBe('https://schema.org');
      expect(schema['@type']).toBe('FAQPage');
      expect(schema.mainEntity.length).toBe(1);
      expect(schema.mainEntity[0].name).toBe('Apakah gratis?');
    });
  });
});
