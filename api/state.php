<?php
/* =====================================================================
   /api/state.php
   This is the endpoint the frontend (js/app.js → loadAll()/persistAll())
   actually talks to. Same contract as the original Node/Express app:

   GET  → returns { programs, students, payments, expenses, settings, trash }
   PUT  → replaces ALL of it in one call (used every time the app saves)

   The per-entity endpoints (programs.php, students.php, payments.php,
   expenses.php, settings.php, trash.php) are the "real" granular REST
   API for any other client. Both layers read/write the same tables.
   ===================================================================== */

require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/helpers.php';

$pdo = db();
$method = $_SERVER['REQUEST_METHOD'];

function replace_table(PDO $pdo, string $table, array $rows, array $columns): void
{
    $pdo->exec("DELETE FROM `$table`");
    if (empty($rows)) return;

    $placeholders = ':' . implode(', :', $columns);
    $colList = implode(', ', array_map(fn($c) => "`$c`", $columns));
    $stmt = $pdo->prepare("INSERT INTO `$table` ($colList) VALUES ($placeholders)");

    foreach ($rows as $row) {
        $values = [];
        foreach ($columns as $c) {
            $values[$c] = $row[$c] ?? null;
        }
        $stmt->execute($values);
    }
}

switch ($method) {

    case 'GET':
        json_out([
            'programs' => $pdo->query('SELECT * FROM programs ORDER BY category, name')->fetchAll(),
            'students' => $pdo->query('SELECT * FROM students ORDER BY name')->fetchAll(),
            'payments' => $pdo->query('SELECT * FROM payments ORDER BY date DESC')->fetchAll(),
            'expenses' => $pdo->query('SELECT * FROM expenses ORDER BY date DESC')->fetchAll(),
            'settings' => settings_get(),
            'trash' => trash_get(),
        ]);
        break;

    case 'PUT':
        $body = request_body();

        try {
            $pdo->beginTransaction();
            $pdo->exec('SET FOREIGN_KEY_CHECKS=0');

            replace_table($pdo, 'programs', $body['programs'] ?? [], ['id', 'category', 'name', 'fee', 'admissionFee']);
            replace_table($pdo, 'students', $body['students'] ?? [], [
                'id', 'studentCode', 'name', 'father', 'contact', 'photo',
                'programId', 'admissionDate', 'monthlyFee', 'discount', 'discountReason', 'admissionFee',
            ]);
            replace_table($pdo, 'payments', $body['payments'] ?? [], [
                'id', 'receiptNo', 'studentId', 'date', 'amount', 'purpose', 'mode', 'note',
            ]);
            replace_table($pdo, 'expenses', $body['expenses'] ?? [], ['id', 'date', 'amount', 'category', 'note']);

            settings_set($body['settings'] ?? []);
            trash_set($body['trash'] ?? []);

            $pdo->exec('SET FOREIGN_KEY_CHECKS=1');
            $pdo->commit();
        } catch (Throwable $e) {
            $pdo->rollBack();
            json_error('Could not save state: ' . $e->getMessage(), 500);
        }

        json_out(['ok' => true]);
        break;

    default:
        json_error('Method not allowed', 405);
}
