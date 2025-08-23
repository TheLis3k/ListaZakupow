<?php
require_once 'config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendJsonResponse(['error' => 'Invalid request method'], 405);
}

// Get input data
$data = json_decode(file_get_contents('php://input'), true);
if (json_last_error() !== JSON_ERROR_NONE) {
    sendJsonResponse(['error' => 'Invalid JSON input'], 400);
}

$username = trim($data['username'] ?? '');
$password = $data['password'] ?? '';

// Validate input
if (empty($username) || empty($password)) {
    sendJsonResponse(['error' => 'Username and password are required'], 400);
}

if (strlen($password) < 8) {
    sendJsonResponse(['error' => 'Password must be at least 8 characters long'], 400);
}

try {
    $db = getDB();
    
    // Check if username already exists
    $stmt = $db->prepare('SELECT id FROM users WHERE username = :username');
    $stmt->bindValue(':username', $username, PDO::PARAM_STR);
    $stmt->execute();
    
    if ($stmt->fetch()) {
        sendJsonResponse(['error' => 'Username already exists'], 409);
    }
    
    // Hash password
    $hashedPassword = password_hash($password, PASSWORD_DEFAULT);
    
    // Insert new user
    $stmt = $db->prepare('INSERT INTO users (username, password, created_at) VALUES (:username, :password, NOW())');
    $stmt->bindValue(':username', $username, PDO::PARAM_STR);
    $stmt->bindValue(':password', $hashedPassword, PDO::PARAM_STR);
    $stmt->execute();
    
    $userId = $db->lastInsertId();
    
    // Automatically log in the user
    $_SESSION['user_id'] = $userId;
    $_SESSION['username'] = $username;
    
    sendJsonResponse([
        'message' => 'User registered successfully',
        'user_id' => $userId,
        'username' => $username
    ]);
} catch (PDOException $e) {
    // Log the error instead of showing it to the user
    error_log("Database error: " . $e->getMessage());
    sendJsonResponse(['error' => 'Database error occurred'], 500);
} catch (Exception $e) {
    error_log("General error: " . $e->getMessage());
    sendJsonResponse(['error' => 'An error occurred'], 500);
}
?>