// shared/seo.js
import { SEO_CONFIG } from './seo-config.js';
import {
  buildOrganizationSchema,
  buildWebSiteSchema,
  buildBreadcrumbSchema,
  buildWebApplicationSchema,
  buildFAQSchema,
  buildHowToSchema
} from './seo-schemas.js';

const SITE = {
  name:       'TMPT',
  url:        'https://tmpt.my.id',
  twitter:    '@tmpt_id',
  defaultOG:  '/assets/og/default-og.png',
  locale:     'id_ID',
  lang:       'id',
  author:     'TMPT — tmpt.my.id',
};

export function injectSEO(pageKey) {
  const config = SEO_CONFIG[pageKey];
  if (!config) {
    console.warn(`SEO configuration for key "${pageKey}" not found.`);
    return;
  }

  const {
    title,
    desc,
    canonical,
    ogImage,
    type = 'website',
    noindex = false,
    schemas = [],
    breadcrumbs = [],
    webApplication = null,
    faqs = null,
    howto = null
  } = config;

  // 1. Title
  document.title = title.includes(SITE.name) ? title : `${title} — ${SITE.name}`;

  // 2. Meta tags
  setMeta('description', desc);
  setMeta('author',      SITE.author);
  setMeta('robots',      noindex ? 'noindex,nofollow' : 'index,follow');
  setMeta('language',    'Indonesian');

  // 3. Open Graph
  setOG('og:title',        title);
  setOG('og:description',  desc);
  setOG('og:url',          canonical || location.href);
  setOG('og:image',        `${SITE.url}${ogImage || SITE.defaultOG}`);
  setOG('og:image:width',  '1200');
  setOG('og:image:height', '630');
  setOG('og:type',         type);
  setOG('og:locale',       SITE.locale);
  setOG('og:site_name',    SITE.name);

  // 4. Twitter Card
  setMeta('twitter:card',        'summary_large_image', 'name');
  setMeta('twitter:site',        SITE.twitter,          'name');
  setMeta('twitter:title',       title,                 'name');
  setMeta('twitter:description', desc,                  'name');
  setMeta('twitter:image',       `${SITE.url}${ogImage || SITE.defaultOG}`, 'name');

  // 5. Canonical
  setCanonical(canonical || location.href);

  // Remove existing dynamically injected JSON-LD scripts to prevent duplicates on single-page transitions (if any)
  document.querySelectorAll('script[data-dynamic-seo="true"]').forEach(el => el.remove());

  // 6. JSON-LD Structured Data
  schemas.forEach(schemaKey => {
    let sd = null;
    if (schemaKey === 'organization') {
      sd = buildOrganizationSchema();
    } else if (schemaKey === 'website') {
      sd = buildWebSiteSchema();
    } else if (schemaKey.startsWith('webapplication')) {
      sd = buildWebApplicationSchema(webApplication || { name: title, description: desc, url: canonical });
    } else if (schemaKey.startsWith('faq')) {
      sd = buildFAQSchema(faqs);
    } else if (schemaKey.startsWith('howto')) {
      sd = buildHowToSchema(howto);
    }

    if (sd) injectJSONLD(sd);
  });

  // 7. Breadcrumb
  if (breadcrumbs.length) {
    const breadcrumbSchema = buildBreadcrumbSchema(breadcrumbs);
    if (breadcrumbSchema) injectJSONLD(breadcrumbSchema);
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function setMeta(name, content, attr = 'name') {
  let el = document.querySelector(`meta[${attr}="${name}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, name);
    document.head.appendChild(el);
  }
  el.content = content;
}

function setOG(property, content) {
  let el = document.querySelector(`meta[property="${property}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute('property', property);
    document.head.appendChild(el);
  }
  el.content = content;
}

function setCanonical(href) {
  let el = document.querySelector('link[rel="canonical"]');
  if (!el) {
    el = document.createElement('link');
    el.rel = 'canonical';
    document.head.appendChild(el);
  }
  el.href = href;
}

function injectJSONLD(schema) {
  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.setAttribute('data-dynamic-seo', 'true');
  script.textContent = JSON.stringify(schema, null, 2);
  document.head.appendChild(script);
}

// Auto-inject if data-seo-key is specified on current script tag or script target
document.addEventListener('DOMContentLoaded', () => {
  const currentScript = document.querySelector('script[data-seo-key]');
  if (currentScript) {
    const key = currentScript.getAttribute('data-seo-key');
    if (key) injectSEO(key);
  }
});
