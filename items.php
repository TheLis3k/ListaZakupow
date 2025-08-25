<?php
require_once 'config.php';

// Check authentication
if (!isLoggedIn()) {
    sendJsonResponse(['error' => 'Authentication required'], 401);
    exit;
}

$userId = getCurrentUserId();
$db = getDB();

// Get request method
$method = $_SERVER['REQUEST_METHOD'];

try {
    switch ($method) {
        case 'GET':
            // Get all items for the user
            $stmt = $db->prepare('
                SELECT id, text, quantity, unit, description, completed, added_at, completed_at, updated_at 
                FROM shopping_items 
                WHERE user_id = :user_id 
                ORDER BY completed, added_at DESC
            ');
            $stmt->bindValue(':user_id', $userId, PDO::PARAM_INT);
            $stmt->execute();
            
            $items = $stmt->fetchAll();
            
            // Convert completed to boolean
            foreach ($items as &$item) {
                $item['completed'] = (bool)$item['completed'];
            }
            
            sendJsonResponse($items);
            break;
            
        case 'POST':
            // Add new item
            $data = json_decode(file_get_contents('php://input'), true);
            
            if (json_last_error() !== JSON_ERROR_NONE) {
                sendJsonResponse(['error' => 'Invalid JSON data'], 400);
                break;
            }
            
            $text = trim($data['text'] ?? '');
            $quantity = intval($data['quantity'] ?? 1);
            $unit = $data['unit'] ?? 'szt';
            $description = trim($data['description'] ?? '');
            $completed = boolval($data['completed'] ?? false);
            
            if (empty($text)) {
                sendJsonResponse(['error' => 'Item text is required'], 400);
                break;
            }
            
            if ($quantity < 1) {
                sendJsonResponse(['error' => 'Quantity must be at least 1'], 400);
                break;
            }
            
            $stmt = $db->prepare('
                INSERT INTO shopping_items (user_id, text, quantity, unit, description, completed, added_at)
                VALUES (:user_id, :text, :quantity, :unit, :description, :completed, NOW())
            ');
            
            $stmt->bindValue(':user_id', $userId, PDO::PARAM_INT);
            $stmt->bindValue(':text', $text, PDO::PARAM_STR);
            $stmt->bindValue(':quantity', $quantity, PDO::PARAM_INT);
            $stmt->bindValue(':unit', $unit, PDO::PARAM_STR);
            $stmt->bindValue(':description', $description, PDO::PARAM_STR);
            $stmt->bindValue(':completed', $completed, PDO::PARAM_BOOL);
            
            $stmt->execute();
            
            $itemId = $db->lastInsertId();
            
            // Get the newly created item
            $stmt = $db->prepare('
                SELECT id, text, quantity, unit, description, completed, added_at, completed_at, updated_at 
                FROM shopping_items 
                WHERE id = :id
            ');
            $stmt->bindValue(':id', $itemId, PDO::PARAM_INT);
            $stmt->execute();
            
            $item = $stmt->fetch();
            $item['completed'] = (bool)$item['completed'];
            
            sendJsonResponse($item, 201);
            break;
            
        case 'PUT':
            // Update existing item
            $itemId = $_GET['id'] ?? null;
            
            if (!$itemId || !is_numeric($itemId)) {
                sendJsonResponse(['error' => 'Valid item ID is required'], 400);
                break;
            }
            
            $data = json_decode(file_get_contents('php://input'), true);
            
            if (json_last_error() !== JSON_ERROR_NONE) {
                sendJsonResponse(['error' => 'Invalid JSON data'], 400);
                break;
            }
            
            // Check if item belongs to user
            $stmt = $db->prepare('SELECT id FROM shopping_items WHERE id = :id AND user_id = :user_id');
            $stmt->bindValue(':id', $itemId, PDO::PARAM_INT);
            $stmt->bindValue(':user_id', $userId, PDO::PARAM_INT);
            $stmt->execute();
            
            if (!$stmt->fetch()) {
                sendJsonResponse(['error' => 'Item not found'], 404);
                break;
            }
            
            // Build update query dynamically based on provided fields
            $updates = [];
            $params = [':id' => $itemId];
            
            if (isset($data['text'])) {
                $text = trim($data['text']);
                if (empty($text)) {
                    sendJsonResponse(['error' => 'Item text cannot be empty'], 400);
                    break;
                }
                $updates[] = 'text = :text';
                $params[':text'] = $text;
            }
            
            if (isset($data['quantity'])) {
                $quantity = intval($data['quantity']);
                if ($quantity < 1) {
                    sendJsonResponse(['error' => 'Quantity must be at least 1'], 400);
                    break;
                }
                $updates[] = 'quantity = :quantity';
                $params[':quantity'] = $quantity;
            }
            
            if (isset($data['unit'])) {
                $updates[] = 'unit = :unit';
                $params[':unit'] = $data['unit'];
            }
            
            if (isset($data['description'])) {
                $updates[] = 'description = :description';
                $params[':description'] = trim($data['description']);
            }
            
            if (isset($data['completed'])) {
                $updates[] = 'completed = :completed';
                $params[':completed'] = boolval($data['completed']);
                
                if ($data['completed']) {
                    $updates[] = 'completed_at = NOW()';
                } else {
                    $updates[] = 'completed_at = NULL';
                }
            }
            
            if (empty($updates)) {
                sendJsonResponse(['error' => 'No fields to update'], 400);
                break;
            }
            
            $updates[] = 'updated_at = NOW()';
            
            $query = 'UPDATE shopping_items SET ' . implode(', ', $updates) . ' WHERE id = :id';
            $stmt = $db->prepare($query);
            
            foreach ($params as $key => $value) {
                $paramType = is_int($value) ? PDO::PARAM_INT : PDO::PARAM_STR;
                $stmt->bindValue($key, $value, $paramType);
            }
            
            $stmt->execute();
            
            sendJsonResponse(['message' => 'Item updated successfully']);
            break;
            
        case 'DELETE':
            // Delete item or perform bulk operations
            $itemId = $_GET['id'] ?? null;
            $action = $_GET['action'] ?? null;
            
            if ($itemId) {
                // Delete single item
                $stmt = $db->prepare('DELETE FROM shopping_items WHERE id = :id AND user_id = :user_id');
                $stmt->bindValue(':id', $itemId, PDO::PARAM_INT);
                $stmt->bindValue(':user_id', $userId, PDO::PARAM_INT);
                $stmt->execute();
                
                if ($stmt->rowCount() === 0) {
                    sendJsonResponse(['error' => 'Item not found'], 404);
                    break;
                }
                
                sendJsonResponse(['message' => 'Item deleted successfully']);
            } elseif ($action === 'remove_checked') {
                // Remove all checked items
                $stmt = $db->prepare('DELETE FROM shopping_items WHERE user_id = :user_id AND completed = 1');
                $stmt->bindValue(':user_id', $userId, PDO::PARAM_INT);
                $stmt->execute();
                
                $deletedCount = $stmt->rowCount();
                
                sendJsonResponse(['message' => "{$deletedCount} items deleted successfully"]);
            } elseif ($action === 'clear') {
                // Clear entire list
                $stmt = $db->prepare('DELETE FROM shopping_items WHERE user_id = :user_id');
                $stmt->bindValue(':user_id', $userId, PDO::PARAM_INT);
                $stmt->execute();
                
                $deletedCount = $stmt->rowCount();
                
                sendJsonResponse(['message' => "{$deletedCount} items deleted successfully"]);
            } else {
                sendJsonResponse(['error' => 'Invalid delete action'], 400);
            }
            break;
            
        default:
            sendJsonResponse(['error' => 'Method not allowed'], 405);
            break;
    }
} catch (PDOException $e) {
    error_log("Database error: " . $e->getMessage());
    sendJsonResponse(['error' => 'Database error occurred'], 500);
} catch (Exception $e) {
    error_log("General error: " . $e->getMessage());
    sendJsonResponse(['error' => 'An error occurred'], 500);
}
?>