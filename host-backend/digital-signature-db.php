<?php
/**
 * کلاس دیتابیس امضای دیجیتال
 */

class DigitalSignatureDB {
    private $dbFile;
    private $pdo;

    public function __construct() {
        $this->dbFile = __DIR__ . '/digital-signature.db';
        $this->connect();
        $this->createTables();
    }

    private function connect() {
        try {
            $this->pdo = new PDO('sqlite:' . $this->dbFile);
            $this->pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
            $this->pdo->exec('PRAGMA foreign_keys = ON');
        } catch (PDOException $e) {
            die('خطا در اتصال به دیتابیس: ' . $e->getMessage());
        }
    }

    private function createTables() {
        $sql = "
        CREATE TABLE IF NOT EXISTS documents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            type TEXT NOT NULL,
            content TEXT NOT NULL,
            status TEXT DEFAULT 'pending',
            metadata TEXT,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS signature_requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            documentId INTEGER NOT NULL,
            signerName TEXT NOT NULL,
            signerEmail TEXT NOT NULL,
            signerPhone TEXT,
            signerNationalId TEXT,
            signatureLink TEXT NOT NULL,
            token TEXT UNIQUE NOT NULL,
            status TEXT DEFAULT 'sent',
            otpCode TEXT,
            otpExpiresAt DATETIME,
            rejectionReason TEXT,
            expiresAt DATETIME NOT NULL,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (documentId) REFERENCES documents(id)
        );

        CREATE TABLE IF NOT EXISTS signatures (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            documentId INTEGER NOT NULL,
            requestId INTEGER NOT NULL,
            signatureData TEXT NOT NULL,
            ipAddress TEXT,
            userAgent TEXT,
            iranianTimestamp TEXT,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (documentId) REFERENCES documents(id),
            FOREIGN KEY (requestId) REFERENCES signature_requests(id)
        );

        CREATE TABLE IF NOT EXISTS signature_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            requestId INTEGER NOT NULL,
            token TEXT UNIQUE NOT NULL,
            expiresAt DATETIME NOT NULL,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (requestId) REFERENCES signature_requests(id)
        );

        CREATE TABLE IF NOT EXISTS audit_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            action TEXT NOT NULL,
            entityType TEXT NOT NULL,
            entityId INTEGER NOT NULL,
            userId INTEGER,
            ipAddress TEXT,
            userAgent TEXT,
            details TEXT,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
        CREATE INDEX IF NOT EXISTS idx_requests_token ON signature_requests(token);
        CREATE INDEX IF NOT EXISTS idx_sessions_token ON signature_sessions(token);
        ";

        $this->pdo->exec($sql);
    }

    public function createDocument($data) {
        $stmt = $this->pdo->prepare("
            INSERT INTO documents (title, type, content, status, metadata)
            VALUES (:title, :type, :content, :status, :metadata)
        ");
        $stmt->execute($data);
        return $this->pdo->lastInsertId();
    }

    public function getDocument($id) {
        $stmt = $this->pdo->prepare("SELECT * FROM documents WHERE id = ?");
        $stmt->execute([$id]);
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }

    public function updateDocument($id, $data) {
        $fields = [];
        $allowedKeys = ['title', 'type', 'content', 'status', 'metadata'];
        $filteredData = [];
        foreach ($data as $key => $value) {
            if (in_array($key, $allowedKeys)) {
                $fields[] = "$key = :$key";
                $filteredData[$key] = $value;
            }
        }
        if (empty($fields)) return false;
        $sql = "UPDATE documents SET " . implode(', ', $fields) . ", updatedAt = CURRENT_TIMESTAMP WHERE id = :id";
        $filteredData['id'] = $id;
        $stmt = $this->pdo->prepare($sql);
        return $stmt->execute($filteredData);
    }

    public function createSignatureRequest($data) {
        $stmt = $this->pdo->prepare("
            INSERT INTO signature_requests 
            (documentId, signerName, signerEmail, signerPhone, signerNationalId, signatureLink, token, expiresAt, status)
            VALUES (:documentId, :signerName, :signerEmail, :signerPhone, :signerNationalId, :signatureLink, :token, :expiresAt, :status)
        ");
        $stmt->execute($data);
        return $this->pdo->lastInsertId();
    }

    public function getSignatureRequest($id) {
        $stmt = $this->pdo->prepare("SELECT * FROM signature_requests WHERE id = ?");
        $stmt->execute([$id]);
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }

    public function getSignatureRequestByToken($token) {
        $stmt = $this->pdo->prepare("SELECT * FROM signature_requests WHERE token = ?");
        $stmt->execute([$token]);
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }

    public function updateSignatureRequest($id, $data) {
        $fields = [];
        $allowedKeys = ['signerName', 'signerEmail', 'signerPhone', 'signerNationalId', 'status', 'otpCode', 'otpExpiresAt', 'rejectionReason', 'expiresAt'];
        $filteredData = [];
        foreach ($data as $key => $value) {
            if (in_array($key, $allowedKeys)) {
                $fields[] = "$key = :$key";
                $filteredData[$key] = $value;
            }
        }
        if (empty($fields)) return false;
        $sql = "UPDATE signature_requests SET " . implode(', ', $fields) . " WHERE id = :id";
        $filteredData['id'] = $id;
        $stmt = $this->pdo->prepare($sql);
        return $stmt->execute($filteredData);
    }

    public function createSignature($data) {
        $stmt = $this->pdo->prepare("
            INSERT INTO signatures (documentId, requestId, signatureData, ipAddress, userAgent, iranianTimestamp)
            VALUES (:documentId, :requestId, :signatureData, :ipAddress, :userAgent, :iranianTimestamp)
        ");
        $stmt->execute($data);
        return $this->pdo->lastInsertId();
    }

    public function getSignature($id) {
        $stmt = $this->pdo->prepare("SELECT * FROM signatures WHERE id = ?");
        $stmt->execute([$id]);
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }

    public function createSignatureSession($data) {
        $stmt = $this->pdo->prepare("
            INSERT INTO signature_sessions (requestId, token, expiresAt)
            VALUES (:requestId, :token, :expiresAt)
        ");
        $stmt->execute($data);
        return $this->pdo->lastInsertId();
    }

    public function getSignatureSession($token) {
        $stmt = $this->pdo->prepare("
            SELECT * FROM signature_sessions 
            WHERE token = ? AND expiresAt > datetime('now')
        ");
        $stmt->execute([$token]);
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }

    public function createAuditLog($data) {
        $stmt = $this->pdo->prepare("
            INSERT INTO audit_logs (action, entityType, entityId, userId, ipAddress, userAgent, details)
            VALUES (:action, :entityType, :entityId, :userId, :ipAddress, :userAgent, :details)
        ");
        $data['userId'] = $data['userId'] ?? null;
        $data['details'] = $data['details'] ?? null;
        $stmt->execute($data);
        return $this->pdo->lastInsertId();
    }

    public function getDocuments($filters = []) {
        $where = [];
        $params = [];

        if (!empty($filters['type'])) {
            $where[] = "type = :type";
            $params['type'] = $filters['type'];
        }

        if (!empty($filters['status'])) {
            $where[] = "status = :status";
            $params['status'] = $filters['status'];
        }

        $sql = "SELECT * FROM documents";
        if (!empty($where)) {
            $sql .= " WHERE " . implode(' AND ', $where);
        }
        $sql .= " ORDER BY createdAt DESC";

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
}