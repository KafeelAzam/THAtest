<?php
/* =====================================================================
   /api/programs.php
   GET    api/programs.php            → list all programs
   GET    api/programs.php?id=9-sci   → one program
   POST   api/programs.php            → create
   PUT    api/programs.php?id=9-sci   → update
   DELETE api/programs.php?id=9-sci   → delete
   ===================================================================== */

require_once __DIR__ . '/bootstrap.php';

$pdo = db();
$method = $_SERVER['REQUEST_METHOD'];
$id = $_GET['id'] ?? null;
$columns = ['id', 'category', 'name', 'fee', 'admissionFee'];

switch ($method) {

    case 'GET':
        if ($id) {
            $stmt = $pdo->prepare('SELECT * FROM programs WHERE id = ?');
            $stmt->execute([$id]);
            $row = $stmt->fetch();
            if (!$row) json_error('Program not found', 404);
            json_out($row);
        } else {
            $rows = $pdo->query('SELECT * FROM programs ORDER BY category, name')->fetchAll();
            json_out($rows);
        }
        break;

    case 'POST':
        $body = request_body();
        if (empty($body['id']) || empty($body['name'])) {
            json_error('id and name are required');
        }
        $data = pick($body, $columns);
        $stmt = $pdo->prepare(
            'INSERT INTO programs (id, category, name, fee, admissionFee) VALUES (:id, :category, :name, :fee, :admissionFee)'
        );
        try {
            $stmt->execute($data);
        } catch (PDOException $e) {
            json_error('Could not create program (id may already exist): ' . $e->getMessage(), 409);
        }
        json_out($data, 201);
        break;

    case 'PUT':
    case 'PATCH':
        if (!$id) json_error('id is required in the query string, e.g. ?id=9-sci');
        $body = request_body();
        $existing = $pdo->prepare('SELECT * FROM programs WHERE id = ?');
        $existing->execute([$id]);
        $current = $existing->fetch();
        if (!$current) json_error('Program not found', 404);

        $merged = array_merge($current, pick($body, ['category', 'name', 'fee', 'admissionFee']));
        $stmt = $pdo->prepare(
            'UPDATE programs SET category=:category, name=:name, fee=:fee, admissionFee=:admissionFee WHERE id=:id'
        );
        $stmt->execute([
            'category' => $merged['category'], 'name' => $merged['name'],
            'fee' => $merged['fee'], 'admissionFee' => $merged['admissionFee'], 'id' => $id,
        ]);
        json_out($merged);
        break;

    case 'DELETE':
        if (!$id) json_error('id is required in the query string, e.g. ?id=9-sci');
        $stmt = $pdo->prepare('DELETE FROM programs WHERE id = ?');
        $stmt->execute([$id]);
        json_out(null, 204);
        break;

    default:
        json_error('Method not allowed', 405);
}
