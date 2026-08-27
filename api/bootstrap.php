<?php
/* =====================================================================
   Shared bootstrap included by every api/*.php endpoint:
   - CORS headers (so the frontend can call this even from another
     origin/port if you ever split them up)
   - reads + decodes the JSON request body for POST/PUT
   - small helpers for sending JSON responses
   ===================================================================== */

require_once __DIR__ . '/config/database.php';

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

/** Decode the JSON request body into an associative array. */
function request_body(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === '' || $raw === false) return [];
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

/** Send a JSON response and stop. */
function json_out($data, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($data);
    exit;
}

/** Send a JSON error and stop. */
function json_error(string $message, int $status = 400): void
{
    json_out(['error' => $message], $status);
}

/** Pull a single value out of an array of allowed columns, defaulting to null. */
function pick(array $src, array $columns): array
{
    $out = [];
    foreach ($columns as $c) {
        $out[$c] = array_key_exists($c, $src) ? $src[$c] : null;
    }
    return $out;
}

/** Generate a random id, same shape as the frontend's own uid(). */
function new_id(): string
{
    return 'id_' . bin2hex(random_bytes(6)) . dechex(time());
}
