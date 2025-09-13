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
            $action = $_GET['action'] ?? null;
            $itemId = $_GET['id'] ?? null;

            if ($itemId) {
                // Single item update
                $data = json_decode(file_get_contents('php://input'), true);
                $updates = array_intersect_key($data, array_flip(['text', 'quantity', 'unit', 'description', 'completed']));

                $stmt = $db->prepare('UPDATE shopping_items SET updated_at = NOW(), ' . implode(' = ?, ', array_keys($updates)) . ' = ? WHERE id = ? AND user_id = ?');
                $values = array_values($updates);
                $values[] = $itemId;
                $values[] = $userId;
                $stmt->execute($values);

                if ($stmt->rowCount() === 0) {
                    sendJsonResponse(['error' => 'Item not found'], 404);
                } else {
                    sendJsonResponse(['message' => 'Item updated successfully']);
                }
            } elseif ($action === 'replace') {
            // Handle bulk replace operation
            $data = json_decode(file_get_contents('php://input'), true);
            
            if (json_last_error() !== JSON_ERROR_NONE) {
                sendJsonResponse(['error' => 'Invalid JSON data'], 400);
                break;
            }
            
            $items = $data['items'] ?? [];
            
            // Validate each item before proceeding
            foreach ($items as $item) {
                $text = trim($item['text'] ?? '');
                $quantity = intval($item['quantity'] ?? 1);
                
                if (empty($text)) {
                    sendJsonResponse(['error' => 'Item text is required for all items'], 400);
                    break 2; // Exit the switch
                }
                
                if ($quantity < 1) {
                    sendJsonResponse(['error' => 'Quantity must be at least 1 for all items'], 400);
                    break 2; // Exit the switch
                }
                
                // Optional: Add more checks, e.g., for valid units
                $validUnits = ['szt', 'kg', 'g', 'l', 'ml', 'opak', 'inna'];
                if (!in_array($item['unit'] ?? '', $validUnits)) {
                    sendJsonResponse(['error' => 'Invalid unit for one or more items'], 400);
                    break 2; // Exit the switch
                }
            }
            
            try {
                $db->beginTransaction();
                
                // Delete all existing items
                $stmt = $db->prepare('DELETE FROM shopping_items WHERE user_id = :user_id');
                $stmt->bindValue(':user_id', $userId, PDO::PARAM_INT);
                $stmt->execute();
                
                // Insert new items (now validated)
                $stmt = $db->prepare('
                    INSERT INTO shopping_items 
                    (user_id, text, quantity, unit, description, completed, added_at)
                    VALUES 
                    (:user_id, :text, :quantity, :unit, :description, :completed, NOW())
                ');
                
                foreach ($items as $item) {
                    $stmt->bindValue(':user_id', $userId, PDO::PARAM_INT);
                    $stmt->bindValue(':text', trim($item['text']), PDO::PARAM_STR);
                    $stmt->bindValue(':quantity', intval($item['quantity']), PDO::PARAM_INT);
                    $stmt->bindValue(':unit', $item['unit'] ?? 'szt', PDO::PARAM_STR);
                    $stmt->bindValue(':description', trim($item['description'] ?? ''), PDO::PARAM_STR);
                    $stmt->bindValue(':completed', boolval($item['completed'] ?? false), PDO::PARAM_BOOL);
                    $stmt->execute();
                }
                
                $db->commit();
                sendJsonResponse(['message' => 'List replaced successfully']);
                
            } catch (Exception $e) {
                $db->rollBack();
                sendJsonResponse(['error' => 'Failed to replace list: ' . $e->getMessage()], 500);
            }
            
            break;
    }
    

            
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