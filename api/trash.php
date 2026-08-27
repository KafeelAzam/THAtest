<?php
/* =====================================================================
   /api/trash.php
   GET api/trash.php   → current trash bins ({students, payments, expenses})
   PUT api/trash.php   → replace trash bins
   ===================================================================== */

require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/helpers.php';

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        json_out(trash_get());
        break;

    case 'PUT':
    case 'PATCH':
        $body = request_body();
        trash_set($body);
        json_out(trash_get());
        break;

    default:
        json_error('Method not allowed', 405);
}
