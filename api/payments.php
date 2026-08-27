<?php
/* =====================================================================
   /api/payments.php
   GET    api/payments.php                → list all (optional ?studentId=&from=&to=)
   GET    api/payments.php?id=xxx          → one payment
   POST   api/payments.php                 → create (auto-assigns receiptNo)
   PUT    api/payments.php?id=xxx           → update
   DELETE api/payments.php?id=xxx           → delete
   ===================================================================== */

require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/helpers.php'; // settings_get()/settings_set()

$pdo = db();
$method = $_SERVER['REQUEST_METHOD'];
$id = $_GET['id'] ?? null;
$columns = ['id', 'receiptNo', 'studentId', 'date', 'amount', 'purpose', 'mode', 'note'];

switch ($method) {

    case 'GET':
        if ($id) {
            $stmt = $pdo->prepare('SELECT * FROM payments WHERE id = ?');
            $stmt->execute([$id]);
            $row = $stmt->fetch();
            if (!$row) json_error('Payment not found', 404);
            json_out($row);
        } else {
            $sql = 'SELECT * FROM payments WHERE 1=1';
            $params = [];
            if (!empty($_GET['studentId'])) { $sql .= ' AND studentId = :studentId'; $params['studentId'] = $_GET['studentId']; }
            if (!empty($_GET['from']))      { $sql .= ' AND date >= :from';         $params['from'] = $_GET['from']; }
            if (!empty($_GET['to']))        { $sql .= ' AND date <= :to';           $params['to'] = $_GET['to']; }
            $sql .= ' ORDER BY date DESC';
            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
            json_out($stmt->fetchAll());
        }
        break;

    case 'POST':
        $body = request_body();
        if (empty($body['studentId']) || !isset($body['amount'])) {
            json_error('studentId and amount are required');
        }
        $data = pick($body, $columns);
        $data['id'] = $data['id'] ?: new_id();

        // Auto-assign the next receipt number from settings (server-side,
        // so concurrent requests from different devices can't collide).
        $settings = settings_get();
        $data['receiptNo'] = $settings['receiptSeq'] ?? 1000;
        $settings['receiptSeq'] = $data['receiptNo'] + 1;
        settings_set($settings);

        $stmt = $pdo->prepare(
            'INSERT INTO payments (id, receiptNo, studentId, date, amount, purpose, mode, note)
             VALUES (:id, :receiptNo, :studentId, :date, :amount, :purpose, :mode, :note)'
        );
        try {
            $stmt->execute($data);
        } catch (PDOException $e) {
            json_error('Could not create payment: ' . $e->getMessage(), 409);
        }
        json_out($data, 201);
        break;

    case 'PUT':
    case 'PATCH':
        if (!$id) json_error('id is required in the query string, e.g. ?id=xxx');
        $body = request_body();
        $existing = $pdo->prepare('SELECT * FROM payments WHERE id = ?');
        $existing->execute([$id]);
        $current = $existing->fetch();
        if (!$current) json_error('Payment not found', 404);

        $updatable = array_diff($columns, ['id']);
        $merged = array_merge($current, pick($body, $updatable));
        $merged['id'] = $id;

        $stmt = $pdo->prepare(
            'UPDATE payments SET receiptNo=:receiptNo, studentId=:studentId, date=:date, amount=:amount,
             purpose=:purpose, mode=:mode, note=:note WHERE id=:id'
        );
        $stmt->execute($merged);
        json_out($merged);
        break;

    case 'DELETE':
        if (!$id) json_error('id is required in the query string, e.g. ?id=xxx');
        $stmt = $pdo->prepare('DELETE FROM payments WHERE id = ?');
        $stmt->execute([$id]);
        json_out(null, 204);
        break;

    default:
        json_error('Method not allowed', 405);
}
