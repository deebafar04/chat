-- =====================================================
-- Model Configuration Seed Data
-- File: 0007_seed_data_model_config.sql
-- Description: Inserts all AI model configurations (Google, OpenAI, Anthropic)
-- =====================================================

-- Google Models
INSERT INTO model_config (model_id, name, description, provider, is_active, is_default, thinking_enabled, input_pricing_per_million_tokens, output_pricing_per_million_tokens, metadata) VALUES
('gemini-2.0-flash', 'Gemini 2.0 Flash', 'Fast, efficient model for most tasks', 'google', true, false, true, 0.0750, 0.3000, '{"contextWindow": 1048576, "maxOutputTokens": 8192}'::jsonb),
('gemini-2.5-flash', 'Gemini 2.5 Flash', 'Enhanced flash model with better performance', 'google', true, true, true, 0.0750, 0.3000, '{"contextWindow": 1048576, "maxOutputTokens": 8192}'::jsonb),
('gemini-2.5-pro', 'Gemini 2.5 Pro', 'Most capable model for complex tasks', 'google', true, false, true, 1.2500, 5.0000, '{"contextWindow": 2097152, "maxOutputTokens": 8192}'::jsonb),
('gemma-3', 'Gemma 3', 'Open source model for basic tasks', 'google', false, false, false, 0.0500, 0.2000, '{"contextWindow": 8192, "maxOutputTokens": 2048}'::jsonb)

ON CONFLICT (model_id) DO NOTHING;

-- OpenAI Models
INSERT INTO model_config (model_id, name, description, provider, is_active, is_default, thinking_enabled, input_pricing_per_million_tokens, output_pricing_per_million_tokens, metadata) VALUES
('gpt-4o', 'GPT-4o', 'Most capable GPT-4 model', 'openai', true, true, true, 2.5000, 10.0000, '{"contextWindow": 128000, "maxOutputTokens": 4096}'::jsonb),
('gpt-4o-mini', 'GPT-4o Mini', 'Faster, more affordable GPT-4', 'openai', true, false, true, 0.1500, 0.6000, '{"contextWindow": 128000, "maxOutputTokens": 4096}'::jsonb),
('gpt-4-turbo', 'GPT-4 Turbo', 'Previous generation GPT-4', 'openai', false, false, false, 10.0000, 30.0000, '{"contextWindow": 128000, "maxOutputTokens": 4096}'::jsonb)

ON CONFLICT (model_id) DO NOTHING;

-- Anthropic Models
INSERT INTO model_config (model_id, name, description, provider, is_active, is_default, thinking_enabled, input_pricing_per_million_tokens, output_pricing_per_million_tokens, metadata) VALUES
('claude-3-5-sonnet-20241022', 'Claude 3.5 Sonnet', 'Most capable Claude model', 'anthropic', true, true, true, 3.0000, 15.0000, '{"contextWindow": 200000, "maxOutputTokens": 8192}'::jsonb),
('claude-3-5-haiku-20241022', 'Claude 3.5 Haiku', 'Fast and efficient Claude model', 'anthropic', true, false, true, 0.2500, 1.2500, '{"contextWindow": 200000, "maxOutputTokens": 8192}'::jsonb),
('claude-3-opus-20240229', 'Claude 3 Opus', 'Previous generation flagship model', 'anthropic', false, false, false, 15.0000, 75.0000, '{"contextWindow": 200000, "maxOutputTokens": 4096}'::jsonb)

ON CONFLICT (model_id) DO NOTHING;
