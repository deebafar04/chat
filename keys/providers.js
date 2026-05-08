/**
 * providers.js — Static provider + model registry (vanilla JS mirror)
 *
 * Canonical source: chat/lib/providers.ts (ES module, used by Next.js app code)
 * This file mirrors that data for no-build static pages that load it via <script>.
 * When adding or changing providers/models, update lib/providers.ts first, then
 * reflect the change here.
 *
 * Also kept in sync with lib/db/migrations/0007_seed_data_model_config.sql
 * and lib/storage/types.ts APIProvider type.
 */

window.KeyManagerProviders = [
  {
    id: 'github',
    name: 'GitHub',
    keyPlaceholder: 'ghp_... or github_pat_...',
    keyHint: 'Personal Access Token (GITHUB_PERSONAL_ACCESS_TOKEN)',
    getKeyUrl: 'https://github.com/settings/tokens',
    tokenOnly: true,
    models: [],
  },
  {
    id: 'google',
    name: 'Google',
    keyPlaceholder: 'AIza...',
    keyHint: 'Google AI Studio key',
    getKeyUrl: 'https://aistudio.google.com/app/apikey',
    models: [
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', description: 'Enhanced flash model with better performance', isDefault: true,  active: true  },
      { id: 'gemini-2.5-pro',   name: 'Gemini 2.5 Pro',   description: 'Most capable model for complex tasks',         isDefault: false, active: true  },
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', description: 'Fast, efficient model for most tasks',         isDefault: false, active: true  },
      { id: 'gemma-3',          name: 'Gemma 3',           description: 'Open source model for basic tasks',           isDefault: false, active: true },
    ],
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    keyPlaceholder: 'sk-ant-...',
    keyHint: 'Anthropic Console key',
    getKeyUrl: 'https://console.anthropic.com/settings/keys',
    models: [
      { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', description: 'Most capable Claude model',        isDefault: true,  active: true  },
      { id: 'claude-3-5-haiku-20241022',  name: 'Claude 3.5 Haiku',  description: 'Fast and efficient Claude model', isDefault: false, active: true  },
      { id: 'claude-3-opus-20240229',     name: 'Claude 3 Opus',     description: 'Previous generation flagship',    isDefault: false, active: false },
    ],
  },
  {
    id: 'openai',
    name: 'OpenAI',
    keyPlaceholder: 'sk-...',
    keyHint: 'OpenAI platform key',
    getKeyUrl: 'https://platform.openai.com/api-keys',
    models: [
      { id: 'gpt-4o',      name: 'GPT-4o',      description: 'Most capable GPT-4 model',       isDefault: true,  active: true  },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: 'Faster, more affordable GPT-4',  isDefault: false, active: true  },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', description: 'Previous generation GPT-4',      isDefault: false, active: false },
    ],
  },
  {
    id: 'xai',
    name: 'xAI',
    keyPlaceholder: 'xai-...',
    keyHint: 'xAI Console key',
    getKeyUrl: 'https://console.x.ai/',
    models: [
      { id: 'grok-3',      name: 'Grok 3',      description: 'Most capable Grok model',  isDefault: true,  active: true },
      { id: 'grok-3-mini', name: 'Grok 3 Mini', description: 'Fast and efficient Grok',  isDefault: false, active: true },
    ],
  },
  {
    id: 'groq',
    name: 'Groq',
    keyPlaceholder: 'gsk_...',
    keyHint: 'Groq Console key',
    getKeyUrl: 'https://console.groq.com/keys',
    models: [
      { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B', description: 'Fast open-source model via Groq', isDefault: true, active: true },
    ],
  },
  {
    id: 'perplexity',
    name: 'Perplexity',
    keyPlaceholder: 'pplx-...',
    keyHint: 'Perplexity API key',
    getKeyUrl: 'https://www.perplexity.ai/settings/api',
    models: [],
  },
  {
    id: 'discord',
    name: 'Discord Bot',
    keyPlaceholder: '',
    keyHint: 'Discord bot token (DISCORD_BOT_TOKEN)',
    getKeyUrl: 'https://discord.com/developers/applications',
    tokenOnly: true,
    models: [],
  },
  {
    id: 'pinecone',
    name: 'Pinecone',
    keyPlaceholder: 'pcsk_...',
    keyHint: 'Vector DB for repository retrieval (PINECONE_API_KEY)',
    getKeyUrl: 'https://app.pinecone.io/organizations/-/keys',
    tokenOnly: true,
    models: [],
  },
  {
    id: 'voyage',
    name: 'Voyage AI',
    keyPlaceholder: 'pa-...',
    keyHint: 'Embedding model for repository retrieval (VOYAGE_API_KEY)',
    getKeyUrl: 'https://dash.voyageai.com/api-keys',
    tokenOnly: true,
    models: [],
  },
];

// CLI providers — shown only on localhost (no API key required)
if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
  window.KeyManagerProviders.push(
    {
      id: 'claude-code-cli',
      name: 'Claude Code CLI',
      keyPlaceholder: '',
      keyHint: 'Local CLI — no API key required',
      getKeyUrl: 'https://claude.ai/download',
      cliOnly: true,
      models: [
        { id: 'claude-code', name: 'Claude Code', description: 'Claude Code CLI running locally', isDefault: true, active: true },
      ],
    },
    {
      id: 'codex-cli',
      name: 'Codex CLI',
      keyPlaceholder: '',
      keyHint: 'Local CLI — no API key required',
      getKeyUrl: 'https://github.com/openai/codex',
      cliOnly: true,
      models: [
        { id: 'codex', name: 'OpenAI Codex', description: 'OpenAI Codex CLI running locally', isDefault: true, active: true },
      ],
    }
  );
}
