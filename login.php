<?php
require_once 'config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendJsonResponse(['error' => 'Invalid request method'], 405);
}

// Get input data
$data = json_decode(file_get_contents('php://input'), true);
$username = trim($data['username'] ?? '');
$password = $data['password'] ?? '';

// Validate input
if (empty($username) || empty($password)) {
    sendJsonResponse(['error' => 'Username and password are required'], 400);
}

try {
    $db = getDB();
    
    // Get user from database
    $stmt = $db->prepare('SELECT id, username, password FROM users WHERE username = :username');
    $stmt->bindValue(':username', $username, PDO::PARAM_STR);
    $stmt->execute();
    
    $user = $stmt->fetch();
    
    if (!$user || !password_verify($password, $user['password'])) {
        sendJsonResponse(['error' => 'Invalid username or password'], 401);
    }
    
    // Set session variables
    $_SESSION['user_id'] = $user['id'];
    $_SESSION['username'] = $user['username'];
    
    sendJsonResponse([
        'message' => 'Login successful',
        'user_id' => $user['id'],
        'username' => $user['username']
    ]);
} catch (PDOException $e) {
    sendJsonResponse(['error' => 'Database error: ' . $e->getMessage()], 500);
}
?>