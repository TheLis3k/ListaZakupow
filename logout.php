<?php
require_once 'config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendJsonResponse(['error' => 'Invalid request method'], 405);
}

// Destroy session
session_destroy();

sendJsonResponse(['message' => 'Logout successful']);
?>