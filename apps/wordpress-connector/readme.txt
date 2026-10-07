=== AgentMate Connector ===
Contributors: agentmate
Tags: deploy, development, sync, themes, plugins
Requires at least: 6.0
Tested up to: 7.1
Requires PHP: 7.4
Stable tag: 1.54.0
License: GPL-2.0-or-later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Lets the AgentMate desktop app pull and deploy this site's theme and plugin files over a signed connection.

== Description ==

AgentMate Connector pairs this site with the AgentMate app on your computer. AgentMate can then copy your themes, plugins and mu-plugins into a local project, and (with a write key) deploy changes back.

* Every request is signed with a key made for one computer, and every reply is signed by the site.
* Keys are made in Tools > AgentMate Connector (Network Admin > Settings on multisite) or with `wp agentmate key create`. A key works once, for 15 minutes.
* Read-only keys can never change anything. Write keys need an admin who can install plugins and themes.
* Only theme, plugin and mu-plugin folders are touched. Uploads, the database, WordPress core and wp-config.php are never read or written.
* Agent and AgentMate files (.claude, .agents, AGENTS.md, CLAUDE.md, .mcp.json, .agentmate and more), secrets and version control folders are refused, whatever the app asks for.

== Switches for wp-config.php ==

* `define( 'AGENTMATE_CONNECTOR_DISABLED', true );` turns the connector off.
* `define( 'AGENTMATE_CONNECTOR_READ_ONLY', true );` allows reading only, for every key.
* `define( 'AGENTMATE_CONNECTOR_DATA_DIR', '/path/outside/the/web/root' );` moves the private data folder.
* `DISALLOW_FILE_MODS` is honoured: with it set, nothing can be deployed.

== Removing it ==

Deactivating the connector first rolls back any deploy still waiting to be confirmed, then removes its guard from mu-plugins. Deleting it from the Plugins screen (or `wp plugin uninstall agentmate-connector`) also drops its tables, settings and private data folder. Your themes and plugins are never touched.

`wp plugin delete` only removes the plugin's files and skips that clean-up, so use `wp plugin uninstall` from the command line.

== Changelog ==

= 1.0.0 =
* First release.
