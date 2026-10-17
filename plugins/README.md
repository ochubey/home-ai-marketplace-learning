# plugins/

Each plugin lives in its own folder `plugins/<name>/`, where `<name>` matches the plugin name in
`.claude-plugin/marketplace.json` and in the plugin's own `.claude-plugin/plugin.json`.

This directory is intentionally empty of plugins for now. A folder here without a catalog entry
fails validation.
