<?php
// Loads the WordPress plugin outside WordPress, with just enough stubbed
// to call its URL builder, and prints the URL for the JSON input on stdin.
define('ABSPATH', __DIR__);
function add_action() {}
function add_filter() {}
function plugin_basename($f) { return basename($f); }
require __DIR__ . '/../../wordpress-plugin/ogsmith/ogsmith.php';
$in = json_decode(stream_get_contents(STDIN), true);
echo ogsmith_card_url($in['params'], $in['settings']);
