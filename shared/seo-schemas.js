// shared/seo-schemas.js

export function buildOrganizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "TMPT",
    "url": "https://tmpt.my.id",
    "logo": "https://tmpt.my.id/favicon.png",
    "description": "Platform produktivitas offline-first, privacy-first untuk Indonesia.",
    "sameAs": [
      "https://github.com/radianapp/tmpt",
      "https://twitter.com/tmptmyid"
    ]
  };
}

export function buildWebSiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "TMPT",
    "url": "https://tmpt.my.id",
    "potentialAction": {
      "@type": "SearchAction",
      "target": {
        "@type": "EntryPoint",
        "urlTemplate": "https://tmpt.my.id/app/?q={search_term_string}"
      },
      "query-input": "required name=search_term_string"
    }
  };
}

export function buildBreadcrumbSchema(breadcrumbs) {
  if (!breadcrumbs || !breadcrumbs.length) return null;
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": breadcrumbs.map((b, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "name": b.name,
      "item": b.url.startsWith('http') ? b.url : `https://tmpt.my.id${b.url}`
    }))
  };
}

export function buildWebApplicationSchema(config) {
  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "name": config.name || "TMPT Application",
    "url": config.url || "https://tmpt.my.id",
    "description": config.description || "",
    "applicationCategory": config.category || "UtilityApplication",
    "applicationSubCategory": config.subCategory || "Productivity Tool",
    "operatingSystem": "All (Web Browser)",
    "browserRequirements": "Chrome 90+, Firefox 90+, Safari 15+",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "IDR"
    },
    "featureList": config.featureList || "",
    "screenshot": config.screenshot || "https://tmpt.my.id/assets/og/default-og.png",
    "creator": {
      "@type": "Organization",
      "name": "TMPT",
      "url": "https://tmpt.my.id"
    }
  };
}

export function buildFAQSchema(faqs) {
  if (!faqs || !faqs.length) return null;
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faqs.map(faq => ({
      "@type": "Question",
      "name": faq.question,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": faq.answer
      }
    }))
  };
}

export function buildHowToSchema(howto) {
  if (!howto) return null;
  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    "name": howto.name,
    "description": howto.description,
    "totalTime": howto.totalTime || "PT2M",
    "tool": (howto.tools || ["TMPT Platform"]).map(t => ({ "@type": "HowToTool", "name": t })),
    "step": howto.steps.map((step, index) => {
      const s = {
        "@type": "HowToStep",
        "position": index + 1,
        "name": step.name,
        "text": step.text
      };
      if (step.image) {
        s.image = step.image.startsWith('http') ? step.image : `https://tmpt.my.id${step.image}`;
      }
      return s;
    })
  };
}
