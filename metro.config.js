const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// `.cjs` is needed by some Supabase/ws transitive deps.
config.resolver.sourceExts.push('cjs');

module.exports = config;
