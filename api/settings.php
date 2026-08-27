<?php
/* =====================================================================
   /api/settings.php
   GET api/settings.php   → current settings (merged with defaults)
   PUT api/settings.php   → update settings (partial merge)
   ===================================================================== */

require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/helpers.php';

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        json_out(settings_get());
        break;

    case 'PUT':
    case 'PATCH':
        $body = request_body();
        $merged = array_merge(settings_get(), $body);
        settings_set($merged);
        json_out($merged);
        break;

    default:
        json_error('Method not allowed', 405);
}
