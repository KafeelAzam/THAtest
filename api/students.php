<?php
/* =====================================================================
   /api/students.php
   GET    api/students.php                     → list all (optional ?programId=&q=)
   GET    api/students.php?id=xxx               → one student
   POST   api/students.php                      → create
   PUT    api/students.php?id=xxx                → update
   DELETE api/students.php?id=xxx                → delete
   ===================================================================== */

require_once __DIR__ . '/bootstrap.php';

$pdo = db();
$method = $_SERVER['REQUEST_METHOD'];
$id = $_GET['id'] ?? null;
$columns = [
    'id', 'studentCode', 'name', 'father', 'contact', 'photo',
    'programId', 'admissionDate', 'monthlyFee', 'discount', 'discountReason', 'admissionFee',
];

switch ($method) {

    case 'GET':
        if ($id) {
            $stmt = $pdo->prepare('SELECT * FROM students WHERE id = ?');
            $stmt->execute([$id]);
            $row = $stmt->fetch();
            if (!$row) json_error('Student not found', 404);
            json_out($row);
        } else {
            $sql = 'SELECT * FROM students WHERE 1=1';
            $params = [];
            if (!empty($_GET['programId'])) {
                $sql .= ' AND programId = :programId';
                $params['programId'] = $_GET['programId'];
            }
            if (!empty($_GET['q'])) {
                $sql .= ' AND (name LIKE :q OR studentCode LIKE :q OR father LIKE :q OR contact LIKE :q)';
                $params['q'] = '%' . $_GET['q'] . '%';
            }
            $sql .= ' ORDER BY name';
            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
            json_out($stmt->fetchAll());
        }
        break;

    case 'POST':
        $body = request_body();
        if (empty($body['name'])) json_error('name is required');
        $data = pick($body, $columns);
        $data['id'] = $data['id'] ?: new_id();
        $data['monthlyFee'] = $data['monthlyFee'] ?? 0;
        $data['discount'] = $data['discount'] ?? 0;
        $data['admissionFee'] = $data['admissionFee'] ?? 0;

        $stmt = $pdo->prepare(
            'INSERT INTO students (id, studentCode, name, father, contact, photo, programId, admissionDate, monthlyFee, discount, discountReason, admissionFee)
             VALUES (:id, :studentCode, :name, :father, :contact, :photo, :programId, :admissionDate, :monthlyFee, :discount, :discountReason, :admissionFee)'
        );
        try {
            $stmt->execute($data);
        } catch (PDOException $e) {
            json_error('Could not create student: ' . $e->getMessage(), 409);
        }
        json_out($data, 201);
        break;

    case 'PUT':
    case 'PATCH':
        if (!$id) json_error('id is required in the query string, e.g. ?id=xxx');
        $body = request_body();
        $existing = $pdo->prepare('SELECT * FROM students WHERE id = ?');
        $existing->execute([$id]);
        $current = $existing->fetch();
        if (!$current) json_error('Student not found', 404);

        $updatable = array_diff($columns, ['id']);
        $merged = array_merge($current, pick($body, $updatable));

        $stmt = $pdo->prepare(
            'UPDATE students SET studentCode=:studentCode, name=:name, father=:father, contact=:contact, photo=:photo,
             programId=:programId, admissionDate=:admissionDate, monthlyFee=:monthlyFee, discount=:discount,
             discountReason=:discountReason, admissionFee=:admissionFee WHERE id=:id'
        );
        $merged['id'] = $id;
        $stmt->execute($merged);
        json_out($merged);
        break;

    case 'DELETE':
        if (!$id) json_error('id is required in the query string, e.g. ?id=xxx');
        $stmt = $pdo->prepare('DELETE FROM students WHERE id = ?');
        $stmt->execute([$id]);
        json_out(null, 204);
        break;

    default:
        json_error('Method not allowed', 405);
}
