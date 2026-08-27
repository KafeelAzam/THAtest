<?php
/* Shared helpers for reading/writing the `settings` JSON blob.
   Used by both api/settings.php (the REST endpoint) and api/payments.php
   (which needs to read+bump receiptSeq when creating a payment). */

require_once __DIR__ . '/bootstrap.php';

const SETTINGS_DEFAULTS = [
    'receiptSeq' => 1000,
    'studentSeq' => 1,
    'pinEnabled' => false,
    'pinHash' => null,
    'dueDay' => 10,
    'lateFeePerDay' => 0,
    'lateFeeCap' => 0,
    'centreAddress' => '',
    'centrePhone' => '',
    'receiptFooterNote' => 'Thank you. Please keep this receipt for your records.',
];

function kv_get(string $key, $fallback = null)
{
    $stmt = db()->prepare('SELECT v FROM key_value_store WHERE k = ?');
    $stmt->execute([$key]);
    $row = $stmt->fetch();
    if (!$row || $row['v'] === null) return $fallback;
    $decoded = json_decode($row['v'], true);
    return json_last_error() === JSON_ERROR_NONE ? $decoded : $fallback;
}

function kv_set(string $key, $value): void
{
    $stmt = db()->prepare(
        'INSERT INTO key_value_store (k, v) VALUES (:k, :v)
         ON DUPLICATE KEY UPDATE v = VALUES(v)'
    );
    $stmt->execute(['k' => $key, 'v' => json_encode($value)]);
}

function settings_get(): array
{
    return array_merge(SETTINGS_DEFAULTS, kv_get('settings', []));
}

function settings_set(array $settings): void
{
    kv_set('settings', $settings);
}

const TRASH_DEFAULTS = ['students' => [], 'payments' => [], 'expenses' => []];

function trash_get(): array
{
    return array_merge(TRASH_DEFAULTS, kv_get('trash', []));
}

function trash_set(array $trash): void
{
    kv_set('trash', array_merge(TRASH_DEFAULTS, $trash));
}
