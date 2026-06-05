/* app/tools/kalkulator/js/ai-calc.js */

export const AI_MODELS = {
  // Price per 1M tokens in USD: [Input Price, Output Price]
  'gpt-4o': { name: 'GPT-4o (OpenAI)', inputPrice: 5.00, outputPrice: 15.00 },
  'gpt-4o-mini': { name: 'GPT-4o mini (OpenAI)', inputPrice: 0.150, outputPrice: 0.600 },
  'gpt-4': { name: 'GPT-4 (OpenAI)', inputPrice: 30.00, outputPrice: 60.00 },
  'o1-preview': { name: 'o1-preview (OpenAI)', inputPrice: 15.00, outputPrice: 60.00 },
  'claude-3-5-sonnet': { name: 'Claude 3.5 Sonnet (Anthropic)', inputPrice: 3.00, outputPrice: 15.00 },
  'claude-3-haiku': { name: 'Claude 3 Haiku (Anthropic)', inputPrice: 0.25, outputPrice: 1.25 },
  'gemini-1-5-pro': { name: 'Gemini 1.5 Pro (Google)', inputPrice: 3.50, outputPrice: 10.50 },
  'gemini-1-5-flash': { name: 'Gemini 1.5 Flash (Google)', inputPrice: 0.35, outputPrice: 1.05 }
};

export function getAIModels() {
  const defaults = { ...AI_MODELS };
  try {
    const custom = JSON.parse(localStorage.getItem('tmpt_custom_llm_models') || '{}');
    return { ...defaults, ...custom };
  } catch (e) {
    return defaults;
  }
}

export function calculateLLMCost(modelKey, inputTokens, outputTokens, monthlyVolume = 1) {
  const models = getAIModels();
  const model = models[modelKey];
  if (!model) return null;

  const costPerInputToken = model.inputPrice / 1000000;
  const costPerOutputToken = model.outputPrice / 1000000;

  const singleInputCost = inputTokens * costPerInputToken;
  const singleOutputCost = outputTokens * costPerOutputToken;
  const singleTotalCost = singleInputCost + singleOutputCost;

  return {
    singleCost: singleTotalCost,
    monthlyCost: singleTotalCost * monthlyVolume,
    annualCost: singleTotalCost * monthlyVolume * 12,
    inputCost: singleInputCost,
    outputCost: singleOutputCost
  };
}

export function compareLLMProviders(inputTokens, outputTokens, monthlyVolume = 1) {
  const results = [];
  const models = getAIModels();
  Object.keys(models).forEach(key => {
    const cost = calculateLLMCost(key, inputTokens, outputTokens, monthlyVolume);
    if (cost) {
      results.push({
        key,
        name: models[key].name,
        singleCost: cost.singleCost,
        monthlyCost: cost.monthlyCost
      });
    }
  });
  // Sort cheapest to most expensive
  return results.sort((a, b) => a.monthlyCost - b.monthlyCost);
}

export function countTokensApprox(text, lang = 'id') {
  if (!text) return { characters: 0, words: 0, tokens: 0 };
  
  const chars = text.length;
  const words = text.trim().split(/\s+/).filter(w => w.length > 0).length;
  
  // Approximate conversion:
  // English: ~4 chars per token
  // Indonesian / CJK: ~2.5 chars per token
  const charsPerToken = lang === 'en' ? 4 : 2.5;
  const tokens = Math.max(1, Math.ceil(chars / charsPerToken));

  return {
    characters: chars,
    words,
    tokens
  };
}
