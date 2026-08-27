<?php
/* =====================================================================
   THE HORIZON ACADEMY — FEES MANAGEMENT SYSTEM
   Plain PHP + PDO + MySQL database connection
   ===================================================================== */

// ---- Edit these to match your XAMPP / MySQL setup ----
define('DB_HOST', '127.0.0.1');
define('DB_PORT', '3306');
define('DB_NAME', 'horizon_academy');
define('DB_USER', 'root');
define('DB_PASS', '');   // XAMPP's default MySQL root user has no password
// --------------------------------------------------------

function db(): PDO
{
    static $pdo = null;
    if ($pdo === null) {
        $dsn = 'mysql:host=' . DB_HOST . ';port=' . DB_PORT . ';dbname=' . DB_NAME . ';charset=utf8mb4';
        try {
            $pdo = new PDO($dsn, DB_USER, DB_PASS, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
            ]);
        } catch (PDOException $e) {
            http_response_code(500);
            header('Content-Type: application/json');
            echo json_encode([
                'error' => 'Database connection failed: ' . $e->getMessage(),
                'hint' => 'Check DB_HOST/DB_NAME/DB_USER/DB_PASS in api/config/database.php, '
                        . 'and make sure the "horizon_academy" database exists (import database/schema.sql).',
            ]);
            exit;
        }
    }
    return $pdo;
}
