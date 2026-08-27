<?php
/* =====================================================================
   /api/expenses.php
   GET    api/expenses.php                → list all (optional ?from=&to=&category=)
   GET    api/expenses.php?id=xxx          → one expense
   POST   api/expenses.php                 → create
   PUT    api/expenses.php?id=xxx           → update
   DELETE api/expenses.php?id=xxx           → delete
   ===================================================================== */

require_once __DIR__ . '/bootstrap.php';

$pdo = db();
$method = $_SERVER['REQUEST_METHOD'];
$id = $_GET['id'] ?? null;
$columns = ['id', 'date', 'amount', 'category', 'note'];

switch ($method) {

    case 'GET':
        if ($id) {
            $stmt = $pdo->prepare('SELECT * FROM expenses WHERE id = ?');
            $stmt->execute([$id]);
            $row = $stmt->fetch();
            if (!$row) json_error('Expense not found', 404);
            json_out($row);
        } else {
            $sql = 'SELECT * FROM expenses WHERE 1=1';
            $params = [];
            if (!empty($_GET['from']))     { $sql .= ' AND date >= :from';     $params['from'] = $_GET['from']; }
            if (!empty($_GET['to']))       { $sql .= ' AND date <= :to';       $params['to'] = $_GET['to']; }
            if (!empty($_GET['category'])) { $sql .= ' AND category = :cat';   $params['cat'] = $_GET['category']; }
            $sql .= ' ORDER BY date DESC';
            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
            json_out($stmt->fetchAll());
        }
        break;

    case 'POST':
        $body = request_body();
        if (!isset($body['amount'])) json_error('amount is required');
        $data = pick($body, $columns);
        $data['id'] = $data['id'] ?: new_id();

        $stmt = $pdo->prepare(
            'INSERT INTO expenses (id, date, amount, category, note) VALUES (:id, :date, :amount, :category, :note)'
        );
        try {
            $stmt->execute($data);
        } catch (PDOException $e) {
            json_error('Could not create expense: ' . $e->getMessage(), 409);
        }
        json_out($data, 201);
        break;

    case 'PUT':
    case 'PATCH':
        if (!$id) json_error('id is required in the query string, e.g. ?id=xxx');
        $body = request_body();
        $existing = $pdo->prepare('SELECT * FROM expenses WHERE id = ?');
        $existing->execute([$id]);
        $current = $existing->fetch();
        if (!$current) json_error('Expense not found', 404);

        $updatable = array_diff($columns, ['id']);
        $merged = array_merge($current, pick($body, $updatable));
        $merged['id'] = $id;

        $stmt = $pdo->prepare(
            'UPDATE expenses SET date=:date, amount=:amount, category=:category, note=:note WHERE id=:id'
        );
        $stmt->execute($merged);
        json_out($merged);
        break;

    case 'DELETE':
        if (!$id) json_error('id is required in the query string, e.g. ?id=xxx');
        $stmt = $pdo->prepare('DELETE FROM expenses WHERE id = ?');
        $stmt->execute([$id]);
        json_out(null, 204);
        break;

    default:
        json_error('Method not allowed', 405);
}
